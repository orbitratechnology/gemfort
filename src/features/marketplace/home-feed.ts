import { addDays, startOfDay } from 'date-fns';

import { directoryTabFromBusinessType } from '@/constants/roles';
import { isApOngoing } from '@/features/workspace/ap-normalize';
import { isPendingCheque, toDate as chequeToDate } from '@/features/workspace/cheque-utils';
import { formatCurrency, formatRelativeDue } from '@/lib/utils';
import type { ApRecord, Business, Cheque, ServiceRecord, Trip } from '@/types';

export type HomeUpcomingKind = 'ap' | 'service' | 'trip' | 'cheque';

export type HomeUpcomingItem = {
  id: string;
  kind: HomeUpcomingKind;
  title: string;
  subtitle: string;
  /** Relative due label, e.g. "Today", "in 3d", "2d overdue" */
  when: string;
  date: Date;
  href: string;
  overdue: boolean;
};

const LOOKAHEAD_DAYS = 21;
/** How far back to surface overdue items on Home. */
const OVERDUE_LOOKBACK_DAYS = 30;

function toDate(ts: { toDate?: () => Date } | null | undefined): Date | null {
  if (!ts) return null;
  return ts.toDate?.() ?? null;
}

function inWindow(day: Date, horizon: Date, lookback: Date): boolean {
  return day <= horizon && day >= lookback;
}

/** Upcoming workspace deadlines: AP returns, services, trips, cheques. */
export function buildHomeUpcoming(input: {
  apRecords: ApRecord[];
  services: ServiceRecord[];
  trips: Trip[];
  cheques?: Cheque[];
  contactName: (id: string | null | undefined) => string;
  /** When set, surfaces Taken pending + Given payment_sent for this user. */
  currentUid?: string | null;
}): HomeUpcomingItem[] {
  const today = startOfDay(new Date());
  const horizon = addDays(today, LOOKAHEAD_DAYS);
  const lookback = addDays(today, -OVERDUE_LOOKBACK_DAYS);
  const items: HomeUpcomingItem[] = [];
  const uid = input.currentUid ?? null;

  if (uid) {
    for (const r of input.apRecords) {
      if (r.status === 'pending' && r.receiverUid === uid) {
        items.push({
          id: `ap-pending-${r.id}`,
          kind: 'ap',
          title: 'AP to accept',
          subtitle: `From ${r.senderName}`,
          when: 'Now',
          date: today,
          href: `/(marketplace)/(tabs)/workspace/ap/${r.id}`,
          overdue: false,
        });
      }
      if (r.status === 'payment_sent' && r.senderUid === uid) {
        items.push({
          id: `ap-pay-${r.id}`,
          kind: 'ap',
          title: 'Confirm AP payment',
          subtitle: `From ${r.receiverName}`,
          when: 'Now',
          date: today,
          href: `/(marketplace)/(tabs)/workspace/ap/${r.id}`,
          overdue: false,
        });
      }
    }
  }

  for (const r of input.apRecords) {
    if (!isApOngoing(r.status)) continue;
    const due = toDate(r.expectedReturnDate);
    if (!due) continue;
    const day = startOfDay(due);
    if (!inWindow(day, horizon, lookback)) continue;
    const holder =
      r.receiverName ||
      input.contactName(r.receiverContactId || r.apHolderContactId);
    const overdue = day < today;
    items.push({
      id: `ap-${r.id}`,
      kind: 'ap',
      title: overdue ? 'AP overdue' : 'AP return',
      subtitle: `With ${holder}`,
      when: formatRelativeDue(day),
      date: day,
      href: `/(marketplace)/(tabs)/workspace/ap/${r.id}`,
      overdue,
    });
  }

  for (const s of input.services) {
    if (s.status === 'completed' || s.status === 'received_back') continue;
    const due = toDate(s.expectedReturnDate);
    if (!due) continue;
    const day = startOfDay(due);
    if (!inWindow(day, horizon, lookback)) continue;
    const who = s.providerName?.trim() || 'Provider';
    const overdue = day < today;
    items.push({
      id: `svc-${s.id}`,
      kind: 'service',
      title: overdue ? 'Service overdue' : 'Service return',
      subtitle: `${s.serviceType.replace(/_/g, ' ')} · ${who}`,
      when: formatRelativeDue(day),
      date: day,
      href: `/(marketplace)/(tabs)/workspace/services/${s.id}`,
      overdue,
    });
  }

  for (const t of input.trips) {
    if (t.status === 'completed' || t.status === 'cancelled') continue;
    const end = toDate(t.expectedEndDate);
    if (!end) continue;
    const day = startOfDay(end);
    if (!inWindow(day, horizon, lookback)) continue;
    const overdue = day < today;
    items.push({
      id: `trip-${t.id}`,
      kind: 'trip',
      title: overdue ? 'Trip ended' : 'Trip ends',
      subtitle: `${t.tripName} · ${t.destinationCity}`,
      when: formatRelativeDue(day),
      date: day,
      href: `/(marketplace)/(tabs)/workspace/trips/${t.id}`,
      overdue,
    });
  }

  for (const c of input.cheques ?? []) {
    if (!isPendingCheque(c)) continue;
    const due = chequeToDate(c.maturityDate);
    if (!due) continue;
    const day = startOfDay(due);
    if (!inWindow(day, horizon, lookback)) continue;
    const overdue = day < today;
    const who = input.contactName(c.counterpartyContactId) || c.issuedBy || 'Counterparty';
    const dir = c.direction === 'received' ? 'From' : 'To';
    items.push({
      id: `cheque-${c.id}`,
      kind: 'cheque',
      title: overdue ? 'Cheque overdue' : 'Cheque matures',
      subtitle: `${c.chequeNumber} · ${dir} ${who} · ${formatCurrency(c.amount, c.currency)}`,
      when: formatRelativeDue(day),
      date: day,
      href: `/(marketplace)/(tabs)/workspace/cheques/${c.id}`,
      overdue,
    });
  }

  return items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return a.date.getTime() - b.date.getTime();
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
