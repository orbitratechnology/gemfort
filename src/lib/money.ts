import { BASE_CURRENCY, type CurrencyCode } from '@/constants/currencies';
import {
  convertFromBaseSync,
  convertToBaseSync,
  type ExchangeRatesSnapshot,
} from '@/lib/exchange-rates';
import { formatCurrency } from '@/lib/utils';

/** Format a face amount in its own currency. Alias kept for gradual migration. */
export function formatMoney(amount: number, currency = BASE_CURRENCY): string {
  return formatCurrency(amount, currency);
}

/**
 * Resolve LKR base for a stored money value.
 * Prefers persisted `amountBase`; otherwise converts face → LKR when rates exist.
 */
export function resolveAmountBase(
  amount: number,
  currency: string | null | undefined,
  amountBase: number | null | undefined,
  rates: Record<string, number> | null | undefined,
): number | null {
  if (typeof amountBase === 'number' && Number.isFinite(amountBase)) {
    return amountBase;
  }
  const code = currency || BASE_CURRENCY;
  if (code === BASE_CURRENCY) return amount;
  if (!rates) return null;
  try {
    return convertToBaseSync(amount, code, rates);
  } catch {
    return null;
  }
}

/** Format an LKR `amountBase` in the user's preferred currency. */
export function formatBaseAsPreferred(
  amountBase: number,
  preferred: string,
  rates: Record<string, number> | null | undefined,
): string {
  const currency = preferred || BASE_CURRENCY;
  if (!rates || currency === BASE_CURRENCY) {
    return formatMoney(amountBase, BASE_CURRENCY);
  }
  try {
    const display = convertFromBaseSync(amountBase, currency, rates);
    return formatMoney(display, currency);
  } catch {
    return formatMoney(amountBase, BASE_CURRENCY);
  }
}

/**
 * Format a stored monetary value for display in the viewer's preferred currency.
 * Uses `amountBase` (LKR) when present; otherwise converts face amount via rates.
 */
export function formatStoredAsPreferred(
  amount: number,
  currency: string | null | undefined,
  preferred: string,
  rates: Record<string, number> | null | undefined,
  amountBase?: number | null,
): string {
  const base = resolveAmountBase(amount, currency, amountBase, rates);
  if (base != null) {
    return formatBaseAsPreferred(base, preferred, rates);
  }
  return formatMoney(amount, currency || BASE_CURRENCY);
}

/** Convert LKR base → preferred numeric amount (falls back to base). */
export function toPreferredAmount(
  amountBase: number,
  preferred: string,
  rates: Record<string, number> | null | undefined,
): number {
  const currency = preferred || BASE_CURRENCY;
  if (!rates || currency === BASE_CURRENCY) return amountBase;
  try {
    return convertFromBaseSync(amountBase, currency, rates);
  } catch {
    return amountBase;
  }
}

/** Outstanding principal in LKR when face remaining and amountBase are known. */
export function outstandingBase(
  amount: number,
  amountReceivedOrPaid: number,
  amountBase: number | undefined,
  currency: string,
): number {
  const remaining = Math.max(0, amount - amountReceivedOrPaid);
  if (remaining <= 0) return 0;
  if (typeof amountBase === 'number' && amount > 0) {
    return Number(((remaining / amount) * amountBase).toFixed(2));
  }
  if (currency === BASE_CURRENCY) return remaining;
  return remaining;
}

export type PreferredMoneyContext = {
  preferred: CurrencyCode;
  rates: ExchangeRatesSnapshot['rates'] | null;
};
