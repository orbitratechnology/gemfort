import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  getDoc,
} from '@/lib/firebase/db';
import { getFirebaseDb } from '@/lib/firebase/config';
import { callApi } from '@/lib/api/api-client';
import type {
  LapidaryJob,
  RequestStatus,
  ServiceRequest,
} from '@/types';

export async function createServiceRequest(input: {
  traderUid: string;
  traderBusinessId: string | null;
  lapidaryUid: string;
  lapidaryBusinessId: string;
  gemId: string;
  gemName: string;
  gemPhotoUrl?: string | null;
  serviceTypes: string[];
  notes?: string;
  expectedReturnDays?: number;
  weightBefore?: number;
  providerName?: string | null;
  providerBusinessName?: string | null;
  providerBusinessLogoUrl?: string | null;
  traderBusinessName?: string | null;
  traderBusinessLogoUrl?: string | null;
}): Promise<string> {
  const result = await callApi<
    { serviceId: string; status: 'pending' },
    Omit<typeof input, 'traderUid'>
  >('/v1/services/requests', {
    traderBusinessId: input.traderBusinessId,
    lapidaryUid: input.lapidaryUid,
    lapidaryBusinessId: input.lapidaryBusinessId,
    gemId: input.gemId,
    gemName: input.gemName,
    gemPhotoUrl: input.gemPhotoUrl ?? null,
    serviceTypes: input.serviceTypes,
    notes: input.notes ?? null,
    expectedReturnDays: input.expectedReturnDays ?? 14,
    weightBefore: input.weightBefore ?? 0,
    providerName: input.providerName ?? null,
    providerBusinessName: input.providerBusinessName ?? null,
    providerBusinessLogoUrl: input.providerBusinessLogoUrl ?? null,
    traderBusinessName: input.traderBusinessName ?? null,
    traderBusinessLogoUrl: input.traderBusinessLogoUrl ?? null,
  }, {
    retryAuthOn401: true,
    idempotencyKey: `mobile-service-request-${input.gemId}-${input.lapidaryBusinessId}-${Date.now().toString(36)}`.slice(0, 128),
  });
  return result.serviceId;
}

function rawServiceTypes(data: Record<string, unknown>): string[] {
  if (Array.isArray(data.serviceTypes)) {
    return data.serviceTypes.filter((value): value is string => typeof value === 'string');
  }
  return typeof data.serviceType === 'string' ? [data.serviceType] : [];
}

function requestStatus(data: Record<string, unknown>): RequestStatus {
  const value = data.requestStatus ?? data.status;
  if (value === 'pending' || value === 'accepted' || value === 'rejected' || value === 'cancelled' || value === 'completed') {
    return value;
  }
  return 'accepted';
}

export function mapServiceToRequest(
  id: string,
  data: Record<string, unknown>,
): ServiceRequest {
  return {
    id,
    traderUid: String(data.traderUid ?? data.ownerUid ?? ''),
    traderBusinessId: (data.traderBusinessId as string | null | undefined) ?? null,
    traderBusinessName: (data.traderBusinessName as string | null | undefined) ?? null,
    lapidaryUid: String(data.lapidaryUid ?? data.providerUid ?? ''),
    lapidaryBusinessId: String(data.lapidaryBusinessId ?? data.providerBusinessId ?? ''),
    gemId: String(data.gemId ?? ''),
    gemName: String(data.gemName ?? 'Gem'),
    gemPhotoUrl: (data.gemPhotoUrl as string | null | undefined) ?? null,
    serviceTypes: rawServiceTypes(data),
    notes: (data.notes as string | null | undefined) ?? (data.instructions as string | null | undefined) ?? null,
    status: requestStatus(data),
    jobId: (data.jobId as string | null | undefined) ??
      (data.status !== 'pending' && data.status !== 'rejected' ? id : null),
    serviceRecordId: (data.serviceRecordId as string | null | undefined) ?? id,
    rejectReason: (data.rejectReason as string | null | undefined) ?? null,
    createdAt: data.createdAt as ServiceRequest['createdAt'],
    updatedAt: data.updatedAt as ServiceRequest['updatedAt'],
    respondedAt: (data.respondedAt as ServiceRequest['respondedAt']) ?? null,
  };
}

function jobStatus(data: Record<string, unknown>): LapidaryJob['status'] | null {
  switch (data.status) {
    case 'given':
    case 'queued':
      return 'queued';
    case 'in_progress':
      return 'in_progress';
    case 'ready':
      return 'ready';
    case 'received_back':
    case 'completed':
    case 'returned':
      return 'returned';
    case 'cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

export function mapServiceToLapidaryJob(
  id: string,
  data: Record<string, unknown>,
): LapidaryJob | null {
  if (data.serviceKind !== 'lapidary_request') return null;
  if (data.providerDeletedAt != null) return null;
  const status = jobStatus(data);
  if (!status) return null;
  const request = mapServiceToRequest(id, data);
  return {
    id,
    serviceRequestId: id,
    lapidaryUid: request.lapidaryUid,
    lapidaryBusinessId: request.lapidaryBusinessId,
    traderUid: request.traderUid,
    traderBusinessName: request.traderBusinessName,
    gemId: request.gemId,
    gemName: request.gemName,
    gemPhotoUrl: request.gemPhotoUrl,
    serviceTypes: request.serviceTypes,
    status,
    notes: request.notes,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export async function fetchServiceRequestById(
  requestId: string,
): Promise<ServiceRequest | null> {
  const snap = await getDoc(
    doc(getFirebaseDb(), 'gemtrack_services', requestId),
  );
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  return data.serviceKind === 'lapidary_request'
    ? mapServiceToRequest(snap.id, data)
    : null;
}

export async function fetchOutgoingServiceRequests(traderUid: string): Promise<ServiceRequest[]> {
  const q = query(
    collection(getFirebaseDb(), 'gemtrack_services'),
    where('ownerUid', '==', traderUid),
    orderBy('updatedAt', 'desc'),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
    .filter(({ data }) => data.serviceKind === 'lapidary_request')
    .map(({ id, data }) => mapServiceToRequest(id, data));
}

export async function fetchIncomingServiceRequests(lapidaryUid: string): Promise<ServiceRequest[]> {
  const q = query(
    collection(getFirebaseDb(), 'gemtrack_services'),
    where('providerUid', '==', lapidaryUid),
    orderBy('updatedAt', 'desc'),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
    .filter(({ data }) => data.serviceKind === 'lapidary_request')
    .map(({ id, data }) => mapServiceToRequest(id, data));
}

export async function respondServiceRequest(
  requestId: string,
  decision: 'accepted' | 'rejected',
  rejectReason?: string,
): Promise<{ jobId: string | null }> {
  const result = await callApi<
    { serviceId: string; status: 'given' | 'rejected' },
    { action: 'accepted' | 'rejected'; rejectReason?: string }
  >(`/v1/services/${encodeURIComponent(requestId)}/request/respond`, {
    action: decision,
    rejectReason: rejectReason?.trim() || undefined,
  }, {
    retryAuthOn401: true,
    idempotencyKey: `mobile-service-request-${decision}-${requestId}-${Date.now().toString(36)}`.slice(0, 128),
  });
  return { jobId: result.status === 'given' ? requestId : null };
}

export async function fetchLapidaryJobs(lapidaryUid: string): Promise<LapidaryJob[]> {
  const q = query(
    collection(getFirebaseDb(), 'gemtrack_services'),
    where('providerUid', '==', lapidaryUid),
    orderBy('updatedAt', 'desc'),
    limit(100),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => mapServiceToLapidaryJob(d.id, d.data() as Record<string, unknown>))
    .filter((job): job is LapidaryJob => job != null);
}

export async function updateLapidaryJobStatus(
  jobId: string,
  status: LapidaryJob['status'],
): Promise<void> {
  await callApi<{ serviceId: string; status: 'in_progress' | 'ready' | 'received_back' }, { status: 'in_progress' | 'ready' | 'returned' }>(
    `/v1/services/${encodeURIComponent(jobId)}/status`,
    { status: status === 'returned' ? 'returned' : status },
    {
      retryAuthOn401: true,
      idempotencyKey: `mobile-service-status-${status}-${jobId}-${Date.now().toString(36)}`.slice(0, 128),
    },
  );
}

export async function completeLapidaryJob(
  jobId: string,
  input: {
    weightAfter: number;
    finalCost: number;
    paymentDueDate: Date;
    currency?: string;
  },
): Promise<void> {
  await callApi<
    { serviceId: string; status: 'ready' },
    {
      weightAfter: number;
      finalCost: number;
      paymentDueDateIso: string;
      currency?: string;
    }
  >(`/v1/services/${encodeURIComponent(jobId)}/complete`, {
    weightAfter: input.weightAfter,
    finalCost: input.finalCost,
    paymentDueDateIso: input.paymentDueDate.toISOString(),
    currency: input.currency,
  }, {
    retryAuthOn401: true,
    idempotencyKey: `mobile-service-complete-${jobId}-${Date.now().toString(36)}`.slice(0, 128),
  });
}

/**
 * Removes a terminal job from the provider's workshop view while preserving
 * the sender's shared service history in `gemtrack_services`.
 */
export async function deleteLapidaryJob(jobId: string): Promise<void> {
  await callApi<{ serviceId: string; status: 'deleted' }, undefined>(
    `/v1/services/${encodeURIComponent(jobId)}/job`,
    undefined,
    {
      method: 'DELETE',
      retryAuthOn401: true,
      idempotencyKey: `mobile-service-job-delete-${jobId}-${Date.now().toString(36)}`.slice(0, 128),
    },
  );
}
