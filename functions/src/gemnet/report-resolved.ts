import { logger } from 'firebase-functions';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

import { REGION } from '../config';
import { createNotificationDoc } from '../notifications/create';

export const onReportResolved = onDocumentUpdated(
  {
    document: 'reports/{reportId}',
    region: REGION,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === after.status) return;

    if (after.status !== 'resolved' && after.status !== 'dismissed') return;

    const type = after.status === 'resolved' ? 'report_resolved' : 'report_dismissed';
    const title = after.status === 'resolved' ? 'Report resolved' : 'Report reviewed';
    const message =
      after.status === 'resolved'
        ? 'Your fraud report has been reviewed and resolved.'
        : 'Your fraud report was reviewed. No further action was taken.';

    await createNotificationDoc({
      recipientUid: after.reporterUid as string,
      type,
      title,
      message,
      referenceType: 'report',
      referenceId: event.params.reportId,
    });

    logger.info('Report resolution notification', { reportId: event.params.reportId, status: after.status });
  },
);
