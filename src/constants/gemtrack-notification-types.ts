/** GemTrack workspace alert types (client-detected; Cloud Functions in production). */
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
] as const;

export type GemTrackNotificationType = (typeof GEMTRACK_NOTIFICATION_TYPES)[number];

export function isGemTrackNotificationType(type: string): type is GemTrackNotificationType {
  return (GEMTRACK_NOTIFICATION_TYPES as readonly string[]).includes(type);
}
