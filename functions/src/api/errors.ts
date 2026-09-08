import type { Context } from 'hono';

import type { ApiEnv } from './types';

export type ApiErrorCode =
  | 'invalid-argument'
  | 'unauthenticated'
  | 'permission-denied'
  | 'not-found'
  | 'already-exists'
  | 'failed-precondition'
  | 'resource-exhausted'
  | 'deadline-exceeded'
  | 'unavailable'
  | 'cancelled'
  | 'internal'
  | 'unknown';

type ApiStatus = 400 | 401 | 403 | 404 | 409 | 412 | 429 | 500 | 503 | 504;

const STATUS_BY_CODE: Record<ApiErrorCode, ApiStatus> = {
  'invalid-argument': 400,
  unauthenticated: 401,
  'permission-denied': 403,
  'not-found': 404,
  'already-exists': 409,
  'failed-precondition': 412,
  'resource-exhausted': 429,
  'deadline-exceeded': 504,
  unavailable: 503,
  cancelled: 409,
  internal: 500,
  unknown: 500,
};

const KNOWN_CODES = new Set<ApiErrorCode>(Object.keys(STATUS_BY_CODE) as ApiErrorCode[]);

export class ApiError extends Error {
  readonly status: ApiStatus;

  constructor(
    readonly code: ApiErrorCode,
    message: string,
    status: ApiStatus = STATUS_BY_CODE[code],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function apiErrorResponse(
  c: Context<ApiEnv>,
  error: ApiError,
) {
  return c.json(
    {
      error: {
        code: error.code,
        message: error.message,
        requestId: c.get('requestId'),
      },
    },
    error.status,
  );
}

/** Convert existing Firebase callable errors into the canonical HTTP error. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  const candidate =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const code = candidate.replace(/^functions\//, '').toLowerCase() as ApiErrorCode;

  if (KNOWN_CODES.has(code)) {
    const message = error instanceof Error ? error.message : 'The request could not be completed.';
    return new ApiError(code, message);
  }

  return new ApiError('internal', 'The service could not complete the request.');
}
