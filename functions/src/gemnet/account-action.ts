import { logger } from 'firebase-functions';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

import { REGION } from '../config';
import { createNotificationDoc } from '../notifications/create';

export const onUserAccountAction = onDocumentUpdated(
  {
    document: 'users/{userId}',
    region: REGION,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const userId = event.params.userId;

    if (before.isSuspended !== after.isSuspended) {
      if (after.isSuspended === true) {
        await createNotificationDoc({
          recipientUid: userId,
          type: 'account_suspended',
          title: 'Account suspended',
          message:
            (after.suspendedReason as string) ||
            'Your account has been suspended. Contact GemFort support for help.',
          referenceType: 'account',
          referenceId: userId,
          priority: 'high',
        });
      } else {
        await createNotificationDoc({
          recipientUid: userId,
          type: 'account_reinstated',
          title: 'Account reinstated',
          message: 'Your account access has been restored.',
          referenceType: 'account',
          referenceId: userId,
        });
      }
      logger.info('Account suspension notification', { userId, suspended: after.isSuspended });
      return;
    }

    if (
      before.verificationStatus !== after.verificationStatus &&
      after.verificationStatus === 'revoked'
    ) {
      await createNotificationDoc({
        recipientUid: userId,
        type: 'verification_revoked',
        title: 'Verification revoked',
        message: 'Your verified status has been revoked. Contact GemFort support if you have questions.',
        referenceType: 'verification',
        referenceId: userId,
        priority: 'high',
      });
      logger.info('Verification revoked notification', { userId });
    }
  },
);
