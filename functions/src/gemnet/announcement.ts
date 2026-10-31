import { FieldPath, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

import { db } from '../admin';
import { REGION } from '../config';
import { createNotificationsBatch } from '../notifications/create';

const USER_PAGE_SIZE = 400;

/** Broadcast new visible announcements to all active users. */
export const onAnnouncementPublished = onDocumentCreated(
  {
    document: 'announcements/{announcementId}',
    region: REGION,
    memory: '512MiB',
    timeoutSeconds: 540,
    retry: true,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data?.isVisible) return;

    const type = 'announcement_platform' as const;

    // Page through recipients so memory stays flat as the user base grows;
    // deterministic IDs make a retried or partially-completed run safe.
    let created = 0;
    let cursor: QueryDocumentSnapshot | undefined;
    for (;;) {
      let page = db
        .collection('users')
        .where('isActive', '==', true)
        .orderBy(FieldPath.documentId())
        .limit(USER_PAGE_SIZE);
      if (cursor) page = page.startAfter(cursor);
      const usersSnap = await page.get();
      if (usersSnap.empty) break;

      const inputs = usersSnap.docs
        .filter((d) => d.data().isSuspended !== true)
        .map((d) => ({
          recipientUid: d.id,
          type,
          title: data.title as string,
          message: (data.content as string)?.slice(0, 200) || 'New announcement from GemFort.',
          referenceType: 'announcement',
          referenceId: event.params.announcementId,
          imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
          actorName: 'GemFort',
          dedupeKey: `announcement:${event.params.announcementId}`,
        }));
      created += await createNotificationsBatch(inputs);
      cursor = usersSnap.docs[usersSnap.docs.length - 1];
      if (usersSnap.size < USER_PAGE_SIZE) break;
    }

    logger.info('Announcement notifications sent', { announcementId: event.params.announcementId, created });
  },
);
