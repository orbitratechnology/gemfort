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

async function readCallableJson<T>(response: Response): Promise<
  CallableSuccess<T> | CallableFailure
> {
  const text = await response.text();
  try {
    return JSON.parse(text) as CallableSuccess<T> | CallableFailure;
  } catch {
    // Cloud Functions returns an HTML document for an undeployed callable,
    // gateway failure, or malformed URL. Never let that escape as a JSON parser
    // exception to a React screen.
    const error = new Error(
      response.status === 404
        ? 'This service is not deployed yet. Please try again after deployment.'
        : 'The service returned an unexpected response. Please try again.',
    ) as Error & { code?: string };
    error.code = 'functions/unavailable';
    throw error;
  }
}

function isUnauthorized(
  status: number,
  json: CallableSuccess<unknown> | CallableFailure,
): boolean {
  if (status === 401) return true;
  if (!('error' in json) || !json.error) return false;
  const code = (json.error.status ?? '').toUpperCase();
  return code === 'UNAUTHENTICATED' || code === 'UNAUTHORIZED';
}

/**
 * Invoke a Firebase callable HTTPS function with the current Auth ID token.
 * Avoids adding @react-native-firebase/functions (native rebuild).
 *
 * Uses a cached ID token; force-refreshes only on auth failure so callables
 * do not pay an Auth round-trip on every request.
 */
export async function callFunction<TResult = unknown, TData = Record<string, never>>(
  name: string,
  data?: TData,
  options?: { forceRefreshToken?: boolean },
): Promise<TResult> {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error('Sign in to continue.');
  }

  const projectId = firebaseConfig.projectId;
  if (!projectId) {
    throw new Error('Firebase is not configured.');
  }

  const url = `https://${REGION}-${projectId}.cloudfunctions.net/${name}`;
  const body = JSON.stringify({ data: data ?? {} });

  const post = async (forceRefresh: boolean) => {
    const idToken = await getIdToken(user, forceRefresh);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body,
    });
    const json = await readCallableJson<TResult>(response);
    return { response, json };
  };

  let { response, json } = await post(options?.forceRefreshToken === true);
  if (isUnauthorized(response.status, json)) {
    ({ response, json } = await post(true));
  }

  if ('error' in json && json.error) {
    const err = new Error('We could not complete that. Please try again.') as Error & { code?: string };
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
