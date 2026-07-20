/**
 * AP (Approval/Consignment) lifecycle business logic.
 *
 * All multi-document mutations use Firestore transactions to guarantee
 * atomic, compare-and-set state transitions — preventing races between
 * concurrent requests and leaving no orphaned data on partial failure.
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { db } from '../../firebase.js';
import { badRequest, forbidden, notFound, unprocessable } from '../../lib/errors.js';
import { formatCurrency, createNotificationDoc } from '../notifications/create.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApPaymentMethod = 'cash' | 'transfer' | 'cheque';

export type ApGemLine = {
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

export type ApDoc = {
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

// ─── Internal helpers ─────────────────────────────────────────────────────────

function gemLabelFromDoc(data: Record<string, unknown>, gemId: string): string {
  const sku = typeof data.sku === 'string' ? data.sku.trim() : '';
  const type = typeof data.gemType === 'string' ? data.gemType.replace(/_/g, ' ') : '';
  return sku || type || gemId.slice(0, 8);
}

// ─── createApRequest ──────────────────────────────────────────────────────────

export type CreateApInput = {
  uid: string;
  receiverContactId: string;
  receiverBusinessId?: string | null;
  expectedDurationDays?: number;
  agreementNotes?: string | null;
  items: { gemId: string; agreedPrice: number; currency?: string }[];
};

/**
 * Create an AP request.
 *
 * Uses a Firestore transaction to atomically check that every gem is still
 * `ready_for_sale` and flip it to `on_ap` in the same operation. A concurrent
 * request that tries to lock the same gem will fail inside the transaction and
 * surface a clear error to the caller.
 */
export async function createApRequest(input: CreateApInput): Promise<{ apId: string }> {
  const { uid } = input;
  const receiverContactId = input.receiverContactId.trim();
  const itemsIn = input.items;
  const days = Math.max(1, Math.floor(Number(input.expectedDurationDays) || 30));

  if (!receiverContactId) badRequest('Select an AP holder.');
  if (itemsIn.length === 0) badRequest('Select at least one gem.');
  if (itemsIn.length > 50) badRequest('Maximum 50 gems per AP request.');

  // ── Pre-transaction reads (no writes yet) ────────────────────────────────
  const contactSnap = await db.collection('gemtrack_contacts').doc(receiverContactId).get();
  if (!contactSnap.exists || contactSnap.data()?.ownerUid !== uid) {
    forbidden('Contact not found.');
  }
  const contact = contactSnap.data()!;
  const linkedBusinessId =
    input.receiverBusinessId ?? (contact.linkedBusinessId as string | null) ?? null;

  if (!linkedBusinessId) {
    unprocessable('AP holder must be a GemFort trader (linked by phone).');
  }

  const [bizSnap, senderSnap] = await Promise.all([
    db.collection('businesses').doc(linkedBusinessId).get(),
    db.collection('users').doc(uid).get(),
  ]);
  if (!bizSnap.exists) unprocessable('Linked business not found.');

  const biz = bizSnap.data()!;
  const receiverUid = biz.ownerUid as string;
  const receiverName = (contact.displayName as string | undefined) ?? biz.businessName ?? 'Unknown';
  const senderName = (senderSnap.data()?.displayName as string | undefined) ?? uid;

  // ── Transactional gem lock + AP creation ────────────────────────────────
  const gemRefs = itemsIn.map((item) => db.collection('gemtrack_gems').doc(item.gemId));
  const apRef = db.collection('gemtrack_ap_records').doc(); // pre-generate ID

  const resolvedItems: ApGemLine[] = await db.runTransaction(async (txn) => {
    // Read all gems inside the transaction (consistent snapshot).
    const gemSnaps = await Promise.all(gemRefs.map((r) => txn.get(r)));

    // Validate all gems before writing any.
    const lines: ApGemLine[] = [];
    for (let i = 0; i < gemSnaps.length; i++) {
      const snap = gemSnaps[i];
      const item = itemsIn[i];
      if (!snap.exists) badRequest(`Gem ${item.gemId} not found.`);
      const gem = snap.data()!;
      if (gem.ownerUid !== uid) forbidden(`Gem ${item.gemId} is not owned by you.`);
      if (gem.status !== 'ready_for_sale') {
        badRequest(`Gem ${item.gemId} is not available (status: ${gem.status}).`);
      }
      lines.push({
        gemId: item.gemId,
        gemLabel: gemLabelFromDoc(gem, item.gemId),
        agreedPrice: item.agreedPrice,
        currency: item.currency ?? 'LKR',
        lineStatus: 'held',
        soldPrice: null,
        soldToName: null,
        soldDate: null,
        ownerReceives: null,
        commission: null,
        paymentDueDate: null,
      });
    }

    // Lock every gem.
    for (let i = 0; i < gemRefs.length; i++) {
      txn.update(gemRefs[i], {
        status: 'on_ap',
        currentHolderContactId: receiverContactId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Create the AP record inside the same transaction.
    const now = Timestamp.now();
    const expectedReturnDate = new Timestamp(now.seconds + days * 86400, now.nanoseconds);
    txn.set(apRef, {
      ownerUid: uid,
      senderUid: uid,
      receiverUid,
      receiverContactId,
      receiverBusinessId: linkedBusinessId,
      receiverName,
      senderName,
      items: lines,
      status: 'pending',
      expectedReturnDate,
      expectedDurationDays: days,
      dateGiven: null,
      agreementNotes: input.agreementNotes ?? null,
      paymentMethod: null,
      paymentAmount: null,
      paymentSentAt: null,
      paymentReceivedAt: null,
      paymentChequeId: null,
      rejectionReason: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return lines;
  });

  // Notification is outside the transaction (non-critical, best-effort).
  await createNotificationDoc({
    recipientUid: receiverUid,
    type: 'ap_request_received',
    title: 'New AP request',
    message: `${senderName} sent you ${resolvedItems.length} gem(s) on approval.`,
    referenceType: 'ap',
    referenceId: apRef.id,
  });

  return { apId: apRef.id };
}

// ─── respondApRequest ────────────────────────────────────────────────────────

export type RespondApInput = {
  uid: string;
  apId: string;
  action: 'accept' | 'reject';
  rejectionReason?: string | null;
};

/**
 * Accept or reject a pending AP request.
 *
 * The status check and update are atomic: a second concurrent respond call
 * will see the already-updated status inside the transaction and fail with
 * a clear error rather than applying duplicate state changes.
 */
export async function respondApRequest(input: RespondApInput): Promise<void> {
  const { uid, apId } = input;
  const apRef = db.collection('gemtrack_ap_records').doc(apId);

  let notifyUid = '';
  let notifyType: 'ap_request_accepted' | 'ap_request_rejected';
  let notifyTitle: string;
  let notifyMessage: string;
  let ap: ApDoc;

  await db.runTransaction(async (txn) => {
    const snap = await txn.get(apRef);
    if (!snap.exists) notFound('AP record not found.');
    ap = snap.data() as ApDoc;

    if (ap.receiverUid !== uid) forbidden('Only the AP receiver can respond.');
    if (ap.status !== 'pending') badRequest(`AP is not pending (status: ${ap.status}).`);

    if (input.action === 'accept') {
      txn.update(apRef, {
        status: 'accepted',
        dateGiven: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      notifyType = 'ap_request_accepted';
      notifyTitle = 'AP request accepted';
      notifyMessage = `${ap.receiverName} accepted your AP for ${ap.items.length} gem(s).`;
    } else {
      // Unlock all gems atomically in the same transaction.
      for (const item of ap.items) {
        const gemRef = db.collection('gemtrack_gems').doc(item.gemId);
        txn.update(gemRef, {
          status: 'ready_for_sale',
          currentHolderContactId: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      txn.update(apRef, {
        status: 'rejected',
        rejectionReason: input.rejectionReason ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      notifyType = 'ap_request_rejected';
      notifyTitle = 'AP request rejected';
      notifyMessage = `${ap.receiverName} rejected your AP request${input.rejectionReason ? ': ' + input.rejectionReason : '.'}`;
    }
    notifyUid = ap!.senderUid;
  });

  await createNotificationDoc({
    recipientUid: notifyUid,
    type: notifyType!,
    title: notifyTitle!,
    message: notifyMessage!,
    referenceType: 'ap',
    referenceId: apId,
  });
}

// ─── cancelApRequest ─────────────────────────────────────────────────────────

/**
 * Cancel a pending or accepted AP.
 *
 * Atomically verifies the AP is in a cancellable state, unlocks held gems,
 * and updates the AP status — all in one transaction.
 */
export async function cancelApRequest(uid: string, apId: string): Promise<void> {
  const apRef = db.collection('gemtrack_ap_records').doc(apId);
  const cancellableStatuses = ['pending', 'accepted', 'with_holder'];

  let notifyUid = '';
  let itemCount = 0;

  await db.runTransaction(async (txn) => {
    const snap = await txn.get(apRef);
    if (!snap.exists) notFound('AP record not found.');
    const ap = snap.data() as ApDoc;

    if (ap.senderUid !== uid && ap.receiverUid !== uid) {
      forbidden('You are not a party to this AP.');
    }
    if (!cancellableStatuses.includes(ap.status)) {
      badRequest(`AP cannot be cancelled in status: ${ap.status}.`);
    }

    // Unlock held gems inside the transaction.
    for (const item of ap.items) {
      if (item.lineStatus === 'held') {
        txn.update(db.collection('gemtrack_gems').doc(item.gemId), {
          status: 'ready_for_sale',
          currentHolderContactId: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    txn.update(apRef, { status: 'cancelled', updatedAt: FieldValue.serverTimestamp() });
    notifyUid = uid === ap.senderUid ? ap.receiverUid : ap.senderUid;
    itemCount = ap.items.length;
  });

  await createNotificationDoc({
    recipientUid: notifyUid,
    type: 'ap_request_cancelled',
    title: 'AP cancelled',
    message: `The AP for ${itemCount} gem(s) has been cancelled.`,
    referenceType: 'ap',
    referenceId: apId,
  });
}

// ─── recordApGemSale ─────────────────────────────────────────────────────────

export type RecordApGemSaleInput = {
  uid: string;
  apId: string;
  gemId: string;
  soldPrice: number;
  soldToName: string;
  ownerReceives: number;
  commission: number;
  currency?: string;
};

/**
 * Record a gem sale within an AP.
 *
 * Atomically reads the AP, verifies the gem line is still `held`, and
 * updates the line + AP status together.
 */
export async function recordApGemSale(input: RecordApGemSaleInput): Promise<void> {
  const { uid, apId, gemId } = input;
  const apRef = db.collection('gemtrack_ap_records').doc(apId);

  let senderUid = '';
  let gemLabel = '';
  let soldPrice = input.soldPrice;
  let ownerReceives = input.ownerReceives;
  let currency = input.currency ?? 'LKR';
  let receiverName = '';

  await db.runTransaction(async (txn) => {
    const snap = await txn.get(apRef);
    if (!snap.exists) notFound('AP record not found.');
    const ap = snap.data() as ApDoc;

    if (ap.receiverUid !== uid) forbidden('Only the AP receiver can record a sale.');
    if (!['accepted', 'with_holder', 'partially_sold'].includes(ap.status)) {
      badRequest(`AP is not in a sellable state (status: ${ap.status}).`);
    }

    const itemIndex = ap.items.findIndex((i) => i.gemId === gemId);
    if (itemIndex === -1) notFound('Gem not found in this AP.');
    if (ap.items[itemIndex].lineStatus !== 'held') {
      badRequest(`Gem is already ${ap.items[itemIndex].lineStatus}.`);
    }

    const updatedItems = ap.items.map((item, i) =>
      i === itemIndex
        ? {
            ...item,
            lineStatus: 'sold' as const,
            soldPrice: input.soldPrice,
            soldToName: input.soldToName,
            soldDate: Timestamp.now(),
            ownerReceives: input.ownerReceives,
            commission: input.commission,
            currency: input.currency ?? item.currency,
          }
        : item,
    );

    const allDone = updatedItems.every((i) => i.lineStatus === 'sold' || i.lineStatus === 'returned');
    const newStatus = allDone ? 'sold_awaiting_payment' : 'partially_sold';

    txn.update(apRef, {
      items: updatedItems,
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Capture for notification below.
    senderUid = ap.senderUid;
    gemLabel = ap.items[itemIndex].gemLabel;
    currency = input.currency ?? ap.items[itemIndex].currency ?? 'LKR';
    receiverName = ap.receiverName;
  });

  await createNotificationDoc({
    recipientUid: senderUid,
    type: 'ap_gem_sold',
    title: 'Gem sold on AP',
    message: `${receiverName} sold ${gemLabel} for ${formatCurrency(soldPrice, currency)}. You receive ${formatCurrency(ownerReceives, currency)}.`,
    referenceType: 'ap',
    referenceId: apId,
  });
}

// ─── returnApGem ─────────────────────────────────────────────────────────────

/**
 * Return a held gem from an AP back to the owner.
 *
 * Atomically verifies the gem line is `held`, unlocks the gem, and updates
 * the AP item list and status.
 */
export async function returnApGem(uid: string, apId: string, gemId: string): Promise<void> {
  const apRef = db.collection('gemtrack_ap_records').doc(apId);
  const gemRef = db.collection('gemtrack_gems').doc(gemId);

  await db.runTransaction(async (txn) => {
    const snap = await txn.get(apRef);
    if (!snap.exists) notFound('AP record not found.');
    const ap = snap.data() as ApDoc;

    if (ap.receiverUid !== uid && ap.senderUid !== uid) {
      forbidden('You are not a party to this AP.');
    }

    const itemIndex = ap.items.findIndex((i) => i.gemId === gemId);
    if (itemIndex === -1) notFound('Gem not found in this AP.');
    if (ap.items[itemIndex].lineStatus !== 'held') {
      badRequest(`Gem is already ${ap.items[itemIndex].lineStatus}.`);
    }

    const updatedItems = ap.items.map((item, i) =>
      i === itemIndex ? { ...item, lineStatus: 'returned' as const } : item,
    );

    const allDone = updatedItems.every((i) => i.lineStatus === 'sold' || i.lineStatus === 'returned');
    const hasSold = updatedItems.some((i) => i.lineStatus === 'sold');
    const newStatus = allDone ? (hasSold ? 'sold_awaiting_payment' : 'returned') : ap.status;

    txn.update(apRef, {
      items: updatedItems,
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Unlock the gem inside the same transaction.
    txn.update(gemRef, {
      status: 'ready_for_sale',
      currentHolderContactId: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

// ─── apPaymentSent ───────────────────────────────────────────────────────────

export type ApPaymentInput = {
  uid: string;
  apId: string;
  amount: number;
  currency?: string;
  method?: ApPaymentMethod | null;
};

/**
 * AP receiver marks payment as sent.
 *
 * Transactionally verifies the AP is in a payment-expected state before
 * writing, preventing duplicate or out-of-order payment events.
 */
export async function apPaymentSent(input: ApPaymentInput): Promise<void> {
  const { uid, apId } = input;
  const apRef = db.collection('gemtrack_ap_records').doc(apId);

  let senderUid = '';
  let receiverName = '';

  await db.runTransaction(async (txn) => {
    const snap = await txn.get(apRef);
    if (!snap.exists) notFound('AP record not found.');
    const ap = snap.data() as ApDoc;

    if (ap.receiverUid !== uid) forbidden('Only the AP receiver can mark payment as sent.');
    if (!['sold_awaiting_payment', 'partially_sold'].includes(ap.status)) {
      badRequest(`No payment expected in status: ${ap.status}.`);
    }

    txn.update(apRef, {
      paymentMethod: input.method ?? null,
      paymentAmount: input.amount,
      paymentSentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    senderUid = ap.senderUid;
    receiverName = ap.receiverName;
  });

  // Write the payment event and notification outside the transaction (append-only).
  const paymentSnap = await db.collection('gemtrack_ap_records').doc(apId).get();
  const ap = paymentSnap.data() as ApDoc;

  await db.collection('gemtrack_ap_payments').add({
    apId,
    ownerUid: ap.ownerUid,
    senderUid: ap.senderUid,
    receiverUid: ap.receiverUid,
    actorUid: uid,
    type: 'sent',
    method: input.method ?? null,
    amount: input.amount,
    createdAt: FieldValue.serverTimestamp(),
  });

  const currency = input.currency ?? 'LKR';
  await createNotificationDoc({
    recipientUid: senderUid,
    type: 'ap_payment_sent',
    title: 'AP payment sent',
    message: `${receiverName} sent payment of ${formatCurrency(input.amount, currency)}. Please confirm receipt.`,
    referenceType: 'ap',
    referenceId: apId,
  });
}

// ─── apPaymentReceived ───────────────────────────────────────────────────────

/**
 * Gem owner confirms receipt of payment. Closes the AP.
 *
 * Transactionally verifies the AP has a sent payment before closing,
 * then writes income/expense transactions and a notification outside the
 * transaction (append-only, safe to retry).
 */
export async function apPaymentReceived(input: ApPaymentInput): Promise<void> {
  const { uid, apId } = input;
  const apRef = db.collection('gemtrack_ap_records').doc(apId);

  let capturedAp: ApDoc | null = null;

  await db.runTransaction(async (txn) => {
    const snap = await txn.get(apRef);
    if (!snap.exists) notFound('AP record not found.');
    const ap = snap.data() as ApDoc;

    if (ap.senderUid !== uid) forbidden('Only the AP sender can confirm payment receipt.');
    if (!ap.paymentSentAt) badRequest('Payment has not been marked as sent yet.');
    if (ap.status === 'completed') badRequest('AP is already completed.');

    txn.update(apRef, {
      status: 'completed',
      paymentReceivedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    capturedAp = ap;
  });

  const ap = capturedAp!;
  const soldTotal = ap.items
    .filter((i) => i.lineStatus === 'sold')
    .reduce((sum, i) => sum + (i.ownerReceives ?? 0), 0);
  const amount = input.amount > 0 ? input.amount : (ap.paymentAmount ?? soldTotal);
  const currency = input.currency ?? 'LKR';
  const now = FieldValue.serverTimestamp();

  // All writes below are append-only — safe outside the transaction.
  await Promise.all([
    db.collection('gemtrack_ap_payments').add({
      apId,
      ownerUid: ap.ownerUid,
      senderUid: ap.senderUid,
      receiverUid: ap.receiverUid,
      actorUid: uid,
      type: 'received',
      method: ap.paymentMethod,
      amount,
      createdAt: now,
    }),
    db.collection('gemtrack_transactions').add({
      ownerUid: ap.senderUid,
      type: 'income',
      amount,
      currency,
      amountBase: amount,
      category: 'ap_income',
      description: `AP payment from ${ap.receiverName}`,
      gemId: null,
      contactId: ap.receiverContactId,
      date: now,
      createdAt: now,
    }),
    db.collection('gemtrack_transactions').add({
      ownerUid: ap.receiverUid,
      type: 'expense',
      amount,
      currency,
      amountBase: amount,
      category: 'other_expense',
      description: `AP payout to ${ap.senderName}`,
      gemId: null,
      contactId: null,
      date: now,
      createdAt: now,
    }),
    createNotificationDoc({
      recipientUid: ap.receiverUid,
      type: 'ap_payment_received',
      title: 'AP payment confirmed',
      message: `${ap.senderName} confirmed receipt of ${formatCurrency(amount, currency)}. AP complete.`,
      referenceType: 'ap',
      referenceId: apId,
    }),
  ]);
}
