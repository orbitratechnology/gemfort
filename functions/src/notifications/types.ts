import type { Timestamp } from 'firebase-admin/firestore';

export const GEMTRACK_NOTIFICATION_TYPES = [
  'cheque_maturing_tomorrow',
  'cheque_bounced',
  'ap_overdue',
  'ap_return_due_soon',
  'ap_payment_overdue',
  'service_overdue',
  'payment_due_soon',
  'payment_overdue',
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
};

export type UserDoc = {
  fcmToken?: string | null;
  isActive?: boolean;
  isSuspended?: boolean;
  notificationPreferences?: UserNotificationPreferences;
};
