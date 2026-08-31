import { getIdToken } from '@/lib/firebase/auth';
import type { AuthUser } from '@/lib/firebase/auth-types';
import { getFirebaseAppCheckToken } from '@/lib/firebase/app-check';
import { getFirebaseAuth } from '@/lib/firebase/config';

type ApiSuccess<T> = {
  data: T;
  meta?: { requestId?: string };
};

type ApiFailure = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export type ApiClientDependencies = {
  getCurrentUser: () => AuthUser | null;
  getIdToken: (user: AuthUser, forceRefresh: boolean) => Promise<string>;
  getAppCheckToken?: () => Promise<string | null>;
  request?: typeof fetch;
};

export type ApiRequestOptions = {
  forceRefreshToken?: boolean;
  retryAuthOn401?: boolean;
  idempotencyKey?: string;
};

const defaultDependencies: ApiClientDependencies = {
  getCurrentUser: () => getFirebaseAuth().currentUser,
  getIdToken: (user, forceRefresh) => getIdToken(user, forceRefresh),
  getAppCheckToken: getFirebaseAppCheckToken,
  request: fetch,
};

export function isGemfortApiCanaryEnabled(): boolean {
  return process.env.EXPO_PUBLIC_GEMFORT_API_CANARY === 'true';
}

/**
 * AP mutations have a separate gate because they change financial and
 * ownership state. Flight/provider reads can be canaried without enabling
 * this mutation path.
 */
export function isGemfortApApiCanaryEnabled(): boolean {
  return process.env.EXPO_PUBLIC_GEMFORT_AP_API_CANARY === 'true';
}

function apiBaseUrl(): string {
  const value = process.env.EXPO_PUBLIC_GEMFORT_API_BASE_URL?.trim().replace(/\/+$/, '');
  if (!value) {
    throw new ApiClientError(
      'The GemFort API is not configured for this build.',
      0,
      'api/configuration',
    );
  }
  return value;
}

function parseResponse(text: string): ApiSuccess<unknown> | ApiFailure {
  try {
    return JSON.parse(text) as ApiSuccess<unknown> | ApiFailure;
  } catch {
    return {};
  }
}

function errorFromResponse(
  status: number,
  parsed: ApiSuccess<unknown> | ApiFailure,
): ApiClientError {
  if ('error' in parsed && parsed.error) {
    return new ApiClientError(
      parsed.error.message || 'The request could not be completed.',
      status,
      parsed.error.code || 'api/error',
      parsed.error.requestId,
    );
  }
  return new ApiClientError(
    status === 404
      ? 'The GemFort API route is not available yet.'
      : 'The GemFort API returned an unexpected response.',
    status,
    status === 404 ? 'api/not-found' : 'api/invalid-response',
  );
}

async function requestOnce<TResult, TData>(
  url: string,
  data: TData,
  user: AuthUser,
  dependencies: ApiClientDependencies,
  options: ApiRequestOptions,
  forceRefresh: boolean,
): Promise<{ response: Response; parsed: ApiSuccess<TResult> | ApiFailure }> {
  const idToken = await dependencies.getIdToken(user, forceRefresh);
  const appCheckToken = await dependencies.getAppCheckToken?.();
  if (!appCheckToken) {
    throw new ApiClientError(
      'This app could not verify its integrity. Please update and try again.',
      0,
      'app-check/unavailable',
    );
  }

  const request = dependencies.request ?? fetch;
  let response: Response;
  try {
    response = await request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      },
      body: JSON.stringify(data),
    });
  } catch {
    throw new ApiClientError(
      'The network is unavailable. Please try again.',
      0,
      'network/unavailable',
    );
  }

  const parsed = parseResponse(await response.text()) as
    | ApiSuccess<TResult>
    | ApiFailure;
  return { response, parsed };
}

export async function callApi<TResult, TData>(
  path: string,
  data: TData,
  options: ApiRequestOptions = {},
  dependencies: ApiClientDependencies = defaultDependencies,
): Promise<TResult> {
  const user = dependencies.getCurrentUser();
  if (!user) {
    throw new ApiClientError('Sign in to continue.', 401, 'unauthenticated');
  }

  const url = `${apiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  let result = await requestOnce<TResult, TData>(
    url,
    data,
    user,
    dependencies,
    options,
    options.forceRefreshToken === true,
  );

  if (
    result.response.status === 401 &&
    options.retryAuthOn401 === true &&
    options.forceRefreshToken !== true
  ) {
    result = await requestOnce<TResult, TData>(url, data, user, dependencies, options, true);
  }

  if (!result.response.ok) {
    throw errorFromResponse(result.response.status, result.parsed);
  }

  if (!('data' in result.parsed)) {
    throw errorFromResponse(result.response.status, result.parsed);
  }

  return result.parsed.data as TResult;
}
