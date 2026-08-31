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
  gemId: string;
  serviceType: string;
  providerUid?: string | null;
  providerName?: string | null;
  status: string;
};

export type ServiceCancellationResult = {
  ok: true;
  status: 'cancelled' | 'cancellation_requested' | 'in_progress';
};

type ServiceCancellationAction = 'accepted' | 'rejected';

function throwDecision(decision: Extract<MutationDecision, { kind: 'reject' }>): never {
  throw new ApiError(decision.code, decision.message);
}

function isGemLockedByService(status: unknown): boolean {
  return status === 'with_cutter' || status === 'with_heater' || status === 'with_polisher';
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
}) {
  await ensureDeterministicNotificationDoc({
    recipientUid: input.recipientUid,
    type: input.type,
    title: input.title,
    message: input.message,
    referenceType: 'service',
    referenceId: input.serviceId,
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
 * The legacy callable intentionally remains on its original implementation.
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

    if (!providerUid && decision.kind === 'transition') {
      gemRef = db.collection('gemtrack_gems').doc(service.gemId);
      gemSnap = await transaction.get(gemRef);
    }

    if (decision.kind === 'replay') {
      const notification: {
        recipientUid: string;
        type: 'service_cancellation_requested';
        title: string;
        message: string;
      } | null = decision.status === 'cancellation_requested' && providerUid
        ? {
          recipientUid: providerUid,
          type: 'service_cancellation_requested',
          title: 'Service cancellation requested',
          message: `A trader asked to cancel ${service.serviceType.replace(/_/g, ' ')}.`,
          }
        : null;
      return {
        status: decision.status as ServiceCancellationResult['status'],
        notification,
      };
    }

    const now = Timestamp.now();
    transaction.update(ref, { status: decision.status, updatedAt: now });

    let notification: {
      recipientUid: string;
      type: 'service_cancellation_requested';
      title: string;
      message: string;
    } | null = null;
    if (providerUid) {
      notification = {
        recipientUid: providerUid,
        type: 'service_cancellation_requested',
        title: 'Service cancellation requested',
        message: `A trader asked to cancel ${service.serviceType.replace(/_/g, ' ')}.`,
      };
    } else if (gemRef && gemSnap) {
      const gem = gemSnap.data() as { ownerUid?: string; status?: string } | undefined;
      if (gemSnap.exists && gem?.ownerUid === service.ownerUid && isGemLockedByService(gem.status)) {
        transaction.update(gemRef, {
          status: 'ready_for_sale',
          currentHolderContactId: null,
          updatedAt: now,
        });
      }
    }

    return {
      status: decision.status as ServiceCancellationResult['status'],
      notification,
    };
  });

  if (result.notification) {
    await ensureServiceNotification({
      recipientUid: result.notification.recipientUid,
      type: result.notification.type,
      title: result.notification.title,
      message: result.notification.message,
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
      { ...service, providerUid: service.providerUid ?? null },
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
        },
      };
    }

    const now = Timestamp.now();
    transaction.update(ref, { status: decision.status, updatedAt: now });

    if (action === 'accepted' && gemSnap) {
      const gem = gemSnap.data() as { ownerUid?: string; status?: string } | undefined;
      if (gemSnap.exists && gem?.ownerUid === service.ownerUid && isGemLockedByService(gem.status)) {
        transaction.update(gemRef, {
          status: 'ready_for_sale',
          currentHolderContactId: null,
          updatedAt: now,
        });
      }
    }

    return {
      status: decision.status as ServiceCancellationResult['status'],
      notification: {
        recipientUid: service.ownerUid,
        type,
        title,
        message,
      },
    };
  });

  if (result.notification) {
    await ensureServiceNotification({
      recipientUid: result.notification.recipientUid,
      type: result.notification.type,
      title: result.notification.title,
      message: result.notification.message,
      serviceId: id,
    });
  }

  return { ok: true, status: result.status };
}
