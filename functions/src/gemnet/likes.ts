import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';

import { db } from '../admin';
import { REGION } from '../config';

/**
 * Keep `businesses.badges.likeCount` in sync with like documents. Each like
 * carries a `counted` flag set in the same transaction as the increment, so a
 * retried trigger never double-counts and a delete only decrements a like that
 * was actually counted.
 */
export const onLikeCreated = onDocumentCreated(
  {
    document: 'likes/{likeId}',
    region: REGION,
    retry: true,
  },
  async (event) => {
    const likeRef = event.data?.ref;
    const data = event.data?.data();
    if (!likeRef || !data) return;

    const toBusinessId = String(data.toBusinessId || '').trim();
    if (!toBusinessId) {
      logger.warn('onLikeCreated missing toBusinessId', {
        likeId: event.params.likeId,
      });
      return;
    }

    const businessRef = db.collection('businesses').doc(toBusinessId);
    const counted = await db.runTransaction(async (transaction) => {
      const [likeSnap, businessSnap] = await transaction.getAll(likeRef, businessRef);
      if (!likeSnap.exists || likeSnap.data()?.counted === true || !businessSnap.exists) {
        return false;
      }
      transaction.update(businessRef, {
        'badges.likeCount': FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(likeRef, { counted: true });
      return true;
    });

    logger.info('likeCount incremented', {
      likeId: event.params.likeId,
      toBusinessId,
      counted,
    });
  },
);

/** Admin removal of a like (e.g. abuse cleanup) lowers the public count. */
export const onLikeDeleted = onDocumentDeleted(
  {
    document: 'likes/{likeId}',
    region: REGION,
    retry: true,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.counted !== true) return;
    const toBusinessId = String(data.toBusinessId || '').trim();
    if (!toBusinessId) return;

    // The deleted like cannot carry a "decremented" marker, so guard retries
    // with a tombstone keyed by the like id.
    const tombstoneRef = db.collection('likes_uncounted').doc(event.params.likeId);
    const businessRef = db.collection('businesses').doc(toBusinessId);
    await db.runTransaction(async (transaction) => {
      const [tombstone, businessSnap] = await transaction.getAll(tombstoneRef, businessRef);
      if (tombstone.exists || !businessSnap.exists) return;
      const current = Number(businessSnap.data()?.badges?.likeCount ?? 0);
      transaction.update(businessRef, {
        'badges.likeCount': Math.max(0, current - 1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(tombstoneRef, {
        toBusinessId,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    });
    logger.info('likeCount decremented', { likeId: event.params.likeId, toBusinessId });
  },
);
