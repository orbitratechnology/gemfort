import notifee from 'react-native-notify-kit';

import {
  respondApCancellation,
  respondApRequest,
} from '@/features/workspace/ap-lifecycle-service';
import { respondGemTransferRequest } from '@/features/workspace/gem-transfer-api';
import { fetchService } from '@/features/workspace/workspace-service';
import { navigateFromNotificationRef } from '@/lib/notification-navigation';
import { pushWithAnchor } from '@/navigation/tab-stack-nav';

export async function handleNotificationAction(
  actionId: string,
  referenceType: string | null,
  referenceId: string | null,
  notificationId?: string,
) {
  try {
    if (
      (actionId === 'accept_gem_transfer' || actionId === 'decline_gem_transfer') &&
      referenceType === 'gem_transfer' &&
      referenceId
    ) {
      await respondGemTransferRequest(
        referenceId,
        actionId === 'accept_gem_transfer' ? 'accepted' : 'rejected',
      );
      if (notificationId) await notifee.cancelNotification(notificationId);
      navigateFromNotificationRef(referenceType, referenceId);
      return;
    }
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
    if (actionId === 'add_service_bill' && referenceType === 'service' && referenceId) {
      const service = await fetchService(referenceId);
      if (service?.finalCost != null && service.paymentDueDate) {
        if (notificationId) await notifee.cancelNotification(notificationId);
        pushWithAnchor({
          pathname: '/(marketplace)/bills/add',
          params: {
            direction: 'payable',
            amount: String(service.finalCost),
            currency: service.finalCostCurrency ?? 'LKR',
            dueDate: service.paymentDueDate.toDate().toISOString(),
            jobId: service.id,
            gemId: service.gemId,
            counterpartyBusinessId: service.providerBusinessId ?? '',
          },
        } as never);
        return;
      }
    }
  } catch {}

  navigateFromNotificationRef(referenceType, referenceId);
}
