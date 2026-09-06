import { Timestamp } from 'firebase-admin/firestore';

import { ApiError } from './errors';
import { db } from '../admin';
import { convertToBaseServer, loadServerRates } from '../gemtrack/exchange-rates';

const OFFER_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const MAX_OFFERS_PER_DAY = 5;

const SUPPORTED_CURRENCIES = new Set([
  'LKR',
  'RMB',
  'USD',
  'EUR',
  'GBP',
  'THB',
  'AED',
  'AUD',
  'SGD',
  'TZS',
  'MGA',
  'IDR',
]);

type BuyerBusinessInput = {
  id?: string | null;
  businessName?: string | null;
  logoUrl?: string | null;
  country?: string | null;
};

export type SubmitListingOfferInput = {
  amount: number;
  currency: string;
  buyerName: string;
  buyerBusiness?: BuyerBusinessInput | null;
  message?: string | null;
};

function assertObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new ApiError('invalid-argument', 'Request body must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

function optionalString(value: unknown, name: string, maxLength: number): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new ApiError('invalid-argument', `${name} is invalid.`);
  }
  return value.trim() || null;
}

function requiredString(value: unknown, name: string, maxLength: number): string {
  const normalized = optionalString(value, name, maxLength);
  if (!normalized) throw new ApiError('invalid-argument', `${name} is required.`);
  return normalized;
}

function listingIdOf(value: string): string {
  const listingId = value.trim();
  if (!listingId || listingId.includes('/')) {
    throw new ApiError('invalid-argument', 'A valid listingId is required.');
  }
  return listingId;
}

function normalizeCurrency(value: unknown): string {
  const currency = typeof value === 'string' ? value.trim().toUpperCase() : '';
  const normalized = currency === 'CNY' || currency === 'CNH' ? 'RMB' : currency;
  if (!SUPPORTED_CURRENCIES.has(normalized)) {
    throw new ApiError('failed-precondition', `Exchange rate for ${currency || 'this currency'} is unavailable.`);
  }
  return normalized;
}

export function parseSubmitListingOfferInput(value: unknown): SubmitListingOfferInput {
  const input = assertObject(value);
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000) {
    throw new ApiError('invalid-argument', 'Enter a valid offer amount.');
  }

  const buyerBusinessValue = input.buyerBusiness;
  let buyerBusiness: BuyerBusinessInput | null | undefined;
  if (buyerBusinessValue === null || buyerBusinessValue === undefined) {
    buyerBusiness = buyerBusinessValue as null | undefined;
  } else {
    const business = assertObject(buyerBusinessValue);
    buyerBusiness = {
      id: optionalString(business.id, 'buyerBusiness.id', 128),
      businessName: optionalString(business.businessName, 'buyerBusiness.businessName', 200),
      logoUrl: optionalString(business.logoUrl, 'buyerBusiness.logoUrl', 2_000),
      country: optionalString(business.country, 'buyerBusiness.country', 120),
    };
  }

  return {
    amount,
    currency: normalizeCurrency(input.currency),
    buyerName: requiredString(input.buyerName, 'buyerName', 200),
    buyerBusiness,
    message: optionalString(input.message, 'message', 1_000),
  };
}

function millis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as Timestamp).toMillis();
  }
  if (value && typeof (value as { seconds?: unknown }).seconds === 'number') {
    return Number((value as { seconds: number }).seconds) * 1_000;
  }
  return 0;
}

function guardId(uid: string, listingId: string): string {
  return `${uid}_${listingId}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 1_500);
}

export async function submitListingOfferForApi(
  listingIdInput: string,
  buyerUid: string,
  input: SubmitListingOfferInput,
): Promise<{ offerId: string }> {
  const listingId = listingIdOf(listingIdInput);
  const rates = await loadServerRates();
  const amountBase = convertToBaseServer(input.amount, input.currency, rates);
  const now = Timestamp.now();
  const listingRef = db.collection('gems').doc(listingId);
  const offerRef = db.collection('listing_offers').doc();
  const guardRef = db.collection('listing_offer_guards').doc(guardId(buyerUid, listingId));
  const dayKey = new Date(now.toMillis()).toISOString().slice(0, 10);
  const dailyRef = db
    .collection('listing_offer_daily')
    .doc(`${buyerUid}_${dayKey}`.replace(/[^A-Za-z0-9_-]/g, '_'));

  await db.runTransaction(async (transaction) => {
    const listingSnap = await transaction.get(listingRef);
    if (!listingSnap.exists) throw new ApiError('not-found', 'Listing not found.');
    const listing = listingSnap.data() as Record<string, unknown>;
    const sellerUid = typeof listing.sellerUid === 'string' ? listing.sellerUid : '';
    if (!sellerUid) throw new ApiError('failed-precondition', 'This listing cannot receive offers.');
    if (sellerUid === buyerUid) throw new ApiError('permission-denied', 'You cannot offer on your own listing.');
    if (listing.status !== 'active') {
      throw new ApiError('failed-precondition', 'This listing is not accepting offers.');
    }

    const guardSnap = await transaction.get(guardRef);
    if (guardSnap.exists) {
      const guard = guardSnap.data() as { offerId?: unknown; lastOfferAt?: unknown };
      const previousOfferId = typeof guard.offerId === 'string' ? guard.offerId : '';
      if (previousOfferId) {
        const previousSnap = await transaction.get(db.collection('listing_offers').doc(previousOfferId));
        if (previousSnap.exists) {
          const previous = previousSnap.data() as { status?: unknown; updatedAt?: unknown; createdAt?: unknown };
          if (previous.status === 'pending') {
            throw new ApiError('already-exists', 'You already have a pending offer on this gem. Withdraw it first to send a new one.');
          }
          if (previous.status === 'withdrawn' || previous.status === 'declined') {
            const lastActivity = millis(previous.updatedAt) || millis(previous.createdAt);
            if (now.toMillis() - lastActivity < OFFER_COOLDOWN_MS) {
              throw new ApiError('failed-precondition', 'Wait 12 hours after withdrawing before offering on this gem again.');
            }
          }
        } else if (now.toMillis() - millis(guard.lastOfferAt) < OFFER_COOLDOWN_MS) {
          throw new ApiError('failed-precondition', 'Wait 12 hours after withdrawing before offering on this gem again.');
        }
      }
    }

    const dailySnap = await transaction.get(dailyRef);
    const offersToday = dailySnap.exists
      ? Number((dailySnap.data() as { count?: unknown }).count ?? 0)
      : 0;
    if (offersToday >= MAX_OFFERS_PER_DAY) {
      throw new ApiError('resource-exhausted', `Offer limit reached (${MAX_OFFERS_PER_DAY} per day). Try again tomorrow.`);
    }

    transaction.create(offerRef, {
      listingId,
      listingSlug: typeof listing.shareableSlug === 'string' ? listing.shareableSlug : listingId,
      listingTitle: typeof listing.title === 'string' ? listing.title : 'Gem listing',
      sellerUid,
      businessId: typeof listing.businessId === 'string' ? listing.businessId : '',
      buyerUid,
      buyerName: input.buyerName,
      buyerBusinessId: input.buyerBusiness?.id ?? null,
      buyerBusinessName: input.buyerBusiness?.businessName ?? null,
      buyerLogoUrl: input.buyerBusiness?.logoUrl ?? null,
      buyerCountry: input.buyerBusiness?.country ?? null,
      amount: input.amount,
      currency: input.currency,
      amountBase,
      message: input.message ?? null,
      status: 'pending',
      sellerCleared: false,
      sellerReadAt: null,
      createdAt: now,
      updatedAt: now,
    });
    transaction.set(guardRef, {
      buyerUid,
      listingId,
      offerId: offerRef.id,
      lastOfferAt: now,
      updatedAt: now,
    });
    transaction.set(dailyRef, {
      buyerUid,
      dayKey,
      count: offersToday + 1,
      updatedAt: now,
    });
  });

  return { offerId: offerRef.id };
}
