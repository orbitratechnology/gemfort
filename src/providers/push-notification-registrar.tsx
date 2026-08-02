import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import {
  respondApCancellation,
  respondApRequest,
} from '@/features/workspace/ap-lifecycle-service';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { navigateFromNotificationRef } from '@/lib/notification-navigation';
import {
  ensureAndroidNotificationChannels,
  registerNotificationCategories,
} from '@/lib/notifications/categories';
import {
  displayRichNotification,
  ensureNotifeeChannels,
  parseRichPushData,
  registerBackgroundNotificationTask,
  wireNotifeeBackgroundPress,
  wireNotifeePressEvents,
} from '@/lib/notifications/rich-display';

function handleNotificationResponse(
  response: Notifications.NotificationResponse | null,
) {
  if (!response) return;

  const data = response.notification.request.content.data as
    | Record<string, unknown>
    | undefined;
  const referenceType =
    data?.referenceType != null ? String(data.referenceType) : null;
  const referenceId =
    data?.referenceId != null ? String(data.referenceId) : null;
  const actionId = response.actionIdentifier;

  if (actionId && actionId !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
    void handleCategoryAction(actionId, referenceType, referenceId);
    return;
  }

  navigateFromNotificationRef(referenceType, referenceId);
}

async function handleCategoryAction(
  actionId: string,
  referenceType: string | null,
  referenceId: string | null,
) {
  try {
    if (actionId === 'accept' && referenceType === 'ap' && referenceId) {
      await respondApRequest(referenceId, 'accepted');
      navigateFromNotificationRef(referenceType, referenceId);
      return;
    }
    if (actionId === 'decline' && referenceType === 'ap' && referenceId) {
      await respondApRequest(referenceId, 'rejected');
      navigateFromNotificationRef(referenceType, referenceId);
      return;
    }
    if (
      actionId === 'accept_cancel' &&
      referenceType === 'ap' &&
      referenceId
    ) {
      await respondApCancellation(referenceId, 'accepted');
      navigateFromNotificationRef(referenceType, referenceId);
      return;
    }
    if (
      actionId === 'decline_cancel' &&
      referenceType === 'ap' &&
      referenceId
    ) {
      await respondApCancellation(referenceId, 'rejected');
      navigateFromNotificationRef(referenceType, referenceId);
      return;
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[push] Category action failed', actionId, error);
    }
  }

  navigateFromNotificationRef(referenceType, referenceId);
}

export function PushNotificationRegistrar() {
  usePushNotifications();

  useEffect(() => {
    void ensureAndroidNotificationChannels();
    void ensureNotifeeChannels();
    void registerNotificationCategories();
    void registerBackgroundNotificationTask();
    void wireNotifeeBackgroundPress();

    const unsubNotifee = wireNotifeePressEvents();

    handleNotificationResponse(Notifications.getLastNotificationResponse());

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handleNotificationResponse(response);
      },
    );

    // Foreground / data messages: render profile + gem via notify-kit (Android)
    // or local attachments (iOS).
    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        const content = notification.request.content;
        const rich = parseRichPushData({
          title: content.title ?? undefined,
          body: content.body ?? undefined,
          ...(content.data as Record<string, unknown>),
        });
        void displayRichNotification(rich);
      },
    );

    return () => {
      responseSub.remove();
      receivedSub.remove();
      unsubNotifee();
    };
  }, []);

  return null;
}

// Handler is configured in use-push-notifications.ts
