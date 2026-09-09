import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { REGION } from '../config';
import { ensureDeterministicNotificationDoc } from '../notifications/create';

function isLapidaryRequest(data: Record<string, unknown> | undefined): boolean {
  return data?.serviceKind === 'lapidary_request';
}

function serviceTypes(data: Record<string, unknown>): string[] {
  if (!Array.isArray(data.serviceTypes)) return [];
  return data.serviceTypes.filter((value): value is string => typeof value === 'string');
}

export const onServiceRequestCreated = onDocumentCreated(
  {
    document: 'gemtrack_services/{serviceId}',
    region: REGION,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data || !isLapidaryRequest(data)) return;
    await ensureDeterministicNotificationDoc({
      recipientUid: data.providerUid,
      type: 'service_request_received',
      title: 'New service request',
      message: `A trader requested ${serviceTypes(data).join(', ') || 'service'} for ${data.gemName}.`,
      referenceType: 'service',
      referenceId: event.params.serviceId,
      actorName: data.traderBusinessName ?? null,
      actorPhotoUrl: data.traderBusinessLogoUrl ?? null,
      imageUrl: data.gemPhotoUrl ?? null,
    });
    logger.info('service_request_received notified', { id: event.params.serviceId });
  },
);
export const onServiceRequestUpdated = onDocumentUpdated(
  {
    document: 'gemtrack_services/{serviceId}',
    region: REGION,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || !isLapidaryRequest(after)) return;

    const requestChanged = before.requestStatus !== after.requestStatus;
    if (requestChanged && (after.requestStatus === 'accepted' || after.requestStatus === 'rejected')) {
      const accepted = after.requestStatus === 'accepted';
      await ensureDeterministicNotificationDoc({
        recipientUid: after.ownerUid ?? after.traderUid,
        type: accepted ? 'service_request_accepted' : 'service_request_rejected',
        title: accepted ? 'Service request accepted' : 'Service request declined',
        message: accepted
          ? 'Your lapidary accepted the job. Tracking is synced.'
          : 'Your lapidary declined this service request.',
        referenceType: 'service',
        referenceId: event.params.serviceId,
        actorName: after.providerBusinessName ?? after.providerName ?? null,
        actorPhotoUrl: after.providerBusinessLogoUrl ?? null,
        imageUrl: after.gemPhotoUrl ?? null,
      });
      return;
    }

    if (before.status === after.status || after.requestStatus !== 'accepted') return;
    if (!['in_progress', 'ready', 'received_back'].includes(String(after.status))) return;
    const jobStatus = after.status === 'received_back' ? 'returned' : String(after.status);
    await ensureDeterministicNotificationDoc({
      recipientUid: after.ownerUid ?? after.traderUid,
      type: 'service_job_updated',
      title: after.status === 'received_back' ? 'Gem returned from lapidary' : 'Workshop update',
      message: `Your service job is now ${jobStatus.replace('_', ' ')}.`,
      referenceType: 'service',
      referenceId: event.params.serviceId,
      actorName: after.providerBusinessName ?? after.providerName ?? null,
      actorPhotoUrl: after.providerBusinessLogoUrl ?? null,
      imageUrl: after.gemPhotoUrl ?? null,
      dedupeKey: `service_job_updated:${event.params.serviceId}:${jobStatus}`,
    });
  },
);
