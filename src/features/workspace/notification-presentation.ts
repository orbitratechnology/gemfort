import type { IconName } from "@/components/ui/icon";

export function fallbackIconForType(type: string): IconName {
  if (type.startsWith("cheque_")) return "money-check-dollar";
  if (type.startsWith("bill_")) return "receipt-long";
  if (type.startsWith("ap_")) return "handshake";
  if (type.startsWith("service_")) return "handyman";
  if (type.startsWith("payment_")) return "payments";
  if (type.startsWith("verification_")) return "verified-user";
  if (type.startsWith("announcement_")) return "campaign";
  if (type.startsWith("report_")) return "flag";
  if (type.startsWith("account_")) return "manage-accounts";
  if (type.startsWith("listing_offer")) return "sell";
  return "notifications";
}

export type NotificationTone =
  | "critical"
  | "warning"
  | "success"
  | "info"
  | "neutral";

/** Visual layout family for inbox rows. */
export type NotificationLayout = "social" | "alert" | "media" | "system";

export type InboxActionVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "ghost";

export type InboxActionId =
  | "open"
  | "accept_ap"
  | "decline_ap"
  | "accept_ap_cancel"
  | "decline_ap_cancel"
  | "view_listing"
  | "view_verify"
  | "view_account";

export type InboxAction = {
  id: InboxActionId;
  label: string;
  variant: InboxActionVariant;
};

export type NotificationPresentation = {
  categoryLabel: string;
  tone: NotificationTone;
  layout: NotificationLayout;
  icon: IconName;
  /** Short verb shown after actor name when layout is social. */
  verb: string | null;
  actions: InboxAction[];
  /** Expo / APNs category for interactive push actions. */
  pushCategoryId: string | null;
};

const OPEN: InboxAction = {
  id: "open",
  label: "View",
  variant: "secondary",
};

function social(
  categoryLabel: string,
  verb: string,
  actions: InboxAction[],
  tone: NotificationTone = "info",
  pushCategoryId: string | null = "open_ref",
): Omit<NotificationPresentation, "icon"> {
  return {
    categoryLabel,
    tone,
    layout: "social",
    verb,
    actions,
    pushCategoryId,
  };
}

function alert(
  categoryLabel: string,
  tone: NotificationTone,
  actions: InboxAction[] = [OPEN],
): Omit<NotificationPresentation, "icon"> {
  return {
    categoryLabel,
    tone,
    layout: "alert",
    verb: null,
    actions,
    pushCategoryId: "open_ref",
  };
}

function system(
  categoryLabel: string,
  tone: NotificationTone,
  actions: InboxAction[],
  pushCategoryId: string | null = "open_ref",
): Omit<NotificationPresentation, "icon"> {
  return {
    categoryLabel,
    tone,
    layout: "system",
    verb: null,
    actions,
    pushCategoryId,
  };
}

function media(
  categoryLabel: string,
  actions: InboxAction[] = [OPEN],
): Omit<NotificationPresentation, "icon"> {
  return {
    categoryLabel,
    tone: "info",
    layout: "media",
    verb: null,
    actions,
    pushCategoryId: "open_ref",
  };
}

const BY_TYPE: Record<string, Omit<NotificationPresentation, "icon">> = {
  // AP
  ap_request_received: social(
    "AP",
    "sent you an AP request",
    [
      { id: "accept_ap", label: "Accept", variant: "primary" },
      { id: "decline_ap", label: "Decline", variant: "destructive" },
      { id: "open", label: "Details", variant: "ghost" },
    ],
    "info",
    "ap_request",
  ),
  ap_request_accepted: social("AP", "accepted your AP", [OPEN], "success"),
  ap_request_rejected: social("AP", "declined your AP", [OPEN], "warning"),
  ap_request_cancelled: social("AP", "cancelled an AP request", [OPEN]),
  ap_cancellation_requested: social(
    "AP",
    "requested to cancel AP",
    [
      { id: "accept_ap_cancel", label: "Allow", variant: "primary" },
      { id: "decline_ap_cancel", label: "Keep AP", variant: "secondary" },
      { id: "open", label: "Details", variant: "ghost" },
    ],
    "warning",
    "ap_cancel",
  ),
  ap_cancellation_accepted: social(
    "AP",
    "accepted AP cancellation",
    [OPEN],
    "success",
  ),
  ap_cancellation_rejected: social(
    "AP",
    "kept the AP open",
    [OPEN],
    "info",
  ),
  ap_gem_sold: social("AP", "sold a gem on AP", [OPEN], "success"),
  ap_payment_sent: social("AP", "sent AP payment", [OPEN], "info"),
  ap_payment_received: social("AP", "confirmed AP payment", [OPEN], "success"),
  ap_overdue: alert("AP", "critical"),
  ap_return_due_soon: alert("AP", "warning"),
  ap_payment_overdue: alert("AP", "critical"),

  // Cheques / bills / payments
  cheque_maturing_tomorrow: alert("Cheque", "warning"),
  cheque_bounced: alert("Cheque", "critical"),
  bill_due_today: alert("Bill", "warning"),
  payment_due_soon: alert("Payment", "warning"),
  payment_overdue: alert("Payment", "critical"),

  // Services / certs
  service_overdue: alert("Service", "critical"),
  service_request_received: social("Service", "requested a service", [OPEN]),
  service_request_accepted: social(
    "Service",
    "accepted your service request",
    [OPEN],
    "success",
  ),
  service_request_rejected: social(
    "Service",
    "declined your service request",
    [OPEN],
    "warning",
  ),
  service_job_updated: social("Service", "updated a job", [OPEN]),
  service_cancellation_requested: social(
    "Service",
    "requested cancellation",
    [OPEN],
    "warning",
  ),
  service_cancellation_accepted: social(
    "Service",
    "accepted cancellation",
    [OPEN],
    "success",
  ),
  service_cancellation_rejected: social(
    "Service",
    "kept the job open",
    [OPEN],
  ),
  // GemNet
  listing_offer_received: social(
    "Offer",
    "made an offer",
    [{ id: "view_listing", label: "View listing", variant: "primary" }],
    "info",
    "listing_offer",
  ),
  announcement_platform: media("Announcements"),
  verification_approved: system(
    "Verification",
    "success",
    [{ id: "view_verify", label: "View status", variant: "primary" }],
  ),
  verification_rejected: system(
    "Verification",
    "warning",
    [{ id: "view_verify", label: "Fix & resubmit", variant: "primary" }],
  ),
  verification_info_requested: system(
    "Verification",
    "warning",
    [{ id: "view_verify", label: "Provide info", variant: "primary" }],
  ),
  verification_revoked: system(
    "Verification",
    "critical",
    [{ id: "view_verify", label: "View details", variant: "secondary" }],
  ),
  report_resolved: system("Report", "success", [OPEN]),
  report_dismissed: system("Report", "neutral", [OPEN]),
  account_warning: system(
    "Account",
    "warning",
    [{ id: "view_account", label: "View account", variant: "secondary" }],
  ),
  account_suspended: system(
    "Account",
    "critical",
    [{ id: "view_account", label: "View account", variant: "secondary" }],
  ),
  account_reinstated: system(
    "Account",
    "success",
    [{ id: "view_account", label: "Open profile", variant: "primary" }],
  ),
  account_banned: system(
    "Account",
    "critical",
    [{ id: "view_account", label: "View account", variant: "secondary" }],
  ),
};

export function getNotificationPresentation(
  type: string,
): NotificationPresentation {
  const base = BY_TYPE[type] ?? {
    categoryLabel: typeLabelFallback(type),
    tone: "neutral" as const,
    layout: "alert" as const,
    verb: null,
    actions: [OPEN],
    pushCategoryId: "open_ref",
  };
  return {
    ...base,
    icon: fallbackIconForType(type),
  };
}

function typeLabelFallback(type: string): string {
  if (type.startsWith("ap_")) return "AP";
  if (type.startsWith("cheque_")) return "Cheque";
  if (type.startsWith("bill_")) return "Bill";
  if (type.startsWith("service_")) return "Service";
  if (type.startsWith("payment_")) return "Payment";
  if (type.startsWith("verification_")) return "Verification";
  if (type.startsWith("announcement_")) return "Announcements";
  if (type.startsWith("report_")) return "Report";
  if (type.startsWith("account_")) return "Account";
  if (type.startsWith("listing_offer")) return "Offer";
  return "Alert";
}

/** Android FCM channel id by priority / urgency. */
export function pushChannelForTone(tone: NotificationTone): string {
  if (tone === "critical") return "urgent";
  if (tone === "warning") return "alerts";
  return "default";
}

export function pushCategoryForType(type: string): string | null {
  return getNotificationPresentation(type).pushCategoryId;
}
