import { logger } from 'firebase-functions';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

import { REGION } from '../config';
import { sendPushForNotification } from '../notifications/push';
import type { NotificationType, StoredNotification } from '../notifications/types';

/** Sends FCM when a notification doc is created. */
export const onNotificationCreated = onDocumentCreated(
  {
    document: 'notifications/{notifId}',
    region: REGION,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() as StoredNotification;
    if (data.isPushSent) return;

    const sent = await sendPushForNotification(data.recipientUid, {
      type: data.type as NotificationType,
      title: data.title,
      message: data.message,
      referenceType: data.referenceType ?? null,
      referenceId: data.referenceId ?? null,
      priority: data.priority ?? 'medium',
    });

    await snap.ref.update({ isPushSent: sent });

    logger.info('Push dispatch', {
      notifId: event.params.notifId,
      type: data.type,
      sent,
    });
  },
);
