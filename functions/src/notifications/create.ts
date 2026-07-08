import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { db } from '../admin';
import { priorityForType, type NotificationInput } from './types';

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
    priority: input.priority ?? priorityForType(input.type),
    isRead: false,
    isPushSent: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  return ref.id;
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
  return `${currency} ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
