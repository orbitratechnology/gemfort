import { startOfDay } from "date-fns";

import type { IconName } from "@/components/ui/icon";
import { isApOngoing } from "@/features/workspace/ap-normalize";
import { isOpenBill, toDate as billToDate } from "@/features/workspace/bill-utils";
import { isPendingCheque, toDate as chequeToDate } from "@/features/workspace/cheque-utils";
import { toTripDate, tripScheduleProgressPercent } from "@/features/workspace/trip-utils";
import { formatCurrency, formatDate, formatRelativeDue } from "@/lib/utils";
import type { ApRecord, Bill, Cheque, ServiceRecord, Trip } from "@/types";

export type ActiveProgressKind = "trip" | "ap" | "cheque" | "bill" | "service";

export type ActiveProgressItem = {
  id: string;
  kind: ActiveProgressKind;
  badge: string;
  title: string;
  subtitle: string;
  /** When set, subtitle is rendered with a country flag. */
  country?: string;
  /** Absolute date label, e.g. "22 Jul 2026" */
  dateLabel: string;
  /** Relative due, e.g. "in 3d" */
  when: string;
  href: string;
  progress: number;
  overdue: boolean;
  icon: IconName;
  sortAt: number;
  /** Contact / business profile photo (or trip icon fallback). */
  imageUrl?: string | null;
  /** People/business = circle; gems = rounded. Default circle. */
  imageShape?: "circle" | "rounded";
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

const OPEN_SERVICE_STATUSES = new Set([
  "given",
  "in_progress",
  "overdue",
]);

/** Ongoing trips + open APs + pending cheques + open bills + active services. */
export function buildActiveProgressItems(input: {
  trips: Trip[];
  apRecords: ApRecord[];
  cheques: Cheque[];
  bills?: Bill[];
  services?: ServiceRecord[];
  /** Signed-in uid — used to pick the other party on Taken APs. */
  currentUid?: string | null;
  contactName: (id: string | null | undefined) => string;
  /** Contact / business avatar for cheque, bill, AP, and service rows. */
  contactPhoto?: (id: string | null | undefined) => string | null;
  /** Direct business logo by business id (services / AP receiverBusinessId). */
  businessPhoto?: (id: string | null | undefined) => string | null;
  /** Business logo by GemFort owner uid (AP sender when Taken). */
  ownerBusinessPhoto?: (uid: string | null | undefined) => string | null;
  /**
   * Optional override for AP leading thumb. Prefer party (circle) over gem.
   * When omitted, party photo is resolved from contact / business helpers.
   */
  apImage?: (record: ApRecord) => {
    url: string | null;
    shape: "circle" | "rounded";
  } | null;
  limit?: number;
}): ActiveProgressItem[] {
  const today = startOfDay(new Date());
  const items: ActiveProgressItem[] = [];
  const contactPhoto = input.contactPhoto ?? (() => null);
  const businessPhoto = input.businessPhoto ?? (() => null);
  const ownerBusinessPhoto = input.ownerBusinessPhoto ?? (() => null);
  const uid = input.currentUid ?? null;

  for (const t of input.trips) {
    if (t.status !== "ongoing") continue;
    const end = toTripDate(t.expectedEndDate);
    const endDay = end ? startOfDay(end) : null;
    items.push({
      id: `trip-${t.id}`,
      kind: "trip",
      badge: "Ongoing",
      title: t.tripName,
      subtitle: [t.destinationCity, t.destinationCountry]
        .filter(Boolean)
        .join(", "),
      country: t.destinationCountry,
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
    const isTaken = !!uid && r.receiverUid === uid;
    const partyName = isTaken
      ? r.senderName || "Sender"
      : r.receiverName ||
        input.contactName(r.receiverContactId || r.apHolderContactId);
    const override = input.apImage?.(r) ?? null;
    const partyUrl =
      override?.url ??
      (isTaken
        ? ownerBusinessPhoto(r.senderUid)
        : contactPhoto(r.receiverContactId || r.apHolderContactId) ||
          businessPhoto(r.receiverBusinessId));
    items.push({
      id: `ap-${r.id}`,
      kind: "ap",
      badge: overdue ? "AP overdue" : "AP out",
      title: partyName,
      subtitle: end ? `Return by ${formatDate(end)}` : "Return date TBD",
      dateLabel: end ? formatDate(end) : "—",
      when: formatRelativeDue(end),
      href: `/(marketplace)/(tabs)/workspace/ap/${r.id}`,
      progress: scheduleProgress(start, end),
      overdue,
      icon: "handshake",
      sortAt: end?.getTime() ?? Number.MAX_SAFE_INTEGER,
      imageUrl: partyUrl,
      imageShape: override?.shape ?? "circle",
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
      title: who,
      subtitle: end
        ? `#${c.chequeNumber} · matures ${formatDate(end)}`
        : `#${c.chequeNumber}`,
      dateLabel: end ? formatDate(end) : "—",
      when: formatRelativeDue(end),
      href: `/(marketplace)/(tabs)/workspace/cheques/${c.id}`,
      progress: scheduleProgress(start, end),
      overdue,
      icon: "money-check-dollar",
      sortAt: end?.getTime() ?? Number.MAX_SAFE_INTEGER,
      imageUrl: contactPhoto(c.counterpartyContactId),
      imageShape: "circle",
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
      imageUrl: contactPhoto(b.counterpartyContactId),
      imageShape: "circle",
    });
  }

  for (const s of input.services ?? []) {
    if (!OPEN_SERVICE_STATUSES.has(s.status)) continue;
    const start = toJs(s.dateGiven);
    const end = toJs(s.expectedReturnDate);
    const endDay = end ? startOfDay(end) : null;
    const overdue =
      s.status === "overdue" || (!!endDay && endDay < today);
    const who =
      s.providerName?.trim() ||
      input.contactName(s.providerContactId) ||
      "Provider";
    const photo =
      contactPhoto(s.providerContactId) ||
      businessPhoto(s.providerBusinessId);
    items.push({
      id: `service-${s.id}`,
      kind: "service",
      badge: overdue ? "Service overdue" : "Service",
      title: who,
      subtitle: `${s.serviceType.replace(/_/g, " ")}${
        end ? ` · due ${formatDate(end)}` : ""
      }`,
      dateLabel: end ? formatDate(end) : "—",
      when: formatRelativeDue(end),
      href: `/(marketplace)/(tabs)/workspace/services/${s.id}`,
      progress: scheduleProgress(start, end),
      overdue,
      icon: "build",
      sortAt: end?.getTime() ?? Number.MAX_SAFE_INTEGER,
      imageUrl: photo,
      imageShape: "circle",
    });
  }

  items.sort((a, b) => a.sortAt - b.sortAt);
  return items.slice(0, input.limit ?? 6);
}
