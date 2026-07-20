import type { Timestamp } from 'firebase-admin/firestore';

export const GEMTRACK_NOTIFICATION_TYPES = [
  'cheque_maturing_tomorrow',
  'cheque_bounced',
  'ap_overdue',
  'ap_return_due_soon',
  'ap_payment_overdue',
  'ap_request_received',
  'ap_request_accepted',
  'ap_request_rejected',
  'ap_request_cancelled',
  'ap_gem_sold',
  'ap_payment_sent',
  'ap_payment_received',
  'service_overdue',
  'payment_due_soon',
  'payment_overdue',
  'service_request_received',
  'service_request_accepted',
  'service_request_rejected',
  'service_job_updated',
  'cert_request_received',
  'cert_request_accepted',
  'cert_request_rejected',
  'cert_ready',
] as const;

export const GEMNET_NOTIFICATION_TYPES = [
  'verification_approved',
  'verification_rejected',
  'verification_info_requested',
  'verification_revoked',
  'announcement_platform',
  'announcement_industry_news',
  'report_resolved',
  'report_dismissed',
  'account_warning',
  'account_suspended',
  'account_reinstated',
  'account_banned',
] as const;

export type GemTrackNotificationType = (typeof GEMTRACK_NOTIFICATION_TYPES)[number];
export type GemNetNotificationType = (typeof GEMNET_NOTIFICATION_TYPES)[number];
export type NotificationType = GemTrackNotificationType | GemNetNotificationType;

export type NotificationPriority = 'high' | 'medium' | 'low';

export type NotificationInput = {
  recipientUid: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceType?: string | null;
  referenceId?: string | null;
  priority?: NotificationPriority;
};

export type StoredNotification = {
  recipientUid: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: string | null;
  priority: NotificationPriority;
  isRead: boolean;
  isPushSent: boolean;
  createdAt: Timestamp;
};

export type UserNotificationPreferences = {
  pushAnnouncements?: boolean;
  pushChequeAlerts?: boolean;
  pushApAlerts?: boolean;
  pushPaymentAlerts?: boolean;
};

export type UserDoc = {
  fcmToken?: string | null;
  isActive?: boolean;
  isSuspended?: boolean;
  notificationPreferences?: UserNotificationPreferences;
};

/** These notification types bypass user push preferences — always send. */
export const PUSH_MANDATORY_TYPES = new Set<NotificationType>([
  'account_suspended',
  'account_banned',
  'account_reinstated',
  'verification_revoked',
  'cheque_bounced',
]);

/** Derive default priority from notification type. */
export function priorityForType(type: NotificationType): NotificationPriority {
  const high: NotificationType[] = [
    'cheque_bounced',
    'account_suspended',
    'account_banned',
    'verification_revoked',
    'ap_overdue',
    'ap_payment_overdue',
    'payment_overdue',
  ];
  const low: NotificationType[] = [
    'announcement_platform',
    'announcement_industry_news',
    'cheque_maturing_tomorrow',
    'ap_return_due_soon',
    'payment_due_soon',
  ];
  if (high.includes(type)) return 'high';
  if (low.includes(type)) return 'low';
  return 'medium';
}
