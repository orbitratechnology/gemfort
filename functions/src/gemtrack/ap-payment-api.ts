import { Timestamp } from 'firebase-admin/firestore';

import { ApiError } from '../api/errors';
import { db } from '../admin';
import { ensureDeterministicNotificationDoc, formatCurrency } from '../notifications/create';
import { canActOnAp } from './mutation-contract';
import {
  apPaymentEventId,
  apPaymentExpenseTransactionId,
  apPaymentIncomeTransactionId,
  apPaymentReceivedFingerprint,
  apPaymentSentFingerprint,
} from './ap-financial-contract';
import { convertToBaseServer, loadServerRates, type ServerRates } from './exchange-rates';

type ApPaymentMethod = 'cash' | 'transfer' | 'cheque';

type ApLine = {
  gemId: string;
  lineStatus: 'held' | 'sold' | 'returned';
  soldPrice?: number | null;
  ownerReceives?: number | null;
  ownerReceivesBase?: number | null;
  agreedPrice: number;
  currency?: string | null;
};

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
  status: 'payment_sent' | 'done';
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

function soldAmount(ap: ApDoc, rates: ServerRates, targetCurrency = paymentCurrency(ap)): number {
  const baseAmount = (ap.items ?? [])
    .filter((item) => item.lineStatus === 'sold')
    .reduce((sum, item) => {
      const amount = Number(item.ownerReceives ?? item.agreedPrice);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new ApiError('failed-precondition', 'The AP contains an invalid sold amount.');
      }
      const currency = normalizeCurrency(item.currency);
      const amountBase =
        item.ownerReceivesBase != null && Number.isFinite(item.ownerReceivesBase)
          ? item.ownerReceivesBase
          : convertToBaseServer(amount, currency, rates);
      return sum + amountBase;
    }, 0);

  if (targetCurrency === 'LKR') return Number(baseAmount.toFixed(2));
  const foreignPerBase = rates[targetCurrency];
  if (!foreignPerBase || foreignPerBase <= 0) {
    throw new ApiError('failed-precondition', `Exchange rate for ${targetCurrency} is unavailable.`);
  }
  return Number((baseAmount * foreignPerBase).toFixed(2));
}

async function ensurePaymentNotification(input: {
  recipientUid: string;
  apId: string;
  type: 'ap_payment_sent' | 'ap_payment_received';
  title: string;
  message: string;
}) {
  await ensureDeterministicNotificationDoc({
    recipientUid: input.recipientUid,
    type: input.type,
    title: input.title,
    message: input.message,
    referenceType: 'ap',
    referenceId: input.apId,
  });
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
  const paymentRef = db.collection('gemtrack_ap_payments').doc(apPaymentEventId(id, 'sent'));

  const result = await db.runTransaction(async (transaction) => {
    const apSnap = await transaction.get(apRef);
    if (!apSnap.exists) throw new ApiError('not-found', 'AP not found.');
    const ap = apSnap.data() as ApDoc;
    if (!canActOnAp('payment-sent', apFixture(ap), uid)) {
      throw new ApiError('permission-denied', 'Only the AP holder can mark payment sent.');
    }

    const currency = input.currency ? normalizeCurrency(input.currency) : paymentCurrency(ap);
    const owed = soldAmount(ap, rates, currency);
    const amount =
      input.amount != null && Number.isFinite(Number(input.amount))
        ? Number(input.amount)
        : owed;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError('invalid-argument', 'Payment amount must be positive.');
    }
    if (amount > owed) {
      throw new ApiError('invalid-argument', 'Payment amount cannot exceed the amount owed.');
    }
    const fingerprint = apPaymentSentFingerprint({
      method: input.method,
      amount,
      currency: input.currency,
      chequeId: input.chequeId,
      receiptUrl: input.receiptUrl,
    });
    const paymentSnap = await transaction.get(paymentRef);
    const notification = {
      recipientUid: ap.senderUid,
      type: 'ap_payment_sent' as const,
      title: 'AP payment sent',
      message: `${ap.receiverName || 'Trader'} sent ${formatCurrency(amount, currency)} via ${input.method}. Confirm when received.`,
    };

    if (ap.status === 'payment_sent') {
      if (!paymentSnap.exists) {
        throw new ApiError(
          'failed-precondition',
          'This AP payment was created by the legacy path and needs reconciliation before API retry.',
        );
      }
      if (paymentSnap.data()?.mutationFingerprint !== fingerprint) {
        throw new ApiError('failed-precondition', 'This AP payment already exists with different details.');
      }
      return { status: 'payment_sent' as const, notification };
    }

    if (ap.status !== 'accepted') {
      throw new ApiError('failed-precondition', 'AP must be accepted with sales before payment.');
    }
    if (owed <= 0) {
      throw new ApiError('failed-precondition', 'Sell at least one gem before sending payment.');
    }
    if (paymentSnap.exists) {
      throw new ApiError('failed-precondition', 'An AP payment event already exists.');
    }

    const now = Timestamp.now();
    transaction.update(apRef, {
      status: 'payment_sent',
      paymentMethod: input.method,
      paymentCurrency: currency,
      paymentAmount: amount,
      paymentSentAt: now,
      paymentChequeId: input.chequeId ?? null,
      paymentReceiptUrl: input.receiptUrl ?? null,
      updatedAt: now,
    });
    transaction.create(paymentRef, {
      eventKind: 'ap_payment',
      mutationFingerprint: fingerprint,
      apId: id,
      ownerUid: ap.ownerUid,
      senderUid: ap.senderUid,
      receiverUid: ap.receiverUid,
      actorUid: uid,
      type: 'sent',
      method: input.method,
      amount,
      receiptUrl: input.receiptUrl ?? null,
      createdAt: now,
    });

    return { status: 'payment_sent' as const, notification };
  });

  await ensurePaymentNotification({ ...result.notification, apId: id });
  return { ok: true, status: result.status };
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
  const paymentRef = db.collection('gemtrack_ap_payments').doc(apPaymentEventId(id, 'received'));
  const incomeRef = db.collection('gemtrack_transactions').doc(apPaymentIncomeTransactionId(id));
  const expenseRef = db.collection('gemtrack_transactions').doc(apPaymentExpenseTransactionId(id));

  const result = await db.runTransaction(async (transaction) => {
    const apSnap = await transaction.get(apRef);
    if (!apSnap.exists) throw new ApiError('not-found', 'AP not found.');
    const ap = apSnap.data() as ApDoc;
    if (!canActOnAp('payment-received', apFixture(ap), uid)) {
      throw new ApiError('permission-denied', 'Only the sender can confirm payment.');
    }

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
    const paymentSnap = await transaction.get(paymentRef);
    const incomeSnap = await transaction.get(incomeRef);
    const expenseSnap = await transaction.get(expenseRef);
    const notification = {
      recipientUid: ap.receiverUid,
      type: 'ap_payment_received' as const,
      title: 'AP payment confirmed',
      message: `${ap.senderName || 'Trader'} confirmed receipt of ${formatCurrency(amount, currency)}. AP complete (sold ${formatCurrency(soldAmount(ap, rates, currency), currency)}).`,
    };

    if (ap.status === 'done') {
      if (!paymentSnap.exists || !incomeSnap.exists || !expenseSnap.exists) {
        throw new ApiError(
          'failed-precondition',
          'This AP completion was created by the legacy path and needs reconciliation before API retry.',
        );
      }
      const fingerprints = [paymentSnap, incomeSnap, expenseSnap].map(
        (snapshot) => snapshot.data()?.mutationFingerprint,
      );
      if (fingerprints.some((value) => value !== fingerprint)) {
        throw new ApiError('failed-precondition', 'This AP payment already exists with different details.');
      }
      return { status: 'done' as const, notification };
    }

    if (ap.status !== 'payment_sent') {
      throw new ApiError('failed-precondition', 'Waiting for payment sent first.');
    }
    if (paymentSnap.exists || incomeSnap.exists || expenseSnap.exists) {
      throw new ApiError('failed-precondition', 'AP payment events are inconsistent and need reconciliation.');
    }

    const amountBase = convertToBaseServer(amount, currency, rates);
    const now = Timestamp.now();
    transaction.update(apRef, {
      status: 'done',
      paymentReceivedAt: now,
      ...(input.method ? { paymentMethod: input.method } : {}),
      ...(input.chequeId !== undefined ? { paymentChequeId: chequeId } : {}),
      ...(input.receiptUrl !== undefined ? { paymentReceiptUrl: receiptUrl } : {}),
      updatedAt: now,
    });
    transaction.create(paymentRef, {
      eventKind: 'ap_payment',
      mutationFingerprint: fingerprint,
      apId: id,
      ownerUid: ap.ownerUid,
      senderUid: ap.senderUid,
      receiverUid: ap.receiverUid,
      actorUid: uid,
      type: 'received',
      method,
      amount,
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
      description: `AP payment from ${ap.receiverName || 'Trader'}`,
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
      description: `AP payout to ${ap.senderName || 'Trader'}`,
      gemId: null,
      contactId: null,
      sourceType: 'ap',
      sourceId: id,
      date: now,
      createdAt: now,
    });

    return { status: 'done' as const, notification };
  });

  await ensurePaymentNotification({ ...result.notification, apId: id });
  return { ok: true, status: result.status };
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
