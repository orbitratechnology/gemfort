import type {
  ApGemLine,
  ApLifecycleStatus,
  ApRecord,
} from '@/types';
import type { Timestamp } from 'firebase/firestore';

import { convertFromBaseSync, convertToBaseSync } from '@/lib/exchange-rates';

/** True when AP is actively out with the holder (ongoing). */
export function isApOngoing(status: ApLifecycleStatus): boolean {
  return (
    status === 'accepted' ||
    status === 'partial' ||
    status === 'with_holder' ||
    status === 'cancellation_requested'
  );
}

/** The holder can still sell, return, or pay on these statuses. */
export function isApActive(status: ApLifecycleStatus): boolean {
  return status === 'accepted' || status === 'partial';
}

/** False once this party removed the AP from their own lists. */
export function isApVisibleTo(ap: Pick<ApRecord, 'hiddenFor'>, uid: string): boolean {
  return !ap.hiddenFor?.includes(uid);
}

export function visibleApRecords(records: ApRecord[], uid: string): ApRecord[] {
  return records.filter((record) => isApVisibleTo(record, uid));
}

/**
 * Currency the holder settles in. Fixed by the first payment; before that it
 * is the first sold gem's currency (matching gemfortApi).
 */
export function apSettlementCurrency(ap: ApRecord): string {
  return (
    ap.paymentCurrency ||
    ap.items?.find((item) => item.lineStatus === 'sold')?.currency ||
    ap.items?.[0]?.currency ||
    'LKR'
  ).toUpperCase();
}

/**
 * Balance still owed to the sender, in apSettlementCurrency. Uses the
 * server-maintained balance when present; otherwise sums sold lines the same
 * way the server does (same-currency lines exactly, others via LKR).
 */
export function apBalanceDue(ap: ApRecord, rates: Record<string, number> | null): number {
  if (typeof ap.balance === 'number' && ap.paymentCurrency) return Math.max(0, ap.balance);
  const currency = apSettlementCurrency(ap);
  let owed = 0;
  for (const line of ap.items ?? []) {
    if (line.lineStatus !== 'sold') continue;
    const amount = line.ownerReceives ?? line.agreedPrice;
    const lineCurrency = (line.currency || 'LKR').toUpperCase();
    if (lineCurrency === currency) {
      owed += amount;
    } else if (rates) {
      const base = typeof line.ownerReceivesBase === 'number'
        ? line.ownerReceivesBase
        : convertToBaseSync(amount, lineCurrency, rates);
      owed += convertFromBaseSync(base, currency, rates);
    }
  }
  return Math.max(0, Math.round((owed - apAmountPaid(ap)) * 100) / 100);
}

/** Confirmed payments so far, in the AP's payment currency. */
export function apAmountPaid(ap: ApRecord): number {
  if (typeof ap.amountPaid === 'number') return ap.amountPaid;
  return ap.status === 'done' && ap.paymentReceivedAt ? ap.paymentAmount ?? 0 : 0;
}

export function isApPending(status: ApLifecycleStatus): boolean {
  return status === 'pending';
}

/** Total agreed value in LKR (source of truth). Falls back to face for legacy rows. */
export function apAgreedTotal(ap: ApRecord): number {
  if (ap.items?.length) {
    return ap.items.reduce(
      (s, i) =>
        s +
        (typeof i.agreedPriceBase === 'number'
          ? i.agreedPriceBase
          : i.agreedPrice || 0),
      0,
    );
  }
  return ap.ownerMinimumPrice ?? 0;
}

/** Total owed to owner in LKR (source of truth). */
export function apOwnerOwedTotal(ap: ApRecord): number {
  if (ap.items?.length) {
    return ap.items
      .filter((i) => i.lineStatus === 'sold')
      .reduce((s, i) => {
        if (typeof i.ownerReceivesBase === 'number') return s + i.ownerReceivesBase;
        const face = i.ownerReceives ?? i.agreedPrice;
        if (typeof i.agreedPriceBase === 'number' && i.agreedPrice > 0) {
          return s + (face / i.agreedPrice) * i.agreedPriceBase;
        }
        if ((i.currency || 'LKR') === 'LKR') return s + face;
        return s;
      }, 0);
  }
  if (ap.status === 'sold' || ap.status === 'payment_sent' || ap.status === 'done') {
    return ap.ownerReceives ?? ap.ownerMinimumPrice ?? 0;
  }
  return 0;
}

export function apHeldCount(ap: ApRecord): number {
  if (ap.items?.length) {
    return ap.items.filter((i) => i.lineStatus === 'held').length;
  }
  return isApOngoing(ap.status) ? 1 : 0;
}

export function apSoldCount(ap: ApRecord): number {
  if (ap.items?.length) {
    return ap.items.filter((i) => i.lineStatus === 'sold').length;
  }
  return ap.status === 'sold' || ap.status === 'payment_sent' || ap.status === 'done'
    ? 1
    : 0;
}

function legacyLineStatus(ap: {
  status: string;
}): ApGemLine['lineStatus'] {
  if (ap.status === 'sold' || ap.status === 'payment_sent' || ap.status === 'done') {
    return 'sold';
  }
  if (ap.status === 'returned' || ap.status === 'rejected' || ap.status === 'cancelled') {
    return 'returned';
  }
  return 'held';
}

function mapLegacyStatus(status: string): ApLifecycleStatus {
  if (status === 'with_holder' || status === 'overdue') return 'accepted';
  if (status === 'sold') return 'payment_sent'; // legacy sold ≈ awaiting/confirm payment
  if (status === 'returned') return 'cancelled';
  if (status === 'disputed') return 'accepted';
  return status as ApLifecycleStatus;
}

/**
 * Normalize legacy single-gem AP docs into the multi-item lifecycle shape.
 */
export function normalizeApRecord(raw: ApRecord & Record<string, unknown>): ApRecord {
  const hasItems = Array.isArray(raw.items) && raw.items.length > 0;
  const senderUid =
    (raw.senderUid as string) || (raw.ownerUid as string) || '';
  const receiverUid = (raw.receiverUid as string) || '';
  const statusRaw = raw.status as string;
  const status = hasItems
    ? (statusRaw as ApLifecycleStatus)
    : mapLegacyStatus(statusRaw);

  let items: ApGemLine[] = hasItems
    ? (raw.items as ApGemLine[])
    : raw.gemId
      ? [
          {
            gemId: raw.gemId as string,
            gemLabel: (raw.gemId as string).slice(0, 8),
            agreedPrice: (raw.ownerMinimumPrice as number) ?? 0,
            currency: (raw.currency as string) || 'LKR',
            lineStatus: legacyLineStatus({ status: statusRaw }),
            soldPrice: (raw.soldPrice as number | null) ?? null,
            soldToName: null,
            soldDate: (raw.soldDate as Timestamp | null) ?? null,
            ownerReceives: (raw.ownerReceives as number | null) ?? null,
            commission: (raw.apHolderCommission as number | null) ?? null,
            paymentDueDate: null,
          },
        ]
      : [];

  return {
    id: raw.id,
    ownerUid: (raw.ownerUid as string) || senderUid,
    senderUid,
    receiverUid,
    receiverContactId:
      (raw.receiverContactId as string) ||
      (raw.apHolderContactId as string) ||
      '',
    receiverBusinessId: (raw.receiverBusinessId as string | null) ?? null,
    receiverName: (raw.receiverName as string) || 'Holder',
    senderName: (raw.senderName as string) || 'Sender',
    items,
    status,
    expectedReturnDate: raw.expectedReturnDate as Timestamp,
    expectedDurationDays: (raw.expectedDurationDays as number) || 30,
    dateGiven: (raw.dateGiven as Timestamp | null) ?? null,
    agreementNotes: (raw.agreementNotes as string | null) ?? null,
    paymentMethod: (raw.paymentMethod as ApRecord['paymentMethod']) ?? null,
    paymentCurrency: (raw.paymentCurrency as string | null) ?? null,
    paymentAmount: (raw.paymentAmount as number | null) ?? null,
    paymentSentAt: (raw.paymentSentAt as Timestamp | null) ?? null,
    paymentReceivedAt: (raw.paymentReceivedAt as Timestamp | null) ?? null,
    paymentChequeId: (raw.paymentChequeId as string | null) ?? null,
    paymentReceiptUrl: (raw.paymentReceiptUrl as string | null) ?? null,
    rejectionReason: (raw.rejectionReason as string | null) ?? null,
    paymentSeq: (raw.paymentSeq as number | null) ?? null,
    amountPaid: (raw.amountPaid as number | null) ?? null,
    balance: (raw.balance as number | null) ?? null,
    hiddenFor: Array.isArray(raw.hiddenFor) ? (raw.hiddenFor as string[]) : [],
    partyDeleted: raw.partyDeleted === true,
    createdAt: raw.createdAt as Timestamp,
    updatedAt: raw.updatedAt as Timestamp,
    // preserve legacy for any remaining callers
    gemId: raw.gemId as string | undefined,
    apHolderContactId: raw.apHolderContactId as string | undefined,
    ownerMinimumPrice: raw.ownerMinimumPrice as number | undefined,
    currency: raw.currency as string | undefined,
    soldPrice: raw.soldPrice as number | null | undefined,
    ownerReceives: raw.ownerReceives as number | null | undefined,
    apHolderCommission: raw.apHolderCommission as number | null | undefined,
    soldDate: raw.soldDate as Timestamp | null | undefined,
    paymentStatus: raw.paymentStatus as ApRecord['paymentStatus'],
  };
}

export function apStatusLabel(status: ApLifecycleStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'accepted':
    case 'with_holder':
      return 'With holder';
    case 'rejected':
      return 'Rejected';
    case 'cancelled':
      return 'Cancelled';
    case 'cancellation_requested':
      return 'Cancel requested';
    case 'payment_sent':
      return 'Payment sent';
    case 'partial':
      return 'Part paid';
    case 'done':
    case 'sold':
    case 'returned':
      return 'Done';
    default:
      return status;
  }
}
