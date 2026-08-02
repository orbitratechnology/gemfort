import {
    addDays,
    differenceInCalendarDays,
    isSameDay,
    startOfDay,
    subDays,
} from 'date-fns';

import {
  type DocumentSnapshot,
  type Firestore,
  type QueryDocumentSnapshot,
  Timestamp,
} from 'firebase-admin/firestore';

import { AP_PAYMENT_OVERDUE_DAYS, DUE_SOON_DAYS } from '../config';
import { formatCurrency, toDate } from './create';
import type { NotificationInput } from './types';

type ContactDoc = { displayName?: string };
type GemDoc = { variety?: string | null; gemType?: string; sku?: string };
type ChequeDoc = {
  ownerUid: string;
  status: string;
  issuedBy?: string;
  amount: number;
  currency?: string;
  counterpartyContactId?: string;
  maturityDate: Timestamp;
};
type ApDoc = {
  ownerUid: string;
  senderUid?: string;
  receiverUid?: string;
  receiverName?: string;
  status: string;
  apHolderContactId?: string;
  expectedReturnDate: Timestamp;
  soldDate?: Timestamp | null;
  paymentStatus?: string;
  paymentSentAt?: Timestamp | null;
  items?: { lineStatus?: string }[];
};
type ServiceDoc = {
  ownerUid: string;
  status: string;
  gemId?: string;
  providerContactId?: string;
  expectedReturnDate: Timestamp;
};
type ReceivableDoc = {
  ownerUid: string;
  status: string;
  contactId?: string;
  amount: number;
  amountReceived: number;
  currency?: string;
  dueDate: Timestamp;
};
type BillDoc = {
  ownerUid: string;
  status: string;
  direction?: string;
  counterpartyContactId?: string;
  amount: number;
  amountSettled?: number;
  currency?: string;
  dueDate: Timestamp;
};

type OwnerContext = {
  contacts: Map<string, ContactDoc>;
  gems: Map<string, GemDoc>;
  cheques: QueryDocumentSnapshot[];
  apRecords: QueryDocumentSnapshot[];
  services: QueryDocumentSnapshot[];
  receivables: QueryDocumentSnapshot[];
  bills: QueryDocumentSnapshot[];
};

function contactName(contacts: Map<string, ContactDoc>, id: string | undefined, fallback = 'Unknown') {
  if (!id) return fallback;
  return contacts.get(id)?.displayName ?? fallback;
}

function gemLabel(gems: Map<string, GemDoc>, gemId: string | undefined) {
  if (!gemId) return 'Gem';
  const gem = gems.get(gemId);
  if (!gem) return 'Gem';
  return gem.variety?.trim() || gem.gemType?.replace(/_/g, ' ') || gem.sku || 'Gem';
}

function daysOverdue(date: Date) {
  return Math.max(1, differenceInCalendarDays(startOfDay(new Date()), startOfDay(date)));
}

function effectiveReceivableOverdue(r: ReceivableDoc): boolean {
  if (r.status === 'paid') return false;
  const remaining = r.amount - r.amountReceived;
  if (remaining <= 0) return false;
  const due = toDate(r.dueDate);
  return !!due && startOfDay(due) < startOfDay(new Date());
}

function ts(d: Date): Timestamp {
  return Timestamp.fromDate(d);
}

function ensureOwner(
  contexts: Map<string, OwnerContext>,
  ownerUid: string | undefined,
): OwnerContext | null {
  if (!ownerUid) return null;
  let ctx = contexts.get(ownerUid);
  if (!ctx) {
    ctx = {
      contacts: new Map(),
      gems: new Map(),
      cheques: [],
      apRecords: [],
      services: [],
      receivables: [],
      bills: [],
    };
    contexts.set(ownerUid, ctx);
  }
  return ctx;
}

function mergeDocsById(
  ...snaps: { docs: QueryDocumentSnapshot[] }[]
): QueryDocumentSnapshot[] {
  const byId = new Map<string, QueryDocumentSnapshot>();
  for (const snap of snaps) {
    for (const d of snap.docs) byId.set(d.id, d);
  }
  return [...byId.values()];
}

async function getDocsByIds(
  db: Firestore,
  collectionName: string,
  ids: Iterable<string>,
): Promise<DocumentSnapshot[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return [];
  const out: DocumentSnapshot[] = [];
  const chunkSize = 100;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const refs = chunk.map((id) => db.collection(collectionName).doc(id));
    const snaps = await db.getAll(...refs);
    out.push(...snaps);
  }
  return out;
}

export function buildGemTrackCandidatesForOwner(
  ownerUid: string,
  ctx: OwnerContext,
): NotificationInput[] {
  const now = startOfDay(new Date());
  const tomorrow = startOfDay(addDays(now, 1));
  const dueSoonTarget = startOfDay(addDays(now, DUE_SOON_DAYS));
  const apPaymentCutoff = subDays(now, AP_PAYMENT_OVERDUE_DAYS);
  const candidates: NotificationInput[] = [];

  for (const doc of ctx.cheques) {
    const c = doc.data() as ChequeDoc;
    if (c.ownerUid !== ownerUid) continue;
    if (c.status !== 'holding' && c.status !== 'deposited') continue;
    const maturity = toDate(c.maturityDate);
    if (maturity && isSameDay(startOfDay(maturity), tomorrow)) {
      candidates.push({
        recipientUid: ownerUid,
        type: 'cheque_maturing_tomorrow',
        title: 'Cheque maturing tomorrow',
        message: `Cheque from ${contactName(ctx.contacts, c.counterpartyContactId, c.issuedBy)} for ${formatCurrency(c.amount, c.currency)} matures tomorrow.`,
        referenceType: 'cheque',
        referenceId: doc.id,
      });
    }
  }

  for (const doc of ctx.bills) {
    const b = doc.data() as BillDoc;
    // Personal tracking only: never notify counterparties or linked users.
    if (b.ownerUid !== ownerUid) continue;
    if (
      b.status !== 'open' &&
      b.status !== 'ongoing' &&
      b.status !== 'partial' &&
      b.status !== 'overdue'
    )
      continue;
    const due = toDate(b.dueDate);
    if (!due || !isSameDay(startOfDay(due), now)) continue;
    const remaining = Math.max(0, b.amount - (b.amountSettled ?? 0));
    if (remaining <= 0) continue;
    const who = contactName(ctx.contacts, b.counterpartyContactId);
    const isPayable = b.direction === 'payable';
    candidates.push({
      recipientUid: ownerUid,
      type: 'bill_due_today',
      title: 'Bill due today',
      message: isPayable
        ? `Pay ${formatCurrency(remaining, b.currency)} to ${who} today.`
        : `Collect ${formatCurrency(remaining, b.currency)} from ${who} today.`,
      referenceType: 'bill',
      referenceId: doc.id,
    });
  }

  for (const doc of ctx.apRecords) {
    const r = doc.data() as ApDoc;
    const partyUids = new Set(
      [r.ownerUid, r.senderUid, r.receiverUid].filter(Boolean) as string[],
    );
    if (!partyUids.has(ownerUid)) continue;
    const holder = r.receiverName || contactName(ctx.contacts, r.apHolderContactId);
    const isAccepted = r.status === 'accepted' || r.status === 'with_holder';

    if (isAccepted) {
      const due = toDate(r.expectedReturnDate);
      if (due && startOfDay(due) < now) {
        candidates.push({
          recipientUid: ownerUid,
          type: 'ap_overdue',
          title: 'AP stone overdue',
          message: `AP with ${holder} is ${daysOverdue(due)} day${daysOverdue(due) === 1 ? '' : 's'} overdue.`,
          referenceType: 'ap',
          referenceId: doc.id,
        });
      }
      if (due && isSameDay(startOfDay(due), dueSoonTarget)) {
        candidates.push({
          recipientUid: ownerUid,
          type: 'ap_return_due_soon',
          title: 'AP return due soon',
          message: `AP with ${holder} is due back in ${DUE_SOON_DAYS} days.`,
          referenceType: 'ap',
          referenceId: doc.id,
        });
      }
    }

    const paymentPending =
      r.status === 'payment_sent' ||
      (r.status === 'sold' && r.paymentStatus !== 'paid') ||
      (r.status === 'accepted' &&
        (r.items ?? []).some((i) => i.lineStatus === 'sold') &&
        !r.paymentSentAt);

    if (paymentPending && (r.senderUid === ownerUid || r.ownerUid === ownerUid)) {
      const sold = toDate(r.paymentSentAt ?? r.soldDate ?? null);
      if (sold && startOfDay(sold) < apPaymentCutoff) {
        candidates.push({
          recipientUid: ownerUid,
          type: 'ap_payment_overdue',
          title: 'AP payment overdue',
          message: `Payment from AP (${holder}) is overdue.`,
          referenceType: 'ap',
          referenceId: doc.id,
        });
      }
    }
  }

  for (const doc of ctx.services) {
    const s = doc.data() as ServiceDoc;
    if (s.ownerUid !== ownerUid) continue;
    if (s.status !== 'given') continue;
    const due = toDate(s.expectedReturnDate);
    if (due && startOfDay(due) < now) {
      const provider = contactName(ctx.contacts, s.providerContactId, 'provider');
      candidates.push({
        recipientUid: ownerUid,
        type: 'service_overdue',
        title: 'Service overdue',
        message: `${gemLabel(ctx.gems, s.gemId)} with ${provider} is ${daysOverdue(due)} day${daysOverdue(due) === 1 ? '' : 's'} overdue.`,
        referenceType: 'service',
        referenceId: doc.id,
      });
    }
  }

  for (const doc of ctx.receivables) {
    const r = doc.data() as ReceivableDoc;
    if (r.ownerUid !== ownerUid) continue;
    const remaining = r.amount - r.amountReceived;
    if (remaining <= 0 || r.status === 'paid') continue;
    const name = contactName(ctx.contacts, r.contactId);
    const due = toDate(r.dueDate);

    if (due && isSameDay(startOfDay(due), dueSoonTarget)) {
      candidates.push({
        recipientUid: ownerUid,
        type: 'payment_due_soon',
        title: 'Payment due soon',
        message: `${name} owes ${formatCurrency(remaining, r.currency)} — due in ${DUE_SOON_DAYS} days.`,
        referenceType: 'receivable',
        referenceId: doc.id,
      });
    }

    if (effectiveReceivableOverdue(r)) {
      candidates.push({
        recipientUid: ownerUid,
        type: 'payment_overdue',
        title: 'Payment overdue',
        message: `Payment from ${name} for ${formatCurrency(remaining, r.currency)} is overdue.`,
        referenceType: 'receivable',
        referenceId: doc.id,
      });
    }
  }

  // Bills are private: never emit a bill alert to anyone except this owner.
  return candidates.filter(
    (c) => c.type !== 'bill_due_today' || c.recipientUid === ownerUid,
  );
}

/**
 * Load only docs that can produce today's alerts (date windows / active statuses).
 * Avoids full-collection `.get()` on cheques, APs, services, receivables, bills,
 * contacts, and gems — read cost used to scale with total DB size every morning.
 */
export async function loadOwnerContexts(db: Firestore): Promise<Map<string, OwnerContext>> {
  const now = startOfDay(new Date());
  const tomorrow = addDays(now, 1);
  const dayAfterTomorrow = addDays(now, 2);
  const dueSoon = addDays(now, DUE_SOON_DAYS);
  const dueSoonEnd = addDays(dueSoon, 1);
  const apPaymentCutoff = subDays(now, AP_PAYMENT_OVERDUE_DAYS);

  const [
    chequesSnap,
    billsSnap,
    receivablesDueSoonSnap,
    receivablesOverdueSnap,
    servicesSnap,
    apReturnSnap,
    apPaymentSentSnap,
    apSoldSnap,
  ] = await Promise.all([
    db
      .collection('gemtrack_cheques')
      .where('maturityDate', '>=', ts(tomorrow))
      .where('maturityDate', '<', ts(dayAfterTomorrow))
      .get(),
    db
      .collection('gemtrack_bills')
      .where('dueDate', '>=', ts(now))
      .where('dueDate', '<', ts(tomorrow))
      .get(),
    db
      .collection('gemtrack_receivables')
      .where('dueDate', '>=', ts(dueSoon))
      .where('dueDate', '<', ts(dueSoonEnd))
      .get(),
    db
      .collection('gemtrack_receivables')
      .where('status', 'in', ['pending', 'partial', 'overdue'])
      .where('dueDate', '<', ts(now))
      .get(),
    db
      .collection('gemtrack_services')
      .where('status', '==', 'given')
      .where('expectedReturnDate', '<', ts(now))
      .get(),
    db
      .collection('gemtrack_ap_records')
      .where('status', 'in', ['accepted', 'with_holder'])
      .where('expectedReturnDate', '<', ts(dueSoonEnd))
      .get(),
    db
      .collection('gemtrack_ap_records')
      .where('status', '==', 'payment_sent')
      .where('paymentSentAt', '<', ts(apPaymentCutoff))
      .get(),
    db
      .collection('gemtrack_ap_records')
      .where('status', 'in', ['sold', 'accepted'])
      .where('soldDate', '<', ts(apPaymentCutoff))
      .get(),
  ]);

  const apDocs = mergeDocsById(apReturnSnap, apPaymentSentSnap, apSoldSnap);
  const receivableDocs = mergeDocsById(receivablesDueSoonSnap, receivablesOverdueSnap);

  const contexts = new Map<string, OwnerContext>();
  const contactIds = new Set<string>();
  const gemIds = new Set<string>();

  for (const d of chequesSnap.docs) {
    const data = d.data() as ChequeDoc;
    ensureOwner(contexts, data.ownerUid)?.cheques.push(d);
    if (data.counterpartyContactId) contactIds.add(data.counterpartyContactId);
  }
  for (const d of billsSnap.docs) {
    const data = d.data() as BillDoc;
    ensureOwner(contexts, data.ownerUid)?.bills.push(d);
    if (data.counterpartyContactId) contactIds.add(data.counterpartyContactId);
  }
  for (const d of receivableDocs) {
    const data = d.data() as ReceivableDoc;
    ensureOwner(contexts, data.ownerUid)?.receivables.push(d);
    if (data.contactId) contactIds.add(data.contactId);
  }
  for (const d of servicesSnap.docs) {
    const data = d.data() as ServiceDoc;
    ensureOwner(contexts, data.ownerUid)?.services.push(d);
    if (data.providerContactId) contactIds.add(data.providerContactId);
    if (data.gemId) gemIds.add(data.gemId);
  }
  for (const d of apDocs) {
    const data = d.data() as ApDoc;
    ensureOwner(contexts, data.ownerUid)?.apRecords.push(d);
    if (data.apHolderContactId) contactIds.add(data.apHolderContactId);
  }

  const [contactSnaps, gemSnaps] = await Promise.all([
    getDocsByIds(db, 'gemtrack_contacts', contactIds),
    getDocsByIds(db, 'gemtrack_gems', gemIds),
  ]);

  for (const snap of contactSnaps) {
    if (!snap.exists) continue;
    const data = snap.data() as ContactDoc & { ownerUid?: string };
    contexts.get(data.ownerUid ?? '')?.contacts.set(snap.id, data);
  }
  for (const snap of gemSnaps) {
    if (!snap.exists) continue;
    const data = snap.data() as GemDoc & { ownerUid?: string };
    contexts.get(data.ownerUid ?? '')?.gems.set(snap.id, data);
  }

  return contexts;
}
