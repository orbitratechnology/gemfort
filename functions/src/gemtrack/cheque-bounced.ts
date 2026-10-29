import { Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

import { isLiveUid } from '../account/deleted-uid';
import { REGION } from '../config';
import { ensureDeterministicNotificationDoc, formatCurrency } from '../notifications/create';
import { db } from '../admin';
import {
  ACTIVE_AP_STATUSES,
  apBalance,
  apOwedAmount,
  apPaymentStatus,
  apSettlementStatus,
  type ApBalanceLine,
} from './ap-balance';
import { apPaymentEventId, deterministicApEventId } from './ap-financial-contract';
import { convertToBaseServer, loadServerRates } from './exchange-rates';

type ApDoc = {
  ownerUid: string;
  senderUid: string;
  receiverUid: string;
  senderName?: string | null;
  receiverName?: string | null;
  receiverContactId?: string | null;
  status: string;
  items?: ApBalanceLine[];
  paymentSeq?: number | null;
  paymentCurrency?: string | null;
  amountPaid?: number | null;
  amountPaidBase?: number | null;
  statusBeforePayment?: string | null;
};

/**
 * A bounced cheque that paid an AP instalment undoes that payment: a pending
 * payment is withdrawn, and a confirmed one is reversed in both ledgers so the
 * AP balance is owed again. Idempotent via the `chequeBounced` flag on the
 * payment events and deterministic reversal IDs, so trigger retries are safe.
 */
async function reconcileApPaymentBounce(
  chequeId: string,
  cheque: Record<string, unknown>,
): Promise<{ notifyUid: string; apId: string; message: string } | null> {
  const apId = typeof cheque.apRecordId === 'string' ? cheque.apRecordId : null;
  const seq = typeof cheque.apPaymentSeq === 'number' ? cheque.apPaymentSeq : null;
  if (!apId || !seq) return null;

  const rates = await loadServerRates();
  const apRef = db.collection('gemtrack_ap_records').doc(apId);
  const sentRef = db.collection('gemtrack_ap_payments').doc(apPaymentEventId(apId, 'sent', seq));
  const receivedRef = db.collection('gemtrack_ap_payments').doc(apPaymentEventId(apId, 'received', seq));
  const incomeReversalRef = db
    .collection('gemtrack_transactions')
    .doc(deterministicApEventId('income', apId, `cheque-bounce:${seq}`));
  const expenseReversalRef = db
    .collection('gemtrack_transactions')
    .doc(deterministicApEventId('expense', apId, `cheque-bounce:${seq}`));

  return db.runTransaction(async (transaction) => {
    const [apSnap, sentSnap, receivedSnap] = await transaction.getAll(apRef, sentRef, receivedRef);
    if (!apSnap.exists || !sentSnap.exists) return null;
    if (sentSnap.data()?.chequeBounced === true) return null;

    const ap = apSnap.data() as ApDoc;
    const amount = Number(sentSnap.data()?.amount ?? 0);
    const currency = (ap.paymentCurrency || 'LKR').toUpperCase();
    const now = Timestamp.now();
    const counterparty = cheque.ownerUid === ap.senderUid ? ap.receiverUid : ap.senderUid;
    const bounceFields = { chequeBounced: true, chequeBouncedAt: now, bouncedChequeId: chequeId };

    if (ap.status === 'payment_sent' && (ap.paymentSeq ?? 1) === seq && !receivedSnap.exists) {
      const restored = ACTIVE_AP_STATUSES.has(ap.statusBeforePayment ?? '')
        ? ap.statusBeforePayment!
        : 'accepted';
      transaction.update(apRef, {
        status: restored,
        statusBeforePayment: null,
        paymentAmount: null,
        paymentSentAt: null,
        paymentChequeId: null,
        updatedAt: now,
      });
      transaction.update(sentRef, bounceFields);
      return {
        notifyUid: counterparty,
        apId,
        message: `The cheque for ${formatCurrency(amount, currency)} on this AP bounced. The payment was withdrawn.`,
      };
    }

    if (!receivedSnap.exists || receivedSnap.data()?.chequeBounced === true) return null;

    const amountPaid = Math.max(0, Number(((ap.amountPaid ?? amount) - amount).toFixed(2)));
    const amountBase = convertToBaseServer(amount, currency, rates);
    const lines = ap.items ?? [];
    const owed = apOwedAmount(lines, currency, rates);
    transaction.update(apRef, {
      status: apSettlementStatus({ lines, owed, amountPaid }),
      amountPaid,
      amountPaidBase: Math.max(0, Number(((ap.amountPaidBase ?? amountBase) - amountBase).toFixed(2))),
      balance: apBalance(owed, amountPaid),
      paymentStatus: apPaymentStatus(owed, amountPaid),
      updatedAt: now,
    });
    transaction.update(sentRef, bounceFields);
    transaction.update(receivedRef, bounceFields);
    // Reversals carry negative amounts so ledger totals net the bounced
    // payment out without deleting the original financial events.
    const reversal = {
      eventKind: 'ap_payment_reversal',
      amount: -amount,
      currency,
      amountBase: -amountBase,
      gemId: null,
      sourceType: 'ap',
      sourceId: apId,
      chequeId,
      date: now,
      createdAt: now,
    };
    if (isLiveUid(ap.senderUid)) {
      transaction.set(incomeReversalRef, {
        ...reversal,
        ownerUid: ap.senderUid,
        type: 'income',
        category: 'ap_income',
        description: `Cheque bounced: AP payment from ${ap.receiverName || 'Trader'} reversed`,
        contactId: ap.receiverContactId ?? null,
      });
    }
    if (isLiveUid(ap.receiverUid)) {
      transaction.set(expenseReversalRef, {
        ...reversal,
        ownerUid: ap.receiverUid,
        type: 'expense',
        category: 'other_expense',
        description: `Cheque bounced: AP payout to ${ap.senderName || 'Trader'} reversed`,
        contactId: null,
      });
    }
    return {
      notifyUid: counterparty,
      apId,
      message: `The cheque for ${formatCurrency(amount, currency)} on this AP bounced. ${formatCurrency(amount, currency)} is owed again.`,
    };
  });
}

/** High-priority alert when a cheque is marked bounced. */
export const onChequeBounced = onDocumentUpdated(
  {
    document: 'gemtrack_cheques/{chequeId}',
    region: REGION,
    retry: true,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    if (before.status === after.status || after.status !== 'bounced') return;

    const ownerUid = after.ownerUid as string;
    const chequeId = event.params.chequeId;
    let counterpartyName = (after.issuedBy as string) ?? 'Unknown';

    if (after.counterpartyContactId) {
      const contact = await db
        .collection('gemtrack_contacts')
        .doc(after.counterpartyContactId as string)
        .get();
      if (contact.exists) {
        counterpartyName = (contact.data()?.displayName as string) ?? counterpartyName;
      }
    }

    const id = await ensureDeterministicNotificationDoc({
      recipientUid: ownerUid,
      type: 'cheque_bounced',
      title: 'Cheque bounced',
      message: after.direction === 'given'
        ? `Cheque to ${counterpartyName} for ${formatCurrency(after.amount as number, (after.currency as string) ?? 'LKR')} has bounced. Take action.`
        : `Cheque from ${counterpartyName} for ${formatCurrency(after.amount as number, (after.currency as string) ?? 'LKR')} has bounced. Take action.`,
      direction:
        after.direction === 'given'
          ? 'given'
          : after.direction === 'received'
            ? 'taken'
            : undefined,
      referenceType: 'cheque',
      referenceId: chequeId,
      priority: 'high',
      // A cheque can bounce, be replaced, and its replacement bounce too;
      // each bounce of this cheque document is one event.
      dedupeKey: `cheque-bounced:${chequeId}:${event.id}`,
    });

    const reconciled = await reconcileApPaymentBounce(chequeId, after);
    if (reconciled && isLiveUid(reconciled.notifyUid)) {
      await ensureDeterministicNotificationDoc({
        recipientUid: reconciled.notifyUid,
        type: 'cheque_bounced',
        title: 'AP cheque bounced',
        message: reconciled.message,
        referenceType: 'ap',
        referenceId: reconciled.apId,
        priority: 'high',
        dedupeKey: `ap-cheque-bounced:${reconciled.apId}:${chequeId}`,
      });
    }

    logger.info('Cheque bounced notification', {
      chequeId,
      ownerUid,
      created: !!id,
      apReconciled: reconciled?.apId ?? null,
    });
  },
);
