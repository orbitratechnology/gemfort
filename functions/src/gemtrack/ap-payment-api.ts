import {
  Timestamp,
  type DocumentReference,
  type Transaction,
} from 'firebase-admin/firestore';

import { ApiError } from '../api/errors';
import { db } from '../admin';
import { isLiveUid } from '../account/deleted-uid';
import { ensureDeterministicNotificationDoc, formatCurrency } from '../notifications/create';
import { canActOnAp } from './mutation-contract';
import {
  apPaymentEventId,
  apPaymentExpenseTransactionId,
  apPaymentIncomeTransactionId,
  apPaymentReceivedFingerprint,
  apPaymentSentFingerprint,
} from './ap-financial-contract';
import {
  ACTIVE_AP_STATUSES,
  MONEY_EPSILON,
  apBalance,
  apOwedAmount,
  apPaymentStatus,
  apSettlementStatus,
  type ApBalanceLine,
} from './ap-balance';
import { convertToBaseServer, loadServerRates, type ServerRates } from './exchange-rates';

type ApPaymentMethod = 'cash' | 'transfer' | 'cheque';

type ApLine = ApBalanceLine & { gemId: string };

type ApDoc = {
  ownerUid: string;
  senderUid: string;
  receiverUid: string;
  receiverContactId?: string | null;
  receiverName?: string | null;
  senderName?: string | null;
  items?: ApLine[];
  status: string;
  paymentMethod?: ApPaymentMethod | null;
  paymentCurrency?: string | null;
  paymentAmount?: number | null;
  paymentSentAt?: Timestamp | null;
  paymentReceivedAt?: Timestamp | null;
  paymentChequeId?: string | null;
  paymentReceiptUrl?: string | null;
  /** Sequence number of the latest payment (pending or confirmed). */
  paymentSeq?: number | null;
  /** Confirmed payments so far, in paymentCurrency. */
  amountPaid?: number | null;
  amountPaidBase?: number | null;
  /** Status to return to if the pending payment's cheque bounces. */
  statusBeforePayment?: string | null;
};

export type ApPaymentSentInput = {
  method: ApPaymentMethod;
  amount?: number | null;
  currency?: string | null;
  chequeId?: string | null;
  receiptUrl?: string | null;
};

export type ApPaymentReceivedInput = {
  method?: ApPaymentMethod | null;
  chequeId?: string | null;
  receiptUrl?: string | null;
};

export type ApPaymentResult = {
  ok: true;
  status: 'payment_sent' | 'accepted' | 'partial' | 'done';
  amountPaid?: number;
  balance?: number;
};

function assertApId(apId: string): string {
  const value = apId.trim();
  if (!value || value.includes('/')) {
    throw new ApiError('invalid-argument', 'A valid apId is required.');
  }
  return value;
}

function isPaymentMethod(value: unknown): value is ApPaymentMethod {
  return value === 'cash' || value === 'transfer' || value === 'cheque';
}

function normalizeString(value: unknown, name: string, maxLength: number): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new ApiError('invalid-argument', `${name} is invalid.`);
  }
  const normalized = value.trim();
  return normalized || null;
}

function normalizeOptionalString(
  value: unknown,
  name: string,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  return normalizeString(value, name, maxLength);
}

function assertObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new ApiError('invalid-argument', 'Request body must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

function apFixture(ap: ApDoc) {
  return {
    ownerUid: ap.ownerUid,
    senderUid: ap.senderUid,
    receiverUid: ap.receiverUid,
    status: ap.status,
  };
}

const SUPPORTED_CURRENCIES = new Set([
  'LKR', 'RMB', 'USD', 'EUR', 'GBP', 'THB', 'AED', 'AUD', 'SGD', 'TZS', 'MGA', 'IDR',
]);

function normalizeCurrency(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : 'LKR';
  const code = normalized === 'CNY' || normalized === 'CNH' ? 'RMB' : normalized || 'LKR';
  if (!SUPPORTED_CURRENCIES.has(code)) {
    throw new ApiError('failed-precondition', `Exchange rate for ${normalized || 'the AP currency'} is unavailable.`);
  }
  return code || 'LKR';
}

function normalizeOptionalCurrency(value: unknown): string | null | undefined {
  const normalized = normalizeOptionalString(value, 'currency', 6);
  return normalized == null ? normalized : normalizeCurrency(normalized);
}

function paymentCurrency(ap: ApDoc): string {
  return normalizeCurrency(
    ap.paymentCurrency ?? ap.items?.find((item) => item.lineStatus === 'sold')?.currency ?? ap.items?.[0]?.currency,
  );
}

function owedAmount(ap: ApDoc, rates: ServerRates, currency: string): number {
  try {
    return apOwedAmount(ap.items ?? [], currency, rates);
  } catch (error) {
    throw new ApiError('failed-precondition', error instanceof Error ? error.message : 'Invalid AP amount.');
  }
}

/**
 * APs settled before instalments existed have no amountPaid; a legacy `done`
 * AP was paid in a single payment of paymentAmount.
 */
function confirmedAmountPaid(ap: ApDoc): number {
  if (typeof ap.amountPaid === 'number' && Number.isFinite(ap.amountPaid)) return ap.amountPaid;
  return ap.status === 'done' && ap.paymentReceivedAt ? Number(ap.paymentAmount ?? 0) : 0;
}

/**
 * A cheque payment must point at a real cheque the actor recorded for this
 * AP, so a bounce reaches the cheque lifecycle (onChequeBounced) and can be
 * reconciled against this AP payment.
 */
async function loadPaymentCheque(
  transaction: Transaction,
  input: {
    chequeId: string | null | undefined;
    uid: string;
    apId: string;
    direction: 'given' | 'received';
    amount: number;
    currency: string;
  },
): Promise<DocumentReference> {
  if (!input.chequeId) {
    throw new ApiError('invalid-argument', 'Record the cheque first, then attach it to this payment.');
  }
  if (input.chequeId.includes('/')) throw new ApiError('invalid-argument', 'chequeId is invalid.');
  const ref = db.collection('gemtrack_cheques').doc(input.chequeId);
  const snap = await transaction.get(ref);
  const cheque = snap.data() as Record<string, unknown> | undefined;
  if (!snap.exists || cheque?.ownerUid !== input.uid) {
    throw new ApiError('permission-denied', 'Cheque not found.');
  }
  if (cheque.direction !== input.direction) {
    throw new ApiError(
      'failed-precondition',
      input.direction === 'given'
        ? 'Attach a cheque you issued.'
        : 'Attach the cheque you received.',
    );
  }
  if (!['holding', 'deposited', 'cleared'].includes(String(cheque.status))) {
    throw new ApiError('failed-precondition', 'This cheque has bounced, been replaced, or been cancelled.');
  }
  if (cheque.apRecordId != null && cheque.apRecordId !== input.apId) {
    throw new ApiError('failed-precondition', 'This cheque is linked to a different AP.');
  }
  const chequeCurrency = normalizeCurrency(cheque.currency ?? 'LKR');
  if (chequeCurrency !== input.currency) {
    throw new ApiError('failed-precondition', `The cheque must be in ${input.currency}.`);
  }
  if (Math.abs(Number(cheque.amount) - input.amount) > MONEY_EPSILON) {
    throw new ApiError('failed-precondition', 'The cheque amount must match the payment amount.');
  }
  return ref;
}

export async function apPaymentSentForApi(
  apId: string,
  uid: string,
  rawInput: ApPaymentSentInput,
): Promise<ApPaymentResult> {
  const input = parseApPaymentSentInput(rawInput);
  const id = assertApId(apId);
  const rates = await loadServerRates();

  const apRef = db.collection('gemtrack_ap_records').doc(id);

  const result = await db.runTransaction(async (transaction) => {
    const apSnap = await transaction.get(apRef);
    if (!apSnap.exists) throw new ApiError('not-found', 'AP not found.');
    const ap = apSnap.data() as ApDoc;
    if (!canActOnAp('payment-sent', apFixture(ap), uid)) {
      throw new ApiError('permission-denied', 'Only the AP holder can mark payment sent.');
    }

    const amountPaid = confirmedAmountPaid(ap);
    // The first payment fixes the AP's settlement currency; later instalments
    // must use it so the balance never mixes currencies.
    const lockedCurrency = amountPaid > 0 && ap.paymentCurrency ? normalizeCurrency(ap.paymentCurrency) : null;
    const currency = input.currency ? normalizeCurrency(input.currency) : lockedCurrency ?? paymentCurrency(ap);
    if (lockedCurrency && currency !== lockedCurrency) {
      throw new ApiError('failed-precondition', `Further payments on this AP must be in ${lockedCurrency}.`);
    }
    const owed = owedAmount(ap, rates, currency);
    const balance = apBalance(owed, amountPaid);
    const amount =
      input.amount != null && Number.isFinite(Number(input.amount))
        ? Number(input.amount)
        : balance;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError('invalid-argument', 'Payment amount must be positive.');
    }

    const fingerprint = apPaymentSentFingerprint({
      method: input.method,
      amount,
      currency: input.currency,
      chequeId: input.chequeId,
      receiptUrl: input.receiptUrl,
    });

    if (ap.status === 'payment_sent') {
      const seq = ap.paymentSeq ?? 1;
      const paymentSnap = await transaction.get(
        db.collection('gemtrack_ap_payments').doc(apPaymentEventId(id, 'sent', seq)),
      );
      if (!paymentSnap.exists) {
        throw new ApiError(
          'failed-precondition',
          'This AP payment was created by the legacy path and needs reconciliation before API retry.',
        );
      }
      if (paymentSnap.data()?.mutationFingerprint !== fingerprint) {
        throw new ApiError('failed-precondition', 'A payment is already waiting for confirmation.');
      }
      return { status: 'payment_sent' as const, seq, amount, currency, amountPaid, balance, ap };
    }

    if (!ACTIVE_AP_STATUSES.has(ap.status)) {
      throw new ApiError('failed-precondition', 'AP must be accepted with sales before payment.');
    }
    if (balance <= 0) {
      throw new ApiError(
        'failed-precondition',
        owed <= 0 ? 'Sell at least one gem before sending payment.' : 'Nothing is owed on this AP.',
      );
    }
    if (amount - balance > MONEY_EPSILON) {
      throw new ApiError(
        'invalid-argument',
        `Payment cannot exceed the balance of ${formatCurrency(balance, currency)}.`,
      );
    }

    const seq = (ap.paymentSeq ?? (amountPaid > 0 ? 1 : 0)) + 1;
    const paymentRef = db.collection('gemtrack_ap_payments').doc(apPaymentEventId(id, 'sent', seq));
    const paymentSnap = await transaction.get(paymentRef);
    if (paymentSnap.exists) {
      throw new ApiError('failed-precondition', 'An AP payment event already exists.');
    }
    const chequeRef = input.method === 'cheque'
      ? await loadPaymentCheque(transaction, {
          chequeId: input.chequeId,
          uid,
          apId: id,
          direction: 'given',
          amount,
          currency,
        })
      : null;

    const now = Timestamp.now();
    transaction.update(apRef, {
      status: 'payment_sent',
      statusBeforePayment: ap.status,
      paymentSeq: seq,
      paymentMethod: input.method,
      paymentCurrency: currency,
      paymentAmount: amount,
      paymentSentAt: now,
      paymentReceivedAt: null,
      paymentChequeId: input.chequeId ?? null,
      paymentReceiptUrl: input.receiptUrl ?? null,
      amountPaid,
      balance,
      updatedAt: now,
    });
    transaction.create(paymentRef, {
      eventKind: 'ap_payment',
      mutationFingerprint: fingerprint,
      apId: id,
      seq,
      ownerUid: ap.ownerUid,
      senderUid: ap.senderUid,
      receiverUid: ap.receiverUid,
      actorUid: uid,
      type: 'sent',
      method: input.method,
      amount,
      currency,
      chequeId: input.chequeId ?? null,
      receiptUrl: input.receiptUrl ?? null,
      createdAt: now,
    });
    if (chequeRef) {
      transaction.update(chequeRef, { apRecordId: id, apPaymentSeq: seq, updatedAt: now });
    }

    return { status: 'payment_sent' as const, seq, amount, currency, amountPaid, balance, ap };
  });

  const remainingAfter = Math.max(0, result.balance - result.amount);
  if (isLiveUid(result.ap.senderUid)) {
    await ensureDeterministicNotificationDoc({
      recipientUid: result.ap.senderUid,
      type: 'ap_payment_sent',
      title: 'AP payment sent',
      message: `${result.ap.receiverName || 'Trader'} sent ${formatCurrency(result.amount, result.currency)} via ${input.method}.${
        remainingAfter > 0 ? ` ${formatCurrency(remainingAfter, result.currency)} will remain.` : ''
      } Confirm when received.`,
      direction: 'given',
      referenceType: 'ap',
      referenceId: id,
      ...(result.seq > 1 ? { dedupeKey: `ap-payment-sent:${id}:${result.seq}` } : {}),
    });
  }
  return { ok: true, status: result.status, amountPaid: result.amountPaid, balance: result.balance };
}

export async function apPaymentReceivedForApi(
  apId: string,
  uid: string,
  rawInput: ApPaymentReceivedInput = {},
): Promise<ApPaymentResult> {
  const input = parseApPaymentReceivedInput(rawInput);
  const id = assertApId(apId);

  const rates = await loadServerRates();
  const apRef = db.collection('gemtrack_ap_records').doc(id);

  const result = await db.runTransaction(async (transaction) => {
    const apSnap = await transaction.get(apRef);
    if (!apSnap.exists) throw new ApiError('not-found', 'AP not found.');
    const ap = apSnap.data() as ApDoc;
    if (!canActOnAp('payment-received', apFixture(ap), uid)) {
      throw new ApiError('permission-denied', 'Only the sender can confirm payment.');
    }

    const seq = ap.paymentSeq ?? 1;
    const paymentRef = db.collection('gemtrack_ap_payments').doc(apPaymentEventId(id, 'received', seq));
    const incomeRef = db.collection('gemtrack_transactions').doc(apPaymentIncomeTransactionId(id, seq));
    const expenseRef = db.collection('gemtrack_transactions').doc(apPaymentExpenseTransactionId(id, seq));

    const amount = ap.paymentAmount ?? 0;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError('failed-precondition', 'Cannot confirm an empty payment.');
    }
    const currency = paymentCurrency(ap);
    const method = input.method ?? ap.paymentMethod ?? null;
    const chequeId = input.chequeId !== undefined
      ? normalizeString(input.chequeId, 'chequeId', 128)
      : ap.paymentChequeId ?? null;
    const receiptUrl = input.receiptUrl !== undefined
      ? normalizeString(input.receiptUrl, 'receiptUrl', 2048)
      : ap.paymentReceiptUrl ?? null;
    const fingerprint = apPaymentReceivedFingerprint({
      method,
      amount,
      currency,
      chequeId,
      receiptUrl,
    });
    const [paymentSnap, incomeSnap, expenseSnap] = await transaction.getAll(
      paymentRef,
      incomeRef,
      expenseRef,
    );
    const owed = owedAmount(ap, rates, currency);

    if (ap.status !== 'payment_sent') {
      // Replay of the confirmation that already settled this payment.
      if (paymentSnap.exists && incomeSnap.exists && expenseSnap.exists) {
        const fingerprints = [paymentSnap, incomeSnap, expenseSnap].map(
          (snapshot) => snapshot.data()?.mutationFingerprint,
        );
        if (fingerprints.some((value) => value !== fingerprint)) {
          throw new ApiError('failed-precondition', 'This AP payment already exists with different details.');
        }
        const paid = confirmedAmountPaid(ap);
        return {
          status: ap.status as ApPaymentResult['status'],
          amount,
          currency,
          amountPaid: paid,
          balance: apBalance(owed, paid),
          owed,
          replay: true,
        };
      }
      if (ap.status === 'done') {
        throw new ApiError(
          'failed-precondition',
          'This AP completion was created by the legacy path and needs reconciliation before API retry.',
        );
      }
      throw new ApiError('failed-precondition', 'Waiting for payment sent first.');
    }
    if (paymentSnap.exists || incomeSnap.exists || expenseSnap.exists) {
      throw new ApiError('failed-precondition', 'AP payment events are inconsistent and need reconciliation.');
    }

    const chequeRef = method === 'cheque'
      ? await loadPaymentCheque(transaction, {
          chequeId,
          uid,
          apId: id,
          direction: 'received',
          amount,
          currency,
        })
      : null;

    const previousPaid = confirmedAmountPaid(ap);
    const amountPaid = Number((previousPaid + amount).toFixed(2));
    const balance = apBalance(owed, amountPaid);
    const status = apSettlementStatus({ lines: ap.items ?? [], owed, amountPaid });
    const amountBase = convertToBaseServer(amount, currency, rates);
    const now = Timestamp.now();
    transaction.update(apRef, {
      status,
      paymentReceivedAt: now,
      amountPaid,
      amountPaidBase: Number(((ap.amountPaidBase ?? 0) + amountBase).toFixed(2)),
      balance,
      paymentStatus: apPaymentStatus(owed, amountPaid),
      statusBeforePayment: null,
      ...(input.method ? { paymentMethod: input.method } : {}),
      ...(input.chequeId !== undefined ? { paymentChequeId: chequeId } : {}),
      ...(input.receiptUrl !== undefined ? { paymentReceiptUrl: receiptUrl } : {}),
      updatedAt: now,
    });
    transaction.create(paymentRef, {
      eventKind: 'ap_payment',
      mutationFingerprint: fingerprint,
      apId: id,
      seq,
      ownerUid: ap.ownerUid,
      senderUid: ap.senderUid,
      receiverUid: ap.receiverUid,
      actorUid: uid,
      type: 'received',
      method,
      amount,
      currency,
      amountPaidAfter: amountPaid,
      balanceAfter: balance,
      chequeId,
      receiptUrl,
      createdAt: now,
    });
    transaction.create(incomeRef, {
      eventKind: 'ap_payment_income',
      mutationFingerprint: fingerprint,
      ownerUid: ap.senderUid,
      type: 'income',
      amount,
      currency,
      amountBase,
      category: 'ap_income',
      description: `AP payment from ${ap.receiverName || 'Trader'}${seq > 1 ? ` (payment ${seq})` : ''}`,
      gemId: null,
      contactId: ap.receiverContactId ?? null,
      sourceType: 'ap',
      sourceId: id,
      receiptUrl,
      date: now,
      createdAt: now,
    });
    transaction.create(expenseRef, {
      eventKind: 'ap_payment_expense',
      mutationFingerprint: fingerprint,
      ownerUid: ap.receiverUid,
      type: 'expense',
      amount,
      currency,
      amountBase,
      category: 'other_expense',
      description: `AP payout to ${ap.senderName || 'Trader'}${seq > 1 ? ` (payment ${seq})` : ''}`,
      gemId: null,
      contactId: null,
      sourceType: 'ap',
      sourceId: id,
      date: now,
      createdAt: now,
    });
    if (chequeRef) {
      transaction.update(chequeRef, { apRecordId: id, apPaymentSeq: seq, updatedAt: now });
    }

    return { status, amount, currency, amountPaid, balance, owed, replay: false, seq, ap };
  });

  if (!result.replay && 'ap' in result && result.ap && isLiveUid(result.ap.receiverUid)) {
    const ap = result.ap;
    const settled = result.status === 'done';
    await ensureDeterministicNotificationDoc({
      recipientUid: ap.receiverUid,
      type: 'ap_payment_received',
      title: settled ? 'AP payment confirmed' : 'AP instalment confirmed',
      message: settled
        ? `${ap.senderName || 'Trader'} confirmed receipt of ${formatCurrency(result.amount, result.currency)}. AP complete.`
        : `${ap.senderName || 'Trader'} confirmed ${formatCurrency(result.amount, result.currency)}. Balance ${formatCurrency(result.balance, result.currency)}.`,
      direction: 'taken',
      referenceType: 'ap',
      referenceId: id,
      ...((result.seq ?? 1) > 1 ? { dedupeKey: `ap-payment-received:${id}:${result.seq}` } : {}),
    });
  }
  return { ok: true, status: result.status, amountPaid: result.amountPaid, balance: result.balance };
}

export function parseApPaymentSentInput(input: unknown): ApPaymentSentInput {
  const value = assertObject(input);
  if (!isPaymentMethod(value.method)) {
    throw new ApiError('invalid-argument', 'Invalid payment method.');
  }
  let amount: number | null | undefined;
  if (value.amount === undefined) {
    amount = undefined;
  } else if (value.amount === null) {
    amount = null;
  } else {
    amount = Number(value.amount);
  }
  if (amount != null && (!Number.isFinite(amount) || amount <= 0)) {
    throw new ApiError('invalid-argument', 'Payment amount must be positive.');
  }
  return {
    method: value.method,
    ...(value.amount !== undefined ? { amount } : {}),
    currency: normalizeOptionalCurrency(value.currency),
    chequeId: normalizeOptionalString(value.chequeId, 'chequeId', 128),
    receiptUrl: normalizeOptionalString(value.receiptUrl, 'receiptUrl', 2048),
  };
}

export function parseApPaymentReceivedInput(input: unknown): ApPaymentReceivedInput {
  const value = assertObject(input);
  if (value.method != null && !isPaymentMethod(value.method)) {
    throw new ApiError('invalid-argument', 'Invalid payment method.');
  }
  return {
    method: value.method as ApPaymentMethod | null | undefined,
    chequeId: normalizeOptionalString(value.chequeId, 'chequeId', 128),
    receiptUrl: normalizeOptionalString(value.receiptUrl, 'receiptUrl', 2048),
  };
}
