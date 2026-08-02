import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';

import { db } from '../admin';
import { REGION } from '../config';

/** Keep `businesses.badges.likeCount` in sync when a like is created. */
export const onLikeCreated = onDocumentCreated(
  {
    document: 'likes/{likeId}',
    region: REGION,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const toBusinessId = String(data.toBusinessId || '').trim();
    if (!toBusinessId) {
      logger.warn('onLikeCreated missing toBusinessId', {
        likeId: event.params.likeId,
      });
      return;
    }

    await db
      .collection('businesses')
      .doc(toBusinessId)
      .update({
        'badges.likeCount': FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });

    logger.info('likeCount incremented', {
      likeId: event.params.likeId,
      toBusinessId,
    });
  },
);
