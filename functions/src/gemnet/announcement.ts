import { logger } from 'firebase-functions';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

import { db } from '../admin';
import { REGION } from '../config';
import { createNotificationsBatch } from '../notifications/create';

/** Broadcast new visible announcements to all active users. */
export const onAnnouncementPublished = onDocumentCreated(
  {
    document: 'announcements/{announcementId}',
    region: REGION,
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data?.isVisible) return;

    const type =
      data.type === 'industry_news' ? 'announcement_industry_news' : 'announcement_platform';

    const usersSnap = await db.collection('users').where('isActive', '==', true).get();
    const inputs = usersSnap.docs
      .filter((d) => d.data().isSuspended !== true)
      .map((d) => ({
        recipientUid: d.id,
        type: type as 'announcement_platform' | 'announcement_industry_news',
        title: data.title as string,
        message: (data.content as string)?.slice(0, 200) || 'New announcement from GemFort.',
        referenceType: 'announcement',
        referenceId: event.params.announcementId,
      }));

    const created = await createNotificationsBatch(inputs);
    logger.info('Announcement notifications sent', { announcementId: event.params.announcementId, created });
  },
);
