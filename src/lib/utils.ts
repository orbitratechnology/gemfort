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
import { normalizePhoneNumber } from '@/lib/firebase/phone-utils';

export function generateSku(sequence: number): string {
  const year = new Date().getFullYear();
  return `GF-${year}-${String(sequence).padStart(5, '0')}`;
}

/** Offline-safe SKU from a Firestore doc id (no collection scan). */
export function generateSkuFromDocId(docId: string): string {
  const year = new Date().getFullYear();
  const token = docId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
  return `GF-${year}-${token.padEnd(5, '0')}`;
}

/** Short user-facing gem ID (hides internal SKU codes). */
export function shortGemId(id: string | null | undefined): string {
  if (!id) return '';
  return id.slice(0, 8).toUpperCase();
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
 * e.g. Today · Tomorrow · In 3 days · 2 days overdue · In 3 months
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

  if (days > 0) {
    if (days <= 14) return `In ${days} day${days === 1 ? '' : 's'}`;

    if (days >= 30) {
      const months = Math.round(days / 30.4375);
      if (months >= 12) {
        const years = Math.round(days / 365.25);
        return `In ${years} year${years === 1 ? '' : 's'}`;
      }
      return `In ${months} month${months === 1 ? '' : 's'}`;
    }

    const weeks = Math.max(1, Math.round(days / 7));
    return `In ${weeks} week${weeks === 1 ? '' : 's'}`;
  }

  const overdueDays = Math.abs(days);
  if (overdueDays <= 14) {
    return `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`;
  }

  if (overdueDays >= 30) {
    const months = Math.round(overdueDays / 30.4375);
    if (months >= 12) {
      const years = Math.round(overdueDays / 365.25);
      return `${years} year${years === 1 ? '' : 's'} overdue`;
    }
    return `${months} month${months === 1 ? '' : 's'} overdue`;
  }

  const weeks = Math.max(1, Math.round(overdueDays / 7));
  return `${weeks} week${weeks === 1 ? '' : 's'} overdue`;
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
  const cleaned = normalizePhoneNumber(phone).replace(/\D/g, '');
  const url = `https://wa.me/${cleaned}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  return url;
}

export function openPhone(phone: string) {
  const normalized = normalizePhoneNumber(phone) || phone;
  return `tel:${normalized}`;
}
