import {
  endOfMonth,
  endOfYear,
  format,
  isToday,
  isWithinInterval,
  isYesterday,
  startOfDay,
  startOfMonth,
  startOfYear,
  subMonths,
  subYears,
} from 'date-fns';

import { outstandingBase } from '@/lib/money';
import type { Payable, Receivable, Transaction } from '@/types';

export type TransactionSection = {
  title: string;
  data: Transaction[];
};

export function groupTransactionsByDate(transactions: Transaction[]): TransactionSection[] {
  const groups = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    const date = transaction.date.toDate();
    const key = format(date, 'yyyy-MM-dd');
    const list = groups.get(key) ?? [];
    list.push(transaction);
    groups.set(key, list);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, data]) => ({
      title: formatSectionTitle(new Date(key)),
      data,
    }));
}

function formatSectionTitle(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  const days = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / 86_400_000,
  );
  if (days > 0 && days < 7) return `${days}d ago`;
  return format(date, 'dd MMM yyyy');
}

function txBase(t: Transaction): number {
  if (typeof t.amountBase === 'number') return t.amountBase;
  return t.currency === 'LKR' ? t.amount : 0;
}

export function getMonthTotals(transactions: Transaction[], referenceDate = new Date()) {
  const monthStart = startOfMonth(referenceDate);

  const income = transactions
    .filter((t) => t.type === 'income' && t.date.toDate() >= monthStart)
    .reduce((sum, t) => sum + txBase(t), 0);

  const expense = transactions
    .filter((t) => t.type === 'expense' && t.date.toDate() >= monthStart)
    .reduce((sum, t) => sum + txBase(t), 0);

  return { income, expense, net: income - expense };
}

// ─── Period-aware analytics ───────────────────────────

export type MoneyPeriod = 'this_month' | 'last_month' | 'this_year';

export const MONEY_PERIODS: { id: MoneyPeriod; label: string }[] = [
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'this_year', label: 'This Year' },
];

export type DateRange = { start: Date; end: Date; label: string };

export function getPeriodRange(period: MoneyPeriod, ref = new Date()): DateRange {
  switch (period) {
    case 'last_month': {
      const d = subMonths(ref, 1);
      return { start: startOfMonth(d), end: endOfMonth(d), label: 'Last Month' };
    }
    case 'this_year':
      return { start: startOfYear(ref), end: endOfYear(ref), label: 'This Year' };
    case 'this_month':
    default:
      return { start: startOfMonth(ref), end: endOfMonth(ref), label: 'This Month' };
  }
}

function getPreviousRange(period: MoneyPeriod, ref = new Date()): DateRange {
  switch (period) {
    case 'last_month':
      return getPeriodRange('last_month', subMonths(ref, 1));
    case 'this_year': {
      const d = subYears(ref, 1);
      return { start: startOfYear(d), end: endOfYear(d), label: 'Last Year' };
    }
    case 'this_month':
    default:
      return getPeriodRange('last_month', ref);
  }
}

export function getRangeTotals(transactions: Transaction[], range: DateRange) {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    const date = t.date.toDate();
    if (date < range.start || date > range.end) continue;
    if (t.type === 'income') income += txBase(t);
    else expense += txBase(t);
  }
  return { income, expense, net: income - expense };
}

export type Trend = { pct: number; up: boolean };

/** Net-profit change of the current period versus the equivalent previous period. */
export function getNetTrend(transactions: Transaction[], period: MoneyPeriod, ref = new Date()): Trend {
  const current = getRangeTotals(transactions, getPeriodRange(period, ref)).net;
  const previous = getRangeTotals(transactions, getPreviousRange(period, ref)).net;
  if (previous === 0) {
    if (current === 0) return { pct: 0, up: true };
    return { pct: 100, up: current > 0 };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return { pct: Math.round(pct * 10) / 10, up: pct >= 0 };
}

export type CategoryTotal = { category: string; amount: number };

export function getCategoryBreakdown(
  transactions: Transaction[],
  range: DateRange,
  type: 'income' | 'expense' = 'expense',
): CategoryTotal[] {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== type) continue;
    const date = t.date.toDate();
    if (date < range.start || date > range.end) continue;
    const key = t.category || 'other';
    totals.set(key, (totals.get(key) ?? 0) + txBase(t));
  }
  return Array.from(totals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/** Outstanding money still owed to you (receivables) and owed by you (payables) — LKR base. */
export function getOutstanding(receivables: Receivable[], payables: Payable[]) {
  const toCollect = receivables
    .filter((r) => r.status !== 'paid')
    .reduce(
      (sum, r) =>
        sum +
        outstandingBase(
          r.amount,
          r.amountReceived,
          r.amountBase,
          r.currency,
        ),
      0,
    );
  const toPay = payables
    .filter((p) => p.status !== 'paid')
    .reduce(
      (sum, p) =>
        sum +
        outstandingBase(p.amount, p.amountPaid, p.amountBase, p.currency),
      0,
    );
  return { toCollect, toPay };
}

export type CashFlowBucket = { label: string; income: number; expense: number };

/** Weekly buckets for month periods, monthly buckets for the year period. */
export function getCashFlowBuckets(
  transactions: Transaction[],
  period: MoneyPeriod,
  ref = new Date(),
): CashFlowBucket[] {
  const range = getPeriodRange(period, ref);

  if (period === 'this_year') {
    const year = range.start.getFullYear();
    const buckets: CashFlowBucket[] = Array.from({ length: 12 }, (_, m) => ({
      label: format(new Date(year, m, 1), 'MMM'),
      income: 0,
      expense: 0,
    }));
    for (const t of transactions) {
      const date = t.date.toDate();
      if (date.getFullYear() !== year) continue;
      const bucket = buckets[date.getMonth()];
      if (t.type === 'income') bucket.income += txBase(t);
      else bucket.expense += txBase(t);
    }
    return buckets;
  }

  // Weekly buckets within the month (1-7, 8-14, 15-21, 22-end)
  const lastDay = range.end.getDate();
  const weekCount = Math.ceil(lastDay / 7);
  const buckets: CashFlowBucket[] = Array.from({ length: weekCount }, (_, i) => ({
    label: `W${i + 1}`,
    income: 0,
    expense: 0,
  }));
  for (const t of transactions) {
    const date = t.date.toDate();
    if (!isWithinInterval(date, { start: range.start, end: range.end })) continue;
    const idx = Math.min(Math.floor((date.getDate() - 1) / 7), weekCount - 1);
    if (t.type === 'income') buckets[idx].income += txBase(t);
    else buckets[idx].expense += txBase(t);
  }
  return buckets;
}
