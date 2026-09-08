import { Timestamp } from 'firebase-admin/firestore';

import { db } from '../admin';
import { ensureDeterministicNotificationDoc } from '../notifications/create';
import { convertToBaseServer, loadServerRates } from '../gemtrack/exchange-rates';
import { ApiError } from './errors';

const STAGES = new Set(['rough', 'cut', 'heated', 'polished']);
const CURRENCIES = new Set([
  'LKR', 'RMB', 'USD', 'EUR', 'GBP', 'THB', 'AED', 'AUD', 'SGD', 'TZS', 'MGA', 'IDR',
]);
const PAYMENT_METHODS = new Set(['cash', 'bank_transfer', 'cheque', 'bill', 'other']);

export type GemTransferPaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'cheque'
  | 'bill'
  | 'other';

export type CreateGemTransferInput = {
  recipientBusinessId: string;
  recipientContactId?: string | null;
  recipientName: string;
  amount: number;
  currency: string;
  paymentMethod: GemTransferPaymentMethod;
  sourceTripId?: string | null;
  sourceTripGemId?: string | null;
};

type TransferDoc = {
  gemId: string;
  sellerUid: string;
  sellerName: string;
  recipientUid: string;
  recipientBusinessId: string;
  recipientContactId: string | null;
  recipientName: string;
  amount: number;
  currency: string;
  amountBase: number;
  paymentMethod: GemTransferPaymentMethod;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  previouslyListed: boolean;
  previousMarketplaceListingId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  sourceTripId: string | null;
  sourceTripGemId: string | null;
};

function objectOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new ApiError('invalid-argument', 'Request body must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

function idOf(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new ApiError('invalid-argument', `${name} is required.`);
  const normalized = value.trim();
  if (!normalized || normalized.includes('/')) {
    throw new ApiError('invalid-argument', `A valid ${name} is required.`);
  }
  return normalized;
}

function optionalIdOf(value: unknown, name: string): string | null {
  if (value == null || value === '') return null;
  return idOf(value, name);
}

function stringOf(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string') throw new ApiError('invalid-argument', `${name} is required.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new ApiError('invalid-argument', `${name} is invalid.`);
  }
  return normalized;
}

function currencyOf(value: unknown): string {
  const raw = stringOf(value, 'currency', 6).toUpperCase();
  const currency = raw === 'CNY' || raw === 'CNH' ? 'RMB' : raw;
  if (!CURRENCIES.has(currency)) throw new ApiError('invalid-argument', 'Unsupported currency.');
  return currency;
}

function paymentMethodOf(value: unknown): GemTransferPaymentMethod {
  if (typeof value !== 'string' || !PAYMENT_METHODS.has(value)) {
    throw new ApiError('invalid-argument', 'Choose a valid payment method.');
  }
  return value as GemTransferPaymentMethod;
}

export function parseCreateGemTransferInput(value: unknown): CreateGemTransferInput {
  const input = objectOf(value);
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000) {
    throw new ApiError('invalid-argument', 'Enter a valid sale amount.');
  }
  return {
    recipientBusinessId: idOf(input.recipientBusinessId, 'recipientBusinessId'),
    recipientContactId: optionalIdOf(input.recipientContactId, 'recipientContactId'),
    recipientName: stringOf(input.recipientName, 'recipientName', 200),
    amount,
    currency: currencyOf(input.currency),
    paymentMethod: paymentMethodOf(input.paymentMethod),
    sourceTripId: optionalIdOf(input.sourceTripId, 'sourceTripId'),
    sourceTripGemId: optionalIdOf(input.sourceTripGemId, 'sourceTripGemId'),
  };
}

function gemStage(data: Record<string, unknown>): string {
  const value = typeof data.stoneStage === 'string' ? data.stoneStage : data.status;
  return typeof value === 'string' && STAGES.has(value) ? value : 'rough';
}

function ownerName(data: Record<string, unknown>, fallback: string): string {
  return typeof data.displayName === 'string' && data.displayName.trim()
    ? data.displayName.trim()
    : fallback;
}

function saleNotification(
  recipientUid: string,
  type: 'gem_transfer_requested' | 'gem_transfer_accepted' | 'gem_transfer_rejected' | 'gem_transfer_cancelled',
  requestId: string,
  title: string,
  message: string,
  actorName: string,
  imageUrl: string | null,
) {
  return ensureDeterministicNotificationDoc({
    recipientUid,
    type,
    title,
    message,
    referenceType: 'gem_transfer',
    referenceId: requestId,
    actorName,
    imageUrl,
    dedupeKey: `${type}:${requestId}`,
  });
}

export async function createGemTransferForApi(
  gemIdInput: string,
  sellerUid: string,
  input: CreateGemTransferInput,
): Promise<{ requestId: string; status: 'pending' }> {
  const gemId = idOf(gemIdInput, 'gemId');
  const rates = await loadServerRates();
  const amountBase = convertToBaseServer(input.amount, input.currency, rates);
  const gemRef = db.collection('gemtrack_gems').doc(gemId);
  const requestRef = db.collection('gem_transfer_requests').doc();
  const now = Timestamp.now();
  const sourceTripId = input.sourceTripId ?? null;
  const sourceTripGemId = input.sourceTripGemId ?? null;
  if ((sourceTripId == null) !== (sourceTripGemId == null)) {
    throw new ApiError('invalid-argument', 'Trip sale context is incomplete.');
  }

  const result = await db.runTransaction(async (transaction) => {
    // Firestore transactions require all reads to happen before writes. Keep
    // these reads explicit and sequential so the Admin SDK can track them
    // consistently across deployed runtimes.
    const gemSnap = await transaction.get(gemRef);
    const businessSnap = await transaction.get(
      db.collection('businesses').doc(input.recipientBusinessId),
    );
    const contactSnap = input.recipientContactId
      ? await transaction.get(db.collection('gemtrack_contacts').doc(input.recipientContactId))
      : null;
    const sellerSnap = await transaction.get(db.collection('users').doc(sellerUid));
    const tripGemRef = sourceTripGemId
      ? db.collection('gemtrack_trip_gems').doc(sourceTripGemId)
      : null;
    const tripGemSnap = tripGemRef ? await transaction.get(tripGemRef) : null;
    if (!gemSnap.exists) throw new ApiError('not-found', 'Gem not found.');
    const gem = gemSnap.data() as Record<string, unknown>;
    if (gem.ownerUid !== sellerUid) throw new ApiError('permission-denied', 'You do not own this gem.');
    const isOnTrip = gem.custody === 'on_trip' || gem.status === 'on_trip';
    if (isOnTrip && (!sourceTripId || !sourceTripGemId)) {
      throw new ApiError('failed-precondition', 'Choose the sale action from the active trip.');
    }
    if (sourceTripId && sourceTripGemId) {
      if (!tripGemSnap?.exists) throw new ApiError('not-found', 'Trip gem record not found.');
      const tripGem = tripGemSnap.data() as Record<string, unknown>;
      if (
        tripGem.ownerUid !== sellerUid ||
        tripGem.tripId !== sourceTripId ||
        tripGem.gemId !== gemId ||
        tripGem.status !== 'on_trip'
      ) {
        throw new ApiError('failed-precondition', 'This gem is no longer active on that trip.');
      }
    }
    const lockedStatuses = new Set([
      'with_cutter',
      'with_heater',
      'with_polisher',
      'on_ap',
    ]);
    if (gem.currentApId || (gem.custody && gem.custody !== 'on_trip') || lockedStatuses.has(String(gem.status))) {
      throw new ApiError('failed-precondition', 'Complete or return the active AP, trip, or service before selling this gem.');
    }
    if (gem.saleTransferRequestId || gem.saleStatus === 'pending') {
      throw new ApiError('already-exists', 'This gem already has a pending sale request.');
    }
    if (gem.saleStatus === 'sold' || gem.outcome === 'sold') {
      throw new ApiError('failed-precondition', 'This gem has already been sold.');
    }
    if (gem.outcome === 'returned') {
      throw new ApiError('failed-precondition', 'This returned gem must be restored before it can be sold.');
    }
    if (!businessSnap.exists) throw new ApiError('not-found', 'The selected trader profile was not found.');
    const business = businessSnap.data() as Record<string, unknown>;
    const recipientUid = typeof business.ownerUid === 'string' ? business.ownerUid : '';
    if (!recipientUid || recipientUid === sellerUid) {
      throw new ApiError('invalid-argument', 'Choose another trader.');
    }
    if (business.isActive === false || business.verificationStatus !== 'verified') {
      throw new ApiError('failed-precondition', 'The selected trader is not currently able to receive gems.');
    }
    if (business.businessType !== 'trader') {
      throw new ApiError('failed-precondition', 'A gem sale can only be sent to a verified trader.');
    }
    if (contactSnap && (!contactSnap.exists || contactSnap.data()?.ownerUid !== sellerUid)) {
      throw new ApiError('permission-denied', 'The selected contact is not yours.');
    }
    if (
      input.recipientContactId &&
      contactSnap?.data()?.linkedBusinessId !== input.recipientBusinessId
    ) {
      throw new ApiError('invalid-argument', 'The selected contact is not linked to that trader.');
    }

    const seller = sellerSnap.data() as Record<string, unknown> | undefined;
    const sellerDisplayName = ownerName(seller ?? {}, 'A GemFort trader');
    const businessDisplayName =
      typeof business.businessName === 'string' && business.businessName.trim()
        ? business.businessName.trim()
        : input.recipientName;
    const contactDisplayName =
      input.recipientContactId && typeof contactSnap?.data()?.displayName === 'string'
        ? String(contactSnap.data()?.displayName).trim()
        : '';
    const recipientDisplayName = contactDisplayName
      ? `${businessDisplayName} · ${contactDisplayName}`
      : businessDisplayName;
    const previouslyListed = gem.isListedOnMarketplace === true;
    const listingId = typeof gem.marketplaceListingId === 'string' ? gem.marketplaceListingId : null;
    const imageUrl = Array.isArray(gem.photoUrls) && typeof gem.photoUrls[0] === 'string'
      ? gem.photoUrls[0] as string
      : null;
    const transfer: TransferDoc = {
      gemId,
      sellerUid,
      sellerName: sellerDisplayName,
      recipientUid,
      recipientBusinessId: input.recipientBusinessId,
      recipientContactId: input.recipientContactId ?? null,
      recipientName: recipientDisplayName,
      amount: input.amount,
      currency: input.currency,
      amountBase,
      paymentMethod: input.paymentMethod,
      status: 'pending',
      previouslyListed,
      previousMarketplaceListingId: listingId,
      createdAt: now,
      updatedAt: now,
      sourceTripId,
      sourceTripGemId,
    };
    transaction.create(requestRef, transfer);
    transaction.update(gemRef, {
      saleTransferRequestId: requestRef.id,
      saleStatus: 'pending',
      outcome: 'sold',
      status: 'sold',
      soldPrice: input.amount,
      soldPriceCurrency: input.currency,
      soldPriceBase: amountBase,
      soldDate: now,
      soldToUid: recipientUid,
      soldToBusinessId: input.recipientBusinessId,
      soldToContactId: input.recipientContactId ?? null,
      soldToName: recipientDisplayName,
      salePaymentMethod: input.paymentMethod,
      isListedOnMarketplace: false,
      updatedAt: now,
    });
    if (listingId) transaction.update(db.collection('gems').doc(listingId), { status: 'sold', updatedAt: now });
    transaction.create(db.collection('gemtrack_gem_events').doc(), {
      gemId,
      ownerUid: sellerUid,
      eventType: 'sale_pending',
      fromStatus: gem.status ?? null,
      toStatus: 'sold',
      description: `Sale request sent to ${recipientDisplayName}`,
      weightAtEvent: gem.currentWeight ?? null,
      photoUrl: null,
      costAdded: null,
      relatedServiceId: null,
      relatedApId: null,
      createdByUid: sellerUid,
      createdAt: now,
    });
    return { requestId: requestRef.id, recipientUid, sellerDisplayName, recipientDisplayName, imageUrl };
  });

  try {
    await saleNotification(
      result.recipientUid,
      'gem_transfer_requested',
      result.requestId,
      'Gem sale request',
      `${result.sellerDisplayName} wants to transfer a gem to your account for ${input.currency} ${input.amount.toLocaleString()}.`,
      result.sellerDisplayName,
      result.imageUrl,
    );
  } catch (error) {
    console.error('gem-transfer-request-notification-failed', error);
  }
  return { requestId: result.requestId, status: 'pending' };
}

function restoredStatus(gem: Record<string, unknown>, previouslyListed: boolean): string {
  if (previouslyListed) return 'listed';
  return gemStage(gem);
}

export async function respondGemTransferForApi(
  requestIdInput: string,
  recipientUid: string,
  action: 'accepted' | 'rejected',
): Promise<{ ok: true; status: 'accepted' | 'rejected'; gemId: string }> {
  const requestId = idOf(requestIdInput, 'requestId');
  const requestRef = db.collection('gem_transfer_requests').doc(requestId);
  const rates = action === 'accepted' ? await loadServerRates() : null;
  const result = await db.runTransaction(async (transaction) => {
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists) throw new ApiError('not-found', 'Gem transfer request not found.');
    const request = requestSnap.data() as TransferDoc;
    if (request.recipientUid !== recipientUid) throw new ApiError('permission-denied', 'Only the recipient can respond.');
    if (request.status !== 'pending') {
      if (request.status === 'accepted' || request.status === 'rejected') {
        return { status: request.status, gemId: request.gemId, replay: true as const };
      }
      throw new ApiError('failed-precondition', 'This sale request is no longer awaiting a response.');
    }
    const gemRef = db.collection('gemtrack_gems').doc(request.gemId);
    const gemSnap = await transaction.get(gemRef);
    if (!gemSnap.exists) throw new ApiError('failed-precondition', 'The gem is no longer available.');
    const gem = gemSnap.data() as Record<string, unknown>;
    if (gem.ownerUid !== request.sellerUid || gem.saleTransferRequestId !== requestId) {
      throw new ApiError('failed-precondition', 'This sale request is no longer active.');
    }
    const now = Timestamp.now();
    const recipientUserSnap = await transaction.get(db.collection('users').doc(recipientUid));
    const recipientUser = recipientUserSnap.data() as Record<string, unknown> | undefined;
    const sourceTripGemSnap = action === 'accepted' && request.sourceTripGemId
      ? await transaction.get(db.collection('gemtrack_trip_gems').doc(request.sourceTripGemId))
      : null;
    if (action === 'accepted' && (request.sourceTripId || request.sourceTripGemId)) {
      if (
        !request.sourceTripId ||
        !request.sourceTripGemId ||
        !sourceTripGemSnap?.exists ||
        sourceTripGemSnap.data()?.ownerUid !== request.sellerUid ||
        sourceTripGemSnap.data()?.tripId !== request.sourceTripId ||
        sourceTripGemSnap.data()?.gemId !== request.gemId ||
        sourceTripGemSnap.data()?.status !== 'on_trip'
      ) {
        throw new ApiError('failed-precondition', 'The trip sale context is no longer active.');
      }
    }
    const actorName = request.recipientName || ownerName(recipientUser ?? {}, 'Trader');
    if (action === 'rejected') {
      transaction.update(requestRef, { status: 'rejected', respondedByUid: recipientUid, respondedAt: now, updatedAt: now });
      transaction.update(gemRef, {
        saleTransferRequestId: null,
        saleStatus: 'unsold',
        outcome: request.previouslyListed ? 'listed' : null,
        status: restoredStatus(gem, request.previouslyListed),
        soldPrice: null,
        soldPriceCurrency: null,
        soldPriceBase: null,
        soldDate: null,
        soldToUid: null,
        soldToBusinessId: null,
        soldToContactId: null,
        soldToName: null,
        salePaymentMethod: null,
        isListedOnMarketplace: request.previouslyListed,
        updatedAt: now,
      });
      if (request.previouslyListed && request.previousMarketplaceListingId) {
        transaction.update(db.collection('gems').doc(request.previousMarketplaceListingId), { status: 'active', updatedAt: now });
      }
      return { status: 'rejected' as const, gemId: request.gemId, sellerUid: request.sellerUid, actorName, replay: false as const };
    }

    const amountBase = convertToBaseServer(request.amount, request.currency, rates!);
    transaction.update(requestRef, { status: 'accepted', respondedByUid: recipientUid, respondedAt: now, updatedAt: now });
    transaction.update(gemRef, {
      ownerUid: recipientUid,
      companyId: typeof recipientUser?.companyId === 'string' ? recipientUser.companyId : null,
      acquisitionType: 'purchase',
      acquisitionDate: now,
      acquisitionCost: request.amount,
      acquisitionCurrency: request.currency,
      acquisitionCostBase: amountBase,
      totalCost: amountBase,
      totalCostCurrency: 'LKR',
      status: gemStage(gem),
      stoneStage: gemStage(gem),
      custody: null,
      currentLocation: null,
      currentHolderContactId: null,
      currentApId: null,
      outcome: null,
      saleStatus: 'unsold',
      saleTransferRequestId: null,
      isListedOnMarketplace: false,
      marketplaceListingId: null,
      soldPrice: null,
      soldPriceCurrency: null,
      soldPriceBase: null,
      soldDate: null,
      soldToUid: null,
      soldToBusinessId: null,
      soldToContactId: null,
      soldToName: null,
      salePaymentMethod: null,
      acquiredFromUid: request.sellerUid,
      acquiredFromName: request.sellerName,
      acquiredAt: now,
      lastSaleRequestId: requestId,
      lastSoldPrice: request.amount,
      lastSoldPriceCurrency: request.currency,
      lastSalePaymentMethod: request.paymentMethod,
      updatedAt: now,
    });
    if (request.sourceTripGemId) {
      transaction.update(db.collection('gemtrack_trip_gems').doc(request.sourceTripGemId), {
        status: 'sold',
        salePrice: request.amount,
        saleDate: now,
        updatedAt: now,
      });
    }
    const sellerTransactionRef = db.collection('gemtrack_transactions').doc();
    const buyerTransactionRef = db.collection('gemtrack_transactions').doc();
    transaction.create(sellerTransactionRef, {
      ownerUid: request.sellerUid,
      type: 'income', amount: request.amount, currency: request.currency, amountBase,
      category: 'gem_sale', description: `Sale of ${String(gem.sku ?? request.gemId)}`,
      gemId: request.gemId, contactId: request.recipientContactId, date: now,
      sourceType: 'gem_transfer', sourceId: requestId, createdAt: now,
    });
    transaction.create(buyerTransactionRef, {
      ownerUid: recipientUid,
      type: 'expense', amount: request.amount, currency: request.currency, amountBase,
      category: 'gem_purchase', description: `Purchase of ${String(gem.sku ?? request.gemId)}`,
      gemId: request.gemId, contactId: null, date: now,
      sourceType: 'gem_transfer', sourceId: requestId, createdAt: now,
    });
    transaction.create(db.collection('gemtrack_gem_events').doc(), {
      gemId: request.gemId,
      ownerUid: recipientUid,
      eventType: 'acquired',
      fromStatus: 'sold',
      toStatus: gemStage(gem),
      description: `Acquired from ${request.sellerUid}`,
      weightAtEvent: gem.currentWeight ?? null,
      photoUrl: null,
      costAdded: request.amount,
      relatedServiceId: null,
      relatedApId: null,
      createdByUid: recipientUid,
      createdAt: now,
    });
    return { status: 'accepted' as const, gemId: request.gemId, sellerUid: request.sellerUid, actorName, replay: false as const };
  });

  if (!result.replay) {
    const type = action === 'accepted' ? 'gem_transfer_accepted' : 'gem_transfer_rejected';
    try {
      await saleNotification(
        result.sellerUid,
        type,
        requestId,
        action === 'accepted' ? 'Gem transfer accepted' : 'Gem transfer declined',
        action === 'accepted'
          ? `${result.actorName} accepted the gem sale. The gem is now in their account.`
          : `${result.actorName} declined the gem sale. The gem remains in your account.`,
        result.actorName,
        null,
      );
    } catch (error) {
      console.error('gem-transfer-response-notification-failed', error);
    }
  }
  return { ok: true, status: result.status, gemId: result.gemId };
}

export async function cancelGemTransferForApi(
  requestIdInput: string,
  sellerUid: string,
): Promise<{ ok: true; status: 'cancelled'; gemId: string }> {
  const requestId = idOf(requestIdInput, 'requestId');
  const requestRef = db.collection('gem_transfer_requests').doc(requestId);
  const result = await db.runTransaction(async (transaction) => {
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists) throw new ApiError('not-found', 'Gem transfer request not found.');
    const request = requestSnap.data() as TransferDoc;
    if (request.sellerUid !== sellerUid) throw new ApiError('permission-denied', 'Only the seller can mark this sale unsold.');
    if (request.status !== 'pending') {
      if (request.status === 'cancelled') return { status: 'cancelled' as const, gemId: request.gemId, replay: true as const };
      throw new ApiError('failed-precondition', 'This sale request can no longer be cancelled.');
    }
    const gemRef = db.collection('gemtrack_gems').doc(request.gemId);
    const gemSnap = await transaction.get(gemRef);
    if (!gemSnap.exists || gemSnap.data()?.saleTransferRequestId !== requestId) {
      throw new ApiError('failed-precondition', 'This gem sale is no longer active.');
    }
    const gem = gemSnap.data() as Record<string, unknown>;
    const now = Timestamp.now();
    transaction.update(requestRef, { status: 'cancelled', cancelledByUid: sellerUid, cancelledAt: now, updatedAt: now });
    transaction.update(gemRef, {
      saleTransferRequestId: null,
      saleStatus: 'unsold',
      outcome: request.previouslyListed ? 'listed' : null,
      status: restoredStatus(gem, request.previouslyListed),
      soldPrice: null,
      soldPriceCurrency: null,
      soldPriceBase: null,
      soldDate: null,
      soldToUid: null,
      soldToBusinessId: null,
      soldToContactId: null,
      soldToName: null,
      salePaymentMethod: null,
      isListedOnMarketplace: request.previouslyListed,
      updatedAt: now,
    });
    if (request.previouslyListed && request.previousMarketplaceListingId) {
      transaction.update(db.collection('gems').doc(request.previousMarketplaceListingId), { status: 'active', updatedAt: now });
    }
    return { status: 'cancelled' as const, gemId: request.gemId, recipientUid: request.recipientUid, recipientName: request.recipientName, replay: false as const };
  });
  if (!result.replay) {
    try {
      await saleNotification(
        result.recipientUid,
        'gem_transfer_cancelled',
        requestId,
        'Gem sale cancelled',
        `${result.recipientName} marked the gem sale unsold.`,
        result.recipientName,
        null,
      );
    } catch (error) {
      console.error('gem-transfer-cancel-notification-failed', error);
    }
  }
  return { ok: true, status: 'cancelled', gemId: result.gemId };
}
