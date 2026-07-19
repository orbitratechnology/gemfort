import { getAuth } from 'firebase-admin/auth';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as functionsV1 from 'firebase-functions/v1';

import { REGION } from '../config';
import { wipeUserData } from './wipe-user-data';

/**
 * Primary path: authenticated callable.
 * 1) Client reauthenticates (recent login).
 * 2) Client invokes this function.
 * 3) We wipe Firestore + Storage, then delete the Auth user.
 */
export const deleteMyAccount = onCall(
  {
    region: REGION,
    timeoutSeconds: 540,
    memory: '1GiB',
    consumeAppCheckToken: false,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in to delete your account.');
    }

    const uid = request.auth.uid;
    logger.info('deleteMyAccount started', { uid });

    const summary = await wipeUserData(uid);

    try {
      await getAuth().deleteUser(uid);
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      // Already gone — treat as success (idempotent).
      if (code !== 'auth/user-not-found') {
        logger.error('Auth delete failed after data wipe', { uid, error });
        throw new HttpsError(
          'internal',
          'Account data was removed but Auth deletion failed. Contact support.',
        );
      }
    }

    logger.info('deleteMyAccount finished', { uid, ...summary });
    return { ok: true as const, ...summary };
  },
);

/**
 * Safety net: if Auth is deleted elsewhere (console, Admin SDK single delete),
 * still wipe residual Firestore/Storage data.
 */
export const onAuthUserDeleted = functionsV1
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .region(REGION)
  .auth.user()
  .onDelete(async (user) => {
    logger.info('onAuthUserDeleted cleanup', { uid: user.uid });
    await wipeUserData(user.uid);
  });
