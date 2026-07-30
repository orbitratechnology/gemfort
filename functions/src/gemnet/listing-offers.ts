import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';

import { REGION } from '../config';
import { createNotificationDoc, formatCurrency } from '../notifications/create';

/** Notify the listing owner when a buyer submits a price offer. */
export const onListingOfferCreated = onDocumentCreated(
  {
    document: 'listing_offers/{offerId}',
    region: REGION,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const amount = Number(data.amount);
    const currency = String(data.currency || 'USD');
    const buyerName = String(data.buyerBusinessName || data.buyerName || 'A buyer');
    const title = String(data.listingTitle || 'your gem');
    const amountLabel = Number.isFinite(amount)
      ? formatCurrency(amount, currency)
      : `${currency} offer`;

    const id = await createNotificationDoc({
      recipientUid: data.sellerUid,
      type: 'listing_offer_received',
      title: 'New offer received',
      message: `${buyerName} offered ${amountLabel} on “${title}”.`,
      referenceType: 'listing',
      referenceId: data.listingSlug || data.listingId,
      priority: 'high',
    });

    logger.info('listing_offer_received notified', {
      offerId: event.params.offerId,
      created: !!id,
      sellerUid: data.sellerUid,
    });
  },
);
