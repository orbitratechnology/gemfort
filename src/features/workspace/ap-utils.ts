import {
  apAgreedTotal,
  apOwnerOwedTotal,
  isApOngoing,
} from '@/features/workspace/ap-normalize';
import type { ApRecord, Contact, WorkspaceGem } from '@/types';

export type ApFilterTab =
  | 'all'
  | 'pending'
  | 'accepted'
  | 'payment_sent'
  | 'done'
  | 'rejected'
  | 'with_holder'
  | 'sold'
  | 'returned'
  | 'overdue';

export function filterApRecords(records: ApRecord[], tab: ApFilterTab): ApRecord[] {
  const now = Date.now();

  switch (tab) {
    case 'pending':
      return records.filter((r) => r.status === 'pending');
    case 'accepted':
    case 'with_holder':
      return records.filter((r) => isApOngoing(r.status));
    case 'payment_sent':
    case 'sold':
      return records.filter(
        (r) => r.status === 'payment_sent' || r.status === 'sold',
      );
    case 'done':
      return records.filter((r) => r.status === 'done');
    case 'rejected':
    case 'returned':
      return records.filter(
        (r) =>
          r.status === 'rejected' ||
          r.status === 'cancelled' ||
          r.status === 'returned',
      );
    case 'overdue':
      return records.filter(
        (r) =>
          isApOngoing(r.status) &&
          r.expectedReturnDate.toDate().getTime() < now,
      );
    default:
      return records;
  }
}

export type ApHolderGroup = {
  holderId: string;
  holderName: string;
  holderPhone: string | null;
  records: ApRecord[];
  totalMinimumValue: number;
  overdueCount: number;
};

export function groupApByHolder(
  records: ApRecord[],
  contacts: Contact[],
): ApHolderGroup[] {
  const grouped = new Map<string, ApRecord[]>();

  for (const record of records) {
    const key = record.receiverContactId || record.apHolderContactId || 'unknown';
    const list = grouped.get(key) ?? [];
    list.push(record);
    grouped.set(key, list);
  }

  const now = Date.now();

  return Array.from(grouped.entries())
    .map(([holderId, holderRecords]) => {
      const contact = contacts.find((c) => c.id === holderId);
      const sample = holderRecords[0];
      return {
        holderId,
        holderName:
          sample?.receiverName ||
          contact?.displayName ||
          'Unknown holder',
        holderPhone: contact?.phone ?? contact?.whatsapp ?? null,
        records: holderRecords.sort(
          (a, b) =>
            (b.dateGiven?.toMillis?.() ?? b.updatedAt.toMillis()) -
            (a.dateGiven?.toMillis?.() ?? a.updatedAt.toMillis()),
        ),
        totalMinimumValue: holderRecords
          .filter((r) => isApOngoing(r.status))
          .reduce((sum, r) => sum + apAgreedTotal(r), 0),
        overdueCount: holderRecords.filter(
          (r) =>
            isApOngoing(r.status) &&
            r.expectedReturnDate.toDate().getTime() < now,
        ).length,
      };
    })
    .sort((a, b) => a.holderName.localeCompare(b.holderName));
}

export function getApSummary(records: ApRecord[]) {
  const now = Date.now();
  const withHolder = records.filter((r) => isApOngoing(r.status));
  const overdue = withHolder.filter(
    (r) => r.expectedReturnDate.toDate().getTime() < now,
  );
  const pendingPayment = records.filter(
    (r) =>
      r.status === 'payment_sent' ||
      r.status === 'sold' ||
      (isApOngoing(r.status) &&
        (r.items ?? []).some((i) => i.lineStatus === 'sold')),
  );

  return {
    totalOut: withHolder.reduce(
      (n, r) => n + (r.items?.filter((i) => i.lineStatus === 'held').length || 1),
      0,
    ),
    totalValue: withHolder.reduce((sum, r) => sum + apAgreedTotal(r), 0),
    overdueCount: overdue.length,
    pendingPaymentTotal: pendingPayment.reduce(
      (sum, r) => sum + apOwnerOwedTotal(r),
      0,
    ),
    pendingRequests: records.filter((r) => r.status === 'pending').length,
  };
}

export function findGemForAp(
  gems: WorkspaceGem[],
  gemId: string,
): WorkspaceGem | undefined {
  return gems.find((g) => g.id === gemId);
}

export function daysSinceGiven(record: ApRecord): number {
  const start = record.dateGiven ?? record.createdAt;
  return Math.floor((Date.now() - start.toDate().getTime()) / 86400000);
}

export function isApOverdue(record: ApRecord): boolean {
  return (
    isApOngoing(record.status) &&
    record.expectedReturnDate.toDate().getTime() < Date.now()
  );
}
