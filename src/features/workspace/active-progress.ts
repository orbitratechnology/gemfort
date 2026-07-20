import { startOfDay } from "date-fns";

import type { IconName } from "@/components/ui/icon";
import { isApOngoing } from "@/features/workspace/ap-normalize";
import { isOpenBill, toDate as billToDate } from "@/features/workspace/bill-utils";
import { isPendingCheque, toDate as chequeToDate } from "@/features/workspace/cheque-utils";
import { toTripDate, tripScheduleProgressPercent } from "@/features/workspace/trip-utils";
import { formatCurrency, formatDate, formatRelativeDue } from "@/lib/utils";
import type { ApRecord, Bill, Cheque, Trip } from "@/types";

export type ActiveProgressKind = "trip" | "ap" | "cheque" | "bill";

export type ActiveProgressItem = {
  id: string;
  kind: ActiveProgressKind;
  badge: string;
  title: string;
  subtitle: string;
  /** Absolute date label, e.g. "22 Jul 2026" */
  dateLabel: string;
  /** Relative due, e.g. "in 3d" */
  when: string;
  href: string;
  progress: number;
  overdue: boolean;
  icon: IconName;
  sortAt: number;
};

function scheduleProgress(
  start: Date | null,
  end: Date | null,
): number {
  if (!start || !end) return 0;
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return 100;
  const elapsed = Date.now() - start.getTime();
  return Math.min(100, Math.max(0, Math.round((elapsed / totalMs) * 100)));
}

function toJs(ts: { toDate?: () => Date } | Date | null | undefined): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  return ts.toDate?.() ?? null;
}

/** Ongoing trips + open APs + pending cheques + open bills, soonest due first. */
export function buildActiveProgressItems(input: {
  trips: Trip[];
  apRecords: ApRecord[];
  cheques: Cheque[];
  bills?: Bill[];
  contactName: (id: string | null | undefined) => string;
  limit?: number;
}): ActiveProgressItem[] {
  const today = startOfDay(new Date());
  const items: ActiveProgressItem[] = [];

  for (const t of input.trips) {
    if (t.status !== "ongoing") continue;
    const end = toTripDate(t.expectedEndDate);
    const endDay = end ? startOfDay(end) : null;
    items.push({
      id: `trip-${t.id}`,
      kind: "trip",
      badge: "Ongoing",
      title: t.tripName,
      subtitle: [t.destinationCity, t.destinationCountry].filter(Boolean).join(", "),
      dateLabel: end ? formatDate(end) : "—",
      when: formatRelativeDue(end),
      href: `/(marketplace)/(tabs)/workspace/trips/${t.id}`,
      progress: tripScheduleProgressPercent(t),
      overdue: !!endDay && endDay < today,
      icon: "flight",
      sortAt: end?.getTime() ?? Number.MAX_SAFE_INTEGER,
    });
  }

  for (const r of input.apRecords) {
    if (!isApOngoing(r.status)) continue;
    const start = toJs(r.dateGiven);
    const end = toJs(r.expectedReturnDate);
    const endDay = end ? startOfDay(end) : null;
    const overdue = !!endDay && endDay < today;
    const holder =
      r.receiverName ||
      input.contactName(r.receiverContactId || r.apHolderContactId);
    items.push({
      id: `ap-${r.id}`,
      kind: "ap",
      badge: overdue ? "AP overdue" : "AP out",
      title: holder,
      subtitle: end ? `Return by ${formatDate(end)}` : "Return date TBD",
      dateLabel: end ? formatDate(end) : "—",
      when: formatRelativeDue(end),
      href: `/(marketplace)/(tabs)/workspace/ap/${r.id}`,
      progress: scheduleProgress(start, end),
      overdue,
      icon: "handshake",
      sortAt: end?.getTime() ?? Number.MAX_SAFE_INTEGER,
    });
  }

  for (const c of input.cheques) {
    if (!isPendingCheque(c)) continue;
    const start = chequeToDate(c.issueDate);
    const end = chequeToDate(c.maturityDate);
    const endDay = end ? startOfDay(end) : null;
    const overdue = !!endDay && endDay < today;
    const who =
      input.contactName(c.counterpartyContactId) || c.issuedBy || "Counterparty";
    items.push({
      id: `cheque-${c.id}`,
      kind: "cheque",
      badge: overdue ? "Cheque due" : "Cheque",
      title: c.chequeNumber,
      subtitle: end
        ? `Matures ${formatDate(end)} · ${who}`
        : who,
      dateLabel: end ? formatDate(end) : "—",
      when: formatRelativeDue(end),
      href: `/(marketplace)/(tabs)/workspace/cheques/${c.id}`,
      progress: scheduleProgress(start, end),
      overdue,
      icon: "money-check-dollar",
      sortAt: end?.getTime() ?? Number.MAX_SAFE_INTEGER,
    });
  }

  for (const b of input.bills ?? []) {
    if (!isOpenBill(b)) continue;
    const end = billToDate(b.dueDate);
    const endDay = end ? startOfDay(end) : null;
    const overdue = !!endDay && endDay < today;
    const who = input.contactName(b.counterpartyContactId) || "Contact";
    const remaining = Math.max(0, b.amount - b.amountSettled);
    items.push({
      id: `bill-${b.id}`,
      kind: "bill",
      badge: overdue ? "Bill overdue" : "Bill",
      title: who,
      subtitle: `${formatCurrency(remaining, b.currency)}${
        end ? ` · due ${formatDate(end)}` : ""
      }`,
      dateLabel: end ? formatDate(end) : "—",
      when: formatRelativeDue(end),
      href: `/(marketplace)/(tabs)/workspace/bills/${b.id}`,
      progress: scheduleProgress(toJs(b.createdAt), end),
      overdue,
      icon: "receipt-long",
      sortAt: end?.getTime() ?? Number.MAX_SAFE_INTEGER,
    });
  }

  items.sort((a, b) => a.sortAt - b.sortAt);
  return items.slice(0, input.limit ?? 6);
}
