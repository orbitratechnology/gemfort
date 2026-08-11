import {
  enableTestSession,
  getVerificationSupportInfo,
  getVerifiedPhoneNumber,
} from '@react-native-firebase/phone-number-verification';
import { Platform } from 'react-native';

import { callFunction } from '@/lib/firebase/call-function';
import { normalizePhoneNumber } from '@/lib/firebase/phone-utils';

const TEST_SESSION = process.env.EXPO_PUBLIC_PNV_TEST_SESSION;
let testSessionEnabled = false;
let testSessionAttempted = false;

/**
 * Dev-only: activates the console's Phone Number Verification test session
 * (SIM-less, numbers are country code + all zeros). No-op outside __DEV__ or
 * when EXPO_PUBLIC_PNV_TEST_SESSION is unset. This must only be supplied to
 * non-public development builds; production builds omit test-session support.
 */
async function enablePnvTestSessionIfConfigured(): Promise<{ enabled: boolean }> {
  if (!__DEV__ || !TEST_SESSION) return { enabled: false };
  if (testSessionEnabled) return { enabled: true };
  if (testSessionAttempted) return { enabled: false };
  testSessionAttempted = true;
  try {
    await enableTestSession(TEST_SESSION);
    testSessionEnabled = true;
    return { enabled: true };
  } catch (error) {
    // "already enabled" means the native client still has the test session
    // active (it survives a bundle reload), so the fake SIM is authoritative.
    if (errorCode(error) === 'pnv/test-session-already-enabled') {
      testSessionEnabled = true;
      return { enabled: true };
    }
    console.warn('[PNV] Test session enable failed; using real SIM check.', errorCode(error));
    return { enabled: false };
  }
}

export type PhoneVerificationAttempt =
  | { status: 'verified'; phoneNumber: string }
  | { status: 'fallback-sms' };

/**
 * Tries carrier-level verification first (Phone Number Verification, Android
 * only). Any failure — unsupported platform/carrier, declined consent, a
 * number that does not match what the user typed, or the native consent flow
 * hanging out — returns `fallback-sms` so the caller can run the SMS OTP
 * flow instead of never leaving a "checking carrier" spinner.
 *
 * Throws only when the verified number is already linked to another account;
 * in that case the SMS path cannot help either, so the caller should stop.
 */
export async function attemptPhoneNumberVerification(
  expectedPhone: string,
): Promise<PhoneVerificationAttempt> {
  try {
    return await withTimeout(runPnvAttempt(expectedPhone), 15000);
  } catch (error) {
    if (errorCode(error) === 'functions/already_exists') {
      throw new Error('That mobile number is already linked to another GemFort account.');
    }
    return { status: 'fallback-sms' };
  }
}

async function runPnvAttempt(
  expectedPhone: string,
): Promise<PhoneVerificationAttempt> {
  if (Platform.OS !== 'android') {
    return { status: 'fallback-sms' };
  }

  // Test mode verifies SIM-less, so the SIM support check would reject the
  // emulator — skip it entirely when a test session is active.
  const { enabled: testMode } = await enablePnvTestSessionIfConfigured();
  if (!testMode) {
    let support;
    try {
      support = await getVerificationSupportInfo();
    } catch {
      return { status: 'fallback-sms' };
    }
    if (!support.some((slot) => slot.isSupported)) {
      return { status: 'fallback-sms' };
    }
  }

  let result;
  try {
    // Presents the Android consent dialog — the caller prepares the user first.
    result = await getVerifiedPhoneNumber();
  } catch {
    return { status: 'fallback-sms' };
  }

  // Only link when it matches the number the user chose, so a secondary SIM
  // number never silently replaces what they typed. A test session's fake SIM
  // is authoritative, so the user-typed number cannot (and need not) match it.
  if (!testMode) {
    const verified = normalizePhoneNumber(result.phoneNumber);
    const expected = normalizePhoneNumber(expectedPhone);
    if (expected && verified !== expected) {
      return { status: 'fallback-sms' };
    }
  }

  const { phoneNumber } = await callFunction<{ phoneNumber: string }, { token: string }>(
    'linkVerifiedPhone',
    { token: result.token },
  );
  return { status: 'verified', phoneNumber };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('pnv/timeout'));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';
}
