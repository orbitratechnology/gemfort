import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { usePushNotifications } from '@/hooks/use-push-notifications';

function navigateFromNotificationData(data: Record<string, unknown> | undefined) {
  if (!data) return;
  const refType = String(data.referenceType ?? '');
  const refId = String(data.referenceId ?? '');

  if (refType === 'ap' && refId) {
    router.push(`/(marketplace)/(tabs)/workspace/ap/${refId}`);
  } else if (refType === 'service' && refId) {
    router.push(`/(marketplace)/(tabs)/workspace/services/${refId}`);
  } else if (refType === 'cheque' && refId) {
    router.push(`/(marketplace)/(tabs)/workspace/cheques/${refId}`);
  } else if (refType === 'receivable') {
    router.push('/(marketplace)/(tabs)/workspace/money/receivables');
  } else if (refType === 'verification') {
    router.push('/profile/verify');
  } else if (refType === 'announcement') {
    router.push('/(marketplace)/(tabs)/home');
  } else {
    router.push('/notifications');
  }
}

function handleNotificationResponse(response: Notifications.NotificationResponse | null) {
  if (!response) return;
  navigateFromNotificationData(
    response.notification.request.content.data as Record<string, unknown> | undefined,
  );
}

export function PushNotificationRegistrar() {
  usePushNotifications();

  useEffect(() => {
    handleNotificationResponse(Notifications.getLastNotificationResponse());

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response);
    });

    return () => {
      responseSub.remove();
    };
  }, []);

  return null;
}
