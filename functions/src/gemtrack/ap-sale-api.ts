import { Timestamp } from 'firebase-admin/firestore';

import { ApiError } from '../api/errors';
import { db } from '../admin';
import { ensureDeterministicNotificationDoc, formatCurrency } from '../notifications/create';
import { convertToBaseServer, loadServerRates } from './exchange-rates';
import { canActOnAp } from './mutation-contract';
import { apSaleFingerprint, apSaleTransactionId } from './ap-financial-contract';

type ApGemLine = {
  gemId: string;
  gemLabel: string;
  agreedPrice: number;
  currency: string;
  lineStatus: 'held' | 'sold' | 'returned';
  soldPrice?: number | null;
  soldPriceBase?: number | null;
  soldToName?: string | null;
  soldDate?: Timestamp | null;
  ownerReceives?: number | null;
  ownerReceivesBase?: number | null;
  commission?: number | null;
  commissionBase?: number | null;
  paymentDueDate?: Timestamp | null;
};

type ApDoc = {
  ownerUid: string;
  senderUid: string;
  receiverUid: string;
  status: string;
  senderName?: string | null;
  receiverName?: string | null;
  items?: ApGemLine[];
};

export type RecordApGemSaleInput = {
  gemId: string;
  soldPrice: number;
  soldToName?: string | null;
  paymentDueDateIso?: string | null;
  ownerReceives?: number | null;
};

export type RecordApGemSaleResult = {
  ok: true;
  status: 'sold';
};

function assertApId(apId: string): string {
  const value = apId.trim();
  if (!value || value.includes('/')) {
    throw new ApiError('invalid-argument', 'A valid apId is required.');
  }
  return value;
}

function normalizeString(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}

function parsePaymentDueDate(value: string | null | undefined): Timestamp | null {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError('invalid-argument', 'paymentDueDateIso must be a valid date.');
  }
  return Timestamp.fromDate(date);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function ensureSaleNotification(input: {
  recipientUid: string;
  apId: string;
  receiverName: string;
  gemLabel: string;
  ownerReceives: number;
  currency: string;
}) {
  await ensureDeterministicNotificationDoc({
    recipientUid: input.recipientUid,
    type: 'ap_gem_sold',
    title: 'AP gem sold',
    message: `${input.receiverName} sold ${input.gemLabel}. You are owed ${formatCurrency(input.ownerReceives, input.currency)}.`,
    referenceType: 'ap',
    referenceId: input.apId,
  });
}

export async function recordApGemSaleForApi(
  apId: string,
  uid: string,
  input: RecordApGemSaleInput,
): Promise<RecordApGemSaleResult> {
  const id = assertApId(apId);
  const gemId = input?.gemId?.trim() ?? '';
  if (!gemId) throw new ApiError('invalid-argument', 'gemId is required.');

  const soldPrice = Number(input.soldPrice);
  if (!Number.isFinite(soldPrice) || soldPrice <= 0) {
    throw new ApiError('invalid-argument', 'soldPrice must be positive.');
  }

  const paymentDueDate = parsePaymentDueDate(input.paymentDueDateIso);
  const rates = await loadServerRates();
  const apRef = db.collection('gemtrack_ap_records').doc(id);
  const gemRef = db.collection('gemtrack_gems').doc(gemId);
  const eventRef = db.collection('gemtrack_transactions').doc(apSaleTransactionId(id, gemId));

  const result = await db.runTransaction(async (transaction) => {
    const apSnap = await transaction.get(apRef);
    if (!apSnap.exists) throw new ApiError('not-found', 'AP not found.');

    const ap = apSnap.data() as ApDoc;
    if (
      !canActOnAp(
        'sale',
        {
          ownerUid: ap.ownerUid,
          senderUid: ap.senderUid,
          receiverUid: ap.receiverUid,
          status: ap.status,
        },
        uid,
      )
    ) {
      throw new ApiError('permission-denied', 'Only the AP holder can record a sale.');
    }
    if (ap.status !== 'accepted') {
      throw new ApiError('failed-precondition', 'AP must be accepted to record sales.');
    }

    const items = [...(ap.items ?? [])];
    const index = items.findIndex((item) => item.gemId === gemId);
    if (index < 0) throw new ApiError('not-found', 'Gem not on this AP.');
    const line = items[index]!;
    const saleCurrency = line.currency?.trim() || 'LKR';
    const ownerReceives =
      input.ownerReceives != null && Number.isFinite(Number(input.ownerReceives))
        ? Number(input.ownerReceives)
        : line.agreedPrice;
    const commission = soldPrice - ownerReceives;
    if (commission < 0) {
      throw new ApiError('invalid-argument', 'ownerReceives cannot exceed soldPrice.');
    }

    const fingerprint = apSaleFingerprint({
      gemId,
      soldPrice,
      soldToName: input.soldToName,
      paymentDueDateIso: input.paymentDueDateIso,
      ownerReceives,
      currency: saleCurrency,
    });
    const eventSnap = await transaction.get(eventRef);
    const gemSnap = await transaction.get(gemRef);

    if (line.lineStatus === 'sold') {
      if (!eventSnap.exists) {
        throw new ApiError(
          'failed-precondition',
          'This AP sale was created by the legacy path and needs reconciliation before API retry.',
        );
      }
      if (eventSnap.data()?.mutationFingerprint !== fingerprint) {
        throw new ApiError('failed-precondition', 'This gem was already sold with different details.');
      }
      return {
        status: 'sold' as const,
        notification: {
          recipientUid: ap.senderUid,
          apId: id,
          receiverName: ap.receiverName || 'Trader',
          gemLabel: line.gemLabel || gemId,
          ownerReceives: line.ownerReceives ?? ownerReceives,
          currency: saleCurrency,
        },
      };
    }

    if (line.lineStatus !== 'held') {
      throw new ApiError('failed-precondition', 'This gem is no longer held on AP.');
    }
    if (eventSnap.exists) {
      throw new ApiError('failed-precondition', 'An AP sale event already exists for this gem.');
    }
    const gem = gemSnap.data() as { ownerUid?: string; status?: string } | undefined;
    if (!gemSnap.exists || gem?.ownerUid !== ap.ownerUid) {
      throw new ApiError('failed-precondition', 'The AP gem could not be verified.');
    }
    if (gem.status === 'sold') {
      throw new ApiError('failed-precondition', 'The AP gem is already sold.');
    }

    const saleAmountBase = convertToBaseServer(soldPrice, saleCurrency, rates);
    const ownerReceivesBase = convertToBaseServer(ownerReceives, saleCurrency, rates);
    const commissionBase = convertToBaseServer(commission, saleCurrency, rates);
    const now = Timestamp.now();
    items[index] = {
      ...line,
      lineStatus: 'sold',
      soldPrice,
      soldPriceBase: saleAmountBase,
      soldToName: normalizeString(input.soldToName),
      soldDate: now,
      ownerReceives,
      ownerReceivesBase,
      commission,
      commissionBase,
      paymentDueDate,
    };

    transaction.update(apRef, { items, updatedAt: now });
    transaction.update(gemRef, {
      status: 'sold',
      soldPrice: ownerReceives,
      soldPriceCurrency: saleCurrency,
      soldPriceBase: ownerReceivesBase,
      soldDate: now,
      currentApId: id,
      updatedAt: now,
    });
    transaction.create(eventRef, {
      eventKind: 'ap_sale',
      mutationFingerprint: fingerprint,
      apId: id,
      gemId,
      ownerUid: uid,
      type: 'income',
      amount: soldPrice,
      currency: saleCurrency,
      amountBase: saleAmountBase,
      category: 'gem_sale',
      description: `AP sale: ${line.gemLabel}${input.soldToName ? ` → ${input.soldToName}` : ''}`,
      contactId: null,
      sourceType: 'ap',
      sourceId: id,
      date: now,
      createdAt: now,
    });

    return {
      status: 'sold' as const,
      notification: {
        recipientUid: ap.senderUid,
        apId: id,
        receiverName: ap.receiverName || 'Trader',
        gemLabel: line.gemLabel || gemId,
        ownerReceives,
        currency: saleCurrency,
      },
    };
  });

  await ensureSaleNotification(result.notification);
  return { ok: true, status: result.status };
}

export function parseRecordApGemSaleInput(input: unknown): RecordApGemSaleInput {
  if (!isObject(input)) {
    throw new ApiError('invalid-argument', 'Request body must be a JSON object.');
  }
  return input as unknown as RecordApGemSaleInput;
}
