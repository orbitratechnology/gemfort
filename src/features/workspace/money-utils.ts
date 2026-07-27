import {
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  isToday,
  isWithinInterval,
  isYesterday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';

import { getMonthGrid } from '@/features/workspace/cheque-utils';
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

export function formatDateRangeLabel(start: Date, end: Date): string {
  if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
    return format(start, 'd MMM yyyy');
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
  }
  return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`;
}

/** Inclusive calendar range for custom filtering. */
export function makeCustomRange(start: Date, end: Date): DateRange {
  const a = startOfDay(start);
  const b = endOfDay(end);
  const [from, to] = a <= b ? [a, b] : [startOfDay(end), endOfDay(start)];
  return { start: from, end: to, label: formatDateRangeLabel(from, to) };
}

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

export { getMonthGrid };

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

function trendFromNets(current: number, previous: number): Trend {
  if (previous === 0) {
    if (current === 0) return { pct: 0, up: true };
    return { pct: 100, up: current > 0 };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return { pct: Math.round(pct * 10) / 10, up: pct >= 0 };
}

function getPreviousCustomRange(range: DateRange): DateRange {
  const days = differenceInCalendarDays(range.end, range.start) + 1;
  const prevEnd = endOfDay(subDays(range.start, 1));
  const prevStart = startOfDay(subDays(prevEnd, days - 1));
  return makeCustomRange(prevStart, prevEnd);
}

/** Net-profit change of the current period versus the equivalent previous period. */
export function getNetTrend(transactions: Transaction[], period: MoneyPeriod, ref = new Date()): Trend {
  const current = getRangeTotals(transactions, getPeriodRange(period, ref)).net;
  const previous = getRangeTotals(transactions, getPreviousRange(period, ref)).net;
  return trendFromNets(current, previous);
}

/** Net-profit change for an arbitrary date range versus the preceding span of equal length. */
export function getNetTrendForRange(transactions: Transaction[], range: DateRange): Trend {
  const current = getRangeTotals(transactions, range).net;
  const previous = getRangeTotals(transactions, getPreviousCustomRange(range)).net;
  return trendFromNets(current, previous);
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
    return getMonthlyBuckets(transactions, range);
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

function accumulateInto(
  buckets: CashFlowBucket[],
  transactions: Transaction[],
  indexOf: (date: Date) => number,
  range: DateRange,
) {
  for (const t of transactions) {
    const date = t.date.toDate();
    if (!isWithinInterval(date, { start: range.start, end: range.end })) continue;
    const idx = indexOf(date);
    if (idx < 0 || idx >= buckets.length) continue;
    if (t.type === 'income') buckets[idx].income += txBase(t);
    else buckets[idx].expense += txBase(t);
  }
  return buckets;
}

function getMonthlyBuckets(transactions: Transaction[], range: DateRange): CashFlowBucket[] {
  const months = eachMonthOfInterval({ start: range.start, end: range.end });
  const buckets = months.map((m) => ({
    label: format(m, months.length > 6 ? 'MMM' : 'MMM yy'),
    income: 0,
    expense: 0,
  }));
  return accumulateInto(
    buckets,
    transactions,
    (date) =>
      months.findIndex(
        (m) => m.getFullYear() === date.getFullYear() && m.getMonth() === date.getMonth(),
      ),
    range,
  );
}

/** Adaptive buckets for an arbitrary custom date range. */
export function getCashFlowBucketsForRange(
  transactions: Transaction[],
  range: DateRange,
): CashFlowBucket[] {
  const days = differenceInCalendarDays(range.end, range.start) + 1;

  if (days > 62) {
    return getMonthlyBuckets(transactions, range);
  }

  if (days > 14) {
    const weeks = eachWeekOfInterval(
      { start: range.start, end: range.end },
      { weekStartsOn: 0 },
    );
    const buckets = weeks.map((w, i) => ({
      label: `W${i + 1}`,
      income: 0,
      expense: 0,
    }));
    return accumulateInto(
      buckets,
      transactions,
      (date) => {
        const weekStart = startOfWeek(date, { weekStartsOn: 0 });
        return weeks.findIndex(
          (w) => format(w, 'yyyy-MM-dd') === format(weekStart, 'yyyy-MM-dd'),
        );
      },
      range,
    );
  }

  const dayList = eachDayOfInterval({ start: range.start, end: range.end });
  const buckets = dayList.map((d) => ({
    label: format(d, 'd'),
    income: 0,
    expense: 0,
  }));
  return accumulateInto(
    buckets,
    transactions,
    (date) =>
      dayList.findIndex((d) => format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')),
    range,
  );
}
