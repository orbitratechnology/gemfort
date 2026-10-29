import { logger } from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { db } from '../admin';
import { REGION } from '../config';
import { createNotificationsBatch } from '../notifications/create';
import { autoCancelStaleServiceCancellations } from './service-cancellation-api';
import { buildGemTrackCandidatesForOwner, loadOwnerContexts } from '../notifications/gemtrack-checks';
import type { NotificationInput } from '../notifications/types';

/** Overdue states nag weekly; date-specific reminders fire once per day. */
const WEEKLY_REMINDER_TYPES = new Set([
  'ap_overdue',
  'ap_payment_overdue',
  'service_overdue',
  'payment_overdue',
]);

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Dedupe identity for a recurring alert. Without a time bucket an item that
 * stays overdue for weeks would be notified exactly once, ever.
 */
export function dailyDedupeKey(input: NotificationInput, now: Date): string {
  const epochDay = Math.floor(now.getTime() / DAY_MS);
  const bucket = WEEKLY_REMINDER_TYPES.has(input.type)
    ? `w${Math.floor(epochDay / 7)}`
    : `d${epochDay}`;
  return [input.referenceType ?? '', input.referenceId ?? '', bucket].join(':');
}

/** Daily GemTrack alerts at 08:00 Asia/Colombo (docs/product/10-notifications.md). */
export const dailyGemTrackNotifications = onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: 'Asia/Colombo',
    region: REGION,
    memory: '512MiB',
    timeoutSeconds: 540,
    // Deterministic notification IDs make a retried run safe.
    retryCount: 2,
  },
  async () => {
    const contexts = await loadOwnerContexts(db);
    const now = new Date();
    const candidates = Array.from(contexts, ([ownerUid, ctx]) =>
      buildGemTrackCandidatesForOwner(ownerUid, ctx),
    )
      .flat()
      .map((candidate) => ({ ...candidate, dedupeKey: dailyDedupeKey(candidate, now) }));
    const totalCandidates = candidates.length;
    const totalCreated = await createNotificationsBatch(candidates);

    const autoCancelledServices = await autoCancelStaleServiceCancellations();

    logger.info('Daily GemTrack notifications complete', {
      owners: contexts.size,
      candidates: totalCandidates,
      created: totalCreated,
      autoCancelledServices,
    });
  },
);
