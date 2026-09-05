import {
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
  orderBy,
  limit,
  getDoc,
} from '@/lib/firebase/db';
import { getFirebaseDb } from '@/lib/firebase/config';
import {
  forgetSync,
  queueDocCreate,
  queueDocUpdate,
} from '@/lib/firebase/local-write';
import type {
  LapidaryJob,
  ServiceRequest,
} from '@/types';

function nowTs() {
  return Timestamp.now();
}

export async function createServiceRequest(input: {
  traderUid: string;
  traderBusinessId: string | null;
  lapidaryUid: string;
  lapidaryBusinessId: string;
  gemId: string;
  gemName: string;
  serviceTypes: string[];
  notes?: string;
}): Promise<string> {
  const now = nowTs();
  const id = queueDocCreate('service_requests', {
    ...input,
    notes: input.notes?.trim() || null,
    status: 'pending',
    jobId: null,
    serviceRecordId: null,
    rejectReason: null,
    createdAt: now,
    updatedAt: now,
    respondedAt: null,
  });
  return id;
}

export async function fetchOutgoingServiceRequests(traderUid: string): Promise<ServiceRequest[]> {
  const q = query(
    collection(getFirebaseDb(), 'service_requests'),
    where('traderUid', '==', traderUid),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ServiceRequest);
}

export async function fetchIncomingServiceRequests(lapidaryUid: string): Promise<ServiceRequest[]> {
  const q = query(
    collection(getFirebaseDb(), 'service_requests'),
    where('lapidaryUid', '==', lapidaryUid),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ServiceRequest);
}

export async function respondServiceRequest(
  requestId: string,
  decision: 'accepted' | 'rejected',
  rejectReason?: string,
): Promise<{ jobId: string | null }> {
  const ref = doc(getFirebaseDb(), 'service_requests', requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Request not found');
  const data = snap.data() as ServiceRequest;
  if (data.status !== 'pending') throw new Error('Request already handled');

  const now = nowTs();
  let jobId: string | null = null;

  if (decision === 'accepted') {
    jobId = queueDocCreate('lapidary_jobs', {
      serviceRequestId: requestId,
      lapidaryUid: data.lapidaryUid,
      lapidaryBusinessId: data.lapidaryBusinessId,
      traderUid: data.traderUid,
      gemId: data.gemId,
      gemName: data.gemName,
      serviceTypes: data.serviceTypes,
      status: 'queued',
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    });

    forgetSync(
      updateDoc(ref, {
        status: 'accepted',
        jobId,
        serviceRecordId: null,
        respondedAt: now,
        updatedAt: now,
      }),
    );
  } else {
    forgetSync(
      updateDoc(ref, {
        status: 'rejected',
        rejectReason: rejectReason?.trim() || 'Declined',
        respondedAt: now,
        updatedAt: now,
      }),
    );
  }

  return { jobId };
}

export async function fetchLapidaryJobs(lapidaryUid: string): Promise<LapidaryJob[]> {
  const q = query(
    collection(getFirebaseDb(), 'lapidary_jobs'),
    where('lapidaryUid', '==', lapidaryUid),
    orderBy('createdAt', 'desc'),
    limit(100),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LapidaryJob);
}

export async function updateLapidaryJobStatus(
  jobId: string,
  status: LapidaryJob['status'],
): Promise<void> {
  queueDocUpdate('lapidary_jobs', jobId, {
      status,
      updatedAt: nowTs(),
    });
}

export async function createClientNotification(input: {
  recipientUid: string;
  type: string;
  title: string;
  message: string;
  referenceType?: string;
  referenceId?: string;
  priority?: 'high' | 'medium' | 'low';
}) {
  queueDocCreate('notifications', {
      recipientUid: input.recipientUid,
      type: input.type,
      title: input.title,
      message: input.message,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      priority: input.priority ?? 'medium',
      isRead: false,
      isPushSent: false,
      createdAt: nowTs(),
    });
}
