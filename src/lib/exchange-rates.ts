import {
  BASE_CURRENCY,
  SUPPORTED_CURRENCIES,
  getApiCurrencyCode,
} from '@/constants/currencies';

export type ExchangeRatesSnapshot = {
  /** Foreign units per 1 LKR (API shape). LKR is always 1. */
  rates: Record<string, number>;
  updatedAt: number;
  provider: string;
};

type RateCache = ExchangeRatesSnapshot & { fetchedAt: number };

let cache: RateCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;
const FIRESTORE_FRESH_MS = 24 * 60 * 60 * 1000;

const OPEN_ER_API = `https://open.er-api.com/v6/latest/${BASE_CURRENCY}`;

const QUOTE_CODES = SUPPORTED_CURRENCIES.map((c) => c.code).filter(
  (c) => c !== BASE_CURRENCY,
);

function normalizeRates(raw: Record<string, number>): Record<string, number> {
  const rates: Record<string, number> = { [BASE_CURRENCY]: 1 };
  for (const code of QUOTE_CODES) {
    const apiKey = getApiCurrencyCode(code);
    const value = raw[code] ?? raw[apiKey];
    if (typeof value === 'number' && value > 0) {
      rates[code] = value;
    }
  }
  // Legacy CNY docs / cache → RMB
  if (!rates.RMB && typeof raw.CNY === 'number' && raw.CNY > 0) {
    rates.RMB = raw.CNY;
  }
  return rates;
}

async function fetchFromOpenErApi(): Promise<ExchangeRatesSnapshot> {
  const res = await fetch(OPEN_ER_API);
  if (!res.ok) throw new Error('Could not fetch exchange rates.');

  const data = (await res.json()) as {
    result?: string;
    rates?: Record<string, number>;
    time_last_update_unix?: number;
  };

  if (data.result !== 'success' || !data.rates) {
    throw new Error('Could not fetch exchange rates.');
  }

  return {
    rates: normalizeRates(data.rates),
    updatedAt: (data.time_last_update_unix ?? Math.floor(Date.now() / 1000)) * 1000,
    provider: 'open.er-api.com',
  };
}

async function fetchFromFirestore(): Promise<ExchangeRatesSnapshot | null> {
  try {
    const { doc, getDoc, getFirebaseDb } = await import('@/lib/firebase/db');
    const snap = await getDoc(doc(getFirebaseDb(), 'system', 'exchange_rates'));
    if (!snap.exists()) return null;
    const data = snap.data() as {
      rates?: Record<string, number>;
      updatedAt?: { toMillis?: () => number } | number;
      provider?: string;
      base?: string;
    };
    if (!data.rates || data.base !== BASE_CURRENCY) return null;

    let updatedAt = Date.now();
    if (typeof data.updatedAt === 'number') updatedAt = data.updatedAt;
    else if (data.updatedAt?.toMillis) updatedAt = data.updatedAt.toMillis();

    if (Date.now() - updatedAt > FIRESTORE_FRESH_MS) return null;

    return {
      rates: normalizeRates(data.rates),
      updatedAt,
      provider: data.provider ?? 'firestore',
    };
  } catch {
    return null;
  }
}

/** Fetch LKR-based rates (foreign per 1 LKR). Prefers fresh Firestore cache, else open.er-api. */
export async function fetchExchangeRatesSnapshot(): Promise<ExchangeRatesSnapshot> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return { rates: cache.rates, updatedAt: cache.updatedAt, provider: cache.provider };
  }

  const fromFs = await fetchFromFirestore();
  const snapshot = fromFs ?? (await fetchFromOpenErApi());

  cache = { ...snapshot, fetchedAt: Date.now() };
  return snapshot;
}

/** @deprecated Prefer fetchExchangeRatesSnapshot — returns foreign-per-LKR map. */
export async function fetchExchangeRates(
  _base = BASE_CURRENCY,
): Promise<Record<string, number>> {
  const snap = await fetchExchangeRatesSnapshot();
  return snap.rates;
}

/** How many LKR equal 1 unit of `currency`. */
export function lkrPerUnit(
  currency: string,
  rates: Record<string, number>,
  base = BASE_CURRENCY,
): number {
  if (currency === base) return 1;
  const code =
    currency === 'CNY' || currency === 'CNH' ? 'RMB' : currency;
  const foreignPerBase = rates[code] ?? rates[currency];
  if (!foreignPerBase || foreignPerBase <= 0) {
    throw new Error(`Missing exchange rate for ${currency}.`);
  }
  return 1 / foreignPerBase;
}

export async function convertToBase(
  amount: number,
  currency: string,
  base = BASE_CURRENCY,
): Promise<number> {
  if (currency === base) return amount;
  const { rates } = await fetchExchangeRatesSnapshot();
  return convertToBaseSync(amount, currency, rates, base);
}

export function convertToBaseSync(
  amount: number,
  currency: string,
  rates: Record<string, number>,
  base = BASE_CURRENCY,
): number {
  if (currency === base) return amount;
  const perUnit = lkrPerUnit(currency, rates, base);
  return Number((amount * perUnit).toFixed(2));
}

export async function convertFromBase(
  amountBase: number,
  currency: string,
  base = BASE_CURRENCY,
): Promise<number> {
  if (currency === base) return amountBase;
  const { rates } = await fetchExchangeRatesSnapshot();
  return convertFromBaseSync(amountBase, currency, rates, base);
}

export function convertFromBaseSync(
  amountBase: number,
  currency: string,
  rates: Record<string, number>,
  base = BASE_CURRENCY,
): number {
  if (currency === base) return amountBase;
  const code =
    currency === 'CNY' || currency === 'CNH' ? 'RMB' : currency;
  const foreignPerBase = rates[code] ?? rates[currency];
  if (!foreignPerBase || foreignPerBase <= 0) {
    throw new Error(`Missing exchange rate for ${currency}.`);
  }
  return Number((amountBase * foreignPerBase).toFixed(2));
}

/** Clear in-memory cache (tests / pull-to-refresh). */
export function clearExchangeRateCache() {
  cache = null;
}
