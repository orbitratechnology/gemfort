import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from '../admin';
import { REGION } from '../config';
import { createNotificationDoc, formatCurrency } from '../notifications/create';
import { convertToBaseServer, loadServerRates } from './exchange-rates';

type ApPaymentMethod = 'cash' | 'transfer' | 'cheque';

type ApGemLine = {
  gemId: string;
  gemLabel: string;
  agreedPrice: number;
  currency: string;
  lineStatus: 'held' | 'sold' | 'returned';
  soldPrice: number | null;
  soldToName: string | null;
  soldDate: Timestamp | null;
  ownerReceives: number | null;
  commission: number | null;
  paymentDueDate: Timestamp | null;
};

type ApDoc = {
  ownerUid: string;
  senderUid: string;
  receiverUid: string;
  receiverContactId: string;
  receiverBusinessId: string | null;
  receiverName: string;
  senderName: string;
  items: ApGemLine[];
  status: string;
  expectedReturnDate: Timestamp;
  expectedDurationDays: number;
  dateGiven: Timestamp | null;
  agreementNotes: string | null;
  paymentMethod: ApPaymentMethod | null;
  paymentAmount: number | null;
  paymentSentAt: Timestamp | null;
  paymentReceivedAt: Timestamp | null;
  paymentChequeId: string | null;
  rejectionReason: string | null;
};

function requireAuth(uid: string | undefined): string {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to continue.');
  return uid;
}

function gemLabelFromDoc(data: Record<string, unknown>, gemId: string): string {
  const sku = typeof data.sku === 'string' ? data.sku.trim() : '';
  const type = typeof data.gemType === 'string' ? data.gemType.replace(/_/g, ' ') : '';
  return sku || type || gemId.slice(0, 8);
}

async function unlockGem(gemId: string) {
  await db.collection('gemtrack_gems').doc(gemId).update({
    status: 'ready_for_sale',
    currentHolderContactId: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function writeApPaymentEvent(input: {
  apId: string;
  ownerUid: string;
  senderUid: string;
  receiverUid: string;
  actorUid: string;
  type: 'sent' | 'received';
  method: ApPaymentMethod | null;
  amount: number;
}) {
  await db.collection('gemtrack_ap_payments').add({
    ...input,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/** Create multi-gem AP request → status pending. Locks gems on_ap. */
export const createApRequest = onCall(
  { region: REGION, timeoutSeconds: 60 },
  async (request) => {
    const uid = requireAuth(request.auth?.uid);
    const data = request.data as {
      receiverContactId?: string;
      receiverBusinessId?: string | null;
      expectedDurationDays?: number;
      agreementNotes?: string | null;
      items?: { gemId: string; agreedPrice: number; currency?: string }[];
    };

    const receiverContactId = data.receiverContactId?.trim();
    const itemsIn = Array.isArray(data.items) ? data.items : [];
    const days = Math.max(1, Math.floor(Number(data.expectedDurationDays) || 30));

    if (!receiverContactId) {
      throw new HttpsError('invalid-argument', 'Select an AP holder.');
    }
    if (itemsIn.length === 0) {
      throw new HttpsError('invalid-argument', 'Select at least one gem.');
    }

    const contactSnap = await db.collection('gemtrack_contacts').doc(receiverContactId).get();
    if (!contactSnap.exists || contactSnap.data()?.ownerUid !== uid) {
      throw new HttpsError('permission-denied', 'Contact not found.');
    }
    const contact = contactSnap.data()!;
    const linkedBusinessId =
      (data.receiverBusinessId as string | null | undefined) ??
      (contact.linkedBusinessId as string | null) ??
      null;

    if (!linkedBusinessId) {
      throw new HttpsError(
        'failed-precondition',
        'AP holder must be a GemFort trader (linked by phone).',
      );
    }

    const bizSnap = await db.collection('businesses').doc(linkedBusinessId).get();
    if (!bizSnap.exists) {
      throw new HttpsError('not-found', 'Trader business profile not found.');
    }
    const biz = bizSnap.data()!;
    const receiverUid = biz.ownerUid as string;
    if (!receiverUid || receiverUid === uid) {
      throw new HttpsError('failed-precondition', 'Invalid AP receiver.');
    }

    const senderSnap = await db.collection('users').doc(uid).get();
    const senderName =
      (senderSnap.data()?.displayName as string) ||
      (biz.ownerName as string) ||
      'Trader';

    const lines: ApGemLine[] = [];
    for (const item of itemsIn) {
      const price = Number(item.agreedPrice);
      if (!item.gemId || !Number.isFinite(price) || price < 0) {
        throw new HttpsError('invalid-argument', 'Each gem needs a valid AP price.');
      }
      const gemRef = db.collection('gemtrack_gems').doc(item.gemId);
      const gemSnap = await gemRef.get();
      if (!gemSnap.exists || gemSnap.data()?.ownerUid !== uid) {
        throw new HttpsError('permission-denied', `Gem ${item.gemId} not found.`);
      }
      const gem = gemSnap.data()! as Record<string, unknown>;
      if (['on_ap', 'sold'].includes(gem.status as string)) {
        throw new HttpsError('failed-precondition', `${gemLabelFromDoc(gem, item.gemId)} is not available.`);
      }
      lines.push({
        gemId: item.gemId,
        gemLabel: gemLabelFromDoc(gem, item.gemId),
        agreedPrice: price,
        currency: item.currency?.trim() || 'LKR',
        lineStatus: 'held',
        soldPrice: null,
        soldToName: null,
        soldDate: null,
        ownerReceives: null,
        commission: null,
        paymentDueDate: null,
      });
    }

    const now = Timestamp.now();
    const expectedReturn = Timestamp.fromDate(new Date(Date.now() + days * 86400000));
    const batch = db.batch();
    const apRef = db.collection('gemtrack_ap_records').doc();

    batch.set(apRef, {
      ownerUid: uid,
      senderUid: uid,
      receiverUid,
      receiverContactId,
      receiverBusinessId: linkedBusinessId,
      receiverName: (biz.businessName as string) || (contact.displayName as string) || 'Trader',
      senderName,
      items: lines,
      status: 'pending',
      expectedReturnDate: expectedReturn,
      expectedDurationDays: days,
      dateGiven: null,
      agreementNotes: data.agreementNotes?.trim() || null,
      paymentMethod: null,
      paymentAmount: null,
      paymentSentAt: null,
      paymentReceivedAt: null,
      paymentChequeId: null,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
    } satisfies Omit<ApDoc, never> & { createdAt: Timestamp; updatedAt: Timestamp });

    for (const line of lines) {
      batch.update(db.collection('gemtrack_gems').doc(line.gemId), {
        status: 'on_ap',
        currentHolderContactId: receiverContactId,
        updatedAt: now,
      });
    }

    await batch.commit();

    await createNotificationDoc({
      recipientUid: receiverUid,
      type: 'ap_request_received',
      title: 'New AP request',
      message: `${senderName} offered ${lines.length} gem${lines.length === 1 ? '' : 's'} on AP.`,
      referenceType: 'ap',
      referenceId: apRef.id,
    });

    logger.info('createApRequest', { apId: apRef.id, uid, receiverUid, gems: lines.length });
    return { apId: apRef.id };
  },
);

/** Receiver accept / reject. */
export const respondApRequest = onCall(
  { region: REGION, timeoutSeconds: 60 },
  async (request) => {
    const uid = requireAuth(request.auth?.uid);
    const { apId, action, rejectionReason } = request.data as {
      apId?: string;
      action?: 'accepted' | 'rejected';
      rejectionReason?: string;
    };
    if (!apId || (action !== 'accepted' && action !== 'rejected')) {
      throw new HttpsError('invalid-argument', 'apId and action required.');
    }

    const ref = db.collection('gemtrack_ap_records').doc(apId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'AP not found.');
    const ap = snap.data() as ApDoc;
    if (ap.receiverUid !== uid) {
      throw new HttpsError('permission-denied', 'Only the AP holder can respond.');
    }
    if (ap.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'This AP is no longer pending.');
    }

    const now = Timestamp.now();

    if (action === 'rejected') {
      const batch = db.batch();
      batch.update(ref, {
        status: 'rejected',
        rejectionReason: rejectionReason?.trim() || null,
        updatedAt: now,
      });
      for (const line of ap.items ?? []) {
        batch.update(db.collection('gemtrack_gems').doc(line.gemId), {
          status: 'ready_for_sale',
          currentHolderContactId: null,
          updatedAt: now,
        });
      }
      await batch.commit();

      await createNotificationDoc({
        recipientUid: ap.senderUid,
        type: 'ap_request_rejected',
        title: 'AP request declined',
        message: `${ap.receiverName} declined your AP request.`,
        referenceType: 'ap',
        referenceId: apId,
      });
      return { ok: true as const, status: 'rejected' };
    }

    await ref.update({
      status: 'accepted',
      dateGiven: now,
      updatedAt: now,
    });

    await createNotificationDoc({
      recipientUid: ap.senderUid,
      type: 'ap_request_accepted',
      title: 'AP request accepted',
      message: `${ap.receiverName} accepted your AP (${(ap.items ?? []).length} gems).`,
      referenceType: 'ap',
      referenceId: apId,
    });

    return { ok: true as const, status: 'accepted' };
  },
);

/** Sender cancels while pending. */
export const cancelApRequest = onCall(
  { region: REGION, timeoutSeconds: 60 },
  async (request) => {
    const uid = requireAuth(request.auth?.uid);
    const { apId } = request.data as { apId?: string };
    if (!apId) throw new HttpsError('invalid-argument', 'apId required.');

    const ref = db.collection('gemtrack_ap_records').doc(apId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'AP not found.');
    const ap = snap.data() as ApDoc;
    if (ap.senderUid !== uid && ap.ownerUid !== uid) {
      throw new HttpsError('permission-denied', 'Only the sender can cancel.');
    }
    if (ap.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Only pending APs can be cancelled.');
    }

    const now = Timestamp.now();
    const batch = db.batch();
    batch.update(ref, { status: 'cancelled', updatedAt: now });
    for (const line of ap.items ?? []) {
      batch.update(db.collection('gemtrack_gems').doc(line.gemId), {
        status: 'ready_for_sale',
        currentHolderContactId: null,
        updatedAt: now,
      });
    }
    await batch.commit();

    await createNotificationDoc({
      recipientUid: ap.receiverUid,
      type: 'ap_request_cancelled',
      title: 'AP request cancelled',
      message: `${ap.senderName} cancelled an AP request.`,
      referenceType: 'ap',
      referenceId: apId,
    });

    return { ok: true as const };
  },
);

/** Receiver records sale for one gem line. */
export const recordApGemSale = onCall(
  { region: REGION, timeoutSeconds: 60 },
  async (request) => {
    const uid = requireAuth(request.auth?.uid);
    const data = request.data as {
      apId?: string;
      gemId?: string;
      soldPrice?: number;
      soldToName?: string;
      paymentDueDateIso?: string | null;
      ownerReceives?: number | null;
    };
    if (!data.apId || !data.gemId) {
      throw new HttpsError('invalid-argument', 'apId and gemId required.');
    }
    const soldPrice = Number(data.soldPrice);
    if (!Number.isFinite(soldPrice) || soldPrice < 0) {
      throw new HttpsError('invalid-argument', 'Enter a valid sold price.');
    }

    const ref = db.collection('gemtrack_ap_records').doc(data.apId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'AP not found.');
    const ap = snap.data() as ApDoc;
    if (ap.receiverUid !== uid) {
      throw new HttpsError('permission-denied', 'Only the AP holder can record a sale.');
    }
    if (ap.status !== 'accepted') {
      throw new HttpsError('failed-precondition', 'AP must be accepted to record sales.');
    }

    const items = [...(ap.items ?? [])];
    const idx = items.findIndex((i) => i.gemId === data.gemId);
    if (idx < 0) throw new HttpsError('not-found', 'Gem not on this AP.');
    const line = items[idx];
    if (line.lineStatus !== 'held') {
      throw new HttpsError('failed-precondition', 'This gem is no longer held on AP.');
    }

    const now = Timestamp.now();
    const ownerReceives =
      data.ownerReceives != null && Number.isFinite(Number(data.ownerReceives))
        ? Number(data.ownerReceives)
        : line.agreedPrice;
    const commission = soldPrice - ownerReceives;
    let paymentDueDate: Timestamp | null = null;
    if (data.paymentDueDateIso) {
      const d = new Date(data.paymentDueDateIso);
      if (!Number.isNaN(d.getTime())) paymentDueDate = Timestamp.fromDate(d);
    }

    items[idx] = {
      ...line,
      lineStatus: 'sold',
      soldPrice,
      soldToName: data.soldToName?.trim() || null,
      soldDate: now,
      ownerReceives,
      commission,
      paymentDueDate,
    };

    const batch = db.batch();
    batch.update(ref, { items, updatedAt: now });
    batch.update(db.collection('gemtrack_gems').doc(line.gemId), {
      status: 'sold',
      soldPrice,
      soldPriceCurrency: line.currency || 'LKR',
      soldDate: now,
      updatedAt: now,
    });
    await batch.commit();

    const saleCurrency = line.currency || 'LKR';
    const rates = await loadServerRates();
    const saleAmountBase = convertToBaseServer(soldPrice, saleCurrency, rates);

    // Receiver books sale income now
    await db.collection('gemtrack_transactions').add({
      ownerUid: uid,
      type: 'income',
      amount: soldPrice,
      currency: saleCurrency,
      amountBase: saleAmountBase,
      category: 'gem_sale',
      description: `AP sale: ${line.gemLabel}${data.soldToName ? ` → ${data.soldToName}` : ''}`,
      gemId: line.gemId,
      contactId: null,
      date: now,
      createdAt: now,
    });

    await createNotificationDoc({
      recipientUid: ap.senderUid,
      type: 'ap_gem_sold',
      title: 'AP gem sold',
      message: `${ap.receiverName} sold ${line.gemLabel} for ${formatCurrency(soldPrice, line.currency)}. You are owed ${formatCurrency(ownerReceives, line.currency)}.`,
      referenceType: 'ap',
      referenceId: data.apId,
    });

    return { ok: true as const };
  },
);

/** Return one unsold gem from an accepted AP. */
export const returnApGem = onCall(
  { region: REGION, timeoutSeconds: 60 },
  async (request) => {
    const uid = requireAuth(request.auth?.uid);
    const { apId, gemId } = request.data as { apId?: string; gemId?: string };
    if (!apId || !gemId) throw new HttpsError('invalid-argument', 'apId and gemId required.');

    const ref = db.collection('gemtrack_ap_records').doc(apId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'AP not found.');
    const ap = snap.data() as ApDoc;
    if (ap.receiverUid !== uid && ap.senderUid !== uid) {
      throw new HttpsError('permission-denied', 'Not a party to this AP.');
    }
    if (ap.status !== 'accepted') {
      throw new HttpsError('failed-precondition', 'Can only return gems on accepted APs.');
    }

    const items = [...(ap.items ?? [])];
    const idx = items.findIndex((i) => i.gemId === gemId);
    if (idx < 0) throw new HttpsError('not-found', 'Gem not on this AP.');
    if (items[idx].lineStatus !== 'held') {
      throw new HttpsError('failed-precondition', 'Only held gems can be returned.');
    }

    const now = Timestamp.now();
    items[idx] = { ...items[idx], lineStatus: 'returned' };
    await ref.update({ items, updatedAt: now });
    await unlockGem(gemId);

    return { ok: true as const };
  },
);

/** Receiver marks payment sent for sold lines. */
export const apPaymentSent = onCall(
  { region: REGION, timeoutSeconds: 60 },
  async (request) => {
    const uid = requireAuth(request.auth?.uid);
    const data = request.data as {
      apId?: string;
      method?: ApPaymentMethod;
      amount?: number;
      chequeId?: string | null;
    };
    if (!data.apId || !data.method) {
      throw new HttpsError('invalid-argument', 'apId and payment method required.');
    }
    if (!['cash', 'transfer', 'cheque'].includes(data.method)) {
      throw new HttpsError('invalid-argument', 'Invalid payment method.');
    }

    const ref = db.collection('gemtrack_ap_records').doc(data.apId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'AP not found.');
    const ap = snap.data() as ApDoc;
    if (ap.receiverUid !== uid) {
      throw new HttpsError('permission-denied', 'Only the AP holder can mark payment sent.');
    }
    if (ap.status !== 'accepted') {
      throw new HttpsError('failed-precondition', 'AP must be accepted with sales before payment.');
    }

    const sold = (ap.items ?? []).filter((i) => i.lineStatus === 'sold');
    if (sold.length === 0) {
      throw new HttpsError('failed-precondition', 'Sell at least one gem before sending payment.');
    }

    const owed = sold.reduce((s, i) => s + (i.ownerReceives ?? i.agreedPrice), 0);
    const amount = data.amount != null && Number.isFinite(Number(data.amount))
      ? Number(data.amount)
      : owed;
    const now = Timestamp.now();

    await ref.update({
      status: 'payment_sent',
      paymentMethod: data.method,
      paymentAmount: amount,
      paymentSentAt: now,
      paymentChequeId: data.chequeId ?? null,
      updatedAt: now,
    });

    await writeApPaymentEvent({
      apId: data.apId,
      ownerUid: ap.ownerUid,
      senderUid: ap.senderUid,
      receiverUid: ap.receiverUid,
      actorUid: uid,
      type: 'sent',
      method: data.method,
      amount,
    });

    await createNotificationDoc({
      recipientUid: ap.senderUid,
      type: 'ap_payment_sent',
      title: 'AP payment sent',
      message: `${ap.receiverName} sent ${formatCurrency(amount)} via ${data.method}. Confirm when received.`,
      referenceType: 'ap',
      referenceId: data.apId,
    });

    return { ok: true as const };
  },
);

/** Sender confirms payment received → done + money both sides. */
export const apPaymentReceived = onCall(
  { region: REGION, timeoutSeconds: 60 },
  async (request) => {
    const uid = requireAuth(request.auth?.uid);
    const data = request.data as {
      apId?: string;
      method?: ApPaymentMethod;
      chequeId?: string | null;
    };
    const apId = data.apId;
    if (!apId) throw new HttpsError('invalid-argument', 'apId required.');

    const ref = db.collection('gemtrack_ap_records').doc(apId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'AP not found.');
    const ap = snap.data() as ApDoc;
    if (ap.senderUid !== uid && ap.ownerUid !== uid) {
      throw new HttpsError('permission-denied', 'Only the sender can confirm payment.');
    }
    if (ap.status !== 'payment_sent') {
      throw new HttpsError('failed-precondition', 'Waiting for payment sent first.');
    }

    if (data.method && !['cash', 'transfer', 'cheque'].includes(data.method)) {
      throw new HttpsError('invalid-argument', 'Invalid payment method.');
    }

    const now = Timestamp.now();
    const amount = ap.paymentAmount ?? 0;
    const currency = (ap.items?.[0]?.currency as string) || 'LKR';
    const soldTotal = (ap.items ?? [])
      .filter((i) => i.lineStatus === 'sold')
      .reduce((s, i) => s + (i.soldPrice ?? 0), 0);
    const method = data.method ?? ap.paymentMethod;
    const chequeId = data.chequeId ?? ap.paymentChequeId ?? null;

    await ref.update({
      status: 'done',
      paymentReceivedAt: now,
      ...(data.method ? { paymentMethod: data.method } : {}),
      ...(data.chequeId !== undefined ? { paymentChequeId: chequeId } : {}),
      updatedAt: now,
    });

    await writeApPaymentEvent({
      apId,
      ownerUid: ap.ownerUid,
      senderUid: ap.senderUid,
      receiverUid: ap.receiverUid,
      actorUid: uid,
      type: 'received',
      method,
      amount,
    });

    const rates = await loadServerRates();
    const amountBase = convertToBaseServer(amount, currency, rates);

    // Sender income
    await db.collection('gemtrack_transactions').add({
      ownerUid: ap.senderUid,
      type: 'income',
      amount,
      currency,
      amountBase,
      category: 'ap_income',
      description: `AP payment from ${ap.receiverName}`,
      gemId: null,
      contactId: ap.receiverContactId,
      date: now,
      createdAt: now,
    });

    // Receiver payout expense
    await db.collection('gemtrack_transactions').add({
      ownerUid: ap.receiverUid,
      type: 'expense',
      amount,
      currency,
      amountBase,
      category: 'other_expense',
      description: `AP payout to ${ap.senderName}`,
      gemId: null,
      contactId: null,
      date: now,
      createdAt: now,
    });

    await createNotificationDoc({
      recipientUid: ap.receiverUid,
      type: 'ap_payment_received',
      title: 'AP payment confirmed',
      message: `${ap.senderName} confirmed receipt of ${formatCurrency(amount, currency)}. AP complete (sold ${formatCurrency(soldTotal, currency)}).`,
      referenceType: 'ap',
      referenceId: apId,
    });

    return { ok: true as const };
  },
);
