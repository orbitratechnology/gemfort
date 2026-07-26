import { BASE_CURRENCY, type CurrencyCode } from '@/constants/currencies';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';
import {
  formatBaseAsPreferred,
  formatStoredAsPreferred,
  toPreferredAmount,
} from '@/lib/money';

type StoredMoney = {
  amount: number;
  currency?: string | null;
  amountBase?: number | null;
};

/**
 * Display money in the signed-in user's preferred currency.
 * Source of truth for stored values is LKR (`amountBase` / `*Base`).
 */
export function usePreferredMoney() {
  const preferred = usePreferredCurrency();
  const { data } = useExchangeRates();
  const rates = data?.rates ?? null;

  function formatBase(amountBase: number): string {
    return formatBaseAsPreferred(amountBase, preferred, rates);
  }

  function formatStored(value: StoredMoney): string {
    return formatStoredAsPreferred(
      value.amount,
      value.currency,
      preferred,
      rates,
      value.amountBase,
    );
  }

  /** Face amount + currency → preferred (for values without a stored base). */
  function formatFace(amount: number, currency?: string | null): string {
    return formatStoredAsPreferred(amount, currency, preferred, rates);
  }

  function fromBase(amountBase: number): number {
    return toPreferredAmount(amountBase, preferred, rates);
  }

  return {
    preferred: preferred as CurrencyCode,
    rates,
    baseCurrency: BASE_CURRENCY,
    formatBase,
    formatStored,
    formatFace,
    fromBase,
  };
}
