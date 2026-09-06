import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

import { REGION } from './config';
import { normalizeFlightOffer } from './flights-utils';

export const travelpayoutsApiToken = defineSecret('TRAVELPAYOUTS_API_TOKEN');
export const travelpayoutsMarker = defineSecret('TRAVELPAYOUTS_MARKER');
export const travelpayoutsProjectId = defineSecret('TRAVELPAYOUTS_PROJECT_ID');

const IATA = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/);
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Invalid travel date.');
const criteriaSchema = z.object({
  origin: IATA,
  destination: IATA,
  departureAt: DATE,
  returnAt: DATE.optional(),
  oneWay: z.boolean().default(true),
  direct: z.boolean().default(false),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default('USD'),
  limit: z.number().int().min(1).max(30).default(20),
  page: z.number().int().min(1).max(10).default(1),
});

type Criteria = z.infer<typeof criteriaSchema>;
type CacheEntry = { expiresAt: number; value: unknown };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();
const CACHE_MS = 60_000;
const MAX_CACHE_ENTRIES = 100;
const UPSTREAM_TIMEOUT_MS = 8_000;

function usableSecret(name: string, value: string) {
  if (!value.trim() || value.startsWith('YOUR_') || value === 'placeholder-set-me') {
    throw new HttpsError('failed-precondition', `${name} is not configured.`);
  }
}

function parseCriteria(data: unknown): Criteria {
  const parsed = criteriaSchema.safeParse(data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Enter valid airports and travel dates.');
  }
  const criteria = parsed.data;
  if (criteria.origin === criteria.destination) {
    throw new HttpsError('invalid-argument', 'Origin and destination must be different.');
  }
  if (!criteria.oneWay && !criteria.returnAt) {
    throw new HttpsError('invalid-argument', 'Choose a return date for a round trip.');
  }
  if (criteria.returnAt && criteria.returnAt <= criteria.departureAt) {
    throw new HttpsError('invalid-argument', 'Return date must be after departure.');
  }
  return criteria;
}

async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit,
  timeoutMessage: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HttpsError('deadline-exceeded', timeoutMessage);
    }
    throw new HttpsError('unavailable', timeoutMessage);
  } finally {
    clearTimeout(timer);
  }
}

async function api(path: string, params: Record<string, string>, token: string) {
  const url = new URL(`https://api.travelpayouts.com${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetchWithTimeout(url, {
    headers: { 'X-Access-Token': token, 'Accept-Encoding': 'gzip, deflate' },
  }, 'Flight data is temporarily unavailable.');
  if (response.status === 429) throw new HttpsError('resource-exhausted', 'Flight data is busy. Please try again shortly.');
  if (!response.ok) {
    logger.warn('Travelpayouts request failed', { status: response.status, path });
    throw new HttpsError('unavailable', 'Flight data is temporarily unavailable.');
  }
  try {
    return await response.json() as { success?: boolean; data?: unknown; error?: string };
  } catch {
    throw new HttpsError('unavailable', 'Flight data is temporarily unavailable.');
  }
}

function cached<T>(key: string, request: () => Promise<T>): Promise<T> {
  const now = Date.now();
  for (const [cachedKey, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(cachedKey);
  }
  const current = cache.get(key);
  if (current) return Promise.resolve(current.value as T);
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const requestPromise = Promise.resolve()
    .then(request)
    .then((value) => {
      cache.set(key, { expiresAt: Date.now() + CACHE_MS, value });
      while (cache.size > MAX_CACHE_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey === undefined) break;
        cache.delete(oldestKey);
      }
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, requestPromise);
  return requestPromise;
}

export async function searchFlightsForApi(data: unknown) {
  const criteria = parseCriteria(data);
  const token = travelpayoutsApiToken.value();
  usableSecret('TRAVELPAYOUTS_API_TOKEN', token);
  return cached(`flights:${JSON.stringify(criteria)}`, async () => {
    const result = await api('/aviasales/v3/prices_for_dates', {
      origin: criteria.origin, destination: criteria.destination, departure_at: criteria.departureAt,
      ...(criteria.returnAt ? { return_at: criteria.returnAt } : {}), one_way: String(criteria.oneWay),
      direct: String(criteria.direct), currency: criteria.currency, limit: String(criteria.limit), page: String(criteria.page), sorting: 'price',
    }, token);
    if (!result.success) throw new HttpsError('unavailable', result.error || 'No cached fares are available for this route.');
    const resultData = Array.isArray(result.data) ? result.data : [];
    return { currency: criteria.currency, offers: resultData.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object').map(normalizeFlightOffer) };
  });
}

export const searchFlights = onCall(
  { region: REGION, timeoutSeconds: 30, secrets: [travelpayoutsApiToken] },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in to search flights.');
    return searchFlightsForApi(request.data);
  },
);

const bookingSchema = z.object({ url: z.string().url() });

export async function createFlightBookingLinkForApi(data: unknown) {
  const input = bookingSchema.safeParse(data);
  if (!input.success) throw new HttpsError('invalid-argument', 'Invalid flight booking link.');
  const parsedUrl = new URL(input.data.url);
  if (parsedUrl.hostname !== 'www.aviasales.com' && parsedUrl.hostname !== 'aviasales.com') {
    throw new HttpsError('invalid-argument', 'Unsupported booking link.');
  }
  const token = travelpayoutsApiToken.value();
  const marker = travelpayoutsMarker.value();
  const trs = travelpayoutsProjectId.value();
  usableSecret('TRAVELPAYOUTS_API_TOKEN', token);
  usableSecret('TRAVELPAYOUTS_MARKER', marker);
  usableSecret('TRAVELPAYOUTS_PROJECT_ID', trs);
  if (!Number.isFinite(Number(marker)) || !Number.isFinite(Number(trs))) {
    throw new HttpsError('failed-precondition', 'Travelpayouts affiliate configuration is invalid.');
  }
  return cached(`partner-link:${input.data.url}`, async () => {
    let response: Response;
    try {
      response = await fetchWithTimeout('https://api.travelpayouts.com/links/v1/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Access-Token': token },
        body: JSON.stringify({ trs: Number(trs), marker: Number(marker), shorten: false, links: [{ url: input.data.url, sub_id: 'gemfort_flights' }] }),
      }, 'Could not create the booking link.');
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('unavailable', 'Could not create the booking link.');
    }
    let payload: { code?: string; error?: string; result?: { links?: Array<{ code?: string; message?: string; partner_url?: string }> } };
    try {
      payload = await response.json() as typeof payload;
    } catch {
      throw new HttpsError('unavailable', 'Could not create the booking link.');
    }
    const link = payload.result?.links?.[0];
    if (!response.ok || payload.code !== 'success' || link?.code !== 'success' || !link.partner_url) {
      logger.warn('Travelpayouts partner link failed', { status: response.status, code: payload.code, detail: link?.message ?? payload.error });
      throw new HttpsError('failed-precondition', 'Travelpayouts could not create an affiliate booking link. Confirm that this project is connected to Aviasales.');
    }
    return { bookingUrl: link.partner_url };
  });
}

export const createFlightBookingLink = onCall(
  { region: REGION, timeoutSeconds: 30, secrets: [travelpayoutsApiToken, travelpayoutsMarker, travelpayoutsProjectId] },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in to continue to booking.');
    return createFlightBookingLinkForApi(request.data);
  },
);

export async function getFlightPriceCalendarForApi(data: unknown) {
  const criteria = parseCriteria(data);
  const token = travelpayoutsApiToken.value();
  usableSecret('TRAVELPAYOUTS_API_TOKEN', token);
  return cached(`calendar:${JSON.stringify(criteria)}`, async () => {
    const result = await api('/v2/prices/week-matrix', {
      origin: criteria.origin, destination: criteria.destination, depart_date: criteria.departureAt,
      ...(criteria.returnAt ? { return_date: criteria.returnAt } : {}), one_way: String(criteria.oneWay),
      currency: criteria.currency, show_to_affiliates: 'true',
    }, token);
    const data = Array.isArray(result.data) ? result.data : [];
    return {
      currency: criteria.currency,
      days: data
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item) => ({
          date: String(item.depart_date ?? ''),
          price: Number(item.value ?? 0),
          stops: Number(item.number_of_changes ?? 0),
          actual: item.actual !== false,
        })),
    };
  });
}

export const getFlightPriceCalendar = onCall(
  { region: REGION, timeoutSeconds: 30, secrets: [travelpayoutsApiToken] },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in to view fare dates.');
    return getFlightPriceCalendarForApi(request.data);
  },
);
