import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { db } from '../admin';
import { ApiError } from '../api/errors';
import { REGION } from '../config';

const BASE_CURRENCY = 'LKR';
const OPEN_ER_API = `https://open.er-api.com/v6/latest/${BASE_CURRENCY}`;
const FETCH_TIMEOUT_MS = 8_000;
const FRESH_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Past this age cached rates are too old to price a financial mutation. */
const STALE_FALLBACK_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** App quote codes → open.er-api ISO keys when they differ. */
const QUOTE_CODES: { code: string; api: string }[] = [
  { code: 'USD', api: 'USD' },
  { code: 'EUR', api: 'EUR' },
  { code: 'GBP', api: 'GBP' },
  { code: 'THB', api: 'THB' },
  { code: 'AED', api: 'AED' },
  { code: 'RMB', api: 'CNY' },
  { code: 'AUD', api: 'AUD' },
  { code: 'SGD', api: 'SGD' },
  { code: 'TZS', api: 'TZS' },
  { code: 'MGA', api: 'MGA' },
  { code: 'IDR', api: 'IDR' },
];

export type ServerRates = Record<string, number>;

/** Fetch foreign-per-LKR rates from open.er-api (shared by sync + AP lifecycle). */
export async function fetchOpenErRates(): Promise<{
  rates: ServerRates;
  updatedAtUnix: number;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(OPEN_ER_API, { signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('open.er-api request timed out');
    }
    throw new Error('open.er-api request failed');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`open.er-api HTTP ${res.status}`);

  const data = (await res.json()) as {
    result?: string;
    rates?: Record<string, number>;
    time_last_update_unix?: number;
  };

  if (data.result !== 'success' || !data.rates) {
    throw new Error('open.er-api returned unsuccessful payload');
  }

  const rates: ServerRates = { [BASE_CURRENCY]: 1 };
  for (const { code, api } of QUOTE_CODES) {
    const value = data.rates[api] ?? data.rates[code];
    if (typeof value === 'number' && value > 0) rates[code] = value;
  }

  return {
    rates,
    updatedAtUnix: data.time_last_update_unix ?? Math.floor(Date.now() / 1000),
  };
}

export function convertToBaseServer(
  amount: number,
  currency: string,
  rates: ServerRates,
  base = BASE_CURRENCY,
): number {
  if (currency === base) return amount;
  const normalized = currency === 'CNY' || currency === 'CNH' ? 'RMB' : currency;
  const foreignPerBase = rates[normalized] ?? rates[currency];
  if (!foreignPerBase || foreignPerBase <= 0) {
    throw new ApiError('failed-precondition', `Exchange rate for ${currency} is unavailable.`);
  }
  return Number((amount / foreignPerBase).toFixed(2));
}

function normalizeCachedRates(data: { rates?: ServerRates }): ServerRates | null {
  if (!data.rates) return null;
  const rates: ServerRates = { [BASE_CURRENCY]: 1, ...data.rates };
  if (!rates.RMB && typeof data.rates.CNY === 'number') {
    rates.RMB = data.rates.CNY;
  }
  return rates;
}

/**
 * Load cached rates from Firestore, refreshing them when older than a day.
 * If the upstream API is down, fall back to the last known-good cache (up to
 * a week old) rather than failing the mutation; with no usable cache the
 * caller gets a 503 instead of a generic 500.
 */
export async function loadServerRates(): Promise<ServerRates> {
  const ref = db.doc('system/exchange_rates');
  const snap = await ref.get();
  const data = snap.exists
    ? (snap.data() as { rates?: ServerRates; updatedAt?: Timestamp; base?: string })
    : null;
  const cached = data?.base === BASE_CURRENCY ? normalizeCachedRates(data) : null;
  const ageMs = data?.updatedAt
    ? Date.now() - data.updatedAt.toMillis()
    : Number.POSITIVE_INFINITY;
  if (cached && ageMs < FRESH_MAX_AGE_MS) return cached;

  try {
    const { rates, updatedAtUnix } = await fetchOpenErRates();
    await ref.set(
      {
        base: BASE_CURRENCY,
        rates,
        provider: 'open.er-api.com',
        updatedAt: FieldValue.serverTimestamp(),
        sourceUpdatedAtUnix: updatedAtUnix,
      },
      { merge: true },
    );
    return rates;
  } catch (error) {
    if (cached && ageMs < STALE_FALLBACK_MAX_AGE_MS) {
      logger.warn('FX refresh failed; using stale cached rates', {
        cacheAgeHours: Math.round(ageMs / 3_600_000),
        error: error instanceof Error ? error.message : String(error),
      });
      return cached;
    }
    logger.error('FX refresh failed with no usable cache', {
      cacheAgeHours: Number.isFinite(ageMs) ? Math.round(ageMs / 3_600_000) : null,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ApiError(
      'unavailable',
      'Exchange rates are temporarily unavailable. Please try again shortly.',
    );
  }
}

/** FX sync every 6 hours (Asia/Colombo) — caches rates for clients + CF. */
export const syncExchangeRates = onSchedule(
  {
    schedule: '0 */6 * * *',
    timeZone: 'Asia/Colombo',
    region: REGION,
    memory: '256MiB',
    timeoutSeconds: 60,
    retryCount: 3,
  },
  async () => {
    const { rates, updatedAtUnix } = await fetchOpenErRates();
    await db.doc('system/exchange_rates').set(
      {
        base: BASE_CURRENCY,
        rates,
        provider: 'open.er-api.com',
        updatedAt: FieldValue.serverTimestamp(),
        sourceUpdatedAtUnix: updatedAtUnix,
      },
      { merge: true },
    );
    logger.info('Exchange rates synced', {
      codes: Object.keys(rates).length,
      sourceUpdatedAtUnix: updatedAtUnix,
    });
  },
);
