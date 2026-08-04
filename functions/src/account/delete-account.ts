import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as functionsV1 from 'firebase-functions/v1';

import { REGION } from '../config';
import { wipeUserData } from './wipe-user-data';

const RECENT_AUTH_MAX_AGE_SECONDS = 5 * 60;

/**
 * Primary path: authenticated callable.
 * 1) Client reauthenticates with password, Google, or Apple.
 * 2) Client invokes this function to remove its Firestore and Storage data.
 * 3) Client calls React Native Firebase's deleteUser on that freshly
 *    reauthenticated user. The Auth onDelete trigger below is a safety net.
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
    const authTime = request.auth.token.auth_time;
    const now = Math.floor(Date.now() / 1000);
    if (typeof authTime !== 'number' || now - authTime > RECENT_AUTH_MAX_AGE_SECONDS) {
      throw new HttpsError(
        'failed-precondition',
        'Please sign in again before deleting your account.',
      );
    }

    logger.info('deleteMyAccount started', { uid });
    const summary = await wipeUserData(uid);
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
