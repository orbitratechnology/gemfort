import { format } from 'date-fns';

export function generateSku(sequence: number): string {
  const year = new Date().getFullYear();
  return `GF-${year}-${String(sequence).padStart(5, '0')}`;
}

export function generateListingSlug(sequence: number): string {
  return `GF-L-${String(sequence).padStart(5, '0')}`;
}

export function formatCurrency(amount: number, currency = 'LKR'): string {
  return `${currency} ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(ts: { toDate?: () => Date } | Date): string {
  const date = ts instanceof Date ? ts : ts.toDate?.() ?? new Date();
  return format(date, 'dd MMM yyyy');
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
