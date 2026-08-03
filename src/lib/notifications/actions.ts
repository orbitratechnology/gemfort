import notifee from 'react-native-notify-kit';

import {
  respondApCancellation,
  respondApRequest,
} from '@/features/workspace/ap-lifecycle-service';
import { navigateFromNotificationRef } from '@/lib/notification-navigation';

export async function handleNotificationAction(
  actionId: string,
  referenceType: string | null,
  referenceId: string | null,
  notificationId?: string,
) {
  try {
    if (actionId === 'accept' && referenceType === 'ap' && referenceId) {
      await respondApRequest(referenceId, 'accepted');
      if (notificationId) await notifee.cancelNotification(notificationId);
      navigateFromNotificationRef(referenceType, referenceId);
      return;
    }
    if (actionId === 'decline' && referenceType === 'ap' && referenceId) {
      await respondApRequest(referenceId, 'rejected');
      if (notificationId) await notifee.cancelNotification(notificationId);
      navigateFromNotificationRef(referenceType, referenceId);
      return;
    }
    if (
      actionId === 'accept_cancel' &&
      referenceType === 'ap' &&
      referenceId
    ) {
      await respondApCancellation(referenceId, 'accepted');
      if (notificationId) await notifee.cancelNotification(notificationId);
      navigateFromNotificationRef(referenceType, referenceId);
      return;
    }
    if (
      actionId === 'decline_cancel' &&
      referenceType === 'ap' &&
      referenceId
    ) {
      await respondApCancellation(referenceId, 'rejected');
      if (notificationId) await notifee.cancelNotification(notificationId);
      navigateFromNotificationRef(referenceType, referenceId);
      return;
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[push] Notification action failed', actionId, error);
    }
  }

  navigateFromNotificationRef(referenceType, referenceId);
}
