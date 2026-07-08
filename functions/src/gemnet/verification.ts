import { logger } from 'firebase-functions';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

import { REGION } from '../config';
import { createNotificationDoc } from '../notifications/create';

const STATUS_MESSAGES: Record<string, { type: string; title: string; message: string }> = {
  approved: {
    type: 'verification_approved',
    title: 'Verification approved',
    message: 'Your business verification has been approved. You can now access verified features.',
  },
  rejected: {
    type: 'verification_rejected',
    title: 'Verification rejected',
    message: 'Your verification application was not approved. Check your application for details.',
  },
  info_requested: {
    type: 'verification_info_requested',
    title: 'More information needed',
    message: 'We need additional information to complete your verification review.',
  },
};

export const onVerificationStatusChanged = onDocumentUpdated(
  {
    document: 'verification_applications/{applicationId}',
    region: REGION,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === after.status) return;

    const mapping = STATUS_MESSAGES[after.status as string];
    if (!mapping) return;

    await createNotificationDoc({
      recipientUid: after.applicantUid as string,
      type: mapping.type as 'verification_approved',
      title: mapping.title,
      message: mapping.message,
      referenceType: 'verification',
      referenceId: event.params.applicationId,
    });

    logger.info('Verification notification', {
      applicationId: event.params.applicationId,
      status: after.status,
    });
  },
);
