import { db, messaging } from '../../firebase.js';
import { logger } from '../../lib/logger.js';
import {
  PUSH_MANDATORY_TYPES,
  type NotificationType,
  type StoredNotification,
  type UserDoc,
  type UserNotificationPreferences,
} from './types.js';

function prefAllowsPush(type: NotificationType, prefs: UserNotificationPreferences): boolean {
  if (type.startsWith('announcement_')) return prefs.pushAnnouncements !== false;
  if (type.startsWith('cheque_')) return prefs.pushChequeAlerts !== false;
  if (type.startsWith('ap_') || type === 'service_overdue') return prefs.pushApAlerts !== false;
  if (type.startsWith('payment_')) return prefs.pushPaymentAlerts !== false;
  return true;
}

export function shouldSendPush(type: NotificationType, user: UserDoc | undefined): boolean {
  if (!user?.fcmToken) return false;
  if (user.isActive === false) return false;
  if (PUSH_MANDATORY_TYPES.has(type)) return true;
  const prefs = user.notificationPreferences ?? {};
  return prefAllowsPush(type, prefs);
}

/**
 * Send an FCM push notification for a stored notification document.
 * Automatically clears the FCM token if it is stale / invalid.
 */
export async function sendPushForNotification(
  recipientUid: string,
  notification: Pick<
    StoredNotification,
    'type' | 'title' | 'message' | 'referenceType' | 'referenceId' | 'priority'
  >,
): Promise<boolean> {
  const userSnap = await db.collection('users').doc(recipientUid).get();
  const user = userSnap.data() as UserDoc | undefined;

  if (!shouldSendPush(notification.type, user)) return false;

  const token = user!.fcmToken!;

  try {
    await messaging.send({
      token,
      notification: {
        title: notification.title,
        body: notification.message,
      },
      data: {
        type: notification.type,
        referenceType: notification.referenceType ?? '',
        referenceId: notification.referenceId ?? '',
        priority: notification.priority ?? 'medium',
      },
      android: {
        priority: notification.priority === 'high' ? 'high' : 'normal',
        notification: { channelId: 'default' },
      },
      apns: {
        payload: {
          aps: {
            sound: notification.priority === 'high' ? 'default' : undefined,
          },
        },
      },
    });
    return true;
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: string }).code)
        : '';

    if (
      code.includes('registration-token-not-registered') ||
      code.includes('invalid-registration-token')
    ) {
      // Stale token — clear it so we stop retrying.
      await db.collection('users').doc(recipientUid).update({ fcmToken: null });
    }

    logger.warn('FCM send failed', { recipientUid, type: notification.type, code });
    return false;
  }
}
