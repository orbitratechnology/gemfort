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

    const { sent, media } = await sendPushForNotification(data.recipientUid, {
      type: data.type as NotificationType,
      title: data.title,
      message: data.message,
      referenceType: data.referenceType ?? null,
      referenceId: data.referenceId ?? null,
      priority: data.priority ?? 'medium',
      actorName: data.actorName ?? null,
      actorPhotoUrl: data.actorPhotoUrl ?? null,
      imageUrl: data.imageUrl ?? null,
    });

    const patch: Record<string, unknown> = { isPushSent: sent };
    // Persist resolved media so the in-app inbox can reuse it without re-fetching.
    if (!data.actorName && media.actorName) patch.actorName = media.actorName;
    if (!data.actorPhotoUrl && media.actorPhotoUrl) {
      patch.actorPhotoUrl = media.actorPhotoUrl;
    }
    if (!data.imageUrl && media.imageUrl) patch.imageUrl = media.imageUrl;

    await snap.ref.update(patch);

    logger.info('Push dispatch', {
      notifId: event.params.notifId,
      type: data.type,
      sent,
      hasActorPhoto: !!media.actorPhotoUrl,
      hasImage: !!media.imageUrl,
    });
  },
);
