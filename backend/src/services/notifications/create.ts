import { FieldValue, type Timestamp } from 'firebase-admin/firestore';

import { db } from '../../firebase.js';
import { priorityForType, type NotificationInput } from './types.js';

/**
 * Check whether an identical notification already exists to avoid duplicates.
 */
export async function notificationExists(
  recipientUid: string,
  type: string,
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

/**
 * Write a single notification document, skipping duplicates.
 * Returns the new document ID or null if the notification already existed.
 */
export async function createNotificationDoc(input: NotificationInput): Promise<string | null> {
  const referenceType = input.referenceType ?? null;
  const referenceId = input.referenceId ?? null;

  const exists = await notificationExists(input.recipientUid, input.type, referenceId);
  if (exists) return null;

  const ref = await db.collection('notifications').add({
    recipientUid: input.recipientUid,
    type: input.type,
    title: input.title,
    message: input.message,
    referenceType,
    referenceId,
    priority: input.priority ?? priorityForType(input.type),
    isRead: false,
    isPushSent: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  return ref.id;
}

/**
 * Write multiple notifications in sequence, skipping duplicates.
 * Returns the number of notifications actually created.
 */
export async function createNotificationsBatch(inputs: NotificationInput[]): Promise<number> {
  let created = 0;
  for (const input of inputs) {
    const id = await createNotificationDoc(input);
    if (id) created += 1;
  }
  return created;
}

/** Format a currency amount for human-readable notification messages. */
export function formatCurrency(amount: number, currency = 'LKR'): string {
  return `${currency} ${amount.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Safely convert a Firestore Timestamp, Date, or null to a JS Date. */
export function toDate(value: Timestamp | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as Timestamp).toDate();
  }
  return null;
}
