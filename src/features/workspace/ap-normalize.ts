import type {
  ApGemLine,
  ApLifecycleStatus,
  ApRecord,
} from '@/types';
import type { Timestamp } from 'firebase/firestore';

/** True when AP is actively out with the holder (ongoing). */
export function isApOngoing(status: ApLifecycleStatus): boolean {
  return (
    status === 'accepted' ||
    status === 'with_holder' ||
    status === 'cancellation_requested'
  );
}

export function isApPending(status: ApLifecycleStatus): boolean {
  return status === 'pending';
}

export function apAgreedTotal(ap: ApRecord): number {
  if (ap.items?.length) {
    return ap.items.reduce((s, i) => s + (i.agreedPrice || 0), 0);
  }
  return ap.ownerMinimumPrice ?? 0;
}

export function apOwnerOwedTotal(ap: ApRecord): number {
  if (ap.items?.length) {
    return ap.items
      .filter((i) => i.lineStatus === 'sold')
      .reduce((s, i) => s + (i.ownerReceives ?? i.agreedPrice), 0);
  }
  if (ap.status === 'sold' || ap.status === 'payment_sent' || ap.status === 'done') {
    return ap.ownerReceives ?? ap.ownerMinimumPrice ?? 0;
  }
  return 0;
}

export function apHeldCount(ap: ApRecord): number {
  if (ap.items?.length) {
    return ap.items.filter((i) => i.lineStatus === 'held').length;
  }
  return isApOngoing(ap.status) ? 1 : 0;
}

export function apSoldCount(ap: ApRecord): number {
  if (ap.items?.length) {
    return ap.items.filter((i) => i.lineStatus === 'sold').length;
  }
  return ap.status === 'sold' || ap.status === 'payment_sent' || ap.status === 'done'
    ? 1
    : 0;
}

function legacyLineStatus(ap: {
  status: string;
}): ApGemLine['lineStatus'] {
  if (ap.status === 'sold' || ap.status === 'payment_sent' || ap.status === 'done') {
    return 'sold';
  }
  if (ap.status === 'returned' || ap.status === 'rejected' || ap.status === 'cancelled') {
    return 'returned';
  }
  return 'held';
}

function mapLegacyStatus(status: string): ApLifecycleStatus {
  if (status === 'with_holder' || status === 'overdue') return 'accepted';
  if (status === 'sold') return 'payment_sent'; // legacy sold ≈ awaiting/confirm payment
  if (status === 'returned') return 'cancelled';
  if (status === 'disputed') return 'accepted';
  return status as ApLifecycleStatus;
}

/**
 * Normalize legacy single-gem AP docs into the multi-item lifecycle shape.
 */
export function normalizeApRecord(raw: ApRecord & Record<string, unknown>): ApRecord {
  const hasItems = Array.isArray(raw.items) && raw.items.length > 0;
  const senderUid =
    (raw.senderUid as string) || (raw.ownerUid as string) || '';
  const receiverUid = (raw.receiverUid as string) || '';
  const statusRaw = raw.status as string;
  const status = hasItems
    ? (statusRaw as ApLifecycleStatus)
    : mapLegacyStatus(statusRaw);

  let items: ApGemLine[] = hasItems
    ? (raw.items as ApGemLine[])
    : raw.gemId
      ? [
          {
            gemId: raw.gemId as string,
            gemLabel: (raw.gemId as string).slice(0, 8),
            agreedPrice: (raw.ownerMinimumPrice as number) ?? 0,
            currency: (raw.currency as string) || 'LKR',
            lineStatus: legacyLineStatus({ status: statusRaw }),
            soldPrice: (raw.soldPrice as number | null) ?? null,
            soldToName: null,
            soldDate: (raw.soldDate as Timestamp | null) ?? null,
            ownerReceives: (raw.ownerReceives as number | null) ?? null,
            commission: (raw.apHolderCommission as number | null) ?? null,
            paymentDueDate: null,
          },
        ]
      : [];

  return {
    id: raw.id,
    ownerUid: (raw.ownerUid as string) || senderUid,
    senderUid,
    receiverUid,
    receiverContactId:
      (raw.receiverContactId as string) ||
      (raw.apHolderContactId as string) ||
      '',
    receiverBusinessId: (raw.receiverBusinessId as string | null) ?? null,
    receiverName: (raw.receiverName as string) || 'Holder',
    senderName: (raw.senderName as string) || 'Sender',
    items,
    status,
    expectedReturnDate: raw.expectedReturnDate as Timestamp,
    expectedDurationDays: (raw.expectedDurationDays as number) || 30,
    dateGiven: (raw.dateGiven as Timestamp | null) ?? null,
    agreementNotes: (raw.agreementNotes as string | null) ?? null,
    paymentMethod: (raw.paymentMethod as ApRecord['paymentMethod']) ?? null,
    paymentAmount: (raw.paymentAmount as number | null) ?? null,
    paymentSentAt: (raw.paymentSentAt as Timestamp | null) ?? null,
    paymentReceivedAt: (raw.paymentReceivedAt as Timestamp | null) ?? null,
    paymentChequeId: (raw.paymentChequeId as string | null) ?? null,
    rejectionReason: (raw.rejectionReason as string | null) ?? null,
    createdAt: raw.createdAt as Timestamp,
    updatedAt: raw.updatedAt as Timestamp,
    // preserve legacy for any remaining callers
    gemId: raw.gemId as string | undefined,
    apHolderContactId: raw.apHolderContactId as string | undefined,
    ownerMinimumPrice: raw.ownerMinimumPrice as number | undefined,
    currency: raw.currency as string | undefined,
    soldPrice: raw.soldPrice as number | null | undefined,
    ownerReceives: raw.ownerReceives as number | null | undefined,
    apHolderCommission: raw.apHolderCommission as number | null | undefined,
    soldDate: raw.soldDate as Timestamp | null | undefined,
    paymentStatus: raw.paymentStatus as ApRecord['paymentStatus'],
  };
}

export function apStatusLabel(status: ApLifecycleStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'accepted':
    case 'with_holder':
      return 'Accepted';
    case 'rejected':
      return 'Rejected';
    case 'cancelled':
      return 'Cancelled';
    case 'cancellation_requested':
      return 'Cancel requested';
    case 'payment_sent':
      return 'Payment sent';
    case 'done':
      return 'Done';
    case 'sold':
      return 'Sold';
    case 'returned':
      return 'Returned';
    default:
      return status;
  }
}
