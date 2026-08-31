import {
  Timestamp,
  type DocumentReference,
  type DocumentSnapshot,
} from 'firebase-admin/firestore';

import { ApiError } from '../api/errors';
import { db } from '../admin';
import { ensureDeterministicNotificationDoc } from '../notifications/create';
import {
  canActOnAp,
  decideApStatusTransition,
  type ApMutationFixture,
  type MutationDecision,
} from './mutation-contract';

type ApItem = {
  gemId: string;
  lineStatus: 'held' | 'sold' | 'returned';
};

type ApDoc = ApMutationFixture & {
  senderName?: string | null;
  receiverName?: string | null;
  items?: ApItem[];
};

export type ApCancellationResult = {
  ok: true;
  status: 'cancellation_requested' | 'accepted' | 'cancelled';
};

type CancellationAction = 'accepted' | 'rejected';

function throwDecision(decision: Extract<MutationDecision, { kind: 'reject' }>): never {
  throw new ApiError(decision.code, decision.message);
}

function assertApId(apId: string): string {
  const value = apId.trim();
  if (!value || value.includes('/')) {
    throw new ApiError('invalid-argument', 'A valid apId is required.');
  }
  return value;
}

function fixtureFromAp(ap: ApDoc): ApMutationFixture {
  return {
    ownerUid: ap.ownerUid,
    senderUid: ap.senderUid,
    receiverUid: ap.receiverUid,
    status: ap.status,
  };
}

async function ensureApNotification(input: {
  recipientUid: string;
  type:
    | 'ap_cancellation_requested'
    | 'ap_cancellation_accepted'
    | 'ap_cancellation_rejected';
  title: string;
  message: string;
  apId: string;
}) {
  await ensureDeterministicNotificationDoc({
    recipientUid: input.recipientUid,
    type: input.type,
    title: input.title,
    message: input.message,
    referenceType: 'ap',
    referenceId: input.apId,
  });
}

export async function requestApCancellationForApi(
  apId: string,
  uid: string,
): Promise<ApCancellationResult> {
  const id = assertApId(apId);
  const ref = db.collection('gemtrack_ap_records').doc(id);

  const result = await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new ApiError('not-found', 'AP not found.');

    const ap = snap.data() as ApDoc;
    if (!canActOnAp('request-cancellation', fixtureFromAp(ap), uid)) {
      throw new ApiError('permission-denied', 'Only the sender can request cancellation.');
    }

    const decision = decideApStatusTransition('request-cancellation', ap.status);
    if (decision.kind === 'reject') throwDecision(decision);

    const notification = {
      recipientUid: ap.receiverUid,
      type: 'ap_cancellation_requested' as const,
      title: 'AP cancellation requested',
      message: `${ap.senderName || 'Trader'} asked to cancel an AP. Accept to unlock the stones.`,
    };

    if (decision.kind === 'transition') {
      transaction.update(ref, { status: decision.status, updatedAt: Timestamp.now() });
    }

    return {
      status: decision.status as ApCancellationResult['status'],
      notification,
    };
  });

  await ensureApNotification({ ...result.notification, apId: id });
  return { ok: true, status: result.status };
}

export async function respondApCancellationForApi(
  apId: string,
  uid: string,
  action: CancellationAction,
): Promise<ApCancellationResult> {
  const id = assertApId(apId);
  const ref = db.collection('gemtrack_ap_records').doc(id);

  const result = await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new ApiError('not-found', 'AP not found.');

    const ap = snap.data() as ApDoc;
    if (!canActOnAp('respond-cancellation', fixtureFromAp(ap), uid)) {
      throw new ApiError('permission-denied', 'Only the AP holder can respond.');
    }

    const decision = decideApStatusTransition(
      action === 'accepted'
        ? 'respond-cancellation-accepted'
        : 'respond-cancellation-rejected',
      ap.status,
    );
    if (decision.kind === 'reject') throwDecision(decision);

    const notification = {
      recipientUid: ap.senderUid,
      type:
        action === 'accepted'
          ? ('ap_cancellation_accepted' as const)
          : ('ap_cancellation_rejected' as const),
      title: action === 'accepted' ? 'AP cancelled' : 'AP cancellation declined',
      message:
        action === 'accepted'
          ? `${ap.receiverName || 'Trader'} accepted your cancellation request.`
          : `${ap.receiverName || 'Trader'} kept the AP active.`,
    };

    const heldItems = (ap.items ?? []).filter((item) => item.lineStatus === 'held');
    const gemRefs: DocumentReference[] =
      action === 'accepted' && decision.kind === 'transition'
        ? heldItems.map((item) => db.collection('gemtrack_gems').doc(item.gemId))
        : [];
    const gemSnaps: DocumentSnapshot[] = [];
    for (const gemRef of gemRefs) {
      gemSnaps.push(await transaction.get(gemRef));
    }

    if (decision.kind === 'transition') {
      if (action === 'accepted') {
        for (let i = 0; i < gemRefs.length; i += 1) {
          const gemSnap = gemSnaps[i]!;
          const gem = gemSnap.data() as { ownerUid?: string } | undefined;
          if (!gemSnap.exists || gem?.ownerUid !== ap.ownerUid) {
            throw new ApiError('failed-precondition', 'An AP gem could not be verified.');
          }
          transaction.update(gemRefs[i]!, {
            status: 'ready_for_sale',
            currentHolderContactId: null,
            updatedAt: Timestamp.now(),
          });
        }
      }
      transaction.update(ref, { status: decision.status, updatedAt: Timestamp.now() });
    }

    return {
      status: decision.status as ApCancellationResult['status'],
      notification,
    };
  });

  await ensureApNotification({ ...result.notification, apId: id });
  return { ok: true, status: result.status };
}
