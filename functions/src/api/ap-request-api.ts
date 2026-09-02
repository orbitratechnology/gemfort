import { createHash } from 'node:crypto';

import { Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore';

import { ApiError } from './errors';
import { db } from '../admin';
import { ensureDeterministicNotificationDoc } from '../notifications/create';
import { convertToBaseServer, loadServerRates } from '../gemtrack/exchange-rates';
import {
  canActOnAp,
  decideApStatusTransition,
  type ApMutationFixture,
  type MutationDecision,
} from '../gemtrack/mutation-contract';

type ApGemLine = {
  gemId: string;
  gemLabel: string;
  agreedPrice: number;
  currency: string;
  agreedPriceBase: number;
  lineStatus: 'held' | 'sold' | 'returned';
  soldPrice: number | null;
  soldPriceBase?: number | null;
  soldToName: string | null;
  soldDate: Timestamp | null;
  ownerReceives: number | null;
  ownerReceivesBase?: number | null;
  commissionBase?: number | null;
  commission: number | null;
  paymentDueDate: Timestamp | null;
};

type ApDoc = ApMutationFixture & {
  receiverContactId?: string | null;
  receiverBusinessId?: string | null;
  receiverName?: string | null;
  senderName?: string | null;
  items?: ApGemLine[];
  rejectionReason?: string | null;
};

export type CreateApRequestInput = {
  receiverContactId: string;
  receiverBusinessId?: string | null;
  expectedDurationDays: number;
  agreementNotes?: string | null;
  items: Array<{ gemId: string; agreedPrice: number; currency?: string }>;
};

export type ApLifecycleResult = {
  ok: true;
  status?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertId(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new ApiError('invalid-argument', `${name} is required.`);
  const normalized = value.trim();
  if (!normalized || normalized.includes('/')) {
    throw new ApiError('invalid-argument', `A valid ${name} is required.`);
  }
  return normalized;
}

function normalizeOptionalString(value: unknown, name: string, maxLength: number): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new ApiError('invalid-argument', `${name} is invalid.`);
  }
  return value.trim() || null;
}

function gemLabelFromDoc(data: Record<string, unknown>, gemId: string): string {
  const sku = typeof data.sku === 'string' ? data.sku.trim() : '';
  const type = typeof data.gemType === 'string' ? data.gemType.replace(/_/g, ' ') : '';
  return sku || type || gemId.slice(0, 8);
}

export function parseCreateApRequestInput(value: unknown): CreateApRequestInput {
  if (!isObject(value)) {
    throw new ApiError('invalid-argument', 'Request body must be a JSON object.');
  }

  const receiverContactId = assertId(value.receiverContactId, 'receiverContactId');
  const rawItems = value.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 100) {
    throw new ApiError('invalid-argument', 'Select between one and 100 gems.');
  }

  const seenGemIds = new Set<string>();
  const items = rawItems.map((item) => {
    if (!isObject(item)) throw new ApiError('invalid-argument', 'Each gem needs a valid AP price.');
    const gemId = assertId(item.gemId, 'gemId');
    if (seenGemIds.has(gemId)) {
      throw new ApiError('invalid-argument', 'A gem can only appear once in an AP request.');
    }
    seenGemIds.add(gemId);
    const agreedPrice = Number(item.agreedPrice);
    if (!Number.isFinite(agreedPrice) || agreedPrice < 0) {
      throw new ApiError('invalid-argument', 'Each gem needs a valid AP price.');
    }
    const currency = item.currency == null ? undefined : normalizeOptionalString(item.currency, 'currency', 6);
    return { gemId, agreedPrice, ...(currency ? { currency } : {}) };
  });

  const durationValue = Number(value.expectedDurationDays);
  const expectedDurationDays = Number.isFinite(durationValue) && durationValue > 0
    ? Math.min(3650, Math.floor(durationValue))
    : 30;
  const receiverBusinessId = value.receiverBusinessId == null
    ? null
    : assertId(value.receiverBusinessId, 'receiverBusinessId');
  const agreementNotes = normalizeOptionalString(value.agreementNotes, 'agreementNotes', 2000);

  return {
    receiverContactId,
    receiverBusinessId,
    expectedDurationDays,
    agreementNotes,
    items,
  };
}

function fixtureFromAp(ap: ApDoc): ApMutationFixture {
  return {
    ownerUid: ap.ownerUid,
    senderUid: ap.senderUid,
    receiverUid: ap.receiverUid,
    status: ap.status,
  };
}

function throwDecision(decision: Extract<MutationDecision, { kind: 'reject' }>): never {
  throw new ApiError(decision.code, decision.message);
}

function parseAction(value: unknown): 'accepted' | 'rejected' {
  if (value !== 'accepted' && value !== 'rejected') {
    throw new ApiError('invalid-argument', 'action must be accepted or rejected.');
  }
  return value;
}

export async function createApRequestForApi(
  uid: string,
  input: CreateApRequestInput,
  idempotencyKey?: string,
): Promise<{ apId: string }> {
  const rates = await loadServerRates();
  const contactRef = db.collection('gemtrack_contacts').doc(input.receiverContactId);
  const contactSnap = await contactRef.get();
  if (!contactSnap.exists || contactSnap.data()?.ownerUid !== uid) {
    throw new ApiError('permission-denied', 'Contact not found.');
  }

  const contact = contactSnap.data()!;
  const linkedBusinessId = input.receiverBusinessId ?? (contact.linkedBusinessId as string | null) ?? null;
  if (!linkedBusinessId) {
    throw new ApiError('failed-precondition', 'AP holder must be a GemFort trader (linked by phone).');
  }

  const businessRef = db.collection('businesses').doc(linkedBusinessId);
  const senderRef = db.collection('users').doc(uid);
  const gemRefs = input.items.map((item) => db.collection('gemtrack_gems').doc(item.gemId));
  const apRef = idempotencyKey
    ? db
        .collection('gemtrack_ap_records')
        .doc(`api-${createHash('sha256').update(`${uid}\u001f${idempotencyKey}`).digest('hex').slice(0, 40)}`)
    : db.collection('gemtrack_ap_records').doc();

  const result = await db.runTransaction(async (transaction) => {
    const existingApSnap = await transaction.get(apRef);
    if (existingApSnap.exists) {
      const existingAp = existingApSnap.data() as ApDoc;
      if (existingAp.senderUid !== uid) {
        throw new ApiError('already-exists', 'This AP request already exists.');
      }
      return {
        apId: apRef.id,
        receiverUid: existingAp.receiverUid,
        senderName: existingAp.senderName || 'Trader',
        lineCount: existingAp.items?.length ?? 0,
      };
    }

    const businessSnap = await transaction.get(businessRef);
    const senderSnap = await transaction.get(senderRef);
    const gemSnaps: DocumentSnapshot[] = [];
    for (const gemRef of gemRefs) gemSnaps.push(await transaction.get(gemRef));

    if (!businessSnap.exists) throw new ApiError('not-found', 'Trader business profile not found.');
    const business = businessSnap.data()!;
    const receiverUid = typeof business.ownerUid === 'string' ? business.ownerUid : '';
    if (!receiverUid || receiverUid === uid) {
      throw new ApiError('failed-precondition', 'Invalid AP receiver.');
    }

    const senderName =
      (senderSnap.data()?.displayName as string | undefined)?.trim() ||
      (business.ownerName as string | undefined)?.trim() ||
      'Trader';
    const lines: ApGemLine[] = [];
    for (let index = 0; index < input.items.length; index += 1) {
      const item = input.items[index]!;
      const gemSnap = gemSnaps[index]!;
      if (!gemSnap.exists || gemSnap.data()?.ownerUid !== uid) {
        throw new ApiError('permission-denied', `Gem ${item.gemId} not found.`);
      }
      const gem = gemSnap.data()! as Record<string, unknown>;
      if (['on_ap', 'sold'].includes(gem.status as string)) {
        throw new ApiError('failed-precondition', `${gemLabelFromDoc(gem, item.gemId)} is not available.`);
      }
      const currency = item.currency?.trim() || 'LKR';
      lines.push({
        gemId: item.gemId,
        gemLabel: gemLabelFromDoc(gem, item.gemId),
        agreedPrice: item.agreedPrice,
        currency,
        agreedPriceBase: convertToBaseServer(item.agreedPrice, currency, rates),
        lineStatus: 'held',
        soldPrice: null,
        soldPriceBase: null,
        soldToName: null,
        soldDate: null,
        ownerReceives: null,
        ownerReceivesBase: null,
        commission: null,
        commissionBase: null,
        paymentDueDate: null,
      });
    }

    const now = Timestamp.now();
    transaction.create(apRef, {
      ownerUid: uid,
      senderUid: uid,
      receiverUid,
      receiverContactId: input.receiverContactId,
      receiverBusinessId: linkedBusinessId,
      receiverName: (business.businessName as string) || (contact.displayName as string) || 'Trader',
      senderName,
      items: lines,
      status: 'pending',
      expectedReturnDate: Timestamp.fromDate(
        new Date(Date.now() + input.expectedDurationDays * 86400000),
      ),
      expectedDurationDays: input.expectedDurationDays,
      dateGiven: null,
      agreementNotes: input.agreementNotes,
      paymentMethod: null,
      paymentAmount: null,
      paymentSentAt: null,
      paymentReceivedAt: null,
      paymentChequeId: null,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
    });

    for (const line of lines) {
      transaction.update(db.collection('gemtrack_gems').doc(line.gemId), {
        status: 'on_ap',
        currentHolderContactId: input.receiverContactId,
        currentApId: apRef.id,
        updatedAt: now,
      });
    }

    return { apId: apRef.id, receiverUid, senderName, lineCount: lines.length };
  });

  await ensureDeterministicNotificationDoc({
    recipientUid: result.receiverUid,
    type: 'ap_request_received',
    title: 'New AP request',
    message: `${result.senderName} offered ${result.lineCount} gem${result.lineCount === 1 ? '' : 's'} on AP.`,
    referenceType: 'ap',
    referenceId: result.apId,
    actorName: result.senderName,
  });

  return { apId: result.apId };
}

export async function respondApRequestForApi(
  apId: string,
  uid: string,
  action: 'accepted' | 'rejected',
  rejectionReason?: string | null,
): Promise<ApLifecycleResult> {
  const ref = db.collection('gemtrack_ap_records').doc(assertId(apId, 'apId'));
  const result = await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new ApiError('not-found', 'AP not found.');
    const ap = snap.data() as ApDoc;
    if (!canActOnAp('respond', fixtureFromAp(ap), uid)) {
      throw new ApiError('permission-denied', 'Only the AP holder can respond.');
    }
    const decision = decideApStatusTransition(
      action === 'accepted' ? 'respond-accepted' : 'respond-rejected',
      ap.status,
    );
    if (decision.kind === 'reject') throwDecision(decision);
    if (decision.kind === 'replay') {
      return {
        status: decision.status,
        notification: {
          recipientUid: ap.senderUid,
          type: action === 'accepted' ? ('ap_request_accepted' as const) : ('ap_request_rejected' as const),
          title: action === 'accepted' ? 'AP request accepted' : 'AP request declined',
          message: action === 'accepted'
            ? `${ap.receiverName || 'Trader'} accepted your AP (${(ap.items ?? []).length} gems).`
            : `${ap.receiverName || 'Trader'} declined your AP request.`,
          actorName: ap.receiverName || 'Trader',
        },
      };
    }

    const now = Timestamp.now();
    const gemRefs = action === 'rejected'
      ? (ap.items ?? []).map((item) => db.collection('gemtrack_gems').doc(item.gemId))
      : [];
    const gemSnaps: DocumentSnapshot[] = [];
    for (const gemRef of gemRefs) gemSnaps.push(await transaction.get(gemRef));
    transaction.update(ref, {
      status: decision.status,
      ...(action === 'rejected' ? { rejectionReason: rejectionReason?.trim() || null } : { dateGiven: now }),
      updatedAt: now,
    });
    for (let index = 0; index < gemRefs.length; index += 1) {
      const gemSnap = gemSnaps[index]!;
      if (!gemSnap.exists || gemSnap.data()?.ownerUid !== ap.ownerUid) {
        throw new ApiError('failed-precondition', 'An AP gem could not be verified.');
      }
      transaction.update(gemRefs[index]!, {
        status: 'ready_for_sale',
        currentHolderContactId: null,
        currentApId: null,
        updatedAt: now,
      });
    }
    return {
      status: decision.status,
      notification: {
        recipientUid: ap.senderUid,
        type: action === 'accepted' ? ('ap_request_accepted' as const) : ('ap_request_rejected' as const),
        title: action === 'accepted' ? 'AP request accepted' : 'AP request declined',
        message: action === 'accepted'
          ? `${ap.receiverName || 'Trader'} accepted your AP (${(ap.items ?? []).length} gems).`
          : `${ap.receiverName || 'Trader'} declined your AP request.`,
        actorName: ap.receiverName || 'Trader',
      },
    };
  });

  if (result.notification) {
    await ensureDeterministicNotificationDoc({
      ...result.notification,
      referenceType: 'ap',
      referenceId: ref.id,
    });
  }
  return { ok: true, status: result.status };
}

export async function cancelApRequestForApi(apId: string, uid: string): Promise<ApLifecycleResult> {
  const ref = db.collection('gemtrack_ap_records').doc(assertId(apId, 'apId'));
  const result = await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new ApiError('not-found', 'AP not found.');
    const ap = snap.data() as ApDoc;
    if (!canActOnAp('cancel', fixtureFromAp(ap), uid)) {
      throw new ApiError('permission-denied', 'Only the sender can cancel.');
    }
    const decision = decideApStatusTransition('cancel', ap.status);
    if (decision.kind === 'reject') throwDecision(decision);
    if (decision.kind === 'replay') {
      return {
        status: decision.status,
        notification: {
          recipientUid: ap.receiverUid,
          type: 'ap_request_cancelled' as const,
          title: 'AP request cancelled',
          message: `${ap.senderName || 'Trader'} cancelled an AP request.`,
        },
      };
    }

    const now = Timestamp.now();
    const gemRefs = (ap.items ?? []).map((item) => db.collection('gemtrack_gems').doc(item.gemId));
    const gemSnaps: DocumentSnapshot[] = [];
    for (const gemRef of gemRefs) gemSnaps.push(await transaction.get(gemRef));
    transaction.update(ref, { status: decision.status, updatedAt: now });
    for (let index = 0; index < gemRefs.length; index += 1) {
      const gemSnap = gemSnaps[index]!;
      if (gemSnap.exists && gemSnap.data()?.ownerUid === ap.ownerUid) {
        transaction.update(gemRefs[index]!, {
          status: 'ready_for_sale',
          currentHolderContactId: null,
          currentApId: null,
          updatedAt: now,
        });
      }
    }
    return {
      status: decision.status,
      notification: {
        recipientUid: ap.receiverUid,
        type: 'ap_request_cancelled' as const,
        title: 'AP request cancelled',
        message: `${ap.senderName || 'Trader'} cancelled an AP request.`,
      },
    };
  });

  if (result.notification) {
    await ensureDeterministicNotificationDoc({
      ...result.notification,
      referenceType: 'ap',
      referenceId: ref.id,
    });
  }
  return { ok: true, status: result.status };
}

export async function returnApGemForApi(
  apId: string,
  uid: string,
  gemId: string,
): Promise<ApLifecycleResult> {
  const id = assertId(apId, 'apId');
  const gem = assertId(gemId, 'gemId');
  const ref = db.collection('gemtrack_ap_records').doc(id);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new ApiError('not-found', 'AP not found.');
    const ap = snap.data() as ApDoc;
    if (!canActOnAp('return', fixtureFromAp(ap), uid)) {
      throw new ApiError('permission-denied', 'Not a party to this AP.');
    }
    if (ap.status !== 'accepted') {
      throw new ApiError('failed-precondition', 'Can only return gems on accepted APs.');
    }
    const items = [...(ap.items ?? [])];
    const index = items.findIndex((item) => item.gemId === gem);
    if (index < 0) throw new ApiError('not-found', 'Gem not on this AP.');
    if (items[index]!.lineStatus === 'returned') return;
    if (items[index]!.lineStatus !== 'held') {
      throw new ApiError('failed-precondition', 'Only held gems can be returned.');
    }
    const gemRef = db.collection('gemtrack_gems').doc(gem);
    const gemSnap = await transaction.get(gemRef);
    if (!gemSnap.exists || gemSnap.data()?.ownerUid !== ap.ownerUid) {
      throw new ApiError('failed-precondition', 'The AP gem could not be verified.');
    }
    const now = Timestamp.now();
    items[index] = { ...items[index]!, lineStatus: 'returned' };
    transaction.update(ref, { items, updatedAt: now });
    transaction.update(gemRef, {
      status: 'ready_for_sale',
      currentHolderContactId: null,
      currentApId: null,
      updatedAt: now,
    });
  });
  return { ok: true };
}

export async function deleteApRecordForApi(apId: string, uid: string): Promise<ApLifecycleResult> {
  const id = assertId(apId, 'apId');
  const ref = db.collection('gemtrack_ap_records').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new ApiError('not-found', 'AP not found.');
  const ap = snap.data() as ApDoc;
  if (!canActOnAp('delete', fixtureFromAp(ap), uid)) {
    throw new ApiError('permission-denied', 'Not a party to this AP.');
  }
  if (!new Set(['done', 'cancelled', 'rejected']).has(ap.status)) {
    throw new ApiError('failed-precondition', 'Only completed or cancelled APs can be deleted.');
  }

  const payments = await db.collection('gemtrack_ap_payments').where('apId', '==', id).get();
  for (let start = 0; start < payments.docs.length; start += 400) {
    const batch = db.batch();
    for (const payment of payments.docs.slice(start, start + 400)) batch.delete(payment.ref);
    if (start + 400 >= payments.docs.length) batch.delete(ref);
    await batch.commit();
  }
  if (payments.docs.length === 0) await db.batch().delete(ref).commit();
  return { ok: true };
}

export function parseRespondApRequestInput(value: unknown): {
  action: 'accepted' | 'rejected';
  rejectionReason?: string | null;
} {
  if (!isObject(value)) throw new ApiError('invalid-argument', 'Request body must be a JSON object.');
  return {
    action: parseAction(value.action),
    rejectionReason: normalizeOptionalString(value.rejectionReason, 'rejectionReason', 2000),
  };
}

export function parseReturnApGemInput(value: unknown): { gemId: string } {
  if (!isObject(value)) throw new ApiError('invalid-argument', 'Request body must be a JSON object.');
  return { gemId: assertId(value.gemId, 'gemId') };
}
