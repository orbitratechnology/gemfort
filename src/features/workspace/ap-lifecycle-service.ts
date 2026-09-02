import { normalizeApRecord } from "@/features/workspace/ap-normalize";
import { OWNER_LIST_LIMIT } from "@/features/workspace/firestore-subscriptions";
import { convertToBase } from "@/lib/exchange-rates";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/config";
import {
  apPaymentReceivedViaApi,
  apPaymentSentViaApi,
  cancelApRequestViaApi,
  createApRequestViaApi,
  deleteApRecordViaApi,
  recordApGemSaleViaApi,
  requestApCancellationViaApi,
  respondApCancellationViaApi,
  respondApRequestViaApi,
  returnApGemViaApi,
} from "@/features/workspace/ap-api";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "@/lib/firebase/db";
import { queueDocCreate } from "@/lib/firebase/local-write";
import type { ApPaymentMethod, ApRecord } from "@/types";

function requireUid(): string {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) throw new Error("Sign in to continue.");
  return uid;
}

export async function fetchApRecordById(apId: string): Promise<ApRecord | null> {
  const snap = await getDoc(doc(getFirebaseDb(), "gemtrack_ap_records", apId));
  if (!snap.exists()) return null;
  return normalizeApRecord({ id: snap.id, ...snap.data() } as ApRecord);
}

export async function fetchGivenApRecords(uid: string): Promise<ApRecord[]> {
  const db = getFirebaseDb();
  const bySender = query(
    collection(db, "gemtrack_ap_records"),
    where("senderUid", "==", uid),
    orderBy("updatedAt", "desc"),
    limit(OWNER_LIST_LIMIT),
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
    collection(db, "gemtrack_ap_records"),
    where("ownerUid", "==", uid),
    orderBy("updatedAt", "desc"),
    limit(OWNER_LIST_LIMIT),
  );
  const snap = await getDocs(byOwner);
  return snap.docs.map((d) =>
    normalizeApRecord({ id: d.id, ...d.data() } as ApRecord),
  );
}

export async function fetchTakenApRecords(uid: string): Promise<ApRecord[]> {
  const snap = await getDocs(
    query(
      collection(getFirebaseDb(), "gemtrack_ap_records"),
      where("receiverUid", "==", uid),
      orderBy("updatedAt", "desc"),
      limit(OWNER_LIST_LIMIT),
    ),
  );
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
  for (const record of [...given, ...taken]) map.set(record.id, record);
  return [...map.values()].sort(
    (a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis(),
  );
}

export function createApRequest(input: {
  receiverContactId: string;
  receiverBusinessId?: string | null;
  expectedDurationDays: number;
  agreementNotes?: string | null;
  items: { gemId: string; agreedPrice: number; currency?: string }[];
}): Promise<string> {
  return createApRequestViaApi(input);
}

export function respondApRequest(
  apId: string,
  action: "accepted" | "rejected",
  rejectionReason?: string,
) {
  return respondApRequestViaApi(apId, action, rejectionReason);
}

export function cancelApRequest(apId: string) {
  return cancelApRequestViaApi(apId);
}

export function recordApGemSale(input: {
  apId: string;
  gemId: string;
  soldPrice: number;
  soldToName?: string;
  paymentDueDateIso?: string | null;
  ownerReceives?: number | null;
}) {
  return recordApGemSaleViaApi(input);
}

export function returnApGem(apId: string, gemId: string) {
  return returnApGemViaApi(apId, gemId);
}

export function apPaymentSent(input: {
  apId: string;
  method: ApPaymentMethod;
  amount?: number;
  chequeId?: string | null;
  receiptUrl?: string | null;
}) {
  return apPaymentSentViaApi(input);
}

export function apPaymentReceived(
  apId: string,
  options?: {
    method?: ApPaymentMethod;
    chequeId?: string | null;
    receiptUrl?: string | null;
  },
) {
  return apPaymentReceivedViaApi({ apId, ...options });
}

/** Receiver books payout expense once AP is done (own ledger only). */
export async function ensureApReceiverPayoutExpense(ap: ApRecord): Promise<void> {
  const uid = requireUid();
  if (ap.receiverUid !== uid || ap.status !== "done") return;
  const amount = ap.paymentAmount ?? 0;
  if (amount <= 0) return;
  const currency = ap.items?.[0]?.currency || "LKR";
  const snap = await getDocs(
    query(
      collection(getFirebaseDb(), "gemtrack_transactions"),
      where("ownerUid", "==", uid),
      where("category", "==", "other_expense"),
      where("description", "==", `AP payout to ${ap.senderName}`),
    ),
  ).catch(() => null);
  const alreadyBooked = snap?.docs.some((d) => {
    const transaction = d.data() as {
      sourceType?: string | null;
      sourceId?: string | null;
    };
    return transaction.sourceType === "ap" && transaction.sourceId === ap.id;
  });
  if (alreadyBooked) return;

  const now = Timestamp.now();
  queueDocCreate("gemtrack_transactions", {
    ownerUid: uid,
    type: "expense",
    amount,
    currency,
    amountBase: await convertToBase(amount, currency),
    category: "other_expense",
    description: `AP payout to ${ap.senderName}`,
    gemId: null,
    contactId: null,
    sourceType: "ap",
    sourceId: ap.id,
    date: now,
    createdAt: now,
  });
}

export function requestApCancellation(apId: string) {
  return requestApCancellationViaApi(apId);
}

export function respondApCancellation(
  apId: string,
  action: "accepted" | "rejected",
) {
  return respondApCancellationViaApi(apId, action);
}

export function deleteApRecord(apId: string) {
  return deleteApRecordViaApi(apId);
}
