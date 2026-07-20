/**
 * Admin — cron-triggered routes
 *
 * These endpoints are called by an external scheduler (Cloud Scheduler,
 * cron-job.org, etc.) and are guarded with CRON_SECRET.
 *
 * POST /api/v1/admin/cron/daily-gemtrack-notifications
 * POST /api/v1/admin/cron/sync-gem-news
 * POST /api/v1/admin/cron/sync-exhibitions
 */
import { Hono } from 'hono';

import { requireCronSecret } from '../../middleware/webhook-guard.js';
import { config } from '../../config.js';
import { db } from '../../firebase.js';
import { logger } from '../../lib/logger.js';
import { unprocessable } from '../../lib/errors.js';
import { loadOwnerContexts, buildGemTrackCandidatesForOwner } from '../../services/gemtrack/gemtrack-checks.js';
import { createNotificationsBatch } from '../../services/notifications/create.js';
import { syncNewsOnce } from '../../services/news/sync-gem-news.js';
import { syncExhibitionsOnce } from '../../services/news/sync-exhibitions.js';

const cron = new Hono();

cron.use('*', requireCronSecret);

/**
 * @openapi
 * /api/v1/admin/cron/daily-gemtrack-notifications:
 *   post:
 *     summary: Run daily GemTrack notification checks
 *     description: |
 *       Checks all active cheques, AP records, services, and receivables and
 *       creates notification documents for items that are overdue or due soon.
 *       Intended to be called once per day at 08:00 Asia/Colombo.
 *     tags: [Admin - Cron]
 *     security: [{ cronSecret: [] }]
 */
cron.post('/daily-gemtrack-notifications', async (c) => {
  logger.info('Daily GemTrack notifications cron started');
  const contexts = await loadOwnerContexts(db);
  let totalCreated = 0;

  for (const [ownerUid, ctx] of contexts) {
    const candidates = buildGemTrackCandidatesForOwner(ownerUid, ctx);
    if (candidates.length === 0) continue;
    const created = await createNotificationsBatch(candidates);
    totalCreated += created;
  }

  logger.info('Daily GemTrack notifications cron finished', {
    owners: contexts.size,
    created: totalCreated,
  });

  return c.json({ ok: true, owners: contexts.size, created: totalCreated });
});

/**
 * @openapi
 * /api/v1/admin/cron/sync-gem-news:
 *   post:
 *     summary: Sync gem industry news
 *     description: Scrapes all configured news sources and upserts articles. Run every 6 hours.
 *     tags: [Admin - Cron]
 *     security: [{ cronSecret: [] }]
 */
cron.post('/sync-gem-news', async (c) => {
  const { geminiApiKey, firecrawlApiKey } = config.news;
  if (!geminiApiKey || !firecrawlApiKey) {
    unprocessable('GEMINI_API_KEY and FIRECRAWL_API_KEY must be configured.');
  }

  logger.info('Gem news sync cron started');
  const summary = await syncNewsOnce(geminiApiKey, firecrawlApiKey);
  logger.info('Gem news sync cron finished', summary);
  return c.json({ ok: true, ...summary });
});

/**
 * @openapi
 * /api/v1/admin/cron/sync-exhibitions:
 *   post:
 *     summary: Sync gem trade exhibitions
 *     description: Scrapes exhibition listing pages and upserts events. Run daily.
 *     tags: [Admin - Cron]
 *     security: [{ cronSecret: [] }]
 */
cron.post('/sync-exhibitions', async (c) => {
  const { geminiApiKey, firecrawlApiKey } = config.news;
  if (!geminiApiKey || !firecrawlApiKey) {
    unprocessable('GEMINI_API_KEY and FIRECRAWL_API_KEY must be configured.');
  }

  logger.info('Exhibitions sync cron started');
  const summary = await syncExhibitionsOnce(geminiApiKey, firecrawlApiKey);
  logger.info('Exhibitions sync cron finished', summary);
  return c.json({ ok: true, ...summary });
});

export default cron;
