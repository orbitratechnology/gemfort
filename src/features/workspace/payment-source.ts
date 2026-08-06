import type { Href } from "expo-router";

import type { IconName } from "@/components/ui/icon";
import type { Payment, Transaction } from "@/types";

/**
 * Source of a Money entry — the record a transaction / payment was created from.
 * Stored on transactions (`sourceType`/`sourceId`) and payments at write time,
 * so Money history can deep-link back to the originating Bill, AP, Cheque,
 * Service, Trip, Gem, or To Collect / To Pay item.
 */
export type PaymentSourceType =
  | "receivable"
  | "payable"
  | "bill"
  | "cheque"
  | "ap"
  | "service"
  | "trip"
  | "gem"
  | "contact"
  | "manual";

type SourceMeta = {
  label: string;
  icon: IconName;
};

const SOURCE_META: Record<PaymentSourceType, SourceMeta> = {
  receivable: { label: "To collect", icon: "south-west" },
  payable: { label: "To pay", icon: "north-east" },
  bill: { label: "Bill", icon: "receipt-long" },
  cheque: { label: "Cheque", icon: "money-check-dollar" },
  ap: { label: "AP", icon: "handshake" },
  service: { label: "Service", icon: "handyman" },
  trip: { label: "Trip", icon: "flight" },
  gem: { label: "Gem", icon: "diamond" },
  contact: { label: "Contact", icon: "person" },
  manual: { label: "Manual", icon: "edit-note" },
};

export function getPaymentSourceMeta(
  type: string | null | undefined,
): SourceMeta {
  if (!type) return { label: "Other", icon: "receipt" };
  return SOURCE_META[type as PaymentSourceType] ?? { label: "Other", icon: "receipt" };
}

/**
 * Resolve a deep link to the originating record. Returns `null` when there is
 * nothing sensible to open (e.g. a manual entry with no source).
 */
export function paymentSourceHref(
  type: string | null | undefined,
  id: string | null | undefined,
): Href | null {
  if (!type || !id) return null;
  switch (type) {
    case "receivable":
      return "/(marketplace)/(tabs)/money/receivables";
    case "payable":
      return "/(marketplace)/(tabs)/money/payables";
    case "bill":
      return `/(marketplace)/(tabs)/workspace/bills/${id}` as Href;
    case "cheque":
      return `/(marketplace)/(tabs)/workspace/cheques/${id}` as Href;
    case "ap":
      return `/(marketplace)/(tabs)/workspace/ap/${id}` as Href;
    case "service":
      return `/(marketplace)/(tabs)/workspace/services/${id}` as Href;
    case "trip":
      return `/(marketplace)/(tabs)/workspace/trips/${id}` as Href;
    case "gem":
      return `/(marketplace)/(tabs)/workspace/gems/${id}` as Href;
    case "contact":
      return `/(marketplace)/(tabs)/workspace/contacts/${id}` as Href;
    default:
      return null;
  }
}

/**
 * Best-effort source for legacy records that predate `sourceType`.
 * Falls back to the explicit link fields already stored on payments.
 */
export function sourceOfPayment(payment: Payment): {
  type: PaymentSourceType | null;
  id: string | null;
} {
  if (payment.sourceType && payment.sourceId) {
    return { type: payment.sourceType as PaymentSourceType, id: payment.sourceId };
  }
  if (payment.receivableId) return { type: "receivable", id: payment.receivableId };
  if (payment.payableId) return { type: "payable", id: payment.payableId };
  if (payment.billId) return { type: "bill", id: payment.billId };
  if (payment.gemId) return { type: "gem", id: payment.gemId };
  return { type: null, id: null };
}

/** Best-effort source for legacy transactions (gem-linked only). */
export function sourceOfTransaction(transaction: Transaction): {
  type: PaymentSourceType | null;
  id: string | null;
} {
  if (transaction.sourceType && transaction.sourceId) {
    return {
      type: transaction.sourceType as PaymentSourceType,
      id: transaction.sourceId,
    };
  }
  if (transaction.gemId) return { type: "gem", id: transaction.gemId };
  return { type: null, id: null };
}
