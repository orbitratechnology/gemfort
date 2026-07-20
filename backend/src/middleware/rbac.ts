/**
 * Role-Based Access Control (RBAC) middleware.
 *
 * GemFort roles (stored in `users/{uid}.role`):
 *   "trader" | "lapidary" | "gem_lab" | "admin"
 *
 * Usage:
 *   app.post('/admin/...', requireAuth, requireRole('admin'), handler)
 *   app.post('/trade/...', requireAuth, requireRole('trader', 'lapidary'), handler)
 */
import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { db } from '../firebase.js';
import { forbidden, internal } from '../lib/errors.js';

export type GemFortRole = 'trader' | 'lapidary' | 'gem_lab' | 'admin';

/**
 * Require the authenticated user to hold one of the given roles.
 * MUST be composed after `requireAuth` (needs c.var.uid).
 */
export function requireRole(...roles: GemFortRole[]) {
  return async (c: Context, next: Next) => {
    const uid: string | undefined = c.get('uid');
    if (!uid) forbidden(); // should not happen if requireAuth came first

    let userRole: string;
    try {
      const snap = await db.collection('users').doc(uid).get();
      if (!snap.exists) forbidden('User record not found.');
      userRole = (snap.data()?.role as string | undefined) ?? '';
    } catch {
      internal('Could not load user role.');
    }

    if (!roles.includes(userRole as GemFortRole)) {
      forbidden(`Required role: ${roles.join(' or ')}.`);
    }

    await next();
  };
}

/**
 * Require the authenticated user to be an admin AND not suspended.
 */
export const requireAdmin = requireRole('admin');

/**
 * Verify the requesting user is active and not suspended.
 * MUST be composed after `requireAuth` (needs c.var.uid).
 *
 * NOTE: HTTPException is intentionally re-thrown — do NOT wrap in a bare
 * catch that silently swallows it, or suspended users will bypass this guard.
 */
export async function requireActive(c: Context, next: Next) {
  const uid: string | undefined = c.get('uid');
  if (!uid) {
    await next();
    return;
  }

  let snap;
  try {
    snap = await db.collection('users').doc(uid).get();
  } catch (err) {
    // Re-throw HTTPException so auth/RBAC errors are never swallowed.
    if (err instanceof HTTPException) throw err;
    // If Firestore is temporarily unavailable, fail closed (deny access).
    forbidden('Could not verify account status. Please try again.');
  }

  const data = snap!.data();
  if (data?.isSuspended === true) {
    forbidden('Your account has been suspended. Contact support.');
  }
  if (data?.isActive === false) {
    forbidden('Your account is inactive.');
  }

  await next();
}
