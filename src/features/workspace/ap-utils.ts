import type { ApRecord, Contact, WorkspaceGem } from '@/types';

export type ApFilterTab = 'all' | 'with_holder' | 'sold' | 'returned' | 'overdue';

export function filterApRecords(records: ApRecord[], tab: ApFilterTab): ApRecord[] {
  const now = Date.now();

  switch (tab) {
    case 'with_holder':
      return records.filter((r) => r.status === 'with_holder');
    case 'sold':
      return records.filter((r) => r.status === 'sold');
    case 'returned':
      return records.filter((r) => r.status === 'returned');
    case 'overdue':
      return records.filter(
        (r) => r.status === 'with_holder' && r.expectedReturnDate.toDate().getTime() < now,
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
    const list = grouped.get(record.apHolderContactId) ?? [];
    list.push(record);
    grouped.set(record.apHolderContactId, list);
  }

  const now = Date.now();

  return Array.from(grouped.entries())
    .map(([holderId, holderRecords]) => {
      const contact = contacts.find((c) => c.id === holderId);
      return {
        holderId,
        holderName: contact?.displayName ?? 'Unknown holder',
        holderPhone: contact?.phone ?? contact?.whatsapp ?? null,
        records: holderRecords.sort(
          (a, b) => b.dateGiven.toMillis() - a.dateGiven.toMillis(),
        ),
        totalMinimumValue: holderRecords
          .filter((r) => r.status === 'with_holder')
          .reduce((sum, r) => sum + r.ownerMinimumPrice, 0),
        overdueCount: holderRecords.filter(
          (r) =>
            r.status === 'with_holder' && r.expectedReturnDate.toDate().getTime() < now,
        ).length,
      };
    })
    .sort((a, b) => a.holderName.localeCompare(b.holderName));
}

export function getApSummary(records: ApRecord[]) {
  const now = Date.now();
  const withHolder = records.filter((r) => r.status === 'with_holder');
  const overdue = withHolder.filter((r) => r.expectedReturnDate.toDate().getTime() < now);
  const pendingPayment = records.filter(
    (r) => r.status === 'sold' && r.paymentStatus !== 'paid',
  );

  return {
    totalOut: withHolder.length,
    totalValue: withHolder.reduce((sum, r) => sum + r.ownerMinimumPrice, 0),
    overdueCount: overdue.length,
    pendingPaymentTotal: pendingPayment.reduce(
      (sum, r) => sum + (r.ownerReceives ?? r.ownerMinimumPrice),
      0,
    ),
  };
}

export function findGemForAp(gems: WorkspaceGem[], gemId: string): WorkspaceGem | undefined {
  return gems.find((g) => g.id === gemId);
}

export function daysSinceGiven(record: ApRecord): number {
  return Math.floor((Date.now() - record.dateGiven.toDate().getTime()) / 86400000);
}

export function isApOverdue(record: ApRecord): boolean {
  return (
    record.status === 'with_holder' &&
    record.expectedReturnDate.toDate().getTime() < Date.now()
  );
}
