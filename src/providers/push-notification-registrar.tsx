import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { usePushNotifications } from '@/hooks/use-push-notifications';
import { navigateFromNotificationRef } from '@/lib/notification-navigation';

function handleNotificationResponse(
  response: Notifications.NotificationResponse | null,
) {
  if (!response) return;
  const data = response.notification.request.content.data as
    | Record<string, unknown>
    | undefined;
  navigateFromNotificationRef(
    data?.referenceType != null ? String(data.referenceType) : null,
    data?.referenceId != null ? String(data.referenceId) : null,
  );
}

export function PushNotificationRegistrar() {
  usePushNotifications();

  useEffect(() => {
    handleNotificationResponse(Notifications.getLastNotificationResponse());

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handleNotificationResponse(response);
      },
    );

    return () => {
      responseSub.remove();
    };
  }, []);

  return null;
}
