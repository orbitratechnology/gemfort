import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from '@/lib/firebase/db';
import { getFirebaseDb } from '@/lib/firebase/config';
import { calcWeightLossPercent, generateSku } from '@/lib/utils';
import type {
  ApRecord,
  Contact,
  GemCost,
  GemEvent,
  GemStatus,
  Payable,
  Receivable,
  ServiceRecord,
  Transaction,
  WorkspaceGem,
} from '@/types';

// ─── Gems ───────────────────────────────────────────

export async function fetchGems(ownerUid: string): Promise<WorkspaceGem[]> {
  const q = query(
    collection(getFirebaseDb(), 'gemtrack_gems'),
    where('ownerUid', '==', ownerUid),
    orderBy('updatedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WorkspaceGem);
}

export async function fetchGem(gemId: string): Promise<WorkspaceGem | null> {
  const snap = await getDoc(doc(getFirebaseDb(), 'gemtrack_gems', gemId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as WorkspaceGem;
}

export async function createGem(
  ownerUid: string,
  input: Partial<WorkspaceGem> & {
    gemType: string;
    originCountry: string;
    roughWeight: number;
    acquisitionCost: number;
  },
): Promise<string> {
  const existing = await fetchGems(ownerUid);
  const sku = generateSku(existing.length + 1);
  const now = Timestamp.now();
  const status: GemStatus = input.roughWeight > 0 ? 'rough' : 'ready_for_sale';

  const gemData = {
    ownerUid,
    companyId: null,
    sku,
    gemType: input.gemType,
    variety: input.variety ?? null,
    originCountry: input.originCountry,
    originMine: input.originMine ?? null,
    acquisitionType: input.acquisitionType ?? 'purchased',
    acquisitionDate: input.acquisitionDate ?? now,
    acquisitionCost: input.acquisitionCost,
    acquisitionCurrency: input.acquisitionCurrency ?? 'LKR',
    acquisitionCostBase: input.acquisitionCost,
    roughWeight: input.roughWeight,
    currentWeight: input.currentWeight ?? input.roughWeight,
    colorPrimary: input.colorPrimary ?? null,
    clarity: input.clarity ?? null,
    cutType: input.cutType ?? null,
    shape: input.shape ?? null,
    isNatural: input.isNatural ?? true,
    treatmentStatus: input.treatmentStatus ?? 'natural',
    treatmentDetails: input.treatmentDetails ?? null,
    status,
    currentLocation: null,
    currentHolderContactId: null,
    totalCost: input.acquisitionCost,
    totalCostCurrency: 'LKR',
    askingPrice: input.askingPrice ?? null,
    askingPriceCurrency: input.askingPriceCurrency ?? null,
    minimumPrice: input.minimumPrice ?? null,
    minimumPriceCurrency: input.minimumPriceCurrency ?? null,
    soldPrice: null,
    soldPriceCurrency: null,
    soldDate: null,
    photoUrls: input.photoUrls ?? [],
    isListedOnMarketplace: false,
    marketplaceListingId: null,
    notes: input.notes ?? null,
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };

  const ref = await addDoc(collection(getFirebaseDb(), 'gemtrack_gems'), gemData);

  await addDoc(collection(getFirebaseDb(), 'gemtrack_gem_events'), {
    gemId: ref.id,
    ownerUid,
    eventType: 'status_change',
    fromStatus: null,
    toStatus: status,
    description: 'Gem added to inventory',
    weightAtEvent: gemData.currentWeight,
    photoUrl: null,
    costAdded: input.acquisitionCost,
    relatedServiceId: null,
    relatedApId: null,
    createdByUid: ownerUid,
    createdAt: now,
  });

  await addDoc(collection(getFirebaseDb(), 'gemtrack_gem_costs'), {
    gemId: ref.id,
    ownerUid,
    costType: 'acquisition',
    description: 'Acquisition cost',
    amount: input.acquisitionCost,
    currency: 'LKR',
    amountBase: input.acquisitionCost,
    serviceRecordId: null,
    date: now,
    createdAt: now,
  });

  return ref.id;
}

export async function updateGemStatus(
  gemId: string,
  ownerUid: string,
  newStatus: GemStatus,
  description: string,
) {
  const gem = await fetchGem(gemId);
  if (!gem) throw new Error('Gem not found');
  const now = Timestamp.now();
  await updateDoc(doc(getFirebaseDb(), 'gemtrack_gems', gemId), {
    status: newStatus,
    updatedAt: now,
  });
  await addDoc(collection(getFirebaseDb(), 'gemtrack_gem_events'), {
    gemId,
    ownerUid,
    eventType: 'status_change',
    fromStatus: gem.status,
    toStatus: newStatus,
    description,
    weightAtEvent: gem.currentWeight,
    photoUrl: null,
    costAdded: null,
    relatedServiceId: null,
    relatedApId: null,
    createdByUid: ownerUid,
    createdAt: now,
  });
}

export async function fetchGemEvents(gemId: string): Promise<GemEvent[]> {
  const q = query(
    collection(getFirebaseDb(), 'gemtrack_gem_events'),
    where('gemId', '==', gemId),
    orderBy('createdAt', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GemEvent);
}

export async function fetchGemCosts(gemId: string): Promise<GemCost[]> {
  const q = query(collection(getFirebaseDb(), 'gemtrack_gem_costs'), where('gemId', '==', gemId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GemCost);
}

// ─── Services ───────────────────────────────────────

export async function fetchServices(ownerUid: string): Promise<ServiceRecord[]> {
  const q = query(
    collection(getFirebaseDb(), 'gemtrack_services'),
    where('ownerUid', '==', ownerUid),
    orderBy('updatedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ServiceRecord);
}

export async function createService(
  ownerUid: string,
  input: Omit<ServiceRecord, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt' | 'status' | 'dateReturned' | 'weightAfter' | 'weightLossPercent' | 'photoAfterUrls' | 'finalCost' | 'finalCostCurrency' | 'paymentStatus' | 'resultNotes'>,
) {
  const now = Timestamp.now();
  const ref = await addDoc(collection(getFirebaseDb(), 'gemtrack_services'), {
    ...input,
    ownerUid,
    status: 'given',
    dateReturned: null,
    weightAfter: null,
    weightLossPercent: null,
    photoAfterUrls: [],
    finalCost: null,
    finalCostCurrency: null,
    paymentStatus: 'unpaid',
    resultNotes: null,
    createdAt: now,
    updatedAt: now,
  });
  await updateGemStatus(input.gemId, ownerUid, 'with_cutter', `Sent for ${input.serviceType}`);
  return ref.id;
}

export async function completeService(
  serviceId: string,
  ownerUid: string,
  input: { weightAfter: number; finalCost: number; resultNotes?: string },
) {
  const snap = await getDoc(doc(getFirebaseDb(), 'gemtrack_services', serviceId));
  if (!snap.exists()) throw new Error('Service not found');
  const service = { id: snap.id, ...snap.data() } as ServiceRecord;
  const now = Timestamp.now();
  const weightLoss = calcWeightLossPercent(service.weightBefore, input.weightAfter);

  await updateDoc(doc(getFirebaseDb(), 'gemtrack_services', serviceId), {
    status: 'received_back',
    dateReturned: now,
    weightAfter: input.weightAfter,
    weightLossPercent: weightLoss,
    finalCost: input.finalCost,
    finalCostCurrency: 'LKR',
    paymentStatus: 'paid',
    resultNotes: input.resultNotes ?? null,
    updatedAt: now,
  });

  const gem = await fetchGem(service.gemId);
  if (gem) {
    const newTotal = gem.totalCost + input.finalCost;
    await updateDoc(doc(getFirebaseDb(), 'gemtrack_gems', service.gemId), {
      currentWeight: input.weightAfter,
      totalCost: newTotal,
      status: 'cut',
      updatedAt: now,
    });
    await addDoc(collection(getFirebaseDb(), 'gemtrack_gem_costs'), {
      gemId: service.gemId,
      ownerUid,
      costType: service.serviceType,
      description: `Service: ${service.serviceType}`,
      amount: input.finalCost,
      currency: 'LKR',
      amountBase: input.finalCost,
      serviceRecordId: serviceId,
      date: now,
      createdAt: now,
    });
    await addDoc(collection(getFirebaseDb(), 'gemtrack_gem_events'), {
      gemId: service.gemId,
      ownerUid,
      eventType: 'status_change',
      fromStatus: gem.status,
      toStatus: 'cut',
      description: `Returned from ${service.serviceType}. Weight: ${input.weightAfter} ct`,
      weightAtEvent: input.weightAfter,
      photoUrl: null,
      costAdded: input.finalCost,
      relatedServiceId: serviceId,
      relatedApId: null,
      createdByUid: ownerUid,
      createdAt: now,
    });
  }
}

// ─── AP ─────────────────────────────────────────────

export async function fetchApRecords(ownerUid: string): Promise<ApRecord[]> {
  const q = query(
    collection(getFirebaseDb(), 'gemtrack_ap_records'),
    where('ownerUid', '==', ownerUid),
    orderBy('updatedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ApRecord);
}

export async function createApRecord(
  ownerUid: string,
  input: {
    gemId: string;
    apHolderContactId: string;
    ownerMinimumPrice: number;
    expectedDurationDays: number;
    agreementNotes?: string;
  },
) {
  const now = Timestamp.now();
  const expectedReturn = Timestamp.fromDate(
    new Date(Date.now() + input.expectedDurationDays * 86400000),
  );
  const ref = await addDoc(collection(getFirebaseDb(), 'gemtrack_ap_records'), {
    ownerUid,
    gemId: input.gemId,
    apHolderContactId: input.apHolderContactId,
    ownerMinimumPrice: input.ownerMinimumPrice,
    currency: 'LKR',
    dateGiven: now,
    expectedDurationDays: input.expectedDurationDays,
    expectedReturnDate: expectedReturn,
    agreementNotes: input.agreementNotes ?? null,
    status: 'with_holder',
    soldPrice: null,
    ownerReceives: null,
    apHolderCommission: null,
    soldDate: null,
    paymentStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  });
  await updateDoc(doc(getFirebaseDb(), 'gemtrack_gems', input.gemId), {
    status: 'on_ap',
    currentHolderContactId: input.apHolderContactId,
    updatedAt: now,
  });
  return ref.id;
}

export async function recordApSale(
  apId: string,
  ownerUid: string,
  soldPrice: number,
) {
  const snap = await getDoc(doc(getFirebaseDb(), 'gemtrack_ap_records', apId));
  if (!snap.exists()) throw new Error('AP record not found');
  const ap = { id: snap.id, ...snap.data() } as ApRecord;
  const now = Timestamp.now();
  const commission = soldPrice - ap.ownerMinimumPrice;

  await updateDoc(doc(getFirebaseDb(), 'gemtrack_ap_records', apId), {
    status: 'sold',
    soldPrice,
    ownerReceives: ap.ownerMinimumPrice,
    apHolderCommission: commission,
    soldDate: now,
    paymentStatus: 'pending',
    updatedAt: now,
  });
  await updateDoc(doc(getFirebaseDb(), 'gemtrack_gems', ap.gemId), {
    status: 'sold',
    soldPrice,
    soldPriceCurrency: 'LKR',
    soldDate: now,
    updatedAt: now,
  });
}

export async function recordApReturn(apId: string, ownerUid: string) {
  const snap = await getDoc(doc(getFirebaseDb(), 'gemtrack_ap_records', apId));
  if (!snap.exists()) throw new Error('AP record not found');
  const ap = { id: snap.id, ...snap.data() } as ApRecord;
  const now = Timestamp.now();
  await updateDoc(doc(getFirebaseDb(), 'gemtrack_ap_records', apId), {
    status: 'returned',
    updatedAt: now,
  });
  await updateDoc(doc(getFirebaseDb(), 'gemtrack_gems', ap.gemId), {
    status: 'ready_for_sale',
    currentHolderContactId: null,
    updatedAt: now,
  });
}

// ─── Contacts ───────────────────────────────────────

export async function fetchContacts(ownerUid: string): Promise<Contact[]> {
  const q = query(collection(getFirebaseDb(), 'gemtrack_contacts'), where('ownerUid', '==', ownerUid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Contact)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function createContact(
  ownerUid: string,
  input: Omit<Contact, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>,
) {
  const now = Timestamp.now();
  const ref = await addDoc(collection(getFirebaseDb(), 'gemtrack_contacts'), {
    ...input,
    ownerUid,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateContact(contactId: string, data: Partial<Contact>) {
  await updateDoc(doc(getFirebaseDb(), 'gemtrack_contacts', contactId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteContact(contactId: string) {
  await deleteDoc(doc(getFirebaseDb(), 'gemtrack_contacts', contactId));
}

export async function fetchContactHistory(ownerUid: string, contactId: string) {
  const [services, apRecords] = await Promise.all([
    fetchServices(ownerUid),
    fetchApRecords(ownerUid),
  ]);
  return {
    services: services.filter((s) => s.providerContactId === contactId),
    apRecords: apRecords.filter((a) => a.apHolderContactId === contactId),
  };
}

// ─── Transactions ─────────────────────────────────

export async function fetchTransactions(ownerUid: string): Promise<Transaction[]> {
  const q = query(
    collection(getFirebaseDb(), 'gemtrack_transactions'),
    where('ownerUid', '==', ownerUid),
    orderBy('date', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction);
}

export async function createTransaction(
  ownerUid: string,
  input: Omit<Transaction, 'id' | 'ownerUid' | 'createdAt' | 'amountBase'>,
) {
  const now = Timestamp.now();
  const ref = await addDoc(collection(getFirebaseDb(), 'gemtrack_transactions'), {
    ...input,
    ownerUid,
    amountBase: input.amount,
    date: input.date ?? now,
    createdAt: now,
  });
  return ref.id;
}

// ─── Receivables / Payables ───────────────────────

export async function fetchReceivables(ownerUid: string): Promise<Receivable[]> {
  const q = query(collection(getFirebaseDb(), 'gemtrack_receivables'), where('ownerUid', '==', ownerUid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Receivable);
}

export async function fetchPayables(ownerUid: string): Promise<Payable[]> {
  const q = query(collection(getFirebaseDb(), 'gemtrack_payables'), where('ownerUid', '==', ownerUid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payable);
}

export async function createReceivable(
  ownerUid: string,
  input: Omit<Receivable, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt' | 'status' | 'amountReceived'>,
) {
  const now = Timestamp.now();
  return (
    await addDoc(collection(getFirebaseDb(), 'gemtrack_receivables'), {
      ...input,
      ownerUid,
      amountReceived: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
  ).id;
}

export async function createPayable(
  ownerUid: string,
  input: Omit<Payable, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt' | 'status' | 'amountPaid'>,
) {
  const now = Timestamp.now();
  return (
    await addDoc(collection(getFirebaseDb(), 'gemtrack_payables'), {
      ...input,
      ownerUid,
      amountPaid: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
  ).id;
}

export async function recordReceivablePayment(receivableId: string, paymentAmount: number) {
  if (paymentAmount <= 0) throw new Error('Payment amount must be positive');
  const ref = doc(getFirebaseDb(), 'gemtrack_receivables', receivableId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Receivable not found');
  const data = snap.data() as Receivable;
  const newReceived = Math.min(data.amount, data.amountReceived + paymentAmount);
  const status =
    newReceived >= data.amount ? 'paid' : newReceived > 0 ? 'partial' : 'pending';
  await updateDoc(ref, {
    amountReceived: newReceived,
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function recordPayablePayment(payableId: string, paymentAmount: number) {
  if (paymentAmount <= 0) throw new Error('Payment amount must be positive');
  const ref = doc(getFirebaseDb(), 'gemtrack_payables', payableId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Payable not found');
  const data = snap.data() as Payable;
  const newPaid = Math.min(data.amount, data.amountPaid + paymentAmount);
  const status = newPaid >= data.amount ? 'paid' : newPaid > 0 ? 'partial' : 'pending';
  await updateDoc(ref, {
    amountPaid: newPaid,
    status,
    updatedAt: serverTimestamp(),
  });
}

// ─── Listings ─────────────────────────────────────

export async function fetchListingBySlug(slug: string) {
  const q = query(
    collection(getFirebaseDb(), 'gems'),
    where('shareableSlug', '==', slug),
    where('status', '==', 'active'),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as import('@/types').MarketplaceListing;
}

export async function createListing(
  sellerUid: string,
  businessId: string,
  input: Record<string, unknown>,
) {
  const now = Timestamp.now();
  const countSnap = await getDocs(query(collection(getFirebaseDb(), 'gems'), where('sellerUid', '==', sellerUid)));
  const slug = `GF-L-${String(countSnap.size + 1).padStart(5, '0')}`;
  const ref = await addDoc(collection(getFirebaseDb(), 'gems'), {
    ...input,
    sellerUid,
    businessId,
    shareableSlug: slug,
    shareableUrl: `https://gemfort.app/l/${slug}`,
    status: 'active',
    soldAt: null,
    soldPrice: null,
    analytics: { totalViews: 0, whatsappTaps: 0 },
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  });
  return { id: ref.id, slug };
}

// ─── Notifications ────────────────────────────────

export async function fetchNotifications(recipientUid: string): Promise<import('@/types').AppNotification[]> {
  const q = query(
    collection(getFirebaseDb(), 'notifications'),
    where('recipientUid', '==', recipientUid),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as import('@/types').AppNotification);
}

export async function createNotification(
  recipientUid: string,
  input: { type: string; title: string; message: string; referenceType?: string; referenceId?: string },
) {
  const now = Timestamp.now();
  await addDoc(collection(getFirebaseDb(), 'notifications'), {
    recipientUid,
    ...input,
    referenceType: input.referenceType ?? null,
    referenceId: input.referenceId ?? null,
    isRead: false,
    isPushSent: false,
    createdAt: now,
  });
}

export async function markNotificationRead(notifId: string) {
  await updateDoc(doc(getFirebaseDb(), 'notifications', notifId), { isRead: true });
}

export async function markAllNotificationsRead(recipientUid: string) {
  const q = query(
    collection(getFirebaseDb(), 'notifications'),
    where('recipientUid', '==', recipientUid),
    where('isRead', '==', false),
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { isRead: true })));
}

// ─── Verification ─────────────────────────────────

export async function submitVerificationApplication(
  applicantUid: string,
  input: Record<string, unknown>,
) {
  const now = Timestamp.now();
  const applicationId = (
    await addDoc(collection(getFirebaseDb(), 'verification_applications'), {
      applicantUid,
      ...input,
      status: 'pending',
      adminUid: null,
      adminNotes: '',
      submittedAt: now,
    })
  ).id;

  await updateDoc(doc(getFirebaseDb(), 'users', applicantUid), {
    verificationStatus: 'pending',
    updatedAt: serverTimestamp(),
  });

  return applicationId;
}

// ─── Overdue detection ────────────────────────────

export function detectOverdueServices(services: ServiceRecord[]): ServiceRecord[] {
  const now = Date.now();
  return services.filter(
    (s) =>
      s.status === 'given' &&
      s.expectedReturnDate.toDate().getTime() < now,
  );
}

export function detectOverdueAp(apRecords: ApRecord[]): ApRecord[] {
  const now = Date.now();
  return apRecords.filter(
    (a) =>
      a.status === 'with_holder' &&
      a.expectedReturnDate.toDate().getTime() < now,
  );
}
