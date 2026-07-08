import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { db } from '../admin';
import { REGION } from '../config';
import { createNotificationsBatch } from '../notifications/create';
import { buildGemTrackCandidatesForOwner, loadOwnerContexts } from '../notifications/gemtrack-checks';

/** Daily GemTrack alerts at 08:00 Asia/Colombo (plan/10-notifications.md). */
export const dailyGemTrackNotifications = onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: 'Asia/Colombo',
    region: REGION,
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async () => {
    const contexts = await loadOwnerContexts(db);
    let totalCreated = 0;

    for (const [ownerUid, ctx] of contexts) {
      const candidates = buildGemTrackCandidatesForOwner(ownerUid, ctx);
      if (candidates.length === 0) continue;
      const created = await createNotificationsBatch(candidates);
      totalCreated += created;
    }

    logger.info('Daily GemTrack notifications complete', {
      owners: contexts.size,
      created: totalCreated,
    });
  },
);
