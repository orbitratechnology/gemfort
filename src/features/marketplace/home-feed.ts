import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  startOfDay,
} from 'date-fns';

import { directoryTabFromBusinessType } from '@/constants/roles';
import type { ApRecord, Business, ServiceRecord, Trip } from '@/types';

export type HomeUpcomingKind = 'ap' | 'service' | 'trip';

export type HomeUpcomingItem = {
  id: string;
  kind: HomeUpcomingKind;
  title: string;
  subtitle: string;
  date: Date;
  href: string;
};

export type HomeDayCell = {
  date: Date;
  label: string;
  dayNum: string;
  count: number;
  isToday: boolean;
};

const LOOKAHEAD_DAYS = 14;

function toDate(ts: { toDate?: () => Date } | null | undefined): Date | null {
  if (!ts) return null;
  return ts.toDate?.() ?? null;
}

/** Build calendar items for AP returns, service returns, and active trips. */
export function buildHomeUpcoming(input: {
  apRecords: ApRecord[];
  services: ServiceRecord[];
  trips: Trip[];
  contactName: (id: string | null | undefined) => string;
}): HomeUpcomingItem[] {
  const today = startOfDay(new Date());
  const horizon = addDays(today, LOOKAHEAD_DAYS);
  const items: HomeUpcomingItem[] = [];

  for (const r of input.apRecords) {
    if (r.status !== 'with_holder' && r.status !== 'overdue') continue;
    const due = toDate(r.expectedReturnDate);
    if (!due) continue;
    const day = startOfDay(due);
    if (day < today || day > horizon) continue;
    const holder = input.contactName(r.apHolderContactId);
    const days = differenceInCalendarDays(day, today);
    items.push({
      id: `ap-${r.id}`,
      kind: 'ap',
      title: days === 0 ? 'AP due today' : `AP due in ${days}d`,
      subtitle: `With ${holder}`,
      date: day,
      href: `/(marketplace)/(tabs)/workspace/ap/${r.id}`,
    });
  }

  for (const s of input.services) {
    if (s.status === 'completed' || s.status === 'received_back') continue;
    const due = toDate(s.expectedReturnDate);
    if (!due) continue;
    const day = startOfDay(due);
    if (day < today || day > horizon) continue;
    const days = differenceInCalendarDays(day, today);
    const who = s.providerName?.trim() || 'Provider';
    items.push({
      id: `svc-${s.id}`,
      kind: 'service',
      title: days === 0 ? 'Service due today' : `Service due in ${days}d`,
      subtitle: `${s.serviceType.replace(/_/g, ' ')} · ${who}`,
      date: day,
      href: `/(marketplace)/(tabs)/workspace/services/${s.id}`,
    });
  }

  for (const t of input.trips) {
    if (t.status === 'completed' || t.status === 'cancelled') continue;
    const end = toDate(t.expectedEndDate);
    if (!end) continue;
    const day = startOfDay(end);
    if (day < today || day > horizon) continue;
    const days = differenceInCalendarDays(day, today);
    items.push({
      id: `trip-${t.id}`,
      kind: 'trip',
      title: days === 0 ? 'Trip ends today' : `Trip ends in ${days}d`,
      subtitle: `${t.tripName} · ${t.destinationCity}`,
      date: day,
      href: `/(marketplace)/(tabs)/workspace/trips/${t.id}`,
    });
  }

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function buildWeekCells(upcoming: HomeUpcomingItem[]): HomeDayCell[] {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    return {
      date,
      label: format(date, 'EEE'),
      dayNum: format(date, 'd'),
      count: upcoming.filter((u) => isSameDay(u.date, date)).length,
      isToday: i === 0,
    };
  });
}

export function popularityScore(b: Business): number {
  const views = b.analytics?.profileViewsTotal ?? 0;
  const listings = b.analytics?.listingViewsTotal ?? 0;
  const taps = (b.analytics?.whatsappTapsTotal ?? 0) + (b.analytics?.phoneTapsTotal ?? 0);
  const endorsements = b.badges.endorsementCount ?? 0;
  return (
    (b.isFeatured ? 10_000 : 0) +
    (b.badges.isVerified ? 1_000 : 0) +
    views * 3 +
    listings * 2 +
    taps * 4 +
    endorsements * 50
  );
}

export function popularByRole(
  businesses: Business[],
  role: 'traders' | 'labs' | 'lapidaries',
  limit = 6,
): Business[] {
  return businesses
    .filter((b) => directoryTabFromBusinessType(b.businessType) === role)
    .sort((a, b) => popularityScore(b) - popularityScore(a) || a.businessName.localeCompare(b.businessName))
    .slice(0, limit);
}
