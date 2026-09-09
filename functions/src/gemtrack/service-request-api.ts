import { Timestamp } from 'firebase-admin/firestore';

import { db } from '../admin';
import { ApiError } from '../api/errors';
import { ensureDeterministicNotificationDoc } from '../notifications/create';

const SERVICE_TYPES = new Set([
  'cutting',
  'recutting',
  'heating',
  'reheating',
  'polishing',
  'repolishing',
]);

const STONE_STAGES = new Set(['rough', 'cut', 'heated', 'polished']);

export type CreateServiceRequestInput = {
  traderBusinessId: string | null;
  lapidaryUid: string;
  lapidaryBusinessId: string;
  gemId: string;
  gemName: string;
  gemPhotoUrl: string | null;
  serviceTypes: string[];
  notes: string | null;
  expectedReturnDays: number;
  weightBefore: number;
  providerName: string | null;
  providerBusinessName: string | null;
  providerBusinessLogoUrl: string | null;
  traderBusinessName: string | null;
  traderBusinessLogoUrl: string | null;
};

type ServiceRequestDoc = CreateServiceRequestInput & {
  ownerUid: string;
  traderUid: string;
  providerUid: string;
  providerBusinessId: string;
  serviceKind: 'lapidary_request';
  requestStatus: 'pending' | 'accepted' | 'rejected';
  status: string;
  serviceType: string;
  providerContactId: string;
  dateGiven: Timestamp;
  expectedReturnDate: Timestamp;
  photoBeforeUrls: string[];
  instructions: string | null;
  agreedPrice: number | null;
  agreedPriceCurrency: string | null;
  advancePaid: number;
  dateReturned: Timestamp | null;
  weightAfter: number | null;
  weightLossPercent: number | null;
  photoAfterUrls: string[];
  resultNotes: string | null;
  receiptUrl: string | null;
  finalCost: number | null;
  finalCostCurrency: string | null;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  rejectReason: string | null;
  serviceRecordId: string;
  jobId: string | null;
  respondedAt: Timestamp | null;
  previousStoneStage: string;
  previousGemStatus: string;
  previousOutcome: string | null;
  providerDeletedAt?: Timestamp | null;
  providerDeletedByUid?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

function objectOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new ApiError('invalid-argument', 'Request body must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

function idOf(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new ApiError('invalid-argument', `${name} is required.`);
  const normalized = value.trim();
  if (!normalized || normalized.includes('/')) {
    throw new ApiError('invalid-argument', `A valid ${name} is required.`);
  }
  return normalized;
}

function optionalIdOf(value: unknown, name: string): string | null {
  if (value == null || value === '') return null;
  return idOf(value, name);
}

function optionalTextOf(value: unknown, name: string, max: number): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max) {
    throw new ApiError('invalid-argument', `${name} is invalid.`);
  }
  return value.trim() || null;
}

function textOf(value: unknown, name: string, max: number): string {
  const result = optionalTextOf(value, name, max);
  if (!result) throw new ApiError('invalid-argument', `${name} is required.`);
  return result;
}

function finiteNumberOf(value: unknown, name: string, min: number, max: number): number {
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max) {
    throw new ApiError('invalid-argument', `${name} is invalid.`);
  }
  return result;
}

export function parseCreateServiceRequestInput(value: unknown): CreateServiceRequestInput {
  const input = objectOf(value);
  const serviceTypes = Array.isArray(input.serviceTypes)
    ? [...new Set(input.serviceTypes.filter((item): item is string => typeof item === 'string').map((item) => item.trim()))]
    : [];
  if (serviceTypes.length === 0 || serviceTypes.some((item) => !SERVICE_TYPES.has(item))) {
    throw new ApiError('invalid-argument', 'Choose at least one valid lapidary service.');
  }

  return {
    traderBusinessId: optionalIdOf(input.traderBusinessId, 'traderBusinessId'),
    lapidaryUid: idOf(input.lapidaryUid, 'lapidaryUid'),
    lapidaryBusinessId: idOf(input.lapidaryBusinessId, 'lapidaryBusinessId'),
    gemId: idOf(input.gemId, 'gemId'),
    gemName: textOf(input.gemName, 'gemName', 200),
    gemPhotoUrl: optionalTextOf(input.gemPhotoUrl, 'gemPhotoUrl', 2_000),
    serviceTypes,
    notes: optionalTextOf(input.notes, 'notes', 2_000),
    expectedReturnDays: finiteNumberOf(input.expectedReturnDays ?? 14, 'expectedReturnDays', 1, 365),
    weightBefore: finiteNumberOf(input.weightBefore ?? 0, 'weightBefore', 0, 1_000_000),
    providerName: optionalTextOf(input.providerName, 'providerName', 200),
    providerBusinessName: optionalTextOf(input.providerBusinessName, 'providerBusinessName', 200),
    providerBusinessLogoUrl: optionalTextOf(input.providerBusinessLogoUrl, 'providerBusinessLogoUrl', 2_000),
    traderBusinessName: optionalTextOf(input.traderBusinessName, 'traderBusinessName', 200),
    traderBusinessLogoUrl: optionalTextOf(input.traderBusinessLogoUrl, 'traderBusinessLogoUrl', 2_000),
  };
}

function gemStage(data: Record<string, unknown>): string {
  const candidate = data.stoneStage ?? data.status;
  if (typeof candidate === 'string' && STONE_STAGES.has(candidate)) return candidate;
  if (candidate === 'ready_for_sale') return 'polished';
  if (candidate === 'with_cutter' || candidate === 'with_heater' || candidate === 'with_polisher') {
    return 'cut';
  }
  return 'rough';
}

function restorableGemStatus(service: Pick<ServiceRequestDoc, 'previousGemStatus' | 'previousStoneStage'>): string {
  const previous = service.previousGemStatus;
  return ['ready_for_sale', 'rough', 'cut', 'heated', 'polished'].includes(previous)
    ? previous
    : service.previousStoneStage;
}

function serviceCustody(serviceTypes: string | string[]): 'with_cutter' | 'with_heater' | 'with_polisher' {
  const types = Array.isArray(serviceTypes) ? serviceTypes : [serviceTypes];
  if (types.some((type) => type.includes('polish'))) return 'with_polisher';
  if (types.some((type) => type.includes('heat'))) return 'with_heater';
  return 'with_cutter';
}

function returnedStage(serviceTypes: string | string[]): 'cut' | 'heated' | 'polished' {
  const types = Array.isArray(serviceTypes) ? serviceTypes : [serviceTypes];
  if (types.some((type) => type.includes('polish'))) return 'polished';
  if (types.some((type) => type.includes('heat'))) return 'heated';
  return 'cut';
}

function serviceFamily(serviceType: string): string {
  return serviceType.startsWith('re') ? serviceType.slice(2) : serviceType;
}

function providerOffers(
  provider: Record<string, unknown>,
  requestedTypes: string[],
): boolean {
  const profile = provider.providerProfile as Record<string, unknown> | undefined;
  const offerings = Array.isArray(profile?.services) ? profile.services : [];
  const hasStructuredOfferings = offerings.length > 0;
  const offered = new Set<string>();
  for (const offering of offerings) {
    if (!offering || typeof offering !== 'object') continue;
    const record = offering as Record<string, unknown>;
    if (record.isActive === false) continue;
    const value = record.serviceId ?? record.name;
    if (typeof value === 'string') offered.add(serviceFamily(value.toLowerCase().trim()));
  }
  if (!hasStructuredOfferings && Array.isArray(profile?.servicesOffered)) {
    for (const value of profile.servicesOffered) {
      if (typeof value === 'string') offered.add(serviceFamily(value.toLowerCase().trim()));
    }
  }
  return requestedTypes.every((type) => offered.has(serviceFamily(type)));
}

function notificationMessage(input: CreateServiceRequestInput): string {
  return `A trader requested ${input.serviceTypes.join(', ')} for ${input.gemName}.`;
}

async function notifyServiceRequest(input: {
  recipientUid: string;
  type: 'service_request_received' | 'service_request_accepted' | 'service_request_rejected' | 'service_job_updated';
  title: string;
  message: string;
  serviceId: string;
  actorName: string | null;
  actorPhotoUrl: string | null;
  imageUrl: string | null;
  dedupeKey?: string;
}) {
  await ensureDeterministicNotificationDoc({
    recipientUid: input.recipientUid,
    type: input.type,
    title: input.title,
    message: input.message,
    referenceType: 'service',
    referenceId: input.serviceId,
    actorName: input.actorName,
    actorPhotoUrl: input.actorPhotoUrl,
    imageUrl: input.imageUrl,
    dedupeKey: input.dedupeKey ?? null,
  });
}

function assertServiceId(serviceId: string): string {
  const value = serviceId.trim();
  if (!value || value.includes('/')) throw new ApiError('invalid-argument', 'A valid serviceId is required.');
  return value;
}

export async function createServiceRequestForApi(
  uid: string,
  input: CreateServiceRequestInput,
): Promise<{ serviceId: string; status: 'pending' }> {
  if (input.lapidaryUid === uid) throw new ApiError('invalid-argument', 'Choose another lapidary.');

  const serviceRef = db.collection('gemtrack_services').doc();
  const gemRef = db.collection('gemtrack_gems').doc(input.gemId);
  const providerRef = db.collection('businesses').doc(input.lapidaryBusinessId);
  const now = Timestamp.now();
  const expectedReturnDate = Timestamp.fromMillis(
    now.toMillis() + input.expectedReturnDays * 86_400_000,
  );

  await db.runTransaction(async (transaction) => {
    const [gemSnap, providerSnap] = await transaction.getAll(gemRef, providerRef);
    if (!gemSnap.exists) throw new ApiError('not-found', 'Gem not found.');
    if (!providerSnap.exists) throw new ApiError('not-found', 'Lapidary profile not found.');

    const gem = gemSnap.data() as Record<string, unknown>;
    const provider = providerSnap.data() as Record<string, unknown>;
    if (gem.ownerUid !== uid) throw new ApiError('permission-denied', 'You do not own this gem.');
    if (provider.ownerUid !== input.lapidaryUid) {
      throw new ApiError('failed-precondition', 'The selected lapidary profile is no longer available.');
    }
    if (provider.isActive === false || provider.verificationStatus !== 'verified') {
      throw new ApiError('failed-precondition', 'The selected lapidary is not currently available.');
    }
    const providerProfile = provider.providerProfile as Record<string, unknown> | undefined;
    if (providerProfile?.isAcceptingOrders === false) {
      throw new ApiError('failed-precondition', 'The selected lapidary is not accepting service requests.');
    }
    if (provider.businessType === 'trader') {
      throw new ApiError('failed-precondition', 'Choose a lapidary profile.');
    }
    if (!providerOffers(provider, input.serviceTypes)) {
      throw new ApiError('failed-precondition', 'One or more selected services are no longer offered by this lapidary.');
    }

    const locked = gem.custody || gem.currentApId
      || gem.status === 'on_ap'
      || gem.status === 'on_trip'
      || gem.currentLocation === 'AP'
      || gem.currentLocation === 'Trip';
    if (locked || gem.saleStatus === 'pending' || gem.outcome === 'sold' || gem.outcome === 'returned') {
      throw new ApiError('failed-precondition', 'Complete the gem\'s current activity before requesting service.');
    }
    if (gem.isListedOnMarketplace === true || gem.outcome === 'listed') {
      throw new ApiError('failed-precondition', 'Remove this gem from the market before requesting service.');
    }

    const previousStoneStage = gemStage(gem);
    const custody = serviceCustody(input.serviceTypes);
    const data: ServiceRequestDoc = {
      ...input,
      ownerUid: uid,
      traderUid: uid,
      providerUid: input.lapidaryUid,
      providerBusinessId: input.lapidaryBusinessId,
      serviceKind: 'lapidary_request',
      requestStatus: 'pending',
      status: 'pending',
      serviceType: input.serviceTypes[0]!,
      providerContactId: '',
      dateGiven: now,
      expectedReturnDate,
      photoBeforeUrls: input.gemPhotoUrl ? [input.gemPhotoUrl] : [],
      instructions: input.notes,
      agreedPrice: null,
      agreedPriceCurrency: null,
      advancePaid: 0,
      dateReturned: null,
      weightAfter: null,
      weightLossPercent: null,
      photoAfterUrls: [],
      resultNotes: null,
      receiptUrl: null,
      finalCost: null,
      finalCostCurrency: null,
      paymentStatus: 'unpaid',
      rejectReason: null,
      serviceRecordId: serviceRef.id,
      jobId: null,
      respondedAt: null,
      previousStoneStage,
      previousGemStatus: typeof gem.status === 'string' ? gem.status : previousStoneStage,
      previousOutcome: typeof gem.outcome === 'string' ? gem.outcome : null,
      createdAt: now,
      updatedAt: now,
    };
    transaction.create(serviceRef, data);
    transaction.update(gemRef, {
      status: custody,
      custody,
      currentLocation: 'Lapidary',
      currentHolderContactId: null,
      updatedAt: now,
    });
  });

  await notifyServiceRequest({
    recipientUid: input.lapidaryUid,
    type: 'service_request_received',
    title: 'New service request',
    message: notificationMessage(input),
    serviceId: serviceRef.id,
    actorName: input.traderBusinessName,
    actorPhotoUrl: input.traderBusinessLogoUrl,
    imageUrl: input.gemPhotoUrl,
  });

  return { serviceId: serviceRef.id, status: 'pending' };
}

export async function respondServiceRequestForApi(
  serviceId: string,
  uid: string,
  action: 'accepted' | 'rejected',
  rejectReason?: string | null,
): Promise<{ serviceId: string; status: 'given' | 'rejected' }> {
  const id = assertServiceId(serviceId);
  const serviceRef = db.collection('gemtrack_services').doc(id);
  let notification: Parameters<typeof notifyServiceRequest>[0] | null = null;

  await db.runTransaction(async (transaction) => {
    const serviceSnap = await transaction.get(serviceRef);
    if (!serviceSnap.exists) throw new ApiError('not-found', 'Service request not found.');
    const service = serviceSnap.data() as ServiceRequestDoc;
    if (service.serviceKind !== 'lapidary_request' || service.providerUid !== uid) {
      throw new ApiError('permission-denied', 'Only the selected lapidary can respond.');
    }
    if (service.requestStatus !== 'pending' || service.status !== 'pending') {
      throw new ApiError('failed-precondition', 'This service request is already handled.');
    }

    const now = Timestamp.now();
    if (action === 'accepted') {
      transaction.update(serviceRef, {
        status: 'given',
        requestStatus: 'accepted',
        jobId: id,
        respondedAt: now,
        updatedAt: now,
      });
      notification = {
        recipientUid: service.ownerUid,
        type: 'service_request_accepted',
        title: 'Service request accepted',
        message: 'Your lapidary accepted the job. Tracking is synced.',
        serviceId: id,
        actorName: service.providerBusinessName ?? service.providerName ?? 'Lapidary',
        actorPhotoUrl: service.providerBusinessLogoUrl,
        imageUrl: service.gemPhotoUrl,
      };
    } else {
      const gemRef = db.collection('gemtrack_gems').doc(service.gemId);
      const gemSnap = await transaction.get(gemRef);
      const gem = gemSnap.data() as Record<string, unknown> | undefined;
      transaction.update(serviceRef, {
        status: 'rejected',
        requestStatus: 'rejected',
        rejectReason: rejectReason?.trim() || 'Declined',
        respondedAt: now,
        updatedAt: now,
      });
      if (gemSnap.exists && gem?.ownerUid === service.ownerUid && gem?.custody === serviceCustody(service.serviceTypes ?? service.serviceType)) {
        transaction.update(gemRef, {
          status: restorableGemStatus(service),
          stoneStage: service.previousStoneStage,
          custody: null,
          outcome: service.previousOutcome,
          currentLocation: null,
          currentHolderContactId: null,
          updatedAt: now,
        });
      }
      notification = {
        recipientUid: service.ownerUid,
        type: 'service_request_rejected',
        title: 'Service request declined',
        message: 'Your lapidary declined this service request.',
        serviceId: id,
        actorName: service.providerBusinessName ?? service.providerName ?? 'Lapidary',
        actorPhotoUrl: service.providerBusinessLogoUrl,
        imageUrl: service.gemPhotoUrl,
      };
    }
  });

  if (notification) {
    await notifyServiceRequest(notification!);
  }
  return { serviceId: id, status: action === 'accepted' ? 'given' : 'rejected' };
}

export async function updateLapidaryServiceStatusForApi(
  serviceId: string,
  uid: string,
  status: 'in_progress' | 'ready' | 'returned',
): Promise<{ serviceId: string; status: 'in_progress' | 'ready' | 'received_back' }> {
  const id = assertServiceId(serviceId);
  const serviceRef = db.collection('gemtrack_services').doc(id);
  let notification: Parameters<typeof notifyServiceRequest>[0] | null = null;
  let nextStatus: 'in_progress' | 'ready' | 'received_back' = status === 'returned' ? 'received_back' : status;

  await db.runTransaction(async (transaction) => {
    const serviceSnap = await transaction.get(serviceRef);
    if (!serviceSnap.exists) throw new ApiError('not-found', 'Service not found.');
    const service = serviceSnap.data() as ServiceRequestDoc;
    if (service.serviceKind !== 'lapidary_request' || service.providerUid !== uid) {
      throw new ApiError('permission-denied', 'Only the selected lapidary can update this job.');
    }
    const allowed =
      (service.status === 'given' && status === 'in_progress') ||
      (service.status === 'in_progress' && status === 'ready') ||
      (service.status === 'ready' && status === 'returned');
    if (!allowed) throw new ApiError('failed-precondition', 'This job cannot move to that status.');

    const now = Timestamp.now();
    const updates: Record<string, unknown> = { status: nextStatus, updatedAt: now };
    if (status === 'returned') updates.dateReturned = now;
    if (status === 'returned') {
      const gemRef = db.collection('gemtrack_gems').doc(service.gemId);
      const gemSnap = await transaction.get(gemRef);
      const gem = gemSnap.data() as Record<string, unknown> | undefined;
      if (gemSnap.exists && gem?.ownerUid === service.ownerUid && gem?.custody === serviceCustody(service.serviceTypes ?? service.serviceType)) {
        const stage = returnedStage(service.serviceTypes ?? service.serviceType);
        transaction.update(gemRef, {
          status: stage,
          stoneStage: stage,
          custody: null,
          currentLocation: null,
          currentHolderContactId: null,
          updatedAt: now,
        });
      }
    }
    transaction.update(serviceRef, updates);
    notification = {
      recipientUid: service.ownerUid,
      type: 'service_job_updated',
      title: status === 'returned' ? 'Gem returned from lapidary' : 'Workshop update',
      message: `Your service job is now ${status.replace('_', ' ')}.`,
      serviceId: id,
      actorName: service.providerBusinessName ?? service.providerName ?? 'Lapidary',
      actorPhotoUrl: service.providerBusinessLogoUrl,
      imageUrl: service.gemPhotoUrl,
      dedupeKey: `service_job_updated:${id}:${status}`,
    };
  });

  if (notification) await notifyServiceRequest(notification!);
  return { serviceId: id, status: nextStatus };
}

/**
 * Hide a terminal workshop job for its provider without deleting the shared
 * service record that the trader uses for service history and auditability.
 */
export async function deleteLapidaryJobForApi(
  serviceId: string,
  uid: string,
): Promise<{ serviceId: string; status: 'deleted' }> {
  const id = assertServiceId(serviceId);
  const serviceRef = db.collection('gemtrack_services').doc(id);

  await db.runTransaction(async (transaction) => {
    const serviceSnap = await transaction.get(serviceRef);
    if (!serviceSnap.exists) throw new ApiError('not-found', 'Service not found.');

    const service = serviceSnap.data() as ServiceRequestDoc;
    if (service.serviceKind !== 'lapidary_request' || service.providerUid !== uid) {
      throw new ApiError('permission-denied', 'Only the selected lapidary can delete this job.');
    }
    if (service.providerDeletedAt != null) return;
    if (!['cancelled', 'completed', 'received_back', 'returned'].includes(service.status)) {
      throw new ApiError(
        'failed-precondition',
        'Only cancelled or completed jobs can be deleted.',
      );
    }

    const now = Timestamp.now();
    transaction.update(serviceRef, {
      providerDeletedAt: now,
      providerDeletedByUid: uid,
      updatedAt: now,
    });
  });

  return { serviceId: id, status: 'deleted' };
}
