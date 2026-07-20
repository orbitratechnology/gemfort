/**
 * Admin — news management routes
 *
 * POST /api/v1/admin/news/sync   Trigger immediate news sync (admin only)
 */
import { Hono } from 'hono';

import { requireAuth, type AuthVariables } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/rbac.js';
import { config } from '../../config.js';
import { syncNewsOnce } from '../../services/news/sync-gem-news.js';
import { syncExhibitionsOnce } from '../../services/news/sync-exhibitions.js';
import { logger } from '../../lib/logger.js';
import { unprocessable } from '../../lib/errors.js';

const newsAdmin = new Hono<{ Variables: AuthVariables }>();

newsAdmin.use('*', requireAuth, requireAdmin);

/**
 * @openapi
 * /api/v1/admin/news/sync:
 *   post:
 *     summary: Trigger immediate gem news sync
 *     description: Admin-only endpoint that immediately scrapes all news sources and upserts articles.
 *     tags: [Admin - News]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Sync completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *                 news: { type: object }
 *                 exhibitions: { type: object }
 */
newsAdmin.post('/sync', async (c) => {
  const { geminiApiKey, firecrawlApiKey } = config.news;
  if (!geminiApiKey || !firecrawlApiKey) {
    unprocessable('GEMINI_API_KEY and FIRECRAWL_API_KEY must be configured on the server.');
  }

  logger.info('Admin news sync triggered', { uid: c.get('uid') });

  const [news, exhibitions] = await Promise.all([
    syncNewsOnce(geminiApiKey, firecrawlApiKey),
    syncExhibitionsOnce(geminiApiKey, firecrawlApiKey),
  ]);

  logger.info('Admin news sync complete', { news, exhibitions });
  return c.json({ ok: true, news, exhibitions });
});

export default newsAdmin;
