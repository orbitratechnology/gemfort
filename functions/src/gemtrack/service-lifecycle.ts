import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from '../admin';
import { REGION } from '../config';
import { createNotificationDoc } from '../notifications/create';

type ServiceDoc = {
  ownerUid: string;
  gemId: string;
  serviceType: string;
  providerUid?: string | null;
  providerName?: string | null;
  status: string;
};

function requireAuth(uid: string | undefined): string {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to continue.');
  return uid;
}

const ACTIVE = new Set(['given', 'in_progress', 'overdue']);

async function unlockGemFromService(gemId: string, ownerUid: string) {
  const gemRef = db.collection('gemtrack_gems').doc(gemId);
  const gemSnap = await gemRef.get();
  if (!gemSnap.exists || gemSnap.data()?.ownerUid !== ownerUid) return;
  const status = gemSnap.data()?.status as string | undefined;
  if (status === 'with_cutter' || status === 'with_heater' || status === 'with_polisher') {
    await gemRef.update({
      status: 'ready_for_sale',
      currentHolderContactId: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

/** Owner requests cancel; GemFort provider must accept. Local-only providers cancel immediately. */
export const requestServiceCancellation = onCall(
  { region: REGION, timeoutSeconds: 60 },
  async (request) => {
    const uid = requireAuth(request.auth?.uid);
    const { serviceId } = request.data as { serviceId?: string };
    if (!serviceId) throw new HttpsError('invalid-argument', 'serviceId required.');

    const ref = db.collection('gemtrack_services').doc(serviceId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Service not found.');
    const service = snap.data() as ServiceDoc;
    if (service.ownerUid !== uid) {
      throw new HttpsError('permission-denied', 'Only the owner can request cancellation.');
    }
    if (!ACTIVE.has(service.status)) {
      throw new HttpsError('failed-precondition', 'This service is not active.');
    }

    const now = Timestamp.now();
    const providerUid = service.providerUid?.trim() || null;

    if (!providerUid) {
      await ref.update({ status: 'cancelled', updatedAt: now });
      await unlockGemFromService(service.gemId, service.ownerUid);
      return { ok: true as const, status: 'cancelled' as const };
    }

    await ref.update({ status: 'cancellation_requested', updatedAt: now });
    await createNotificationDoc({
      recipientUid: providerUid,
      type: 'service_cancellation_requested',
      title: 'Service cancellation requested',
      message: `A trader asked to cancel ${service.serviceType.replace(/_/g, ' ')}.`,
      referenceType: 'service',
      referenceId: serviceId,
    });

    return { ok: true as const, status: 'cancellation_requested' as const };
  },
);

/** Provider accepts or declines a cancellation request. */
export const respondServiceCancellation = onCall(
  { region: REGION, timeoutSeconds: 60 },
  async (request) => {
    const uid = requireAuth(request.auth?.uid);
    const { serviceId, action } = request.data as {
      serviceId?: string;
      action?: 'accepted' | 'rejected';
    };
    if (!serviceId || (action !== 'accepted' && action !== 'rejected')) {
      throw new HttpsError('invalid-argument', 'serviceId and action required.');
    }

    const ref = db.collection('gemtrack_services').doc(serviceId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Service not found.');
    const service = snap.data() as ServiceDoc;
    if (service.providerUid !== uid) {
      throw new HttpsError('permission-denied', 'Only the provider can respond.');
    }
    if (service.status !== 'cancellation_requested') {
      throw new HttpsError('failed-precondition', 'No cancellation request pending.');
    }

    const now = Timestamp.now();
    if (action === 'rejected') {
      await ref.update({ status: 'in_progress', updatedAt: now });
      await createNotificationDoc({
        recipientUid: service.ownerUid,
        type: 'service_cancellation_rejected',
        title: 'Cancellation declined',
        message: `${service.providerName || 'Provider'} kept the service active.`,
        referenceType: 'service',
        referenceId: serviceId,
      });
      return { ok: true as const, status: 'in_progress' as const };
    }

    await ref.update({ status: 'cancelled', updatedAt: now });
    await unlockGemFromService(service.gemId, service.ownerUid);
    await createNotificationDoc({
      recipientUid: service.ownerUid,
      type: 'service_cancellation_accepted',
      title: 'Service cancelled',
      message: `${service.providerName || 'Provider'} accepted your cancellation.`,
      referenceType: 'service',
      referenceId: serviceId,
    });

    return { ok: true as const, status: 'cancelled' as const };
  },
);
