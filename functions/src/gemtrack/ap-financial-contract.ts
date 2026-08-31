import { createHash } from 'node:crypto';

function hashPayload(payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function normalizeString(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}

function normalizeIso(value: string | null | undefined): string | null {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Stable, bounded Firestore ID for a new API-owned AP event. */
export function deterministicApEventId(
  kind: 'sale' | 'payment-sent' | 'payment-received' | 'income' | 'expense',
  apId: string,
  discriminator = '',
): string {
  const digest = hashPayload({ kind, apId, discriminator });
  return `api-ap-${kind}-${digest.slice(0, 40)}`;
}

export function apSaleTransactionId(apId: string, gemId: string): string {
  return deterministicApEventId('sale', apId, gemId);
}

export function apPaymentEventId(
  apId: string,
  type: 'sent' | 'received',
): string {
  return deterministicApEventId(type === 'sent' ? 'payment-sent' : 'payment-received', apId);
}

export function apPaymentIncomeTransactionId(apId: string): string {
  return deterministicApEventId('income', apId, 'payment-received');
}

export function apPaymentExpenseTransactionId(apId: string): string {
  return deterministicApEventId('expense', apId, 'payment-received');
}

export function apSaleFingerprint(input: {
  gemId: string;
  soldPrice: number;
  soldToName?: string | null;
  paymentDueDateIso?: string | null;
  ownerReceives: number;
  currency: string;
}): string {
  return hashPayload({
    kind: 'ap-sale',
    gemId: input.gemId,
    soldPrice: input.soldPrice,
    soldToName: normalizeString(input.soldToName),
    paymentDueDateIso: normalizeIso(input.paymentDueDateIso),
    ownerReceives: input.ownerReceives,
    currency: input.currency.trim().toUpperCase(),
  });
}

export function apPaymentSentFingerprint(input: {
  method: 'cash' | 'transfer' | 'cheque';
  amount: number;
  chequeId?: string | null;
  receiptUrl?: string | null;
}): string {
  return hashPayload({
    kind: 'ap-payment-sent',
    method: input.method,
    amount: input.amount,
    chequeId: normalizeString(input.chequeId),
    receiptUrl: normalizeString(input.receiptUrl),
  });
}

export function apPaymentReceivedFingerprint(input: {
  method: 'cash' | 'transfer' | 'cheque' | null;
  amount: number;
  currency: string;
  chequeId?: string | null;
  receiptUrl?: string | null;
}): string {
  return hashPayload({
    kind: 'ap-payment-received',
    method: input.method,
    amount: input.amount,
    currency: input.currency.trim().toUpperCase(),
    chequeId: normalizeString(input.chequeId),
    receiptUrl: normalizeString(input.receiptUrl),
  });
}
