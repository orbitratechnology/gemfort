import { isPast, startOfDay } from 'date-fns';

import type { Payable, Receivable } from '@/types';

export function effectiveReceivableStatus(r: Receivable): Receivable['status'] {
  if (r.status === 'paid') return 'paid';
  const due = r.dueDate?.toDate?.();
  if (due && isPast(startOfDay(due)) && r.amount - r.amountReceived > 0) return 'overdue';
  return r.status;
}

export function effectivePayableStatus(p: Payable): Payable['status'] {
  if (p.status === 'paid') return 'paid';
  const due = p.dueDate?.toDate?.();
  if (due && isPast(startOfDay(due)) && p.amount - p.amountPaid > 0) return 'overdue';
  return p.status;
}

export function getReceivableSummary(receivables: Receivable[]) {
  let totalOutstanding = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let partialCount = 0;

  for (const r of receivables) {
    const remaining = Math.max(0, r.amount - r.amountReceived);
    if (remaining <= 0) continue;
    totalOutstanding += remaining;
    const status = effectiveReceivableStatus(r);
    if (status === 'overdue') {
      overdueCount += 1;
      overdueAmount += remaining;
    }
    if (status === 'partial') partialCount += 1;
  }

  return { totalOutstanding, overdueCount, overdueAmount, partialCount, count: receivables.length };
}

export function getPayableSummary(payables: Payable[]) {
  let totalOutstanding = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let partialCount = 0;

  for (const p of payables) {
    const remaining = Math.max(0, p.amount - p.amountPaid);
    if (remaining <= 0) continue;
    totalOutstanding += remaining;
    const status = effectivePayableStatus(p);
    if (status === 'overdue') {
      overdueCount += 1;
      overdueAmount += remaining;
    }
    if (status === 'partial') partialCount += 1;
  }

  return { totalOutstanding, overdueCount, overdueAmount, partialCount, count: payables.length };
}
