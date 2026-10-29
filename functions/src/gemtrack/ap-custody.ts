import { type DocumentSnapshot, type Timestamp } from 'firebase-admin/firestore';

import { ApiError } from '../api/errors';

/**
 * Gem state captured on an AP line when the gem is locked, so reject, cancel,
 * and return can put the gem back exactly as it was instead of forcing it to
 * `ready_for_sale`.
 */
export type ApGemSnapshot = {
  status: string | null;
  custody: string | null;
  outcome: string | null;
  currentLocation: string | null;
  currentHolderContactId: string | null;
};

type GemData = Record<string, unknown>;

// A gem carried on a trip can still be handed over on AP; every other
// custody means someone else is physically holding it.
const BLOCKING_CUSTODY = new Set([
  'with_cutter', 'with_heater', 'with_polisher', 'with_lapidary', 'on_ap',
]);
const OUTCOME_STATUSES = new Set(['listed', 'sold', 'returned']);

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/**
 * Why a gem cannot go on AP, or null when it can. A gem must be in the
 * owner's hands: no custody other than a trip, no marketplace listing, no
 * terminal outcome, and no pending ownership transfer.
 */
export function apUnavailableReason(gem: GemData): string | null {
  const status = stringOrNull(gem.status) ?? '';
  if (stringOrNull(gem.currentApId)) return 'is already on another AP';
  const custody = stringOrNull(gem.custody);
  if ((custody && custody !== 'on_trip') || BLOCKING_CUSTODY.has(status)) {
    return 'is not in your custody';
  }
  if (gem.isListedOnMarketplace === true || gem.outcome === 'listed' || status === 'listed') {
    return 'is listed on the marketplace. Unlist it first';
  }
  if (stringOrNull(gem.outcome) || OUTCOME_STATUSES.has(status)) {
    return 'is already sold or returned';
  }
  if (stringOrNull(gem.saleTransferRequestId) || gem.saleStatus === 'pending') {
    return 'has a pending sale transfer';
  }
  return null;
}

export function assertGemAvailableForAp(gem: GemData, label: string): void {
  const reason = apUnavailableReason(gem);
  if (reason) throw new ApiError('failed-precondition', `${label} ${reason}.`);
}

export function snapshotGemForAp(gem: GemData): ApGemSnapshot {
  return {
    status: stringOrNull(gem.status),
    custody: stringOrNull(gem.custody),
    outcome: stringOrNull(gem.outcome),
    currentLocation: stringOrNull(gem.currentLocation),
    currentHolderContactId: stringOrNull(gem.currentHolderContactId),
  };
}

/**
 * True when the gem is still locked by this AP and owned by the AP owner, so
 * releasing it cannot clobber a gem that has since moved elsewhere (or a gem
 * id that never belonged to the sender).
 */
export function isGemLockedByAp(
  gemSnap: DocumentSnapshot,
  apId: string,
  apOwnerUid: string,
): boolean {
  if (!gemSnap.exists) return false;
  const gem = gemSnap.data() as GemData;
  return gem.ownerUid === apOwnerUid && gem.currentApId === apId;
}

/** Firestore update that releases a gem from AP custody to its prior state. */
export function releaseGemFromApUpdate(
  snapshot: ApGemSnapshot | null | undefined,
  now: Timestamp,
): Record<string, unknown> {
  // APs created before snapshots existed only accepted gems that were not on
  // AP or sold; ready_for_sale is the closest prior state for those.
  const status = snapshot?.status && snapshot.status !== 'on_ap' ? snapshot.status : 'ready_for_sale';
  return {
    status,
    custody: snapshot?.custody ?? null,
    ...(snapshot ? { outcome: snapshot.outcome } : {}),
    currentLocation: snapshot?.currentLocation ?? null,
    currentHolderContactId: snapshot?.currentHolderContactId ?? null,
    currentApId: null,
    updatedAt: now,
  };
}
