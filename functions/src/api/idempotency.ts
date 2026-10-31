import { createHash } from 'node:crypto';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { db } from '../admin';
import { ApiError } from './errors';
import { validateIdempotencyKey } from '../gemtrack/mutation-contract';

const PENDING_RETRY_AFTER_MS = 10 * 60 * 1000;
/** After a server-side failure, wait before letting the same key run again. */
const FAILED_RETRY_AFTER_MS = 30 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

/**
 * Errors the handlers raise while validating, before any write commits. Only
 * these release the claim outright; anything else may have committed part of
 * the mutation, so the claim is kept and retried under a cooldown.
 */
const PRE_EXECUTION_ERROR_CODES = new Set([
  'invalid-argument',
  'unauthenticated',
  'permission-denied',
  'not-found',
  'already-exists',
  'failed-precondition',
]);
/** Retries arrive within minutes; a Firestore TTL policy on `expiresAt` purges older records. */
const RECORD_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function expiresAtFrom(now: Timestamp): Timestamp {
  return Timestamp.fromMillis(now.toMillis() + RECORD_TTL_MS);
}

type IdempotencyRecord = {
  uid: string;
  route: string;
  key: string;
  requestHash: string;
  status: 'pending' | 'succeeded' | 'failed';
  response?: unknown;
  attempts?: number;
  lastErrorCode?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt: Timestamp;
};

export type IdempotentInput<T> = {
  uid: string;
  route: string;
  key: string | undefined;
  request: unknown;
  execute: () => Promise<T>;
};

export type MutationExecutor = <T>(input: IdempotentInput<T>) => Promise<T>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function requestHash(input: unknown): string {
  const serialized = JSON.stringify(canonicalize(input)) ?? 'null';
  return createHash('sha256')
    .update(serialized)
    .digest('hex');
}

function recordId(uid: string, route: string, key: string): string {
  return `api-${createHash('sha256').update(`${uid}\u001f${route}\u001f${key}`).digest('hex')}`;
}

/**
 * Execute a mutation once per user/route/idempotency key and replay its result
 * for an identical retry. A validation failure releases the claim; any other
 * failure keeps it as `failed` so retries are serialized behind a cooldown.
 */
export async function executeIdempotent<T>(input: IdempotentInput<T>): Promise<T> {
  const key = validateIdempotencyKey(input.key);
  const hash = requestHash(input.request);
  const ref = db.collection('gemfort_api_idempotency').doc(recordId(input.uid, input.route, key));
  const now = Timestamp.now();

  const claim = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      transaction.create(ref, {
        uid: input.uid,
        route: input.route,
        key,
        requestHash: hash,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        expiresAt: expiresAtFrom(now),
      } satisfies IdempotencyRecord);
      return { kind: 'new' as const };
    }

    const existing = snapshot.data() as IdempotencyRecord;
    if (existing.uid !== input.uid || existing.route !== input.route || existing.key !== key) {
      throw new ApiError('already-exists', 'This idempotency key is already in use.');
    }
    if (existing.requestHash !== hash) {
      throw new ApiError(
        'already-exists',
        'This idempotency key was already used with a different request.',
      );
    }
    if (existing.status === 'succeeded') {
      return { kind: 'replay' as const, response: existing.response as T };
    }

    const updatedAt = existing.updatedAt?.toMillis?.() ?? 0;
    if (existing.status === 'failed') {
      if ((existing.attempts ?? 1) >= MAX_FAILED_ATTEMPTS) {
        throw new ApiError(
          'failed-precondition',
          'This request failed repeatedly and needs support to reconcile it.',
        );
      }
      if (updatedAt > Date.now() - FAILED_RETRY_AFTER_MS) {
        throw new ApiError('unavailable', 'This request just failed. Please retry in a moment.');
      }
    } else if (updatedAt > Date.now() - PENDING_RETRY_AFTER_MS) {
      throw new ApiError(
        'failed-precondition',
        'An identical request is already in progress. Please retry shortly.',
      );
    }

    transaction.update(ref, { status: 'pending', updatedAt: now, expiresAt: expiresAtFrom(now) });
    return { kind: 'new' as const };
  });

  if (claim.kind === 'replay') return claim.response;

  try {
    const response = await input.execute();
    // Account deletion intentionally removes every user-owned idempotency
    // record, including this one. Treat that terminal cleanup as success
    // instead of attempting to update a document that no longer exists.
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return;
      const completedAt = Timestamp.now();
      transaction.update(ref, {
        status: 'succeeded',
        response,
        updatedAt: completedAt,
        expiresAt: expiresAtFrom(completedAt),
      });
    });
    return response;
  } catch (error) {
    const code = error instanceof ApiError ? error.code : null;
    if (code && PRE_EXECUTION_ERROR_CODES.has(code)) {
      // Deterministic rejection before any commit: free the key so a
      // corrected client can retry with it.
      await ref.delete().catch(() => undefined);
    } else {
      // The handler may have committed before failing (e.g. while notifying).
      // Keep the claim so a concurrent duplicate cannot re-run it, and let a
      // later retry through after a cooldown; handlers are transactional and
      // use deterministic IDs, so that retry reconciles instead of duplicating.
      const failedAt = Timestamp.now();
      await ref
        .update({
          status: 'failed',
          attempts: FieldValue.increment(1),
          lastErrorCode: code ?? 'internal',
          updatedAt: failedAt,
          expiresAt: expiresAtFrom(failedAt),
        })
        .catch(() => undefined);
    }
    throw error;
  }
}
