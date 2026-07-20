/**
 * Firebase ID-token authentication middleware.
 *
 * Expects: Authorization: Bearer <Firebase ID Token>
 *
 * On success injects `c.var.uid` (string) and `c.var.user` (DecodedIdToken)
 * into the Hono context so downstream handlers can use them without re-verifying.
 */
import type { Context, Next } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { DecodedIdToken } from 'firebase-admin/auth';

import { auth } from '../firebase.js';
import { unauthenticated } from '../lib/errors.js';

export type AuthVariables = {
  uid: string;
  user: DecodedIdToken;
};

/**
 * Require a valid Firebase ID token.
 * Attach decoded token to context variables.
 */
export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c: Context, next: Next) => {
    const header = c.req.header('Authorization') ?? '';
    if (!header.startsWith('Bearer ')) {
      unauthenticated('No Bearer token provided.');
    }

    const token = header.slice(7).trim();
    if (!token) unauthenticated('Empty Bearer token.');

    let decoded: DecodedIdToken;
    try {
      decoded = await auth.verifyIdToken(token, /* checkRevoked */ true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      unauthenticated(`Token verification failed: ${msg}`);
    }

    c.set('uid', decoded.uid);
    c.set('user', decoded);
    await next();
  },
);

/**
 * Optional auth — populates uid/user if a valid token is present but does NOT
 * reject the request if the header is absent.  Useful for public-read endpoints
 * that show extra data to authenticated users.
 */
export const optionalAuth = createMiddleware<{ Variables: Partial<AuthVariables> }>(
  async (c: Context, next: Next) => {
    const header = c.req.header('Authorization') ?? '';
    if (header.startsWith('Bearer ')) {
      const token = header.slice(7).trim();
      if (token) {
        try {
          const decoded = await auth.verifyIdToken(token, true);
          c.set('uid', decoded.uid);
          c.set('user', decoded);
        } catch {
          // swallow — treat as unauthenticated
        }
      }
    }
    await next();
  },
);
