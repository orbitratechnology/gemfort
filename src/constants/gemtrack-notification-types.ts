/** GemTrack workspace alert types (client-detected; Cloud Functions in production). */
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

export type GemTrackNotificationType = (typeof GEMTRACK_NOTIFICATION_TYPES)[number];

export function isGemTrackNotificationType(type: string): type is GemTrackNotificationType {
  return (GEMTRACK_NOTIFICATION_TYPES as readonly string[]).includes(type);
}
