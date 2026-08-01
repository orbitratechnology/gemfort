import { normalizeApRecord } from "@/features/workspace/ap-normalize";
import { fetchBusiness } from "@/features/marketplace/marketplace-service";
import { convertToBase } from "@/lib/exchange-rates";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "@/lib/firebase/db";
import {
  queueDocCreate,
  queueDocDelete,
  queueDocUpdate,
} from "@/lib/firebase/local-write";
import type { ApGemLine, ApPaymentMethod, ApRecord, WorkspaceGem } from "@/types";

function requireUid(): string {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) throw new Error("Sign in to continue.");
  return uid;
}

function formatMoney(amount: number, currency = "LKR"): string {
  try {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: currency === "LKR" ? "LKR" : currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function gemLabel(gem: WorkspaceGem, gemId: string): string {
  const sku = gem.sku?.trim() ?? "";
  const type = gem.gemType?.replace(/_/g, " ") ?? "";
  return sku || type || gemId.slice(0, 8);
}

function notify(
  recipientUid: string,
  type: string,
  title: string,
  message: string,
  apId: string,
) {
  if (!recipientUid || recipientUid === getFirebaseAuth().currentUser?.uid) {
    return;
  }
  queueDocCreate("notifications", {
    recipientUid,
    type,
    title,
    message,
    referenceType: "ap",
    referenceId: apId,
    priority: "medium",
    isRead: false,
    isPushSent: false,
    createdAt: Timestamp.now(),
  });
}

function writeApPaymentEvent(input: {
  apId: string;
  ownerUid: string;
  senderUid: string;
  receiverUid: string;
  actorUid: string;
  type: "sent" | "received";
  method: ApPaymentMethod | null;
  amount: number;
}) {
  queueDocCreate("gemtrack_ap_payments", {
    ...input,
    createdAt: Timestamp.now(),
  });
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
  );
  const snap = await getDocs(byOwner);
  return snap.docs.map((d) =>
    normalizeApRecord({ id: d.id, ...d.data() } as ApRecord),
  );
}

export async function fetchTakenApRecords(uid: string): Promise<ApRecord[]> {
  const q = query(
    collection(getFirebaseDb(), "gemtrack_ap_records"),
    where("receiverUid", "==", uid),
    orderBy("updatedAt", "desc"),
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

async function loadAp(apId: string): Promise<ApRecord> {
  const ap = await fetchApRecordById(apId);
  if (!ap) throw new Error("AP not found.");
  return ap;
}

function unlockGemFields(now: Timestamp) {
  return {
    status: "ready_for_sale",
    currentHolderContactId: null,
    currentApId: null,
    updatedAt: now,
  };
}

export async function createApRequest(input: {
  receiverContactId: string;
  receiverBusinessId?: string | null;
  expectedDurationDays: number;
  agreementNotes?: string | null;
  items: { gemId: string; agreedPrice: number; currency?: string }[];
}): Promise<string> {
  const uid = requireUid();
  const receiverContactId = input.receiverContactId?.trim();
  const itemsIn = Array.isArray(input.items) ? input.items : [];
  const days = Math.max(1, Math.floor(Number(input.expectedDurationDays) || 30));

  if (!receiverContactId) throw new Error("Select an AP holder.");
  if (itemsIn.length === 0) throw new Error("Select at least one gem.");

  const contactSnap = await getDoc(
    doc(getFirebaseDb(), "gemtrack_contacts", receiverContactId),
  );
  if (!contactSnap.exists() || contactSnap.data()?.ownerUid !== uid) {
    throw new Error("Contact not found.");
  }
  const contact = contactSnap.data()!;
  const linkedBusinessId =
    input.receiverBusinessId ??
    (contact.linkedBusinessId as string | null) ??
    null;
  if (!linkedBusinessId) {
    throw new Error("AP holder must be a GemFort trader (linked by phone).");
  }

  const biz = await fetchBusiness(linkedBusinessId);
  if (!biz) throw new Error("Trader business profile not found.");
  const receiverUid = biz.ownerUid;
  if (!receiverUid || receiverUid === uid) {
    throw new Error("Invalid AP receiver.");
  }

  const senderName =
    getFirebaseAuth().currentUser?.displayName?.trim() ||
    biz.ownerName?.trim() ||
    "Trader";

  const lines: ApGemLine[] = [];
  for (const item of itemsIn) {
    const price = Number(item.agreedPrice);
    if (!item.gemId || !Number.isFinite(price) || price < 0) {
      throw new Error("Each gem needs a valid AP price.");
    }
    const gemSnap = await getDoc(
      doc(getFirebaseDb(), "gemtrack_gems", item.gemId),
    );
    if (!gemSnap.exists() || gemSnap.data()?.ownerUid !== uid) {
      throw new Error("Gem not found.");
    }
    const gem = { id: gemSnap.id, ...gemSnap.data() } as WorkspaceGem;
    if (["on_ap", "sold"].includes(gem.status)) {
      throw new Error(`${gemLabel(gem, item.gemId)} is not available.`);
    }
    const currency = item.currency?.trim() || "LKR";
    lines.push({
      gemId: item.gemId,
      gemLabel: gemLabel(gem, item.gemId),
      agreedPrice: price,
      currency,
      agreedPriceBase: await convertToBase(price, currency),
      lineStatus: "held",
      soldPrice: null,
      soldPriceBase: null,
      soldToName: null,
      soldDate: null,
      ownerReceives: null,
      ownerReceivesBase: null,
      commission: null,
      commissionBase: null,
      paymentDueDate: null,
    } as ApGemLine);
  }

  const now = Timestamp.now();
  const expectedReturn = Timestamp.fromDate(
    new Date(Date.now() + days * 86400000),
  );
  const apId = queueDocCreate("gemtrack_ap_records", {
    ownerUid: uid,
    senderUid: uid,
    receiverUid,
    receiverContactId,
    receiverBusinessId: linkedBusinessId,
    receiverName: biz.businessName || (contact.displayName as string) || "Trader",
    senderName,
    items: lines,
    status: "pending",
    expectedReturnDate: expectedReturn,
    expectedDurationDays: days,
    dateGiven: null,
    agreementNotes: input.agreementNotes?.trim() || null,
    paymentMethod: null,
    paymentAmount: null,
    paymentSentAt: null,
    paymentReceivedAt: null,
    paymentChequeId: null,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
  });

  for (const line of lines) {
    queueDocUpdate("gemtrack_gems", line.gemId, {
      status: "on_ap",
      currentHolderContactId: receiverContactId,
      currentApId: apId,
      updatedAt: now,
    });
  }

  notify(
    receiverUid,
    "ap_request_received",
    "New AP request",
    `${senderName} offered ${lines.length} gem${lines.length === 1 ? "" : "s"} on AP.`,
    apId,
  );

  return apId;
}

export async function respondApRequest(
  apId: string,
  action: "accepted" | "rejected",
  rejectionReason?: string,
) {
  const uid = requireUid();
  const ap = await loadAp(apId);
  if (ap.receiverUid !== uid) {
    throw new Error("Only the AP holder can respond.");
  }
  if (ap.status !== "pending") {
    throw new Error("This AP is no longer pending.");
  }

  const now = Timestamp.now();
  if (action === "rejected") {
    queueDocUpdate("gemtrack_ap_records", apId, {
      status: "rejected",
      rejectionReason: rejectionReason?.trim() || null,
      updatedAt: now,
    });
    for (const line of ap.items ?? []) {
      queueDocUpdate("gemtrack_gems", line.gemId, unlockGemFields(now));
    }
    notify(
      ap.senderUid,
      "ap_request_rejected",
      "AP request declined",
      `${ap.receiverName} declined your AP request.`,
      apId,
    );
    return { ok: true as const, status: "rejected" as const };
  }

  queueDocUpdate("gemtrack_ap_records", apId, {
    status: "accepted",
    dateGiven: now,
    updatedAt: now,
  });
  notify(
    ap.senderUid,
    "ap_request_accepted",
    "AP request accepted",
    `${ap.receiverName} accepted your AP (${(ap.items ?? []).length} gems).`,
    apId,
  );
  return { ok: true as const, status: "accepted" as const };
}

export async function cancelApRequest(apId: string) {
  const uid = requireUid();
  const ap = await loadAp(apId);
  if (ap.senderUid !== uid && ap.ownerUid !== uid) {
    throw new Error("Only the sender can cancel.");
  }
  if (ap.status !== "pending") {
    throw new Error("Only pending APs can be cancelled.");
  }
  const now = Timestamp.now();
  queueDocUpdate("gemtrack_ap_records", apId, {
    status: "cancelled",
    updatedAt: now,
  });
  for (const line of ap.items ?? []) {
    queueDocUpdate("gemtrack_gems", line.gemId, unlockGemFields(now));
  }
  notify(
    ap.receiverUid,
    "ap_request_cancelled",
    "AP request cancelled",
    `${ap.senderName} cancelled an AP request.`,
    apId,
  );
  return { ok: true as const };
}

export async function recordApGemSale(input: {
  apId: string;
  gemId: string;
  soldPrice: number;
  soldToName?: string;
  paymentDueDateIso?: string | null;
  ownerReceives?: number | null;
}) {
  const uid = requireUid();
  const ap = await loadAp(input.apId);
  if (ap.receiverUid !== uid) {
    throw new Error("Only the AP holder can record a sale.");
  }
  if (ap.status !== "accepted") {
    throw new Error("AP must be accepted to record sales.");
  }

  const soldPrice = Number(input.soldPrice);
  if (!Number.isFinite(soldPrice) || soldPrice < 0) {
    throw new Error("Enter a valid sold price.");
  }

  const items = [...(ap.items ?? [])];
  const idx = items.findIndex((i) => i.gemId === input.gemId);
  if (idx < 0) throw new Error("Gem not on this AP.");
  const line = items[idx];
  if (line.lineStatus !== "held") {
    throw new Error("This gem is no longer held on AP.");
  }

  const now = Timestamp.now();
  const ownerReceives =
    input.ownerReceives != null && Number.isFinite(Number(input.ownerReceives))
      ? Number(input.ownerReceives)
      : line.agreedPrice;
  const commission = soldPrice - ownerReceives;
  let paymentDueDate: Timestamp | null = null;
  if (input.paymentDueDateIso) {
    const d = new Date(input.paymentDueDateIso);
    if (!Number.isNaN(d.getTime())) paymentDueDate = Timestamp.fromDate(d);
  }

  const saleCurrency = line.currency || "LKR";
  const saleAmountBase = await convertToBase(soldPrice, saleCurrency);
  const ownerReceivesBase = await convertToBase(ownerReceives, saleCurrency);
  const commissionBase = await convertToBase(commission, saleCurrency);

  items[idx] = {
    ...line,
    lineStatus: "sold",
    soldPrice,
    soldPriceBase: saleAmountBase,
    soldToName: input.soldToName?.trim() || null,
    soldDate: now,
    ownerReceives,
    ownerReceivesBase,
    commission,
    commissionBase,
    paymentDueDate,
  };

  queueDocUpdate("gemtrack_ap_records", input.apId, {
    items,
    updatedAt: now,
  });
  queueDocUpdate("gemtrack_gems", line.gemId, {
    status: "sold",
    soldPrice: ownerReceives,
    soldPriceCurrency: saleCurrency,
    soldPriceBase: ownerReceivesBase,
    soldDate: now,
    currentApId: input.apId,
    updatedAt: now,
  });

  queueDocCreate("gemtrack_transactions", {
    ownerUid: uid,
    type: "income",
    amount: soldPrice,
    currency: saleCurrency,
    amountBase: saleAmountBase,
    category: "gem_sale",
    description: `AP sale: ${line.gemLabel}${input.soldToName ? ` → ${input.soldToName}` : ""}`,
    gemId: line.gemId,
    contactId: null,
    date: now,
    createdAt: now,
  });

  notify(
    ap.senderUid,
    "ap_gem_sold",
    "AP gem sold",
    `${ap.receiverName} sold ${line.gemLabel}. You are owed ${formatMoney(ownerReceives, line.currency)}.`,
    input.apId,
  );

  return { ok: true as const };
}

export async function returnApGem(apId: string, gemId: string) {
  const uid = requireUid();
  const ap = await loadAp(apId);
  if (ap.receiverUid !== uid && ap.senderUid !== uid) {
    throw new Error("Not a party to this AP.");
  }
  if (ap.status !== "accepted") {
    throw new Error("Can only return gems on accepted APs.");
  }
  const items = [...(ap.items ?? [])];
  const idx = items.findIndex((i) => i.gemId === gemId);
  if (idx < 0) throw new Error("Gem not on this AP.");
  if (items[idx].lineStatus !== "held") {
    throw new Error("Only held gems can be returned.");
  }
  const now = Timestamp.now();
  items[idx] = { ...items[idx], lineStatus: "returned" };
  queueDocUpdate("gemtrack_ap_records", apId, { items, updatedAt: now });
  queueDocUpdate("gemtrack_gems", gemId, unlockGemFields(now));
  return { ok: true as const };
}

export async function apPaymentSent(input: {
  apId: string;
  method: ApPaymentMethod;
  amount?: number;
  chequeId?: string | null;
}) {
  const uid = requireUid();
  if (!input.method || !["cash", "transfer", "cheque"].includes(input.method)) {
    throw new Error("Invalid payment method.");
  }
  const ap = await loadAp(input.apId);
  if (ap.receiverUid !== uid) {
    throw new Error("Only the AP holder can mark payment sent.");
  }
  if (ap.status !== "accepted") {
    throw new Error("AP must be accepted with sales before payment.");
  }
  const sold = (ap.items ?? []).filter((i) => i.lineStatus === "sold");
  if (sold.length === 0) {
    throw new Error("Sell at least one gem before sending payment.");
  }
  const owed = sold.reduce((s, i) => s + (i.ownerReceives ?? i.agreedPrice), 0);
  const amount =
    input.amount != null && Number.isFinite(Number(input.amount))
      ? Number(input.amount)
      : owed;
  const now = Timestamp.now();
  queueDocUpdate("gemtrack_ap_records", input.apId, {
    status: "payment_sent",
    paymentMethod: input.method,
    paymentAmount: amount,
    paymentSentAt: now,
    paymentChequeId: input.chequeId ?? null,
    updatedAt: now,
  });
  writeApPaymentEvent({
    apId: input.apId,
    ownerUid: ap.ownerUid,
    senderUid: ap.senderUid,
    receiverUid: ap.receiverUid,
    actorUid: uid,
    type: "sent",
    method: input.method,
    amount,
  });
  notify(
    ap.senderUid,
    "ap_payment_sent",
    "AP payment sent",
    `${ap.receiverName} sent ${formatMoney(amount)} via ${input.method}. Confirm when received.`,
    input.apId,
  );
  return { ok: true as const };
}

export async function apPaymentReceived(
  apId: string,
  options?: { method?: ApPaymentMethod; chequeId?: string | null },
) {
  const uid = requireUid();
  const ap = await loadAp(apId);
  if (ap.senderUid !== uid && ap.ownerUid !== uid) {
    throw new Error("Only the sender can confirm payment.");
  }
  if (ap.status !== "payment_sent") {
    throw new Error("Waiting for payment sent first.");
  }
  if (
    options?.method &&
    !["cash", "transfer", "cheque"].includes(options.method)
  ) {
    throw new Error("Invalid payment method.");
  }

  const now = Timestamp.now();
  const amount = ap.paymentAmount ?? 0;
  const currency = ap.items?.[0]?.currency || "LKR";
  const soldTotal = (ap.items ?? [])
    .filter((i) => i.lineStatus === "sold")
    .reduce((s, i) => s + (i.soldPrice ?? 0), 0);
  const method = options?.method ?? ap.paymentMethod;
  const chequeId = options?.chequeId ?? ap.paymentChequeId ?? null;
  const amountBase = await convertToBase(amount, currency);

  queueDocUpdate("gemtrack_ap_records", apId, {
    status: "done",
    paymentReceivedAt: now,
    ...(options?.method ? { paymentMethod: options.method } : {}),
    ...(options?.chequeId !== undefined ? { paymentChequeId: chequeId } : {}),
    updatedAt: now,
  });

  writeApPaymentEvent({
    apId,
    ownerUid: ap.ownerUid,
    senderUid: ap.senderUid,
    receiverUid: ap.receiverUid,
    actorUid: uid,
    type: "received",
    method: method ?? null,
    amount,
  });

  // Own ledger only (offline-safe). Receiver payout expense is ensured on AP open.
  queueDocCreate("gemtrack_transactions", {
    ownerUid: ap.senderUid,
    type: "income",
    amount,
    currency,
    amountBase,
    category: "ap_income",
    description: `AP payment from ${ap.receiverName}`,
    gemId: null,
    contactId: ap.receiverContactId,
    date: now,
    createdAt: now,
  });

  notify(
    ap.receiverUid,
    "ap_payment_received",
    "AP payment confirmed",
    `${ap.senderName} confirmed receipt of ${formatMoney(amount, currency)}. AP complete (sold ${formatMoney(soldTotal, currency)}).`,
    apId,
  );

  return { ok: true as const };
}

/** Receiver books payout expense once AP is done (own ledger only). */
export async function ensureApReceiverPayoutExpense(ap: ApRecord): Promise<void> {
  const uid = requireUid();
  if (ap.receiverUid !== uid || ap.status !== "done") return;
  const amount = ap.paymentAmount ?? 0;
  if (amount <= 0) return;
  const currency = ap.items?.[0]?.currency || "LKR";
  const q = query(
    collection(getFirebaseDb(), "gemtrack_transactions"),
    where("ownerUid", "==", uid),
    where("category", "==", "other_expense"),
    where("description", "==", `AP payout to ${ap.senderName}`),
  );
  try {
    const snap = await getDocs(q);
    if (!snap.empty) return;
  } catch {
    // Proceed to create if query fails offline without index.
  }
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
    date: now,
    createdAt: now,
  });
}

export async function requestApCancellation(apId: string) {
  const uid = requireUid();
  const ap = await loadAp(apId);
  if (ap.senderUid !== uid && ap.ownerUid !== uid) {
    throw new Error("Only the sender can request cancellation.");
  }
  const allowed = new Set([
    "accepted",
    "with_holder",
    "payment_sent",
    "sold",
    "overdue",
    "disputed",
  ]);
  if (!allowed.has(ap.status)) {
    throw new Error("This AP cannot request cancellation in its current status.");
  }
  queueDocUpdate("gemtrack_ap_records", apId, {
    status: "cancellation_requested",
    updatedAt: Timestamp.now(),
  });
  notify(
    ap.receiverUid,
    "ap_cancellation_requested",
    "AP cancellation requested",
    `${ap.senderName} asked to cancel an AP. Accept to unlock the stones.`,
    apId,
  );
  return { ok: true as const, status: "cancellation_requested" as const };
}

export async function respondApCancellation(
  apId: string,
  action: "accepted" | "rejected",
) {
  const uid = requireUid();
  const ap = await loadAp(apId);
  if (ap.receiverUid !== uid) {
    throw new Error("Only the AP holder can respond.");
  }
  if (ap.status !== "cancellation_requested") {
    throw new Error("No cancellation request pending.");
  }
  const now = Timestamp.now();
  if (action === "rejected") {
    queueDocUpdate("gemtrack_ap_records", apId, {
      status: "accepted",
      updatedAt: now,
    });
    notify(
      ap.senderUid,
      "ap_cancellation_rejected",
      "AP cancellation declined",
      `${ap.receiverName} kept the AP active.`,
      apId,
    );
    return { ok: true as const, status: "accepted" as const };
  }

  queueDocUpdate("gemtrack_ap_records", apId, {
    status: "cancelled",
    updatedAt: now,
  });
  for (const line of ap.items ?? []) {
    if (line.lineStatus === "held") {
      queueDocUpdate("gemtrack_gems", line.gemId, unlockGemFields(now));
    }
  }
  notify(
    ap.senderUid,
    "ap_cancellation_accepted",
    "AP cancelled",
    `${ap.receiverName} accepted your cancellation request.`,
    apId,
  );
  return { ok: true as const, status: "cancelled" as const };
}

export async function deleteApRecord(apId: string) {
  const uid = requireUid();
  const ap = await loadAp(apId);
  if (
    ap.senderUid !== uid &&
    ap.ownerUid !== uid &&
    ap.receiverUid !== uid
  ) {
    throw new Error("Not a party to this AP.");
  }
  const terminal = new Set(["done", "cancelled", "rejected"]);
  if (!terminal.has(ap.status)) {
    throw new Error("Only completed or cancelled APs can be deleted.");
  }
  try {
    const payments = await getDocs(
      query(
        collection(getFirebaseDb(), "gemtrack_ap_payments"),
        where("apId", "==", apId),
      ),
    );
    for (const d of payments.docs) {
      queueDocDelete("gemtrack_ap_payments", d.id);
    }
  } catch {
    // Best-effort cleanup.
  }
  queueDocDelete("gemtrack_ap_records", apId);
  return { ok: true as const };
}
