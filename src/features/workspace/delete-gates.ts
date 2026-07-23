import type {
  ApRecord,
  Cheque,
  Bill,
  ServiceRecord,
  Trip,
  WorkspaceGem,
} from "@/types";

/** Gems locked in marketplace / AP / trip flows cannot be hard-deleted. */
export function canDeleteGem(gem: WorkspaceGem): boolean {
  return !["on_ap", "on_trip", "listed", "sold"].includes(gem.status);
}

export function canDeleteCheque(_cheque: Cheque): boolean {
  return true;
}

export function canDeleteBill(_bill: Bill): boolean {
  return true;
}

export function canDeleteTrip(_trip: Trip): boolean {
  return true;
}

/** Complete or mutually cancelled services may be deleted. */
export function canDeleteService(service: ServiceRecord): boolean {
  return (
    service.status === "completed" ||
    service.status === "received_back" ||
    service.status === "cancelled"
  );
}

/** Active service that still needs cancel (or local cancel) before delete. */
export function canRequestServiceCancellation(service: ServiceRecord): boolean {
  return (
    service.status === "given" ||
    service.status === "in_progress" ||
    service.status === "overdue"
  );
}

/** Local contact providers have no in-app counterparty — cancel immediately. */
export function serviceNeedsProviderApproval(service: ServiceRecord): boolean {
  return Boolean(service.providerUid);
}

export function canDeleteAp(ap: ApRecord): boolean {
  return (
    ap.status === "done" ||
    ap.status === "cancelled" ||
    ap.status === "rejected"
  );
}

/** Sender may request cancel once the receiver has accepted (or payment is in flight). */
export function canRequestApCancellation(ap: ApRecord, uid: string): boolean {
  const isSender = ap.senderUid === uid || ap.ownerUid === uid;
  if (!isSender) return false;
  return (
    ap.status === "accepted" ||
    ap.status === "with_holder" ||
    ap.status === "payment_sent" ||
    ap.status === "sold" ||
    ap.status === "overdue" ||
    ap.status === "disputed"
  );
}

export function canRespondApCancellation(ap: ApRecord, uid: string): boolean {
  return (
    ap.receiverUid === uid && ap.status === "cancellation_requested"
  );
}

export function canRespondServiceCancellation(
  service: ServiceRecord,
  uid: string,
): boolean {
  return (
    service.providerUid === uid &&
    service.status === "cancellation_requested"
  );
}
