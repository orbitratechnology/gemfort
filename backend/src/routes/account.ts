/**
 * Account routes
 *
 * DELETE /api/v1/account — hard-delete the authenticated user's account,
 *   wiping all Firestore documents and Storage objects they own.
 */
import { Hono } from 'hono';

import { auth } from '../firebase.js';
import { requireAuth, type AuthVariables } from '../middleware/auth.js';
import { requireActive } from '../middleware/rbac.js';
import { wipeUserData } from '../services/account/wipe-user-data.js';
import { logger } from '../lib/logger.js';
import { internal } from '../lib/errors.js';

const account = new Hono<{ Variables: AuthVariables }>();

/**
 * @openapi
 * /api/v1/account:
 *   delete:
 *     summary: Delete my account
 *     description: |
 *       Permanently deletes the authenticated user's account. This wipes all owned
 *       Firestore documents and Storage objects, anonymises cross-user references,
 *       and then removes the Firebase Auth user record.
 *
 *       The client **must reauthenticate** (recent sign-in) before calling this.
 *     tags: [Account]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 firestoreDeleted: { type: integer }
 *                 firestoreAnonymized: { type: integer }
 *                 storageDeleted: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthenticated'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
account.delete('/', requireAuth, requireActive, async (c) => {
  const uid = c.get('uid');
  logger.info('deleteMyAccount started', { uid });

  const summary = await wipeUserData(uid);

  try {
    await auth.deleteUser(uid);
  } catch (err: unknown) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    if (code !== 'auth/user-not-found') {
      logger.error('Auth delete failed after data wipe', { uid, error: err });
      internal('Account data was removed but Auth deletion failed. Contact support.');
    }
    // user-not-found is fine — treat as idempotent.
  }

  logger.info('deleteMyAccount finished', { uid, ...summary });
  return c.json({ ok: true, ...summary });
});

export default account;
