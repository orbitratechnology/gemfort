import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { db } from '../admin';
import { REGION } from '../config';

const BASE_CURRENCY = 'LKR';
const OPEN_ER_API = `https://open.er-api.com/v6/latest/${BASE_CURRENCY}`;

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
  const res = await fetch(OPEN_ER_API);
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
    throw new Error(`Missing exchange rate for ${currency}`);
  }
  return Number((amount / foreignPerBase).toFixed(2));
}

/** Load cached rates from Firestore, or fetch live if missing/stale. */
export async function loadServerRates(): Promise<ServerRates> {
  const ref = db.doc('system/exchange_rates');
  const snap = await ref.get();
  if (snap.exists) {
    const data = snap.data() as {
      rates?: ServerRates;
      updatedAt?: Timestamp;
      base?: string;
    };
    const ageMs = data.updatedAt
      ? Date.now() - data.updatedAt.toMillis()
      : Number.POSITIVE_INFINITY;
    if (data.base === BASE_CURRENCY && data.rates && ageMs < 24 * 60 * 60 * 1000) {
      const rates: ServerRates = { [BASE_CURRENCY]: 1, ...data.rates };
      if (!rates.RMB && typeof data.rates.CNY === 'number') {
        rates.RMB = data.rates.CNY;
      }
      return rates;
    }
  }

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
}

/** Daily FX sync at 01:00 Asia/Colombo — caches rates for clients + CF. */
export const syncExchangeRates = onSchedule(
  {
    schedule: '0 1 * * *',
    timeZone: 'Asia/Colombo',
    region: REGION,
    memory: '256MiB',
    timeoutSeconds: 60,
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
