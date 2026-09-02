import { logger } from 'firebase-functions';

import { wipeUserData } from './wipe-user-data';
import { ApiError } from '../api/errors';

const RECENT_AUTH_MAX_AGE_SECONDS = 5 * 60;

export type DeleteAccountResult = {
  ok: true;
  firestoreDeleted: number;
  firestoreAnonymized: number;
  storageDeleted: number;
};

export async function deleteMyAccountForApi(
  uid: string,
  authTime: number | undefined,
): Promise<DeleteAccountResult> {
  const now = Math.floor(Date.now() / 1000);
  if (typeof authTime !== 'number' || now - authTime > RECENT_AUTH_MAX_AGE_SECONDS) {
    throw new ApiError(
      'failed-precondition',
      'Please sign in again before deleting your account.',
    );
  }

  logger.info('deleteMyAccount API started', { uid });
  const summary = await wipeUserData(uid);
  logger.info('deleteMyAccount API finished', { uid, ...summary });
  return { ok: true, ...summary };
}
