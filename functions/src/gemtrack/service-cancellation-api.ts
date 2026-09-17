import {
  Timestamp,
  type DocumentReference,
  type DocumentSnapshot,
} from 'firebase-admin/firestore';

import { ApiError } from '../api/errors';
import { db } from '../admin';
import { ensureDeterministicNotificationDoc } from '../notifications/create';
import {
  decideServiceCancellationRequest,
  decideServiceCancellationResponse,
  type MutationDecision,
} from './mutation-contract';

type ServiceDoc = {
  ownerUid: string;
  traderBusinessName?: string | null;
  traderBusinessLogoUrl?: string | null;
  gemId: string;
  gemPhotoUrl?: string | null;
  serviceType: string;
  serviceTypes?: string[];
  providerUid?: string | null;
  providerName?: string | null;
  providerBusinessName?: string | null;
  providerBusinessLogoUrl?: string | null;
  traderUid?: string | null;
  traderBusinessId?: string | null;
  providerBusinessId?: string | null;
  previousStoneStage?: string | null;
  previousGemStatus?: string | null;
  previousOutcome?: string | null;
  cancellationPreviousStatus?: string | null;
  status: string;
};

export type ServiceCancellationResult = {
  ok: true;
  status: 'cancelled' | 'cancellation_requested' | 'given' | 'in_progress' | 'ready' | 'overdue';
};

type ServiceCancellationAction = 'accepted' | 'rejected';
type ServiceCancellationNotification = {
  recipientUid: string;
  type:
    | 'service_cancellation_requested'
    | 'service_cancellation_accepted'
    | 'service_cancellation_rejected';
  title: string;
  message: string;
  actorName: string | null;
  actorPhotoUrl: string | null;
  imageUrl: string | null;
};

function throwDecision(decision: Extract<MutationDecision, { kind: 'reject' }>): never {
  throw new ApiError(decision.code, decision.message);
}

function isGemLockedByService(status: unknown): boolean {
  return status === 'with_cutter' || status === 'with_heater' || status === 'with_polisher';
}

function restoredGemFields(
  service: ServiceDoc,
  gem: { status?: unknown; stoneStage?: unknown; custody?: unknown },
): Record<string, unknown> {
  const stage = ['rough', 'cut', 'heated', 'polished'].includes(String(service.previousStoneStage))
    ? String(service.previousStoneStage)
    : ['rough', 'cut', 'heated', 'polished'].includes(String(gem.stoneStage))
      ? String(gem.stoneStage)
      : gem.status === 'ready_for_sale'
        ? 'polished'
        : 'rough';
  const outcome = service.previousOutcome === 'listed' ? 'listed' : null;
  const previousStatus = ['ready_for_sale', 'rough', 'cut', 'heated', 'polished'].includes(
    String(service.previousGemStatus),
  )
    ? String(service.previousGemStatus)
    : stage;
  return {
    status: outcome === 'listed' ? 'listed' : previousStatus,
    stoneStage: stage,
    outcome,
    isListedOnMarketplace: outcome === 'listed',
    custody: null,
    currentLocation: null,
    currentHolderContactId: null,
  };
}

async function ensureServiceNotification(input: {
  recipientUid: string;
  type:
    | 'service_cancellation_requested'
    | 'service_cancellation_accepted'
    | 'service_cancellation_rejected';
  title: string;
  message: string;
  serviceId: string;
  actorName?: string | null;
  actorPhotoUrl?: string | null;
  imageUrl?: string | null;
}) {
  await ensureDeterministicNotificationDoc({
    recipientUid: input.recipientUid,
    type: input.type,
    title: input.title,
    message: input.message,
    referenceType: 'service',
    referenceId: input.serviceId,
    actorName: input.actorName ?? null,
    actorPhotoUrl: input.actorPhotoUrl ?? null,
    imageUrl: input.imageUrl ?? null,
  });
}

function assertServiceId(serviceId: string): string {
  const value = serviceId.trim();
  if (!value || value.includes('/')) {
    throw new ApiError('invalid-argument', 'A valid serviceId is required.');
  }
  return value;
}

/**
 * Transactional HTTP API implementation for owner cancellation requests.
 * The Hono API owns the migrated service-cancellation implementation.
 */
export async function requestServiceCancellationForApi(
  serviceId: string,
  uid: string,
): Promise<ServiceCancellationResult> {
  const id = assertServiceId(serviceId);
  const ref = db.collection('gemtrack_services').doc(id);

  const result = await db.runTransaction(async (transaction) => {
    const serviceSnap = await transaction.get(ref);
    if (!serviceSnap.exists) throw new ApiError('not-found', 'Service not found.');

    const service = serviceSnap.data() as ServiceDoc;
    const decision = decideServiceCancellationRequest(service, uid);
    if (decision.kind === 'reject') throwDecision(decision);

    const providerUid = service.providerUid?.trim() || null;
    let gemSnap: DocumentSnapshot | null = null;
    let gemRef: DocumentReference | null = null;

    if (decision.kind === 'transition' && decision.status === 'cancelled') {
      gemRef = db.collection('gemtrack_gems').doc(service.gemId);
      gemSnap = await transaction.get(gemRef);
    }

    if (decision.kind === 'replay') {
      const notification: ServiceCancellationNotification | null = decision.status === 'cancellation_requested' && providerUid
        ? {
          recipientUid: providerUid,
          type: 'service_cancellation_requested',
          title: 'Service cancellation requested',
          message: `A trader asked to cancel ${service.serviceType.replace(/_/g, ' ')}.`,
          actorName: service.traderBusinessName ?? 'Trader',
          actorPhotoUrl: service.traderBusinessLogoUrl ?? null,
          imageUrl: service.gemPhotoUrl ?? null,
          }
        : null;
      return {
        status: decision.status as ServiceCancellationResult['status'],
        notification,
      };
    }

    const now = Timestamp.now();
    transaction.update(ref, {
      status: decision.status,
      ...(decision.status === 'cancellation_requested'
        ? { cancellationPreviousStatus: service.status }
        : {}),
      updatedAt: now,
    });

    let notification: ServiceCancellationNotification | null = null;
    if (providerUid && decision.status === 'cancellation_requested') {
      notification = {
        recipientUid: providerUid,
        type: 'service_cancellation_requested',
        title: 'Service cancellation requested',
        message: `A trader asked to cancel ${service.serviceType.replace(/_/g, ' ')}.`,
        actorName: service.traderBusinessName ?? 'Trader',
        actorPhotoUrl: service.traderBusinessLogoUrl ?? null,
        imageUrl: service.gemPhotoUrl ?? null,
      };
    }
    if (decision.status === 'cancelled' && gemRef && gemSnap) {
      const gem = gemSnap.data() as { ownerUid?: string; status?: string; stoneStage?: string; custody?: string } | undefined;
      if (gemSnap.exists && gem?.ownerUid === service.ownerUid && (isGemLockedByService(gem.status) || isGemLockedByService(gem.custody))) {
        transaction.update(gemRef, { ...restoredGemFields(service, gem), updatedAt: now });
      }
    }

    return {
      status: decision.status as ServiceCancellationResult['status'],
      notification,
    };
  });

  if (result.notification) {
    await ensureServiceNotification({
      ...result.notification,
      serviceId: id,
    });
  }

  return { ok: true, status: result.status };
}

/** Transactional HTTP API implementation for provider cancellation responses. */
export async function respondServiceCancellationForApi(
  serviceId: string,
  uid: string,
  action: ServiceCancellationAction,
): Promise<ServiceCancellationResult> {
  const id = assertServiceId(serviceId);
  const ref = db.collection('gemtrack_services').doc(id);

  const result = await db.runTransaction(async (transaction) => {
    const serviceSnap = await transaction.get(ref);
    if (!serviceSnap.exists) throw new ApiError('not-found', 'Service not found.');

    const service = serviceSnap.data() as ServiceDoc;
    const decision = decideServiceCancellationResponse(
      {
        ...service,
        providerUid: service.providerUid ?? null,
        previousStatus: service.cancellationPreviousStatus ?? null,
      },
      uid,
      action,
    );
    if (decision.kind === 'reject') throwDecision(decision);

    const gemRef = db.collection('gemtrack_gems').doc(service.gemId);
    const gemSnap =
      action === 'accepted' && decision.kind === 'transition'
        ? await transaction.get(gemRef)
        : null;

    const type: 'service_cancellation_accepted' | 'service_cancellation_rejected' =
      action === 'accepted'
        ? 'service_cancellation_accepted'
        : 'service_cancellation_rejected';
    const title = action === 'accepted' ? 'Service cancelled' : 'Cancellation declined';
    const message =
      action === 'accepted'
        ? `${service.providerName || 'Provider'} accepted your cancellation.`
        : `${service.providerName || 'Provider'} kept the service active.`;

    if (decision.kind === 'replay') {
      return {
        status: decision.status as ServiceCancellationResult['status'],
        notification: {
          recipientUid: service.ownerUid,
          type,
          title,
          message,
          actorName: service.providerBusinessName ?? service.providerName ?? 'Lapidary',
          actorPhotoUrl: service.providerBusinessLogoUrl ?? null,
          imageUrl: service.gemPhotoUrl ?? null,
        },
      };
    }

    const now = Timestamp.now();
    transaction.update(ref, { status: decision.status, updatedAt: now });

    if (action === 'accepted' && gemSnap) {
      const gem = gemSnap.data() as { ownerUid?: string; status?: string; stoneStage?: string; custody?: string } | undefined;
      if (gemSnap.exists && gem?.ownerUid === service.ownerUid && (isGemLockedByService(gem.status) || isGemLockedByService(gem.custody))) {
        transaction.update(gemRef, { ...restoredGemFields(service, gem), updatedAt: now });
      }
    }

    return {
      status: decision.status as ServiceCancellationResult['status'],
      notification: {
        recipientUid: service.ownerUid,
        type,
        title,
        message,
        actorName: service.providerBusinessName ?? service.providerName ?? 'Lapidary',
        actorPhotoUrl: service.providerBusinessLogoUrl ?? null,
        imageUrl: service.gemPhotoUrl ?? null,
      },
    };
  });

  if (result.notification) {
    await ensureServiceNotification({
      ...result.notification,
      serviceId: id,
    });
  }

  return { ok: true, status: result.status };
}
