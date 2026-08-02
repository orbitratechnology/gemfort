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
  'ap_cancellation_requested',
  'ap_cancellation_accepted',
  'ap_cancellation_rejected',
  'ap_gem_sold',
  'ap_payment_sent',
  'ap_payment_received',
  'service_overdue',
  'service_cancellation_requested',
  'service_cancellation_accepted',
  'service_cancellation_rejected',
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
  'listing_offer_received',
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
  /** Display name of the person/business that triggered the event. */
  actorName?: string | null;
  /** Profile / business logo for the actor. */
  actorPhotoUrl?: string | null;
  /** Secondary rich media (gem, listing, announcement art). */
  imageUrl?: string | null;
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
    type === 'verification_revoked' ||
    type === 'listing_offer_received'
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

/** Expo / APNs interactive category ids (must match client registration). */
export function pushCategoryForType(type: NotificationType): string {
  if (type === 'ap_request_received') return 'ap_request';
  if (type === 'ap_cancellation_requested') return 'ap_cancel';
  if (type === 'listing_offer_received') return 'listing_offer';
  return 'open_ref';
}

export function pushChannelForType(type: NotificationType, priority: NotificationPriority): string {
  if (
    priority === 'high' ||
    type === 'cheque_bounced' ||
    type.startsWith('account_') ||
    type === 'ap_overdue' ||
    type === 'payment_overdue' ||
    type === 'service_overdue'
  ) {
    return 'urgent';
  }
  if (
    type.includes('due') ||
    type.includes('maturing') ||
    type.includes('overdue') ||
    priority === 'medium'
  ) {
    return 'alerts';
  }
  return 'default';
}

export type UserNotificationPreferences = {
  /** Master push switch; unset means enabled. */
  pushEnabled?: boolean;
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
