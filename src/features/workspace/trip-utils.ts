import { differenceInCalendarDays, format } from 'date-fns';

import type { Trip, TripExpense, TripGem, TripStatus, WorkspaceGem } from '@/types';

export function toTripDate(ts: { toDate?: () => Date } | Date | null | undefined): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  return ts.toDate?.() ?? null;
}

export function formatTripDates(trip: Trip): string {
  const start = toTripDate(trip.startDate);
  const end = toTripDate(trip.expectedEndDate);
  if (!start || !end) return '—';
  return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
}

export function tripDurationDays(trip: Trip): number {
  const start = toTripDate(trip.startDate);
  const end = toTripDate(trip.actualEndDate ?? trip.expectedEndDate);
  if (!start || !end) return 0;
  return Math.max(1, differenceInCalendarDays(end, start) + 1);
}

export function isActiveTrip(trip: Trip): boolean {
  return trip.status === 'planning' || trip.status === 'ongoing';
}

export function computeTripSummary(
  expenses: TripExpense[],
  tripGems: TripGem[],
  gems: WorkspaceGem[],
) {
  const totalExpenses = expenses.reduce((s, e) => s + e.amountBase, 0);
  const purchases = tripGems.filter((tg) => tg.role === 'purchase');
  const parcels = tripGems.filter((tg) => tg.role === 'parcel');
  const soldParcels = parcels.filter((tg) => tg.status === 'sold');
  const totalGemsPurchased = purchases.length;
  const totalGemsSold = soldParcels.length;
  const purchaseSpend = purchases.reduce((s, tg) => s + (tg.purchaseCost ?? 0), 0);
  const totalRevenue = soldParcels.reduce((s, tg) => s + (tg.salePrice ?? 0), 0);
  const gemsOnTrip = tripGems.filter((tg) => tg.status === 'on_trip').length;
  const gemsReturned = tripGems.filter((tg) => tg.status === 'returned').length;
  const netResult = totalRevenue - totalExpenses - purchaseSpend;

  return {
    totalExpenses,
    totalGemsPurchased,
    totalGemsSold,
    totalRevenue,
    netResult,
    gemsOnAp: 0,
    gemsOnTrip,
    gemsReturned,
    purchaseSpend,
    parcelCount: parcels.length,
    gemMap: new Map(gems.map((g) => [g.id, g])),
  };
}

export function getTripsByStatus(trips: Trip[]) {
  return {
    active: trips.filter(isActiveTrip),
    completed: trips.filter((t) => t.status === 'completed'),
    cancelled: trips.filter((t) => t.status === 'cancelled'),
  };
}

export function budgetUsedPercent(trip: Trip, totalSpent: number): number {
  if (!trip.budget || trip.budget <= 0) return 0;
  return Math.min(100, Math.round((totalSpent / trip.budget) * 100));
}

/** Calendar progress from start → expected end (clamped 0–100). */
export function tripScheduleProgressPercent(trip: Trip): number {
  const start = toTripDate(trip.startDate);
  const end = toTripDate(trip.expectedEndDate);
  if (!start || !end) return 0;
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return 100;
  const elapsed = Date.now() - start.getTime();
  return Math.min(100, Math.max(0, Math.round((elapsed / totalMs) * 100)));
}

export function canStartTrip(status: TripStatus): boolean {
  return status === 'planning';
}

export function canCompleteTrip(status: TripStatus): boolean {
  return status === 'ongoing';
}
