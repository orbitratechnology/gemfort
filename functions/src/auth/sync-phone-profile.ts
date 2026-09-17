import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';

import { ApiError } from '../api/errors';
import { db } from '../admin';

const PHONE_RE = /^\+\d{10,15}$/;

type SyncPhoneFailure = (
  code: 'unauthenticated' | 'failed-precondition' | 'internal',
  message: string,
) => never;

async function syncPhoneProfileCore(
  uid: string | undefined,
  fail: SyncPhoneFailure,
): Promise<{ phoneNumber: string }> {
  if (!uid) fail('unauthenticated', 'Sign in to verify your phone number.');

  let phoneNumber: string;
  try {
    const user = await getAuth().getUser(uid);
    phoneNumber = user.phoneNumber ?? '';
  } catch {
    fail('internal', 'Could not read your Firebase Auth profile. Please try again.');
  }

  if (!PHONE_RE.test(phoneNumber)) {
    fail(
      'failed-precondition',
      'Link a phone number through Firebase Auth before syncing your profile.',
    );
  }

  try {
    await db.collection('users').doc(uid).update({
      phone: phoneNumber,
      phoneVerified: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.error('syncPhoneProfile profile update failed', {
      uid,
      code: errorCode(error),
    });
    fail('internal', 'Could not update your profile. Please try again.');
  }

  logger.info('syncPhoneProfile succeeded', { uid });
  return { phoneNumber };
}

export async function syncPhoneProfileForApi(uid: string): Promise<{ phoneNumber: string }> {
  return syncPhoneProfileCore(uid, (code, message): never => {
    throw new ApiError(code, message);
  });
}

function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';
}
