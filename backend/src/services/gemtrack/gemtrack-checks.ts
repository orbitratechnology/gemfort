/**
 * GemTrack daily alert generation logic.
 * Builds notification candidates for a given owner based on their data snapshot.
 */
import {
  addDays,
  differenceInCalendarDays,
  isSameDay,
  startOfDay,
  subDays,
} from 'date-fns';
import type { Firestore, QueryDocumentSnapshot, Timestamp } from 'firebase-admin/firestore';

import { AP_PAYMENT_OVERDUE_DAYS, DUE_SOON_DAYS } from '../../config.js';
import { formatCurrency, toDate } from '../notifications/create.js';
import type { NotificationInput } from '../notifications/types.js';

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

export type OwnerContext = {
  contacts: Map<string, ContactDoc>;
  gems: Map<string, GemDoc>;
  cheques: QueryDocumentSnapshot[];
  apRecords: QueryDocumentSnapshot[];
  services: QueryDocumentSnapshot[];
  receivables: QueryDocumentSnapshot[];
};

function contactName(
  contacts: Map<string, ContactDoc>,
  id: string | undefined,
  fallback = 'Unknown',
): string {
  if (!id) return fallback;
  return contacts.get(id)?.displayName ?? fallback;
}

function gemLabel(gems: Map<string, GemDoc>, gemId: string | undefined): string {
  if (!gemId) return 'Gem';
  const gem = gems.get(gemId);
  if (!gem) return 'Gem';
  return gem.variety?.trim() || gem.gemType?.replace(/_/g, ' ') || gem.sku || 'Gem';
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

  // ── Cheques ──────────────────────────────────────────────────────────
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

  // ── AP records ────────────────────────────────────────────────────────
  for (const doc of ctx.apRecords) {
    const r = doc.data() as ApDoc;
    const partyUids = new Set([r.ownerUid, r.senderUid, r.receiverUid].filter(Boolean) as string[]);
    if (!partyUids.has(ownerUid)) continue;

    const holder = r.receiverName || contactName(ctx.contacts, r.apHolderContactId);
    const isAccepted = r.status === 'accepted' || r.status === 'with_holder';
    const returnDate = toDate(r.expectedReturnDate);

    if (isAccepted && returnDate) {
      const daysLeft = differenceInCalendarDays(startOfDay(returnDate), now);
      if (daysLeft < 0) {
        candidates.push({
          recipientUid: ownerUid,
          type: 'ap_overdue',
          title: 'AP gems overdue',
          message: `AP gems with ${holder} are ${Math.abs(daysLeft)} day(s) overdue for return.`,
          referenceType: 'ap',
          referenceId: doc.id,
        });
      } else if (isSameDay(startOfDay(returnDate), dueSoonTarget)) {
        candidates.push({
          recipientUid: ownerUid,
          type: 'ap_return_due_soon',
          title: 'AP return due soon',
          message: `AP gems with ${holder} are due to return in ${DUE_SOON_DAYS} days.`,
          referenceType: 'ap',
          referenceId: doc.id,
        });
      }
    }

    // Payment overdue: sold items but payment not sent after AP_PAYMENT_OVERDUE_DAYS.
    if (r.status === 'sold_awaiting_payment' || r.status === 'partially_sold') {
      const sentAt = toDate(r.paymentSentAt ?? null);
      if (!sentAt || startOfDay(sentAt) < apPaymentCutoff) {
        candidates.push({
          recipientUid: ownerUid,
          type: 'ap_payment_overdue',
          title: 'AP payment overdue',
          message: `Payment from ${holder} is overdue by more than ${AP_PAYMENT_OVERDUE_DAYS} days.`,
          referenceType: 'ap',
          referenceId: doc.id,
        });
      }
    }
  }

  // ── Services ──────────────────────────────────────────────────────────
  for (const doc of ctx.services) {
    const s = doc.data() as ServiceDoc;
    if (s.ownerUid !== ownerUid) continue;
    if (s.status !== 'in_progress' && s.status !== 'accepted') continue;
    const returnDate = toDate(s.expectedReturnDate);
    if (!returnDate) continue;
    const daysLeft = differenceInCalendarDays(startOfDay(returnDate), now);
    if (daysLeft < 0) {
      candidates.push({
        recipientUid: ownerUid,
        type: 'service_overdue',
        title: 'Service overdue',
        message: `${gemLabel(ctx.gems, s.gemId)} service is ${Math.abs(daysLeft)} day(s) overdue for return.`,
        referenceType: 'service',
        referenceId: doc.id,
      });
    }
  }

  // ── Receivables ───────────────────────────────────────────────────────
  for (const doc of ctx.receivables) {
    const r = doc.data() as ReceivableDoc;
    if (r.ownerUid !== ownerUid) continue;
    if (r.status === 'paid') continue;
    const remaining = r.amount - r.amountReceived;
    if (remaining <= 0) continue;
    const due = toDate(r.dueDate);
    if (!due) continue;
    const daysLeft = differenceInCalendarDays(startOfDay(due), now);
    const name = contactName(ctx.contacts, r.contactId);
    if (daysLeft < 0) {
      candidates.push({
        recipientUid: ownerUid,
        type: 'payment_overdue',
        title: 'Payment overdue',
        message: `Payment of ${formatCurrency(remaining, r.currency)} from ${name} is ${Math.abs(daysLeft)} day(s) overdue.`,
        referenceType: 'receivable',
        referenceId: doc.id,
      });
    } else if (isSameDay(startOfDay(due), dueSoonTarget)) {
      candidates.push({
        recipientUid: ownerUid,
        type: 'payment_due_soon',
        title: 'Payment due soon',
        message: `Payment of ${formatCurrency(remaining, r.currency)} from ${name} is due in ${DUE_SOON_DAYS} days.`,
        referenceType: 'receivable',
        referenceId: doc.id,
      });
    }
  }

  return candidates;
}

/**
 * Load all data needed for daily GemTrack notifications in as few round-trips
 * as possible. Returns a map of ownerUid → OwnerContext.
 */
export async function loadOwnerContexts(
  firestoreDb: Firestore,
): Promise<Map<string, OwnerContext>> {
  const now = new Date();
  const cutoff = subDays(now, 60); // look back 60 days max

  const [contacts, gems, cheques, apRecords, services, receivables] = await Promise.all([
    firestoreDb.collection('gemtrack_contacts').get(),
    firestoreDb.collection('gemtrack_gems').get(),
    firestoreDb.collection('gemtrack_cheques')
      .where('status', 'in', ['holding', 'deposited'])
      .get(),
    firestoreDb.collection('gemtrack_ap_records')
      .where('status', 'in', ['accepted', 'with_holder', 'sold_awaiting_payment', 'partially_sold'])
      .get(),
    firestoreDb.collection('gemtrack_services')
      .where('status', 'in', ['accepted', 'in_progress'])
      .get(),
    firestoreDb.collection('gemtrack_receivables')
      .where('status', '!=', 'paid')
      .get(),
  ]);

  const owners = new Set<string>();
  for (const snap of [cheques, apRecords, services, receivables]) {
    snap.docs.forEach((d) => {
      const uid = d.data().ownerUid as string | undefined;
      if (uid) owners.add(uid);
    });
  }

  const contexts = new Map<string, OwnerContext>();
  for (const ownerUid of owners) {
    contexts.set(ownerUid, {
      contacts: new Map(),
      gems: new Map(),
      cheques: [],
      apRecords: [],
      services: [],
      receivables: [],
    });
  }

  contacts.docs.forEach((d) => {
    const data = d.data();
    const uid = data.ownerUid as string;
    contexts.get(uid)?.contacts.set(d.id, data as ContactDoc);
  });
  gems.docs.forEach((d) => {
    const data = d.data();
    const uid = data.ownerUid as string;
    contexts.get(uid)?.gems.set(d.id, data as GemDoc);
  });
  cheques.docs.forEach((d) => {
    contexts.get(d.data().ownerUid as string)?.cheques.push(d);
  });
  apRecords.docs.forEach((d) => {
    contexts.get(d.data().ownerUid as string)?.apRecords.push(d);
  });
  services.docs.forEach((d) => {
    contexts.get(d.data().ownerUid as string)?.services.push(d);
  });
  receivables.docs.forEach((d) => {
    contexts.get(d.data().ownerUid as string)?.receivables.push(d);
  });

  return contexts;
}
