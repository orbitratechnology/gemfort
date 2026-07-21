import { BASE_CURRENCY, type CurrencyCode } from '@/constants/currencies';
import {
  convertFromBaseSync,
  type ExchangeRatesSnapshot,
} from '@/lib/exchange-rates';
import { formatCurrency } from '@/lib/utils';

/** Format a face amount in its own currency. Alias kept for gradual migration. */
export function formatMoney(amount: number, currency = BASE_CURRENCY): string {
  return formatCurrency(amount, currency);
}

/** Format an LKR `amountBase` in the user's preferred currency. */
export function formatBaseAsPreferred(
  amountBase: number,
  preferred: string,
  rates: Record<string, number>,
): string {
  const currency = preferred || BASE_CURRENCY;
  try {
    const display = convertFromBaseSync(amountBase, currency, rates);
    return formatMoney(display, currency);
  } catch {
    return formatMoney(amountBase, BASE_CURRENCY);
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
