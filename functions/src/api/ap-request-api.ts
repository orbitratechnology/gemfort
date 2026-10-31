import { createHash } from 'node:crypto';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { ApiError } from './errors';
import { db } from '../admin';
import { isLiveUid } from '../account/deleted-uid';
import { ensureDeterministicNotificationDoc } from '../notifications/create';
import { convertToBaseServer, loadServerRates } from '../gemtrack/exchange-rates';
import {
  assertGemAvailableForAp,
  isGemLockedByAp,
  releaseGemFromApUpdate,
  snapshotGemForAp,
  type ApGemSnapshot,
} from '../gemtrack/ap-custody';
import { ACTIVE_AP_STATUSES, apOwedAmount, apSettlementStatus } from '../gemtrack/ap-balance';
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
  previousGemState?: ApGemSnapshot | null;
};

type ApDoc = ApMutationFixture & {
  receiverContactId?: string | null;
  receiverBusinessId?: string | null;
  receiverName?: string | null;
  senderName?: string | null;
  items?: ApGemLine[];
  rejectionReason?: string | null;
  paymentCurrency?: string | null;
  amountPaid?: number | null;
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

const SUPPORTED_CURRENCIES = new Set([
  'LKR', 'RMB', 'USD', 'EUR', 'GBP', 'THB', 'AED', 'AUD', 'SGD', 'TZS', 'MGA', 'IDR',
]);

function normalizeCurrency(value: unknown): string | undefined {
  const normalized = normalizeOptionalString(value, 'currency', 6);
  if (!normalized) return undefined;
  const code = normalized.toUpperCase() === 'CNY' || normalized.toUpperCase() === 'CNH'
    ? 'RMB'
    : normalized.toUpperCase();
  if (!SUPPORTED_CURRENCIES.has(code)) {
    throw new ApiError('invalid-argument', `Unsupported currency: ${normalized}.`);
  }
  return code;
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
    const currency = normalizeCurrency(item.currency);
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
  const gemRefs = input.items.map((item) => db.collection('gemtrack_gems').doc(item.gemId));
  const senderBusinessSnap = await db
    .collection('businesses')
    .where('ownerUid', '==', uid)
    .limit(1)
    .get();
  const senderBusinessName =
    (senderBusinessSnap.docs[0]?.data()?.businessName as string | undefined)?.trim() ||
    'Trader';
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

    const transactionSnaps = await transaction.getAll(businessRef, ...gemRefs);
    const businessSnap = transactionSnaps[0]!;
    const gemSnaps = transactionSnaps.slice(1);

    if (!businessSnap.exists) throw new ApiError('not-found', 'Trader business profile not found.');
    const business = businessSnap.data()!;
    const receiverUid = typeof business.ownerUid === 'string' ? business.ownerUid : '';
    if (!receiverUid || receiverUid === uid) {
      throw new ApiError('failed-precondition', 'Invalid AP receiver.');
    }

    const senderName = senderBusinessName;
    const lines: ApGemLine[] = [];
    for (let index = 0; index < input.items.length; index += 1) {
      const item = input.items[index]!;
      const gemSnap = gemSnaps[index]!;
      if (!gemSnap.exists || gemSnap.data()?.ownerUid !== uid) {
        throw new ApiError('permission-denied', `Gem ${item.gemId} not found.`);
      }
      const gem = gemSnap.data()! as Record<string, unknown>;
      assertGemAvailableForAp(gem, gemLabelFromDoc(gem, item.gemId));
      const currency = normalizeCurrency(item.currency) || 'LKR';
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
        previousGemState: snapshotGemForAp(gem),
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
        custody: 'on_ap',
        currentLocation: 'AP',
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
    direction: 'taken',
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
          direction: 'given' as const,
          actorName: ap.receiverName || 'Trader',
        },
      };
    }

    const now = Timestamp.now();
    const gemRefs = action === 'rejected'
      ? (ap.items ?? []).map((item) => db.collection('gemtrack_gems').doc(item.gemId))
      : [];
    const gemSnaps = gemRefs.length > 0 ? await transaction.getAll(...gemRefs) : [];
    transaction.update(ref, {
      status: decision.status,
      ...(action === 'rejected' ? { rejectionReason: rejectionReason?.trim() || null } : { dateGiven: now }),
      updatedAt: now,
    });
    // Release only gems this AP actually locked. A gem id that never belonged
    // to the sender (or has moved on) is skipped instead of wedging the reject.
    for (let index = 0; index < gemRefs.length; index += 1) {
      if (!isGemLockedByAp(gemSnaps[index]!, ref.id, ap.ownerUid)) continue;
      transaction.update(
        gemRefs[index]!,
        releaseGemFromApUpdate((ap.items ?? [])[index]?.previousGemState, now),
      );
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
        direction: 'given' as const,
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
          direction: 'taken' as const,
        },
      };
    }

    const now = Timestamp.now();
    const gemRefs = (ap.items ?? []).map((item) => db.collection('gemtrack_gems').doc(item.gemId));
    const gemSnaps = gemRefs.length > 0 ? await transaction.getAll(...gemRefs) : [];
    transaction.update(ref, { status: decision.status, updatedAt: now });
    for (let index = 0; index < gemRefs.length; index += 1) {
      if (!isGemLockedByAp(gemSnaps[index]!, ref.id, ap.ownerUid)) continue;
      transaction.update(
        gemRefs[index]!,
        releaseGemFromApUpdate((ap.items ?? [])[index]?.previousGemState, now),
      );
    }
    return {
      status: decision.status,
      notification: {
        recipientUid: ap.receiverUid,
        type: 'ap_request_cancelled' as const,
        title: 'AP request cancelled',
        message: `${ap.senderName || 'Trader'} cancelled an AP request.`,
        direction: 'taken' as const,
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
  const rates = await loadServerRates();
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new ApiError('not-found', 'AP not found.');
    const ap = snap.data() as ApDoc;
    if (!canActOnAp('return', fixtureFromAp(ap), uid)) {
      throw new ApiError('permission-denied', 'Not a party to this AP.');
    }
    if (!ACTIVE_AP_STATUSES.has(ap.status)) {
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
    // The sender may have deleted their account (gem gone, owner detached);
    // the holder can still close the line out.
    const ownerGone = !isLiveUid(ap.ownerUid);
    const lockedHere = isGemLockedByAp(gemSnap, id, ap.ownerUid);
    if (!lockedHere && !ownerGone) {
      throw new ApiError('failed-precondition', 'The AP gem could not be verified.');
    }
    const now = Timestamp.now();
    const previousGemState = items[index]!.previousGemState;
    items[index] = { ...items[index]!, lineStatus: 'returned' };
    // The AP only closes once nothing is held and nothing is still owed.
    const settlementCurrency = (ap.paymentCurrency?.trim() || items[index]!.currency || 'LKR').toUpperCase();
    const owed = apOwedAmount(items, settlementCurrency, rates);
    const amountPaid = typeof ap.amountPaid === 'number' ? ap.amountPaid : 0;
    transaction.update(ref, {
      items,
      status: apSettlementStatus({ lines: items, owed, amountPaid }),
      updatedAt: now,
    });
    if (lockedHere) {
      transaction.update(gemRef, releaseGemFromApUpdate(previousGemState, now));
    }
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

  // Deleting only hides the AP from this party's lists. The record, its
  // payment events, and the ledger transactions that reference it are kept
  // so neither party's financial history loses its source.
  await ref.update({
    hiddenFor: FieldValue.arrayUnion(uid),
    updatedAt: Timestamp.now(),
  });
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
