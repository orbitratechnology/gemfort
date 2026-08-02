import { logger } from 'firebase-functions';

import { db, messaging } from '../admin';
import { resolvePushMedia } from './resolve-media';
import {
  PUSH_MANDATORY_TYPES,
  pushCategoryForType,
  pushChannelForType,
  type NotificationType,
  type StoredNotification,
  type UserDoc,
  type UserNotificationPreferences,
} from './types';

function prefAllowsPush(type: NotificationType, prefs: UserNotificationPreferences): boolean {
  if (type.startsWith('announcement_')) return prefs.pushAnnouncements !== false;
  if (type.startsWith('cheque_')) return prefs.pushChequeAlerts !== false;
  if (type.startsWith('bill_')) return prefs.pushBillAlerts !== false;
  if (type.startsWith('ap_') || type === 'service_overdue') return prefs.pushApAlerts !== false;
  if (type.startsWith('payment_')) return prefs.pushPaymentAlerts !== false;
  return true;
}

export function shouldSendPush(type: NotificationType, user: UserDoc | undefined): boolean {
  if (!user?.fcmToken) return false;
  if (user.isActive === false) return false;
  const prefs = user.notificationPreferences ?? {};
  if (prefs.pushEnabled === false) return false;
  if (PUSH_MANDATORY_TYPES.has(type)) return true;
  return prefAllowsPush(type, prefs);
}

/** Prefer gem art for BigPicture; fall back to sender profile. */
export function pickFcmRichImage(
  actorPhotoUrl: string | null,
  imageUrl: string | null,
): string | null {
  return imageUrl || actorPhotoUrl || null;
}

export async function sendPushForNotification(
  recipientUid: string,
  notification: Pick<
    StoredNotification,
    | 'type'
    | 'title'
    | 'message'
    | 'referenceType'
    | 'referenceId'
    | 'priority'
    | 'actorName'
    | 'actorPhotoUrl'
    | 'imageUrl'
  >,
): Promise<{
  sent: boolean;
  media: {
    actorName: string | null;
    actorPhotoUrl: string | null;
    imageUrl: string | null;
  };
}> {
  const userSnap = await db.collection('users').doc(recipientUid).get();
  const user = userSnap.data() as UserDoc | undefined;

  const media = await resolvePushMedia({
    type: notification.type,
    referenceType: notification.referenceType,
    referenceId: notification.referenceId,
    actorName: notification.actorName,
    actorPhotoUrl: notification.actorPhotoUrl,
    imageUrl: notification.imageUrl,
    recipientUid,
  });

  if (!shouldSendPush(notification.type, user)) {
    return { sent: false, media };
  }

  const token = user!.fcmToken!;
  const priority = notification.priority ?? 'medium';
  const channelId = pushChannelForType(notification.type, priority);
  const categoryId = pushCategoryForType(notification.type);
  const richImage = pickFcmRichImage(media.actorPhotoUrl, media.imageUrl);
  const subtitle = media.actorName || undefined;

  // All data values must be strings for FCM.
  const data: Record<string, string> = {
    title: notification.title,
    body: notification.message,
    type: String(notification.type),
    referenceType: notification.referenceType ?? '',
    referenceId: notification.referenceId ?? '',
    priority,
    categoryId,
    channelId,
    actorName: media.actorName ?? '',
    actorPhotoUrl: media.actorPhotoUrl ?? '',
    imageUrl: media.imageUrl ?? '',
    largeIconUrl: media.actorPhotoUrl ?? '',
  };

  try {
    await messaging.send({
      token,
      data,
      android: {
        // Data-only on Android so notify-kit can render profile largeIcon + gem BigPicture.
        // High priority wakes the device to run the background presentation task.
        priority: 'high',
      },
      apns: {
        payload: {
          aps: {
            sound: priority === 'high' ? 'default' : undefined,
            category: categoryId,
            ...(richImage ? { 'mutable-content': 1 } : {}),
            alert: {
              title: notification.title,
              ...(subtitle ? { subtitle } : {}),
              body: notification.message,
            },
          },
        },
        ...(richImage
          ? {
              fcmOptions: {
                imageUrl: richImage,
              },
            }
          : {}),
      },
    });
    return { sent: true, media };
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String((error as { code: string }).code)
        : '';

    if (
      code.includes('registration-token-not-registered') ||
      code.includes('invalid-registration-token')
    ) {
      await db.collection('users').doc(recipientUid).update({ fcmToken: null });
    }

    logger.warn('FCM send failed', { recipientUid, type: notification.type, code, error });
    return { sent: false, media };
  }
}
