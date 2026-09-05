export type NotificationGroup = {
  key: string;
  label: string;
};

const GROUPS: Record<string, NotificationGroup> = {
  finance: { key: "finance", label: "Finance & due dates" },
  ap: { key: "ap", label: "Memorandums" },
  services: { key: "services", label: "Lapidary services" },
  market: { key: "market", label: "Marketplace" },
  account: { key: "account", label: "Account & verification" },
  updates: { key: "updates", label: "Updates" },
};

/** A stable, human-readable bucket used in the inbox and system tray. */
export function notificationGroupForType(type: string): NotificationGroup {
  if (
    type.startsWith("cheque_") ||
    type.startsWith("bill_") ||
    type.startsWith("payment_")
  ) {
    return GROUPS.finance;
  }
  if (type.startsWith("ap_")) return GROUPS.ap;
  if (type.startsWith("service_")) return GROUPS.services;
  if (type.startsWith("listing_") || type.startsWith("like_")) {
    return GROUPS.market;
  }
  if (type.startsWith("announcement_")) return GROUPS.updates;
  if (
    type.startsWith("account_") ||
    type.startsWith("verification_") ||
    type.startsWith("report_")
  ) {
    return GROUPS.account;
  }
  return GROUPS.updates;
}

/** Native grouping identifiers must be compact and never contain user content. */
export function notificationThreadIdForType(type: string): string {
  return `gemfort.${notificationGroupForType(type).key}`;
}
