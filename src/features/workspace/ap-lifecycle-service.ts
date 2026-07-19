import { callFunction } from '@/lib/firebase/call-function';
import { getFirebaseDb } from '@/lib/firebase/config';
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from '@/lib/firebase/db';
import { normalizeApRecord } from '@/features/workspace/ap-normalize';
import type { ApPaymentMethod, ApRecord } from '@/types';

export async function fetchGivenApRecords(uid: string): Promise<ApRecord[]> {
  const db = getFirebaseDb();
  // Prefer senderUid; fall back to ownerUid for legacy docs.
  const bySender = query(
    collection(db, 'gemtrack_ap_records'),
    where('senderUid', '==', uid),
    orderBy('updatedAt', 'desc'),
  );
  try {
    const snap = await getDocs(bySender);
    if (!snap.empty) {
      return snap.docs.map((d) =>
        normalizeApRecord({ id: d.id, ...d.data() } as ApRecord),
      );
    }
  } catch {
    // Index may still be building — fall through to ownerUid.
  }

  const byOwner = query(
    collection(db, 'gemtrack_ap_records'),
    where('ownerUid', '==', uid),
    orderBy('updatedAt', 'desc'),
  );
  const snap = await getDocs(byOwner);
  return snap.docs.map((d) =>
    normalizeApRecord({ id: d.id, ...d.data() } as ApRecord),
  );
}

export async function fetchTakenApRecords(uid: string): Promise<ApRecord[]> {
  const q = query(
    collection(getFirebaseDb(), 'gemtrack_ap_records'),
    where('receiverUid', '==', uid),
    orderBy('updatedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    normalizeApRecord({ id: d.id, ...d.data() } as ApRecord),
  );
}

/** Given + Taken for the user (deduped). */
export async function fetchApRecordsForUser(uid: string): Promise<ApRecord[]> {
  const [given, taken] = await Promise.all([
    fetchGivenApRecords(uid),
    fetchTakenApRecords(uid).catch(() => [] as ApRecord[]),
  ]);
  const map = new Map<string, ApRecord>();
  for (const r of [...given, ...taken]) map.set(r.id, r);
  return [...map.values()].sort(
    (a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis(),
  );
}

export async function createApRequest(input: {
  receiverContactId: string;
  receiverBusinessId?: string | null;
  expectedDurationDays: number;
  agreementNotes?: string | null;
  items: { gemId: string; agreedPrice: number; currency?: string }[];
}): Promise<string> {
  const result = await callFunction<{ apId: string }, typeof input>(
    'createApRequest',
    input,
  );
  return result.apId;
}

export async function respondApRequest(
  apId: string,
  action: 'accepted' | 'rejected',
  rejectionReason?: string,
) {
  return callFunction('respondApRequest', { apId, action, rejectionReason });
}

export async function cancelApRequest(apId: string) {
  return callFunction('cancelApRequest', { apId });
}

export async function recordApGemSale(input: {
  apId: string;
  gemId: string;
  soldPrice: number;
  soldToName?: string;
  paymentDueDateIso?: string | null;
  ownerReceives?: number | null;
}) {
  return callFunction('recordApGemSale', input);
}

export async function returnApGem(apId: string, gemId: string) {
  return callFunction('returnApGem', { apId, gemId });
}

export async function apPaymentSent(input: {
  apId: string;
  method: ApPaymentMethod;
  amount?: number;
  chequeId?: string | null;
}) {
  return callFunction('apPaymentSent', input);
}

export async function apPaymentReceived(apId: string) {
  return callFunction('apPaymentReceived', { apId });
}
