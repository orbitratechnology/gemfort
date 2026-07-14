import {
  addDoc,
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
import type {
  CertificationRequest,
  LapidaryJob,
  PublicCertificate,
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
  const ref = await addDoc(collection(getFirebaseDb(), 'service_requests'), {
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
  return ref.id;
}

export async function createCertificationRequest(input: {
  traderUid: string;
  traderBusinessId: string | null;
  labUid: string;
  labBusinessId: string;
  gemId: string;
  gemName: string;
  reportType: string;
  notes?: string;
}): Promise<string> {
  const now = nowTs();
  const ref = await addDoc(collection(getFirebaseDb(), 'certification_requests'), {
    ...input,
    notes: input.notes?.trim() || null,
    status: 'pending',
    certificateId: null,
    rejectReason: null,
    createdAt: now,
    updatedAt: now,
    respondedAt: null,
  });
  return ref.id;
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
    const jobRef = await addDoc(collection(getFirebaseDb(), 'lapidary_jobs'), {
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
    jobId = jobRef.id;

    await updateDoc(ref, {
      status: 'accepted',
      jobId,
      serviceRecordId: null,
      respondedAt: now,
      updatedAt: now,
    });
  } else {
    await updateDoc(ref, {
      status: 'rejected',
      rejectReason: rejectReason?.trim() || 'Declined',
      respondedAt: now,
      updatedAt: now,
    });
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
  await updateDoc(doc(getFirebaseDb(), 'lapidary_jobs', jobId), {
    status,
    updatedAt: nowTs(),
  });
}

export async function fetchOutgoingCertRequests(traderUid: string): Promise<CertificationRequest[]> {
  const q = query(
    collection(getFirebaseDb(), 'certification_requests'),
    where('traderUid', '==', traderUid),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CertificationRequest);
}

export async function fetchIncomingCertRequests(labUid: string): Promise<CertificationRequest[]> {
  const q = query(
    collection(getFirebaseDb(), 'certification_requests'),
    where('labUid', '==', labUid),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CertificationRequest);
}

export async function respondCertificationRequest(
  requestId: string,
  decision: 'accepted' | 'rejected',
  rejectReason?: string,
): Promise<void> {
  const ref = doc(getFirebaseDb(), 'certification_requests', requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Request not found');
  const data = snap.data() as CertificationRequest;
  if (data.status !== 'pending') throw new Error('Request already handled');
  const now = nowTs();
  await updateDoc(ref, {
    status: decision,
    rejectReason: decision === 'rejected' ? rejectReason?.trim() || 'Declined' : null,
    respondedAt: now,
    updatedAt: now,
  });
}

export async function publishCertificate(input: {
  labUid: string;
  labBusinessId: string;
  labName: string;
  certificateNumber: string;
  verificationCode?: string;
  reportType: string;
  fileUrl: string;
  fileType: string;
  gemId?: string | null;
  gemName?: string | null;
  traderUid?: string | null;
  certificationRequestId?: string | null;
  resultsSummary?: PublicCertificate['resultsSummary'];
}): Promise<string> {
  const now = nowTs();
  const ref = await addDoc(collection(getFirebaseDb(), 'certificates'), {
    labUid: input.labUid,
    labBusinessId: input.labBusinessId,
    labName: input.labName,
    certificateNumber: input.certificateNumber.trim(),
    verificationCode: input.verificationCode?.trim() || null,
    reportType: input.reportType,
    certificateDate: now,
    fileUrl: input.fileUrl,
    fileType: input.fileType,
    gemId: input.gemId ?? null,
    gemName: input.gemName ?? null,
    traderUid: input.traderUid ?? null,
    certificationRequestId: input.certificationRequestId ?? null,
    resultsSummary: input.resultsSummary ?? {
      weight: null,
      color: null,
      origin: null,
      treatment: null,
      clarity: null,
    },
    visibility: 'public',
    createdAt: now,
    updatedAt: now,
  });

  if (input.certificationRequestId) {
    await updateDoc(doc(getFirebaseDb(), 'certification_requests', input.certificationRequestId), {
      status: 'completed',
      certificateId: ref.id,
      updatedAt: now,
    });
  }

  return ref.id;
}

export async function fetchLabCertificates(labUid: string): Promise<PublicCertificate[]> {
  const q = query(
    collection(getFirebaseDb(), 'certificates'),
    where('labUid', '==', labUid),
    orderBy('createdAt', 'desc'),
    limit(100),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PublicCertificate);
}

export async function verifyCertificateByNumber(
  certificateNumber: string,
): Promise<PublicCertificate | null> {
  const q = query(
    collection(getFirebaseDb(), 'certificates'),
    where('certificateNumber', '==', certificateNumber.trim()),
    where('visibility', '==', 'public'),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as PublicCertificate;
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
  await addDoc(collection(getFirebaseDb(), 'notifications'), {
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
