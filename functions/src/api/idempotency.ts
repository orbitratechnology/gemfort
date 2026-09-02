import { createHash } from 'node:crypto';

import { Timestamp } from 'firebase-admin/firestore';

import { db } from '../admin';
import { ApiError } from './errors';
import { validateIdempotencyKey } from '../gemtrack/mutation-contract';

const PENDING_RETRY_AFTER_MS = 10 * 60 * 1000;

type IdempotencyRecord = {
  uid: string;
  route: string;
  key: string;
  requestHash: string;
  status: 'pending' | 'succeeded';
  response?: unknown;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
 * for an identical retry. A pending claim is released when the handler fails;
 * the domain handlers themselves use transactions or deterministic event IDs
 * to make retries safe after a transport failure.
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
    if (updatedAt > Date.now() - PENDING_RETRY_AFTER_MS) {
      throw new ApiError(
        'failed-precondition',
        'An identical request is already in progress. Please retry shortly.',
      );
    }

    transaction.update(ref, { status: 'pending', updatedAt: now });
    return { kind: 'new' as const };
  });

  if (claim.kind === 'replay') return claim.response;

  try {
    const response = await input.execute();
    await ref.update({ status: 'succeeded', response, updatedAt: Timestamp.now() });
    return response;
  } catch (error) {
    await ref.delete().catch(() => undefined);
    throw error;
  }
}
