import { createHash } from 'node:crypto';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { db } from '../admin';
import {
  notificationGroupKeyForType,
  priorityForType,
  type NotificationInput,
} from './types';

export async function notificationExists(
  recipientUid: string,
  type: string,
  _referenceType: string | null | undefined,
  referenceId: string | null | undefined,
): Promise<boolean> {
  if (!referenceId) {
    const snap = await db
      .collection('notifications')
      .where('recipientUid', '==', recipientUid)
      .where('type', '==', type)
      .limit(1)
      .get();
    return !snap.empty;
  }

  const snap = await db
    .collection('notifications')
    .where('recipientUid', '==', recipientUid)
    .where('type', '==', type)
    .where('referenceId', '==', referenceId)
    .limit(1)
    .get();
  return !snap.empty;
}

export async function createNotificationDoc(input: NotificationInput): Promise<string | null> {
  const referenceType = input.referenceType ?? null;
  const referenceId = input.referenceId ?? null;

  const exists = await notificationExists(
    input.recipientUid,
    input.type,
    referenceType,
    referenceId,
  );
  if (exists) return null;

  const ref = await db.collection('notifications').add({
    recipientUid: input.recipientUid,
    type: input.type,
    title: input.title,
    message: input.message,
    referenceType,
    referenceId,
    actorName: input.actorName ?? null,
    actorPhotoUrl: input.actorPhotoUrl ?? null,
    imageUrl: input.imageUrl ?? null,
    priority: input.priority ?? priorityForType(input.type),
    groupKey: notificationGroupKeyForType(input.type),
    isRead: false,
    isPushSent: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  return ref.id;
}

function deterministicNotificationId(input: NotificationInput): string {
  const identity = [
    input.recipientUid,
    input.type,
    input.referenceType ?? '',
    input.referenceId ?? '',
  ].join('\u001f');
  return `api-${createHash('sha256').update(identity).digest('hex').slice(0, 48)}`;
}

/**
 * Create an API notification with a stable document ID.
 *
 * The query preserves compatibility with notifications created by the legacy
 * callable path. The deterministic create closes the race between concurrent
 * API retries when no legacy notification exists yet.
 */
export async function ensureDeterministicNotificationDoc(
  input: NotificationInput,
): Promise<string | null> {
  const referenceType = input.referenceType ?? null;
  const referenceId = input.referenceId ?? null;
  const exists = await notificationExists(
    input.recipientUid,
    input.type,
    referenceType,
    referenceId,
  );
  if (exists) return null;

  const id = deterministicNotificationId(input);
  try {
    await db.collection('notifications').doc(id).create({
      recipientUid: input.recipientUid,
      type: input.type,
      title: input.title,
      message: input.message,
      referenceType,
      referenceId,
      actorName: input.actorName ?? null,
      actorPhotoUrl: input.actorPhotoUrl ?? null,
      imageUrl: input.imageUrl ?? null,
      priority: input.priority ?? priorityForType(input.type),
      groupKey: notificationGroupKeyForType(input.type),
      isRead: false,
      isPushSent: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    return id;
  } catch (error) {
    const code = String(
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : '',
    ).toUpperCase();
    if (code === '6' || code === 'ALREADY_EXISTS') return null;
    throw error;
  }
}

export async function createNotificationsBatch(inputs: NotificationInput[]): Promise<number> {
  let created = 0;
  for (const input of inputs) {
    const id = await createNotificationDoc(input);
    if (id) created += 1;
  }
  return created;
}

export function formatCurrency(amount: number, currency = 'LKR'): string {
  const symbols: Record<string, string> = {
    LKR: 'Rs',
    USD: '$',
    EUR: '€',
    GBP: '£',
    THB: '฿',
    AED: 'د.إ',
    RMB: '¥',
    CNY: '¥',
    AUD: 'A$',
    SGD: 'S$',
    TZS: 'TSh',
    MGA: 'Ar',
    IDR: 'Rp',
  };
  const code = currency === 'CNY' || currency === 'CNH' ? 'RMB' : currency;
  const symbol = symbols[code] ?? symbols[currency] ?? currency;
  const formatted = amount.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${formatted}`;
}

export function toDate(value: Timestamp | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as Timestamp).toDate();
  }
  return null;
}
