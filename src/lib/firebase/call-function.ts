import { getIdToken } from '@/lib/firebase/auth';
import { getFirebaseAuth, firebaseConfig } from '@/lib/firebase/config';
import { REGION } from '@/lib/firebase/functions-region';

type CallableSuccess<T> = { result: T };
type CallableFailure = {
  error: {
    message?: string;
    status?: string;
    details?: unknown;
  };
};

/**
 * Invoke a Firebase callable HTTPS function with the current Auth ID token.
 * Avoids adding @react-native-firebase/functions (native rebuild).
 */
export async function callFunction<TResult = unknown, TData = Record<string, never>>(
  name: string,
  data?: TData,
): Promise<TResult> {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error('Sign in to continue.');
  }

  const projectId = firebaseConfig.projectId;
  if (!projectId) {
    throw new Error('Firebase is not configured.');
  }

  const idToken = await getIdToken(user, true);
  const url = `https://${REGION}-${projectId}.cloudfunctions.net/${name}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data: data ?? {} }),
  });

  const json = (await response.json()) as CallableSuccess<TResult> | CallableFailure;

  if ('error' in json && json.error) {
    const message = json.error.message || 'Request failed.';
    const err = new Error(message) as Error & { code?: string };
    err.code = json.error.status
      ? `functions/${json.error.status.toLowerCase()}`
      : 'functions/error';
    throw err;
  }

  if (!response.ok) {
    throw new Error('Request failed. Please try again.');
  }

  return (json as CallableSuccess<TResult>).result;
}
