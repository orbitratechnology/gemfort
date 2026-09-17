import {
  linkWithCredential,
  PhoneAuthProvider,
  type PhoneAuthListener,
  type User,
  verifyPhoneNumber,
} from '@react-native-firebase/auth';

import { callApi } from '@/lib/api/api-client';
import { getFirebaseAuth } from '@/lib/firebase/config';
import { normalizePhoneNumber } from '@/lib/firebase/phone-utils';

export function sendPhoneVerificationCode(
  phoneE164: string,
  forceResend = false,
): Promise<string> {
  const listener = verifyPhoneNumber(getFirebaseAuth(), phoneE164, 60, forceResend);
  return verificationIdFromListener(listener);
}

export async function confirmPhoneVerificationCode(
  verificationId: string,
  code: string,
  expectedPhoneE164: string,
): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('You must be signed in to verify your phone.');

  const credential = PhoneAuthProvider.credential(verificationId, code);
  let linkedUser: User = user;
  try {
    // The returned UserCredential contains the freshly linked Auth user. Use
    // it before reloading the pre-link user, which can briefly expose stale
    // phoneNumber data on the first submit.
    linkedUser = (await linkWithCredential(user, credential)).user;
  } catch (error) {
    if (!isProviderAlreadyLinked(error)) throw error;
    await user.reload();
    if (normalizePhoneNumber(user.phoneNumber ?? '') !== expectedPhoneE164) {
      throw new Error('A different phone number is already linked to this account.');
    }

    // The requested number is already linked to this authenticated user. Auth
    // has already established ownership, so profile sync is idempotent and no
    // second link operation is needed.
    await syncPhoneProfile(expectedPhoneE164);
    return;
  }

  await waitForExpectedPhone(linkedUser, expectedPhoneE164);

  await syncPhoneProfile(expectedPhoneE164);
}

async function syncPhoneProfile(expectedPhoneE164: string): Promise<void> {
  await callApi(
    '/v1/auth/phone/sync',
    {},
    {
      retryAuthOn401: true,
      idempotencyKey: `phone-sync-${expectedPhoneE164.replace(/\D/g, '')}`,
    },
  );
}

function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';
}

function isProviderAlreadyLinked(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    errorCode(error) === 'auth/provider-already-linked' ||
    message.includes('already been linked to the given provider')
  );
}

async function waitForExpectedPhone(user: User, expectedPhoneE164: string): Promise<void> {
  for (const delayMs of [0, 150, 300, 600]) {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (normalizePhoneNumber(user.phoneNumber ?? '') === expectedPhoneE164) return;
    await user.reload();
  }

  if (normalizePhoneNumber(user.phoneNumber ?? '') !== expectedPhoneE164) {
    throw new Error('The verified phone number does not match the selected number.');
  }
}

function verificationIdFromListener(listener: PhoneAuthListener): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (callback: (value: string) => void, value: string) => {
      if (settled) return;
      settled = true;
      callback(value);
    };

    listener.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.error) {
          if (!settled) {
            settled = true;
            reject(snapshot.error);
          }
          return;
        }
        if (snapshot.verificationId) {
          finish(resolve, snapshot.verificationId);
        }
      },
      (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      },
    );
  });
}
