import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { usePushNotifications } from '@/hooks/use-push-notifications';
import { navigateFromNotificationRef } from '@/lib/notification-navigation';
import { handleNotificationAction } from '@/lib/notifications/actions';
import {
  ensureAndroidNotificationChannels,
  registerNotificationCategories,
} from '@/lib/notifications/categories';
import {
  displayRichNotification,
  ensureNotifeeChannels,
  parseRichPushData,
  registerBackgroundNotificationTask,
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
    void handleNotificationAction(actionId, referenceType, referenceId);
    return;
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
    const unsubNotifee = wireNotifeePressEvents(handleNotificationAction);

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
