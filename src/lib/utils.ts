import {
  differenceInCalendarDays,
  differenceInHours,
  differenceInMinutes,
  format,
  isToday,
  isYesterday,
  startOfDay,
} from 'date-fns';

import { getCurrencySymbol, resolveCurrencyCode } from '@/constants/currencies';

export function generateSku(sequence: number): string {
  const year = new Date().getFullYear();
  return `GF-${year}-${String(sequence).padStart(5, '0')}`;
}

export function generateListingSlug(sequence: number): string {
  return `GF-L-${String(sequence).padStart(5, '0')}`;
}

/** Face amount with currency symbol, e.g. "Rs 1,250.00" / "¥ 90.00". */
export function formatCurrency(amount: number, currency = 'LKR'): string {
  const code = resolveCurrencyCode(currency);
  const symbol = getCurrencySymbol(code);
  const formatted = amount.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${formatted}`;
}

/** Resolve Firestore Timestamp / Date to a JS Date. */
export function toJsDate(
  ts: { toDate?: () => Date } | Date | null | undefined,
): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? null : ts;
  const d = ts.toDate?.();
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

export function formatDate(ts: { toDate?: () => Date } | Date): string {
  const date = toJsDate(ts) ?? new Date();
  return format(date, 'dd MMM yyyy');
}

/**
 * Relative past time for activity feeds (notifications, history, payments).
 * e.g. Just now · 5m ago · 3h ago · Yesterday · 4d ago · 12 Jan
 */
export function formatRelativeTime(
  ts: { toDate?: () => Date } | Date | null | undefined,
): string {
  const date = toJsDate(ts);
  if (!date) return '—';

  const now = new Date();
  const mins = differenceInMinutes(now, date);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;

  const hours = differenceInHours(now, date);
  if (hours < 24 && isToday(date)) return `${hours}h ago`;
  if (isYesterday(date)) return 'Yesterday';

  const days = differenceInCalendarDays(now, date);
  if (days > 0 && days < 7) return `${days}d ago`;
  if (date.getFullYear() === now.getFullYear()) return format(date, 'd MMM');
  return format(date, 'd MMM yyyy');
}

/**
 * Relative due / upcoming labels (AP, services, cheques, payables).
 * e.g. Today · Tomorrow · in 3d · 2d overdue · 12 Jan
 */
export function formatRelativeDue(
  ts: { toDate?: () => Date } | Date | null | undefined,
): string {
  const date = toJsDate(ts);
  if (!date) return '—';

  const day = startOfDay(date);
  const today = startOfDay(new Date());
  const days = differenceInCalendarDays(day, today);

  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days <= 14) return `in ${days}d`;
  if (day.getFullYear() === today.getFullYear()) return format(day, 'd MMM');
  return format(day, 'd MMM yyyy');
}

/** True when the due date is before today (calendar). */
export function isPastDue(
  ts: { toDate?: () => Date } | Date | null | undefined,
): boolean {
  const date = toJsDate(ts);
  if (!date) return false;
  return differenceInCalendarDays(startOfDay(date), startOfDay(new Date())) < 0;
}

export function calcWeightLossPercent(before: number, after: number): number {
  if (before <= 0) return 0;
  return Number((((before - after) / before) * 100).toFixed(2));
}

export function openWhatsApp(phone: string, message?: string) {
  const cleaned = phone.replace(/\D/g, '');
  const url = `https://wa.me/${cleaned}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  return url;
}

export function openPhone(phone: string) {
  return `tel:${phone}`;
}
