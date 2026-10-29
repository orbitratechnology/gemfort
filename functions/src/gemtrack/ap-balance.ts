/**
 * AP settlement maths, kept free of Firestore so it can be unit tested.
 *
 * The holder owes the sender `ownerReceives` for every sold line. Payments are
 * recorded one at a time; the AP only closes when nothing is held and the
 * balance reaches zero.
 */

export const MONEY_EPSILON = 0.005;

/** Carries an API error code so toApiError maps it to 412, not 500. */
class BalanceError extends Error {
  readonly code = 'failed-precondition';
}

export type ApBalanceLine = {
  lineStatus: 'held' | 'sold' | 'returned';
  agreedPrice: number;
  currency?: string | null;
  ownerReceives?: number | null;
  ownerReceivesBase?: number | null;
};

/** LKR is the base currency; rates are foreign units per 1 LKR. */
export type BalanceRates = Record<string, number>;

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toBase(amount: number, currency: string, rates: BalanceRates): number {
  if (currency === 'LKR') return amount;
  const perBase = rates[currency];
  if (!perBase || perBase <= 0) throw new BalanceError(`Exchange rate for ${currency} is unavailable.`);
  return amount / perBase;
}

function fromBase(amountBase: number, currency: string, rates: BalanceRates): number {
  if (currency === 'LKR') return amountBase;
  const perBase = rates[currency];
  if (!perBase || perBase <= 0) throw new BalanceError(`Exchange rate for ${currency} is unavailable.`);
  return amountBase * perBase;
}

/**
 * Total owed to the sender for sold lines, in `currency`. Lines already in
 * that currency are summed exactly; other lines go through the LKR base.
 */
export function apOwedAmount(
  lines: readonly ApBalanceLine[],
  currency: string,
  rates: BalanceRates,
): number {
  let total = 0;
  for (const line of lines) {
    if (line.lineStatus !== 'sold') continue;
    const amount = Number(line.ownerReceives ?? line.agreedPrice);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BalanceError('The AP contains an invalid sold amount.');
    }
    const lineCurrency = (line.currency?.trim() || 'LKR').toUpperCase();
    if (lineCurrency === currency) {
      total += amount;
      continue;
    }
    const amountBase =
      line.ownerReceivesBase != null && Number.isFinite(line.ownerReceivesBase)
        ? line.ownerReceivesBase
        : toBase(amount, lineCurrency, rates);
    total += fromBase(amountBase, currency, rates);
  }
  return roundMoney(total);
}

export function apBalance(owed: number, amountPaid: number): number {
  const balance = roundMoney(owed - amountPaid);
  return Math.abs(balance) < MONEY_EPSILON ? 0 : balance;
}

export type ApSettlementStatus = 'accepted' | 'partial' | 'done';

/**
 * Status of an active AP after a sale, return, or confirmed payment:
 * - `done` once nothing is held and the balance is zero,
 * - `partial` while some payment was received but a balance remains,
 * - `accepted` otherwise (gems still held, nothing outstanding yet).
 */
export function apSettlementStatus(input: {
  lines: readonly ApBalanceLine[];
  owed: number;
  amountPaid: number;
}): ApSettlementStatus {
  const balance = apBalance(input.owed, input.amountPaid);
  const anyHeld = input.lines.some((line) => line.lineStatus === 'held');
  if (!anyHeld && balance <= 0) return 'done';
  if (input.amountPaid > 0 && balance > 0) return 'partial';
  return 'accepted';
}

export function apPaymentStatus(owed: number, amountPaid: number): 'pending' | 'partial' | 'paid' {
  const balance = apBalance(owed, amountPaid);
  if (owed > 0 && balance <= 0) return 'paid';
  return amountPaid > 0 ? 'partial' : 'pending';
}

/** Statuses in which the holder can still sell, return, or pay. */
export const ACTIVE_AP_STATUSES = new Set(['accepted', 'partial']);
