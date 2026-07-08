import { BASE_CURRENCY } from '@/constants/currencies';

type RateCache = {
  fetchedAt: number;
  rates: Record<string, number>;
};

let cache: RateCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Fetch LKR-equivalent rates for major currencies via Frankfurter (no API key). */
export async function fetchExchangeRates(base = BASE_CURRENCY): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rates;
  }

  const codes = ['USD', 'EUR', 'GBP', 'THB', 'CNY', 'AUD', 'SGD'].join(',');
  const res = await fetch(`https://api.frankfurter.app/latest?from=${base}&to=${codes}`);
  if (!res.ok) throw new Error('Could not fetch exchange rates.');

  const data = (await res.json()) as { rates: Record<string, number> };
  const rates: Record<string, number> = { [base]: 1 };

  for (const [code, rate] of Object.entries(data.rates)) {
    // API returns: 1 LKR = rate USD — invert to get 1 USD in LKR
    rates[code] = 1 / rate;
  }

  cache = { fetchedAt: Date.now(), rates };
  return rates;
}

export async function convertToBase(
  amount: number,
  currency: string,
  base = BASE_CURRENCY,
): Promise<number> {
  if (currency === base) return amount;
  const rates = await fetchExchangeRates(base);
  const rate = rates[currency];
  if (!rate) return amount;
  return Number((amount * rate).toFixed(2));
}

export function convertToBaseSync(
  amount: number,
  currency: string,
  rates: Record<string, number>,
  base = BASE_CURRENCY,
): number {
  if (currency === base) return amount;
  const rate = rates[currency];
  if (!rate) return amount;
  return Number((amount * rate).toFixed(2));
}
