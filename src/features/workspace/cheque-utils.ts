import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isTomorrow,
  isWithinInterval,
  startOfDay,
  startOfMonth,
} from 'date-fns';

import type { Cheque, ChequeStatus } from '@/types';

export const CHEQUE_STATUS_LABELS: Record<ChequeStatus, string> = {
  holding: 'Holding',
  deposited: 'Deposited',
  cleared: 'Cleared',
  bounced: 'Bounced',
  replaced: 'Replaced',
  cancelled: 'Cancelled',
};

export const PENDING_CHEQUE_STATUSES: ChequeStatus[] = ['holding', 'deposited'];

export function toDate(ts: { toDate?: () => Date } | Date | null | undefined): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  return ts.toDate?.() ?? null;
}

export function isPendingCheque(c: Cheque): boolean {
  return PENDING_CHEQUE_STATUSES.includes(c.status);
}

export function daysUntilMaturity(c: Cheque): number {
  const d = toDate(c.maturityDate);
  if (!d) return 0;
  return differenceInCalendarDays(startOfDay(d), startOfDay(new Date()));
}

export function getChequeSummary(cheques: Cheque[]) {
  const holding = cheques.filter((c) => c.status === 'holding');
  const deposited = cheques.filter((c) => c.status === 'deposited');
  const bounced = cheques.filter((c) => c.status === 'bounced');
  const pending = cheques.filter(isPendingCheque);

  const holdingTotal = holding.reduce((s, c) => s + c.amountBase, 0);
  const depositedTotal = deposited.reduce((s, c) => s + c.amountBase, 0);

  const now = new Date();
  const monthEnd = endOfMonth(now);
  const clearingThisMonth = pending
    .filter((c) => {
      const d = toDate(c.maturityDate);
      return d && isWithinInterval(d, { start: startOfMonth(now), end: monthEnd });
    })
    .reduce((s, c) => s + c.amountBase, 0);

  return {
    holdingCount: holding.length,
    holdingTotal,
    depositedCount: deposited.length,
    depositedTotal,
    bouncedCount: bounced.length,
    pendingCount: pending.length,
    pendingTotal: pending.reduce((s, c) => s + c.amountBase, 0),
    clearingThisMonth,
  };
}

export function getUpcomingCheques(cheques: Cheque[], limit = 20): Cheque[] {
  return cheques
    .filter(isPendingCheque)
    .slice()
    .sort((a, b) => {
      const da = toDate(a.maturityDate)?.getTime() ?? 0;
      const db = toDate(b.maturityDate)?.getTime() ?? 0;
      return da - db;
    })
    .slice(0, limit);
}

export function getChequesForDate(cheques: Cheque[], date: Date): Cheque[] {
  return cheques.filter((c) => {
    const d = toDate(c.maturityDate);
    return d && isSameDay(d, date);
  });
}

export function getChequesByDayInMonth(cheques: Cheque[], month: Date): Map<string, Cheque[]> {
  const map = new Map<string, Cheque[]>();
  cheques
    .filter((c) => {
      const d = toDate(c.maturityDate);
      return d && isSameMonth(d, month) && isPendingCheque(c);
    })
    .forEach((c) => {
      const d = toDate(c.maturityDate)!;
      const key = format(d, 'yyyy-MM-dd');
      const list = map.get(key) ?? [];
      list.push(c);
      map.set(key, list);
    });
  return map;
}

export function getDayTotal(cheques: Cheque[]): number {
  return cheques.reduce((s, c) => s + c.amountBase, 0);
}

export function maturityLabel(c: Cheque): string {
  const d = toDate(c.maturityDate);
  if (!d) return '—';
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  const days = daysUntilMaturity(c);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days <= 7) return `${days}d left`;
  return format(d, 'd MMM yyyy');
}

export function detectChequesMaturingTomorrow(cheques: Cheque[]): Cheque[] {
  return cheques.filter((c) => {
    if (!isPendingCheque(c)) return false;
    const d = toDate(c.maturityDate);
    return d && isTomorrow(d);
  });
}

export function detectChequesMaturingThisWeek(cheques: Cheque[]): Cheque[] {
  const now = startOfDay(new Date());
  const weekEnd = addDays(now, 7);
  return cheques.filter((c) => {
    if (!isPendingCheque(c)) return false;
    const d = toDate(c.maturityDate);
    return d && isWithinInterval(d, { start: now, end: weekEnd });
  });
}

export function getMonthGrid(month: Date): (Date | null)[][] {
  const start = startOfMonth(month);
  const firstDow = start.getDay();
  const daysInMonth = endOfMonth(month).getDate();
  const cells: (Date | null)[] = [];

  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}
