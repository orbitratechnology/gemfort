import { getAppCheck, type DecodedAppCheckToken, type VerifyAppCheckTokenResponse, type VerifyAppCheckTokenOptions } from 'firebase-admin/app-check';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import type { MiddlewareHandler } from 'hono';

import { ApiError, apiErrorResponse } from './errors';
import type { ApiEnv } from './types';

export type VerifyIdToken = (
  idToken: string,
  checkRevoked?: boolean,
) => Promise<DecodedIdToken>;

export type VerifyAppCheckToken = (
  token: string,
  options?: VerifyAppCheckTokenOptions,
) => Promise<VerifyAppCheckTokenResponse>;

export type AppCheckMode = 'off' | 'audit' | 'enforce';

function defaultVerifyIdToken(idToken: string, checkRevoked = false) {
  return getAuth().verifyIdToken(idToken, checkRevoked);
}

function defaultVerifyAppCheckToken(
  token: string,
  options?: VerifyAppCheckTokenOptions,
) {
  return getAppCheck().verifyToken(token, options);
}

export function requireFirebaseAuth(
  verifyIdToken: VerifyIdToken = defaultVerifyIdToken,
): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const authorization = c.req.header('Authorization') ?? '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match?.[1]) {
      return apiErrorResponse(
        c,
        new ApiError('unauthenticated', 'Sign in to continue.'),
      );
    }

    try {
      const token = await verifyIdToken(match[1], false);
      c.set('user', { uid: token.uid, token });
      return next();
    } catch {
      return apiErrorResponse(
        c,
        new ApiError('unauthenticated', 'The sign-in session is invalid or expired.'),
      );
    }
  };
}

export function requireFirebaseAppCheck(options?: {
  mode?: AppCheckMode;
  verifyToken?: VerifyAppCheckToken;
}): MiddlewareHandler<ApiEnv> {
  const mode = options?.mode ?? 'enforce';
  const verifyToken = options?.verifyToken ?? defaultVerifyAppCheckToken;

  return async (c, next) => {
    if (mode === 'off') {
      return next();
    }

    const token = c.req.header('X-Firebase-AppCheck')?.trim();
    if (!token) {
      if (mode === 'audit') {
        console.warn('gemfort-api-app-check-missing', { requestId: c.get('requestId') });
        return next();
      }
      return apiErrorResponse(
        c,
        new ApiError('unauthenticated', 'App Check verification is required.'),
      );
    }

    try {
      const verified = await verifyToken(token, { consume: false });
      c.set('appCheck', verified.token as DecodedAppCheckToken);
      return next();
    } catch {
      if (mode === 'audit') {
        console.warn('gemfort-api-app-check-invalid', { requestId: c.get('requestId') });
        return next();
      }
      return apiErrorResponse(
        c,
        new ApiError('unauthenticated', 'App Check verification failed.'),
      );
    }
  };
}
