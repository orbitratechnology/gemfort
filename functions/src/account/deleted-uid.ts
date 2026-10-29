/**
 * Placeholder written into shared records (APs, services, offers) when one
 * party deletes their account. The counterparty keeps the record; the deleted
 * user's uid is no longer stored.
 */
export const DELETED_UID = '__deleted__';

export function isLiveUid(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value !== DELETED_UID;
}
