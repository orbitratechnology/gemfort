import {
    addDays,
    differenceInCalendarDays,
    isSameDay,
    startOfDay,
    subDays,
} from "date-fns";

import type { GemTrackNotificationType } from "@/constants/gemtrack-notification-types";
import { isGemTrackNotificationType } from "@/constants/gemtrack-notification-types";
import { detectChequesMaturingTomorrow } from "@/features/workspace/cheque-utils";
import { effectiveReceivableStatus } from "@/features/workspace/payment-utils";
import {
    detectOverdueAp,
    detectOverdueServices,
} from "@/features/workspace/workspace-service";
import { formatCurrency } from "@/lib/utils";
import type {
    ApRecord,
    AppNotification,
    Cheque,
    Contact,
    Receivable,
    ServiceRecord,
    WorkspaceGem,
} from "@/types";

export type NotificationCandidate = {
  type: GemTrackNotificationType;
  title: string;
  message: string;
  referenceType: string;
  referenceId: string;
};

const AP_PAYMENT_OVERDUE_DAYS = 14;
const DUE_SOON_DAYS = 3;

function toDate(ts: { toDate?: () => Date } | null | undefined): Date | null {
  if (!ts) return null;
  return ts.toDate?.() ?? null;
}

function contactName(
  contacts: Contact[],
  contactId: string | null | undefined,
  fallback = "Unknown",
): string {
  if (!contactId) return fallback;
  return contacts.find((c) => c.id === contactId)?.displayName ?? fallback;
}

function gemLabel(gems: WorkspaceGem[], gemId: string): string {
  const gem = gems.find((g) => g.id === gemId);
  if (!gem) return "Gem";
  return (
    gem.variety?.trim() || gem.gemType?.replace(/_/g, " ") || gem.sku || "Gem"
  );
}

function daysOverdue(date: Date): number {
  return Math.max(
    1,
    differenceInCalendarDays(startOfDay(new Date()), startOfDay(date)),
  );
}

export function detectApReturnDueSoon(
  apRecords: ApRecord[],
  contacts: Contact[],
): NotificationCandidate[] {
  const target = startOfDay(addDays(new Date(), DUE_SOON_DAYS));
  return apRecords
    .filter((r) => {
      if (r.status !== "with_holder") return false;
      const due = toDate(r.expectedReturnDate);
      return due && isSameDay(startOfDay(due), target);
    })
    .map((r) => ({
      type: "ap_return_due_soon" as const,
      title: "AP return due soon",
      message: `AP stone with ${contactName(contacts, r.apHolderContactId)} is due back in ${DUE_SOON_DAYS} days.`,
      referenceType: "ap",
      referenceId: r.id,
    }));
}

export function detectApPaymentOverdue(
  apRecords: ApRecord[],
  contacts: Contact[],
): NotificationCandidate[] {
  const cutoff = subDays(startOfDay(new Date()), AP_PAYMENT_OVERDUE_DAYS);
  return apRecords
    .filter((r) => {
      if (r.status !== "sold") return false;
      if (r.paymentStatus === "paid") return false;
      const sold = toDate(r.soldDate);
      return sold && startOfDay(sold) < cutoff;
    })
    .map((r) => ({
      type: "ap_payment_overdue" as const,
      title: "AP payment overdue",
      message: `Payment from AP sale (${contactName(contacts, r.apHolderContactId)}) is overdue.`,
      referenceType: "ap",
      referenceId: r.id,
    }));
}

export function detectPaymentsDueSoon(
  receivables: Receivable[],
  contacts: Contact[],
): NotificationCandidate[] {
  const target = startOfDay(addDays(new Date(), DUE_SOON_DAYS));
  return receivables
    .filter((r) => {
      if (r.status === "paid") return false;
      const remaining = r.amount - r.amountReceived;
      if (remaining <= 0) return false;
      const due = toDate(r.dueDate);
      return due && isSameDay(startOfDay(due), target);
    })
    .map((r) => {
      const remaining = r.amount - r.amountReceived;
      return {
        type: "payment_due_soon" as const,
        title: "Payment due soon",
        message: `${contactName(contacts, r.contactId)} owes ${formatCurrency(remaining, r.currency)} — due in ${DUE_SOON_DAYS} days.`,
        referenceType: "receivable",
        referenceId: r.id,
      };
    });
}

export function detectPaymentsOverdue(
  receivables: Receivable[],
  contacts: Contact[],
): NotificationCandidate[] {
  return receivables
    .filter((r) => {
      if (r.status === "paid") return false;
      const remaining = r.amount - r.amountReceived;
      if (remaining <= 0) return false;
      return effectiveReceivableStatus(r) === "overdue";
    })
    .map((r) => {
      const remaining = r.amount - r.amountReceived;
      return {
        type: "payment_overdue" as const,
        title: "Payment overdue",
        message: `Payment from ${contactName(contacts, r.contactId)} for ${formatCurrency(remaining, r.currency)} is overdue.`,
        referenceType: "receivable",
        referenceId: r.id,
      };
    });
}

export function buildApOverdueCandidates(
  apRecords: ApRecord[],
  contacts: Contact[],
): NotificationCandidate[] {
  return detectOverdueAp(apRecords).map((r) => {
    const due = toDate(r.expectedReturnDate);
    const days = due ? daysOverdue(due) : 1;
    return {
      type: "ap_overdue" as const,
      title: "AP stone overdue",
      message: `AP stone with ${contactName(contacts, r.apHolderContactId)} is ${days} day${days === 1 ? "" : "s"} overdue.`,
      referenceType: "ap",
      referenceId: r.id,
    };
  });
}

export function buildServiceOverdueCandidates(
  services: ServiceRecord[],
  contacts: Contact[],
  gems: WorkspaceGem[],
): NotificationCandidate[] {
  return detectOverdueServices(services).map((s) => {
    const due = toDate(s.expectedReturnDate);
    const days = due ? daysOverdue(due) : 1;
    const provider = contactName(contacts, s.providerContactId, "provider");
    return {
      type: "service_overdue" as const,
      title: "Service overdue",
      message: `${gemLabel(gems, s.gemId)} with ${provider} is ${days} day${days === 1 ? "" : "s"} overdue.`,
      referenceType: "service",
      referenceId: s.id,
    };
  });
}

export function buildChequeMaturingCandidates(
  cheques: Cheque[],
  contacts: Contact[],
): NotificationCandidate[] {
  return detectChequesMaturingTomorrow(cheques).map((c) => ({
    type: "cheque_maturing_tomorrow" as const,
    title: "Cheque maturing tomorrow",
    message: `Cheque from ${contactName(contacts, c.counterpartyContactId, c.issuedBy)} for ${formatCurrency(c.amount, c.currency)} matures tomorrow.`,
    referenceType: "cheque",
    referenceId: c.id,
  }));
}

export function buildGemTrackNotificationCandidates(input: {
  apRecords: ApRecord[];
  services: ServiceRecord[];
  cheques: Cheque[];
  receivables: Receivable[];
  contacts: Contact[];
  gems: WorkspaceGem[];
}): NotificationCandidate[] {
  return [
    ...buildChequeMaturingCandidates(input.cheques, input.contacts),
    ...buildApOverdueCandidates(input.apRecords, input.contacts),
    ...detectApReturnDueSoon(input.apRecords, input.contacts),
    ...detectApPaymentOverdue(input.apRecords, input.contacts),
    ...buildServiceOverdueCandidates(
      input.services,
      input.contacts,
      input.gems,
    ),
    ...detectPaymentsDueSoon(input.receivables, input.contacts),
    ...detectPaymentsOverdue(input.receivables, input.contacts),
  ];
}

export function notificationDedupeKey(
  n: Pick<AppNotification, "type" | "referenceType" | "referenceId">,
): string {
  return `${n.type}:${n.referenceType ?? ""}:${n.referenceId ?? ""}`;
}

export function existingGemTrackNotificationKeys(
  notifications: AppNotification[],
): Set<string> {
  return new Set(
    notifications
      .filter((n) => isGemTrackNotificationType(n.type))
      .map(notificationDedupeKey),
  );
}
