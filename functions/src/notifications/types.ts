import type { Timestamp } from 'firebase-admin/firestore';

export const GEMTRACK_NOTIFICATION_TYPES = [
  'cheque_maturing_tomorrow',
  'cheque_bounced',
  'bill_due_today',
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

export type StoredNotification = NotificationInput & {
  isRead: boolean;
  isPushSent: boolean;
  createdAt: Timestamp;
};

export function priorityForType(type: NotificationType): NotificationPriority {
  if (
    type === 'cheque_bounced' ||
    type.startsWith('account_') ||
    type === 'verification_revoked'
  ) {
    return 'high';
  }
  if (
    type === 'ap_overdue' ||
    type === 'cheque_maturing_tomorrow' ||
    type === 'bill_due_today' ||
    type === 'payment_overdue' ||
    type === 'service_overdue'
  ) {
    return 'medium';
  }
  return 'low';
}

/** Types that always send push regardless of user prefs. */
export const PUSH_MANDATORY_TYPES = new Set<NotificationType>([
  'cheque_bounced',
  'verification_approved',
  'verification_rejected',
  'verification_info_requested',
  'verification_revoked',
  'account_warning',
  'account_suspended',
  'account_reinstated',
  'account_banned',
  'report_resolved',
  'report_dismissed',
]);

export type UserNotificationPreferences = {
  pushAnnouncements?: boolean;
  pushChequeAlerts?: boolean;
  pushApAlerts?: boolean;
  pushPaymentAlerts?: boolean;
  pushBillAlerts?: boolean;
};

export type UserDoc = {
  fcmToken?: string | null;
  isActive?: boolean;
  isSuspended?: boolean;
  notificationPreferences?: UserNotificationPreferences;
};
