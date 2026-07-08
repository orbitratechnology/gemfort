import {
    addDays,
    differenceInCalendarDays,
    isSameDay,
    startOfDay,
    subDays,
} from 'date-fns';

import type { Firestore, QueryDocumentSnapshot, Timestamp } from 'firebase-admin/firestore';

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
  status: string;
  apHolderContactId?: string;
  expectedReturnDate: Timestamp;
  soldDate?: Timestamp | null;
  paymentStatus?: string;
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

type OwnerContext = {
  contacts: Map<string, ContactDoc>;
  gems: Map<string, GemDoc>;
  cheques: QueryDocumentSnapshot[];
  apRecords: QueryDocumentSnapshot[];
  services: QueryDocumentSnapshot[];
  receivables: QueryDocumentSnapshot[];
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

  for (const doc of ctx.apRecords) {
    const r = doc.data() as ApDoc;
    if (r.ownerUid !== ownerUid) continue;
    const holder = contactName(ctx.contacts, r.apHolderContactId);

    if (r.status === 'with_holder') {
      const due = toDate(r.expectedReturnDate);
      if (due && startOfDay(due) < now) {
        candidates.push({
          recipientUid: ownerUid,
          type: 'ap_overdue',
          title: 'AP stone overdue',
          message: `AP stone with ${holder} is ${daysOverdue(due)} day${daysOverdue(due) === 1 ? '' : 's'} overdue.`,
          referenceType: 'ap',
          referenceId: doc.id,
        });
      }
      if (due && isSameDay(startOfDay(due), dueSoonTarget)) {
        candidates.push({
          recipientUid: ownerUid,
          type: 'ap_return_due_soon',
          title: 'AP return due soon',
          message: `AP stone with ${holder} is due back in ${DUE_SOON_DAYS} days.`,
          referenceType: 'ap',
          referenceId: doc.id,
        });
      }
    }

    if (r.status === 'sold' && r.paymentStatus !== 'paid') {
      const sold = toDate(r.soldDate ?? null);
      if (sold && startOfDay(sold) < apPaymentCutoff) {
        candidates.push({
          recipientUid: ownerUid,
          type: 'ap_payment_overdue',
          title: 'AP payment overdue',
          message: `Payment from AP sale (${holder}) is overdue.`,
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

  return candidates;
}

export async function loadOwnerContexts(db: Firestore): Promise<Map<string, OwnerContext>> {
  const [cheques, apRecords, services, receivables, contacts, gems] = await Promise.all([
    db.collection('gemtrack_cheques').get(),
    db.collection('gemtrack_ap_records').get(),
    db.collection('gemtrack_services').get(),
    db.collection('gemtrack_receivables').get(),
    db.collection('gemtrack_contacts').get(),
    db.collection('gemtrack_gems').get(),
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
    const uid = d.data().ownerUid as string;
    contexts.get(uid)?.cheques.push(d);
  });
  apRecords.docs.forEach((d) => {
    const uid = d.data().ownerUid as string;
    contexts.get(uid)?.apRecords.push(d);
  });
  services.docs.forEach((d) => {
    const uid = d.data().ownerUid as string;
    contexts.get(uid)?.services.push(d);
  });
  receivables.docs.forEach((d) => {
    const uid = d.data().ownerUid as string;
    contexts.get(uid)?.receivables.push(d);
  });

  return contexts;
}
