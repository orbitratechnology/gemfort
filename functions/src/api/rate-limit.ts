import { createHash } from 'node:crypto';

import { Timestamp } from 'firebase-admin/firestore';
import type { Context, MiddlewareHandler } from 'hono';

import { db } from '../admin';
import { ApiError, apiErrorResponse } from './errors';
import type { ApiEnv } from './types';

type Bucket = { tokens: number; updatedAt: number };

/**
 * Per-instance token bucket. Cheap enough to run on every request and stops a
 * single client from saturating an instance's concurrency slots. Limits are
 * per instance, so the shared Firestore budget below backs it for mutations.
 */
export class TokenBucketLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = Date.now();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly maxKeys = 10_000,
  ) {}

  take(key: string, now = Date.now()): boolean {
    this.sweep(now);
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, updatedAt: now };
    const elapsed = Math.max(0, now - bucket.updatedAt) / 1000;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillPerSecond);
    bucket.updatedAt = now;
    if (bucket.tokens < 1) {
      this.buckets.set(key, bucket);
      return false;
    }
    bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    return true;
  }

  private sweep(now: number) {
    if (now - this.lastSweep < 60_000 && this.buckets.size < this.maxKeys) return;
    this.lastSweep = now;
    const fullAfterMs = (this.capacity / this.refillPerSecond) * 1000;
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.updatedAt > fullAfterMs) this.buckets.delete(key);
    }
    while (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next().value;
      if (oldest === undefined) break;
      this.buckets.delete(oldest);
    }
  }
}

/** Client IP as seen by Cloud Run (left-most X-Forwarded-For entry). */
export function clientIp(c: Context<ApiEnv>): string {
  const forwarded = c.req.header('X-Forwarded-For') ?? '';
  return forwarded.split(',')[0]?.trim() || 'unknown';
}

function tooManyRequests(c: Context<ApiEnv>) {
  c.header('Retry-After', '30');
  return apiErrorResponse(
    c,
    new ApiError('resource-exhausted', 'Too many requests. Please slow down and try again shortly.'),
  );
}

export function rateLimitBy(
  limiter: TokenBucketLimiter,
  keyOf: (c: Context<ApiEnv>) => string | null,
): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const key = keyOf(c);
    if (key && !limiter.take(key)) return tooManyRequests(c);
    return next();
  };
}

export type MutationBudget = (uid: string, route: string) => Promise<void>;

const MUTATION_WINDOW_MS = 60_000;
const MUTATIONS_PER_WINDOW = 30;
const BUDGET_DOC_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Shared per-user mutation budget across all API instances: a fixed one-minute
 * window counter in Firestore. Expired windows are purged by a TTL policy on
 * `expiresAt`.
 */
export const firestoreMutationBudget: MutationBudget = async (uid) => {
  const window = Math.floor(Date.now() / MUTATION_WINDOW_MS);
  const id = createHash('sha256').update(`${uid}\u001f${window}`).digest('hex').slice(0, 40);
  const ref = db.collection('api_rate_limits').doc(id);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const count = Number(snap.data()?.count ?? 0);
    if (count >= MUTATIONS_PER_WINDOW) {
      throw new ApiError(
        'resource-exhausted',
        'Too many changes in a short time. Please wait a minute and try again.',
      );
    }
    transaction.set(ref, {
      uid,
      window,
      count: count + 1,
      expiresAt: Timestamp.fromMillis(Date.now() + BUDGET_DOC_TTL_MS),
    });
  });
};
