import { logger } from 'firebase-functions/logger';
import * as functionsV1 from 'firebase-functions/v1';

import { REGION } from '../config';
import { wipeUserData } from './wipe-user-data';

/**
 * Safety net: if an Auth user is deleted outside DELETE /v1/account (Firebase
 * console, Admin SDK), still wipe their Firestore and Storage data.
 *
 * This stays a 1st-gen function on purpose: Cloud Functions 2nd gen has no
 * Auth user-deleted event (only blocking beforeCreate/beforeSignIn hooks), so
 * there is no v2 equivalent to migrate to.
 */
export const onAuthUserDeleted = functionsV1
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .region(REGION)
  .auth.user()
  .onDelete(async (user) => {
    logger.info('onAuthUserDeleted cleanup', { uid: user.uid });
    await wipeUserData(user.uid);
  });
