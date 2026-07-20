/**
 * Auth event webhooks.
 *
 * POST /webhooks/auth/user-deleted   Called when a Firebase Auth user is deleted
 *   (safety net — wipes any residual Firestore/Storage data).
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { requireWebhookSecret } from '../../middleware/webhook-guard.js';
import { wipeUserData } from '../../services/account/wipe-user-data.js';
import { logger } from '../../lib/logger.js';

const authWebhooks = new Hono();

authWebhooks.use('*', requireWebhookSecret);

const userDeletedPayload = z.object({
  uid: z.string().min(1),
});

/**
 * @openapi
 * /webhooks/auth/user-deleted:
 *   post:
 *     summary: Auth user deleted event
 *     description: |
 *       Safety-net webhook. If a Firebase Auth user is deleted outside of the
 *       normal `DELETE /api/v1/account` flow (e.g. from the Firebase console or
 *       Admin SDK), this endpoint cleans up residual Firestore and Storage data.
 *     tags: [Webhooks]
 *     security: [{ webhookSecret: [] }]
 */
authWebhooks.post('/user-deleted', zValidator('json', userDeletedPayload), async (c) => {
  const { uid } = c.req.valid('json');
  logger.info('onAuthUserDeleted cleanup', { uid });
  const summary = await wipeUserData(uid);
  logger.info('onAuthUserDeleted cleanup complete', { uid, ...summary });
  return c.json({ ok: true, ...summary });
});

export default authWebhooks;
