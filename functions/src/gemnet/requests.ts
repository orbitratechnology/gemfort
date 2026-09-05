import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { REGION } from '../config';
import { createNotificationDoc } from '../notifications/create';

export const onServiceRequestCreated = onDocumentCreated(
  {
    document: 'service_requests/{requestId}',
    region: REGION,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    await createNotificationDoc({
      recipientUid: data.lapidaryUid,
      type: 'service_request_received',
      title: 'New service request',
      message: `A trader requested ${((data.serviceTypes as string[]) || []).join(', ') || 'service'} for ${data.gemName}.`,
      referenceType: 'service_request',
      referenceId: event.params.requestId,
    });
    logger.info('service_request_received notified', { id: event.params.requestId });
  },
);
export const onServiceRequestUpdated = onDocumentUpdated(
  {
    document: 'service_requests/{requestId}',
    region: REGION,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === after.status) return;
    if (after.status === 'accepted' || after.status === 'rejected') {
      await createNotificationDoc({
        recipientUid: after.traderUid,
        type: after.status === 'accepted' ? 'service_request_accepted' : 'service_request_rejected',
        title: after.status === 'accepted' ? 'Service request accepted' : 'Service request declined',
        message:
          after.status === 'accepted'
            ? 'Your lapidary accepted the job. Tracking is synced.'
            : 'Your lapidary declined this service request.',
        referenceType: 'service_request',
        referenceId: event.params.requestId,
      });
    }
  },
);
