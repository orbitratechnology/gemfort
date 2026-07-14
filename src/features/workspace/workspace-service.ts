import { normalizePhoneKey } from "@/features/workspace/device-contacts-service";
import { convertToBase } from "@/lib/exchange-rates";
import { getFirebaseDb } from "@/lib/firebase/config";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where,
} from "@/lib/firebase/db";
import { uploadBlobToStorage } from "@/lib/firebase/storage-upload";
import { calcWeightLossPercent, generateSku } from "@/lib/utils";
import type {
    ApRecord,
    Cheque,
    ChequeDirection,
    ChequeStatus,
    Contact,
    GemCost,
    GemEvent,
    GemStatus,
    Payable,
    Payment,
    Receivable,
    ServiceRecord,
    Transaction,
    Trip,
    TripExpense,
    TripGem,
    TripStatus,
    TripType,
    WorkspaceGem,
} from "@/types";

// ─── Gems ───────────────────────────────────────────

export async function fetchGems(ownerUid: string): Promise<WorkspaceGem[]> {
  const q = query(
    collection(getFirebaseDb(), "gemtrack_gems"),
    where("ownerUid", "==", ownerUid),
    orderBy("updatedAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WorkspaceGem);
}

export async function fetchGem(gemId: string): Promise<WorkspaceGem | null> {
  const snap = await getDoc(doc(getFirebaseDb(), "gemtrack_gems", gemId));
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
  const status: GemStatus = input.roughWeight > 0 ? "rough" : "ready_for_sale";

  const gemData = {
    ownerUid,
    companyId: null,
    sku,
    gemType: input.gemType,
    variety: input.variety ?? null,
    originCountry: input.originCountry,
    originMine: input.originMine ?? null,
    acquisitionType: input.acquisitionType ?? "purchased",
    acquisitionDate: input.acquisitionDate ?? now,
    acquisitionCost: input.acquisitionCost,
    acquisitionCurrency: input.acquisitionCurrency ?? "LKR",
    acquisitionCostBase: input.acquisitionCost,
    roughWeight: input.roughWeight,
    currentWeight: input.currentWeight ?? input.roughWeight,
    colorPrimary: input.colorPrimary ?? null,
    clarity: input.clarity ?? null,
    cutType: input.cutType ?? null,
    shape: input.shape ?? null,
    isNatural: input.isNatural ?? true,
    treatmentStatus: input.treatmentStatus ?? "natural",
    treatmentDetails: input.treatmentDetails ?? null,
    status,
    currentLocation: null,
    currentHolderContactId: null,
    totalCost: input.acquisitionCost,
    totalCostCurrency: "LKR",
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

  const ref = await addDoc(
    collection(getFirebaseDb(), "gemtrack_gems"),
    gemData,
  );

  await addDoc(collection(getFirebaseDb(), "gemtrack_gem_events"), {
    gemId: ref.id,
    ownerUid,
    eventType: "status_change",
    fromStatus: null,
    toStatus: status,
    description: "Gem added to inventory",
    weightAtEvent: gemData.currentWeight,
    photoUrl: null,
    costAdded: input.acquisitionCost,
    relatedServiceId: null,
    relatedApId: null,
    createdByUid: ownerUid,
    createdAt: now,
  });

  await addDoc(collection(getFirebaseDb(), "gemtrack_gem_costs"), {
    gemId: ref.id,
    ownerUid,
    costType: "acquisition",
    description: "Acquisition cost",
    amount: input.acquisitionCost,
    currency: "LKR",
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
  if (!gem) throw new Error("Gem not found");
  const now = Timestamp.now();
  await updateDoc(doc(getFirebaseDb(), "gemtrack_gems", gemId), {
    status: newStatus,
    updatedAt: now,
  });
  await addDoc(collection(getFirebaseDb(), "gemtrack_gem_events"), {
    gemId,
    ownerUid,
    eventType: "status_change",
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
    collection(getFirebaseDb(), "gemtrack_gem_events"),
    where("gemId", "==", gemId),
    orderBy("createdAt", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GemEvent);
}

export async function fetchGemCosts(gemId: string): Promise<GemCost[]> {
  const q = query(
    collection(getFirebaseDb(), "gemtrack_gem_costs"),
    where("gemId", "==", gemId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GemCost);
}

// ─── Services ───────────────────────────────────────

export async function fetchServices(
  ownerUid: string,
): Promise<ServiceRecord[]> {
  const q = query(
    collection(getFirebaseDb(), "gemtrack_services"),
    where("ownerUid", "==", ownerUid),
    orderBy("updatedAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ServiceRecord);
}

export async function createService(
  ownerUid: string,
  input: Omit<
    ServiceRecord,
    | "id"
    | "ownerUid"
    | "createdAt"
    | "updatedAt"
    | "status"
    | "dateReturned"
    | "weightAfter"
    | "weightLossPercent"
    | "photoAfterUrls"
    | "finalCost"
    | "finalCostCurrency"
    | "paymentStatus"
    | "resultNotes"
  >,
) {
  const now = Timestamp.now();
  const ref = await addDoc(collection(getFirebaseDb(), "gemtrack_services"), {
    ...input,
    ownerUid,
    status: "given",
    dateReturned: null,
    weightAfter: null,
    weightLossPercent: null,
    photoAfterUrls: [],
    finalCost: null,
    finalCostCurrency: null,
    paymentStatus: "unpaid",
    resultNotes: null,
    createdAt: now,
    updatedAt: now,
  });
  await updateGemStatus(
    input.gemId,
    ownerUid,
    "with_cutter",
    `Sent for ${input.serviceType}`,
  );
  return ref.id;
}

export async function completeService(
  serviceId: string,
  ownerUid: string,
  input: { weightAfter: number; finalCost: number; resultNotes?: string },
) {
  const snap = await getDoc(
    doc(getFirebaseDb(), "gemtrack_services", serviceId),
  );
  if (!snap.exists()) throw new Error("Service not found");
  const service = { id: snap.id, ...snap.data() } as ServiceRecord;
  const now = Timestamp.now();
  const weightLoss = calcWeightLossPercent(
    service.weightBefore,
    input.weightAfter,
  );

  await updateDoc(doc(getFirebaseDb(), "gemtrack_services", serviceId), {
    status: "received_back",
    dateReturned: now,
    weightAfter: input.weightAfter,
    weightLossPercent: weightLoss,
    finalCost: input.finalCost,
    finalCostCurrency: "LKR",
    paymentStatus: "paid",
    resultNotes: input.resultNotes ?? null,
    updatedAt: now,
  });

  const gem = await fetchGem(service.gemId);
  if (gem) {
    const newTotal = gem.totalCost + input.finalCost;
    await updateDoc(doc(getFirebaseDb(), "gemtrack_gems", service.gemId), {
      currentWeight: input.weightAfter,
      totalCost: newTotal,
      status: "cut",
      updatedAt: now,
    });
    await addDoc(collection(getFirebaseDb(), "gemtrack_gem_costs"), {
      gemId: service.gemId,
      ownerUid,
      costType: service.serviceType,
      description: `Service: ${service.serviceType}`,
      amount: input.finalCost,
      currency: "LKR",
      amountBase: input.finalCost,
      serviceRecordId: serviceId,
      date: now,
      createdAt: now,
    });
    await addDoc(collection(getFirebaseDb(), "gemtrack_gem_events"), {
      gemId: service.gemId,
      ownerUid,
      eventType: "status_change",
      fromStatus: gem.status,
      toStatus: "cut",
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
    collection(getFirebaseDb(), "gemtrack_ap_records"),
    where("ownerUid", "==", ownerUid),
    orderBy("updatedAt", "desc"),
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
  const ref = await addDoc(collection(getFirebaseDb(), "gemtrack_ap_records"), {
    ownerUid,
    gemId: input.gemId,
    apHolderContactId: input.apHolderContactId,
    ownerMinimumPrice: input.ownerMinimumPrice,
    currency: "LKR",
    dateGiven: now,
    expectedDurationDays: input.expectedDurationDays,
    expectedReturnDate: expectedReturn,
    agreementNotes: input.agreementNotes ?? null,
    status: "with_holder",
    soldPrice: null,
    ownerReceives: null,
    apHolderCommission: null,
    soldDate: null,
    paymentStatus: "pending",
    createdAt: now,
    updatedAt: now,
  });
  await updateDoc(doc(getFirebaseDb(), "gemtrack_gems", input.gemId), {
    status: "on_ap",
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
  const snap = await getDoc(doc(getFirebaseDb(), "gemtrack_ap_records", apId));
  if (!snap.exists()) throw new Error("AP record not found");
  const ap = { id: snap.id, ...snap.data() } as ApRecord;
  const now = Timestamp.now();
  const commission = soldPrice - ap.ownerMinimumPrice;

  await updateDoc(doc(getFirebaseDb(), "gemtrack_ap_records", apId), {
    status: "sold",
    soldPrice,
    ownerReceives: ap.ownerMinimumPrice,
    apHolderCommission: commission,
    soldDate: now,
    paymentStatus: "pending",
    updatedAt: now,
  });
  await updateDoc(doc(getFirebaseDb(), "gemtrack_gems", ap.gemId), {
    status: "sold",
    soldPrice,
    soldPriceCurrency: "LKR",
    soldDate: now,
    updatedAt: now,
  });
}

export async function recordApReturn(apId: string, ownerUid: string) {
  const snap = await getDoc(doc(getFirebaseDb(), "gemtrack_ap_records", apId));
  if (!snap.exists()) throw new Error("AP record not found");
  const ap = { id: snap.id, ...snap.data() } as ApRecord;
  const now = Timestamp.now();
  await updateDoc(doc(getFirebaseDb(), "gemtrack_ap_records", apId), {
    status: "returned",
    updatedAt: now,
  });
  await updateDoc(doc(getFirebaseDb(), "gemtrack_gems", ap.gemId), {
    status: "ready_for_sale",
    currentHolderContactId: null,
    updatedAt: now,
  });
}

// ─── Contacts ───────────────────────────────────────

export async function fetchContacts(ownerUid: string): Promise<Contact[]> {
  const q = query(
    collection(getFirebaseDb(), "gemtrack_contacts"),
    where("ownerUid", "==", ownerUid),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        contactTypes: Array.isArray(data.contactTypes) ? data.contactTypes : [],
        photoUrl: data.photoUrl ?? null,
        deviceContactId: data.deviceContactId ?? null,
      } as Contact;
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function createContact(
  ownerUid: string,
  input: Omit<Contact, "id" | "ownerUid" | "createdAt" | "updatedAt">,
) {
  const now = Timestamp.now();
  const ref = await addDoc(collection(getFirebaseDb(), "gemtrack_contacts"), {
    displayName: input.displayName,
    companyName: input.companyName ?? null,
    phone: input.phone ?? null,
    whatsapp: input.whatsapp ?? null,
    email: input.email ?? null,
    contactTypes: input.contactTypes ?? [],
    notes: input.notes ?? null,
    isFavourite: input.isFavourite ?? false,
    photoUrl: input.photoUrl ?? null,
    deviceContactId: input.deviceContactId ?? null,
    ownerUid,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

/**
 * Import one device contact into GemFort workspace contacts.
 * Uploads thumbnail when present. Skips if already linked by deviceContactId or phone.
 */
export async function importDeviceContactToWorkspace(
  ownerUid: string,
  device: {
    id: string;
    displayName: string;
    companyName: string | null;
    phone: string | null;
    email: string | null;
    imageUri: string | null;
  },
  options?: {
    contactTypes?: string[];
    existing?: Contact[];
  },
): Promise<{ id: string; created: boolean }> {
  const existing = options?.existing ?? (await fetchContacts(ownerUid));
  const byDevice = existing.find((c) => c.deviceContactId === device.id);
  if (byDevice) return { id: byDevice.id, created: false };

  const phoneKey = normalizePhoneKey(device.phone);
  if (phoneKey) {
    const byPhone = existing.find(
      (c) => normalizePhoneKey(c.phone) === phoneKey,
    );
    if (byPhone) {
      // Link device id + refresh photo if missing
      const updates: Partial<Contact> = { deviceContactId: device.id };
      if (!byPhone.photoUrl && device.imageUri) {
        updates.photoUrl = await uploadContactPhoto(
          ownerUid,
          device.id,
          device.imageUri,
        );
      }
      await updateContact(byPhone.id, updates);
      return { id: byPhone.id, created: false };
    }
  }

  let photoUrl: string | null = null;
  if (device.imageUri) {
    photoUrl = await uploadContactPhoto(ownerUid, device.id, device.imageUri);
  }

  const id = await createContact(ownerUid, {
    displayName: device.displayName,
    companyName: device.companyName,
    phone: device.phone,
    whatsapp: device.phone,
    email: device.email,
    contactTypes: options?.contactTypes?.length
      ? options.contactTypes
      : ["broker"],
    notes: null,
    isFavourite: false,
    photoUrl,
    deviceContactId: device.id,
  });
  return { id, created: true };
}

export async function importDeviceContactsBatch(
  ownerUid: string,
  devices: {
    id: string;
    displayName: string;
    companyName: string | null;
    phone: string | null;
    email: string | null;
    imageUri: string | null;
  }[],
  contactTypes?: string[],
): Promise<{ created: number; linked: number }> {
  let existing = await fetchContacts(ownerUid);
  let created = 0;
  let linked = 0;
  for (const device of devices) {
    const result = await importDeviceContactToWorkspace(ownerUid, device, {
      contactTypes,
      existing,
    });
    if (result.created) {
      created += 1;
      // Keep local list fresh for subsequent duplicate checks
      existing = [
        ...existing,
        {
          id: result.id,
          ownerUid,
          displayName: device.displayName,
          companyName: device.companyName,
          phone: device.phone,
          whatsapp: device.phone,
          email: device.email,
          contactTypes: contactTypes?.length ? contactTypes : ["broker"],
          notes: null,
          isFavourite: false,
          photoUrl: null,
          deviceContactId: device.id,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
      ];
    } else {
      linked += 1;
    }
  }
  return { created, linked };
}

async function uploadContactPhoto(
  ownerUid: string,
  deviceContactId: string,
  localUri: string,
): Promise<string> {
  const ext = localUri.split("?")[0]?.split(".").pop()?.toLowerCase();
  const safeExt = ext && ext.length <= 5 ? ext : "jpg";
  return uploadBlobToStorage(
    localUri,
    `users/${ownerUid}/contacts/${deviceContactId}.${safeExt}`,
  );
}

export async function updateContact(contactId: string, data: Partial<Contact>) {
  await updateDoc(doc(getFirebaseDb(), "gemtrack_contacts", contactId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteContact(contactId: string) {
  await deleteDoc(doc(getFirebaseDb(), "gemtrack_contacts", contactId));
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

export async function fetchTransactions(
  ownerUid: string,
): Promise<Transaction[]> {
  const q = query(
    collection(getFirebaseDb(), "gemtrack_transactions"),
    where("ownerUid", "==", ownerUid),
    orderBy("date", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction);
}

export async function createTransaction(
  ownerUid: string,
  input: Omit<Transaction, "id" | "ownerUid" | "createdAt" | "amountBase"> & {
    amountBase?: number;
  },
) {
  const now = Timestamp.now();
  const amountBase =
    input.amountBase ??
    (input.currency && input.currency !== "LKR"
      ? await convertToBase(input.amount, input.currency)
      : input.amount);
  const ref = await addDoc(
    collection(getFirebaseDb(), "gemtrack_transactions"),
    {
      ...input,
      ownerUid,
      amountBase,
      date: input.date ?? now,
      createdAt: now,
    },
  );
  return ref.id;
}

// ─── Receivables / Payables ───────────────────────

export async function fetchReceivables(
  ownerUid: string,
): Promise<Receivable[]> {
  const q = query(
    collection(getFirebaseDb(), "gemtrack_receivables"),
    where("ownerUid", "==", ownerUid),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Receivable);
}

export async function fetchPayables(ownerUid: string): Promise<Payable[]> {
  const q = query(
    collection(getFirebaseDb(), "gemtrack_payables"),
    where("ownerUid", "==", ownerUid),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payable);
}

export async function createReceivable(
  ownerUid: string,
  input: Omit<
    Receivable,
    "id" | "ownerUid" | "createdAt" | "updatedAt" | "status" | "amountReceived"
  >,
) {
  const now = Timestamp.now();
  return (
    await addDoc(collection(getFirebaseDb(), "gemtrack_receivables"), {
      ...input,
      ownerUid,
      amountReceived: 0,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
  ).id;
}

export async function createPayable(
  ownerUid: string,
  input: Omit<
    Payable,
    "id" | "ownerUid" | "createdAt" | "updatedAt" | "status" | "amountPaid"
  >,
) {
  const now = Timestamp.now();
  return (
    await addDoc(collection(getFirebaseDb(), "gemtrack_payables"), {
      ...input,
      ownerUid,
      amountPaid: 0,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
  ).id;
}

export async function recordReceivablePayment(
  ownerUid: string,
  receivableId: string,
  paymentAmount: number,
  options?: {
    currency?: string;
    paymentMethod?: string | null;
    commission?: number | null;
    notes?: string | null;
  },
) {
  if (paymentAmount <= 0) throw new Error("Payment amount must be positive");
  const ref = doc(getFirebaseDb(), "gemtrack_receivables", receivableId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Receivable not found");
  const data = snap.data() as Receivable;
  const newReceived = Math.min(
    data.amount,
    data.amountReceived + paymentAmount,
  );
  const status =
    newReceived >= data.amount
      ? "paid"
      : newReceived > 0
        ? "partial"
        : "pending";
  const now = Timestamp.now();
  const currency = options?.currency ?? data.currency ?? "LKR";

  await updateDoc(ref, {
    amountReceived: newReceived,
    status,
    updatedAt: serverTimestamp(),
  });

  const amountBase = await convertToBase(paymentAmount, currency);
  const txnId = await createTransaction(ownerUid, {
    type: "income",
    amount: paymentAmount,
    currency,
    amountBase,
    category: "other_income",
    description: `Payment received: ${data.description}`,
    gemId: null,
    contactId: data.contactId,
    date: now,
  });

  await addDoc(collection(getFirebaseDb(), "gemtrack_payments"), {
    ownerUid,
    direction: "in",
    amount: paymentAmount,
    currency,
    amountBase,
    paymentMethod: options?.paymentMethod ?? null,
    commission: options?.commission ?? null,
    receivableId,
    payableId: null,
    gemId: null,
    contactId: data.contactId,
    transactionId: txnId,
    notes: options?.notes ?? null,
    paymentDate: now,
    createdAt: now,
  });
}

export async function recordPayablePayment(
  ownerUid: string,
  payableId: string,
  paymentAmount: number,
  options?: {
    currency?: string;
    paymentMethod?: string | null;
    commission?: number | null;
    notes?: string | null;
  },
) {
  if (paymentAmount <= 0) throw new Error("Payment amount must be positive");
  const ref = doc(getFirebaseDb(), "gemtrack_payables", payableId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Payable not found");
  const data = snap.data() as Payable;
  const newPaid = Math.min(data.amount, data.amountPaid + paymentAmount);
  const status =
    newPaid >= data.amount ? "paid" : newPaid > 0 ? "partial" : "pending";
  const now = Timestamp.now();
  const currency = options?.currency ?? data.currency ?? "LKR";

  await updateDoc(ref, {
    amountPaid: newPaid,
    status,
    updatedAt: serverTimestamp(),
  });

  const amountBase = await convertToBase(paymentAmount, currency);
  const txnId = await createTransaction(ownerUid, {
    type: "expense",
    amount: paymentAmount,
    currency,
    amountBase,
    category: "other_expense",
    description: `Payment made: ${data.description}`,
    gemId: null,
    contactId: data.contactId,
    date: now,
  });

  await addDoc(collection(getFirebaseDb(), "gemtrack_payments"), {
    ownerUid,
    direction: "out",
    amount: paymentAmount,
    currency,
    amountBase,
    paymentMethod: options?.paymentMethod ?? null,
    commission: options?.commission ?? null,
    receivableId: null,
    payableId,
    gemId: null,
    contactId: data.contactId,
    transactionId: txnId,
    notes: options?.notes ?? null,
    paymentDate: now,
    createdAt: now,
  });
}

export async function fetchPayments(ownerUid: string): Promise<Payment[]> {
  const q = query(
    collection(getFirebaseDb(), "gemtrack_payments"),
    where("ownerUid", "==", ownerUid),
    orderBy("paymentDate", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment);
}

// ─── Cheques ──────────────────────────────────────

export async function fetchCheques(ownerUid: string): Promise<Cheque[]> {
  const q = query(
    collection(getFirebaseDb(), "gemtrack_cheques"),
    where("ownerUid", "==", ownerUid),
    orderBy("maturityDate", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Cheque);
}

export async function fetchCheque(chequeId: string): Promise<Cheque | null> {
  const snap = await getDoc(doc(getFirebaseDb(), "gemtrack_cheques", chequeId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Cheque;
}

export async function createCheque(
  ownerUid: string,
  input: {
    direction: ChequeDirection;
    chequeNumber: string;
    bankName: string;
    bankCode?: string | null;
    branch?: string | null;
    amount: number;
    currency?: string;
    counterpartyContactId: string;
    issuedBy: string;
    issueDate: Timestamp;
    maturityDate: Timestamp;
    status?: ChequeStatus;
    photoUrl?: string | null;
    gemId?: string | null;
    apRecordId?: string | null;
    notes?: string | null;
  },
): Promise<string> {
  const now = Timestamp.now();
  const ref = await addDoc(collection(getFirebaseDb(), "gemtrack_cheques"), {
    ownerUid,
    direction: input.direction,
    chequeNumber: input.chequeNumber.trim(),
    bankName: input.bankName.trim(),
    bankCode: input.bankCode?.trim() ?? null,
    branch: input.branch?.trim() ?? null,
    amount: input.amount,
    currency: input.currency ?? "LKR",
    amountBase: input.amount,
    counterpartyContactId: input.counterpartyContactId,
    issuedBy: input.issuedBy.trim(),
    issueDate: input.issueDate,
    maturityDate: input.maturityDate,
    depositedDate: null,
    clearedDate: null,
    status: input.status ?? "holding",
    bouncedReason: null,
    replacementChequeId: null,
    photoUrl: input.photoUrl ?? null,
    gemId: input.gemId ?? null,
    apRecordId: input.apRecordId ?? null,
    tripId: null,
    notes: input.notes?.trim() ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateCheque(
  chequeId: string,
  data: Partial<
    Pick<
      Cheque,
      | "chequeNumber"
      | "bankName"
      | "branch"
      | "amount"
      | "amountBase"
      | "issuedBy"
      | "issueDate"
      | "maturityDate"
      | "photoUrl"
      | "notes"
    >
  >,
) {
  const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (data.chequeNumber !== undefined)
    updates.chequeNumber = data.chequeNumber.trim();
  if (data.bankName !== undefined) updates.bankName = data.bankName.trim();
  if (data.branch !== undefined) updates.branch = data.branch?.trim() ?? null;
  if (data.amount !== undefined) {
    updates.amount = data.amount;
    updates.amountBase = data.amountBase ?? data.amount;
  }
  if (data.issuedBy !== undefined) updates.issuedBy = data.issuedBy.trim();
  if (data.issueDate !== undefined) updates.issueDate = data.issueDate;
  if (data.maturityDate !== undefined) updates.maturityDate = data.maturityDate;
  if (data.photoUrl !== undefined) updates.photoUrl = data.photoUrl;
  if (data.notes !== undefined) updates.notes = data.notes?.trim() ?? null;
  await updateDoc(doc(getFirebaseDb(), "gemtrack_cheques", chequeId), updates);
}

export async function updateChequeStatus(
  chequeId: string,
  status: ChequeStatus,
  extra?: { bouncedReason?: string; replacementChequeId?: string },
) {
  const now = Timestamp.now();
  const updates: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };
  if (status === "deposited") updates.depositedDate = now;
  if (status === "cleared") {
    updates.clearedDate = now;
    updates.depositedDate = updates.depositedDate ?? now;
  }
  if (status === "bounced" && extra?.bouncedReason) {
    updates.bouncedReason = extra.bouncedReason.trim();
  }
  if (status === "replaced" && extra?.replacementChequeId) {
    updates.replacementChequeId = extra.replacementChequeId;
  }
  await updateDoc(doc(getFirebaseDb(), "gemtrack_cheques", chequeId), updates);
}

// ─── Trips ────────────────────────────────────────

const EMPTY_TRIP_SUMMARY = {
  totalExpenses: 0,
  totalGemsPurchased: 0,
  totalGemsSold: 0,
  totalRevenue: 0,
  netResult: 0,
  gemsOnAp: 0,
  gemsReturned: 0,
};

export async function fetchTrips(ownerUid: string): Promise<Trip[]> {
  const q = query(
    collection(getFirebaseDb(), "gemtrack_trips"),
    where("ownerUid", "==", ownerUid),
    orderBy("startDate", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trip);
}

export async function fetchTrip(tripId: string): Promise<Trip | null> {
  const snap = await getDoc(doc(getFirebaseDb(), "gemtrack_trips", tripId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Trip;
}

export async function createTrip(
  ownerUid: string,
  input: {
    tripName: string;
    tripType: TripType;
    destinationCountry: string;
    destinationCity: string;
    startDate: Timestamp;
    expectedEndDate: Timestamp;
    budget?: number;
    budgetCurrency?: string;
    cashCarried?: number;
    notes?: string | null;
  },
): Promise<string> {
  const now = Timestamp.now();
  const ref = await addDoc(collection(getFirebaseDb(), "gemtrack_trips"), {
    ownerUid,
    companyId: null,
    tripName: input.tripName.trim(),
    tripType: input.tripType,
    destinationCountry: input.destinationCountry.trim(),
    destinationCity: input.destinationCity.trim(),
    startDate: input.startDate,
    expectedEndDate: input.expectedEndDate,
    actualEndDate: null,
    budget: input.budget ?? 0,
    budgetCurrency: input.budgetCurrency ?? "LKR",
    cashCarried: input.cashCarried ?? 0,
    status: "planning" as TripStatus,
    summary: { ...EMPTY_TRIP_SUMMARY },
    notes: input.notes?.trim() ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateTripStatus(tripId: string, status: TripStatus) {
  const updates: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };
  if (status === "completed") updates.actualEndDate = Timestamp.now();
  await updateDoc(doc(getFirebaseDb(), "gemtrack_trips", tripId), updates);
}

export async function fetchTripExpenses(
  tripId: string,
): Promise<TripExpense[]> {
  const q = query(
    collection(getFirebaseDb(), "gemtrack_trip_expenses"),
    where("tripId", "==", tripId),
    orderBy("date", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TripExpense);
}

export async function addTripExpense(
  ownerUid: string,
  tripId: string,
  input: {
    category: string;
    amount: number;
    currency?: string;
    description?: string | null;
    date?: Timestamp;
    paymentMethod?: string | null;
    receiptPhotoUrl?: string | null;
  },
): Promise<string> {
  const now = Timestamp.now();
  const ref = await addDoc(
    collection(getFirebaseDb(), "gemtrack_trip_expenses"),
    {
      tripId,
      ownerUid,
      date: input.date ?? now,
      category: input.category,
      description: input.description?.trim() ?? null,
      amount: input.amount,
      currency: input.currency ?? "LKR",
      amountBase: input.amount,
      paymentMethod: input.paymentMethod ?? null,
      receiptPhotoUrl: input.receiptPhotoUrl ?? null,
      createdAt: now,
    },
  );

  await createTransaction(ownerUid, {
    type: "expense",
    amount: input.amount,
    currency: input.currency ?? "LKR",
    category: "trip_expense",
    description: input.description?.trim() || `Trip expense: ${input.category}`,
    gemId: null,
    contactId: null,
    date: input.date ?? now,
  });

  await refreshTripSummary(tripId, ownerUid);
  return ref.id;
}

export async function fetchTripGems(tripId: string): Promise<TripGem[]> {
  const q = query(
    collection(getFirebaseDb(), "gemtrack_trip_gems"),
    where("tripId", "==", tripId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TripGem);
}

async function refreshTripSummary(tripId: string, ownerUid: string) {
  const [expenses, tripGems] = await Promise.all([
    fetchTripExpenses(tripId),
    fetchTripGems(tripId),
  ]);
  const purchases = tripGems.filter((tg) => tg.role === "purchase");
  const parcels = tripGems.filter((tg) => tg.role === "parcel");
  const sold = parcels.filter((tg) => tg.status === "sold");
  const totalExpenses = expenses.reduce((s, e) => s + e.amountBase, 0);
  const purchaseSpend = purchases.reduce(
    (s, tg) => s + (tg.purchaseCost ?? 0),
    0,
  );
  const totalRevenue = sold.reduce((s, tg) => s + (tg.salePrice ?? 0), 0);

  await updateDoc(doc(getFirebaseDb(), "gemtrack_trips", tripId), {
    summary: {
      totalExpenses,
      totalGemsPurchased: purchases.length,
      totalGemsSold: sold.length,
      totalRevenue,
      netResult: totalRevenue - totalExpenses - purchaseSpend,
      gemsOnAp: 0,
      gemsReturned: tripGems.filter((tg) => tg.status === "returned").length,
    },
    updatedAt: serverTimestamp(),
  });
}

export async function createGemOnSourcingTrip(
  ownerUid: string,
  tripId: string,
  input: {
    gemType: string;
    originCountry: string;
    roughWeight: number;
    acquisitionCost: number;
    notes?: string | null;
  },
): Promise<string> {
  const gemId = await createGem(ownerUid, {
    gemType: input.gemType,
    originCountry: input.originCountry,
    roughWeight: input.roughWeight,
    acquisitionCost: input.acquisitionCost,
    notes: input.notes ?? `Purchased on trip`,
  });

  const now = Timestamp.now();
  await addDoc(collection(getFirebaseDb(), "gemtrack_trip_gems"), {
    tripId,
    ownerUid,
    gemId,
    role: "purchase",
    purchaseCost: input.acquisitionCost,
    salePrice: null,
    saleDate: null,
    status: "on_trip",
    createdAt: now,
    updatedAt: now,
  });

  await refreshTripSummary(tripId, ownerUid);
  return gemId;
}

export async function addGemsToSellingTrip(
  ownerUid: string,
  tripId: string,
  gemIds: string[],
): Promise<void> {
  const now = Timestamp.now();
  await Promise.all(
    gemIds.map(async (gemId) => {
      await addDoc(collection(getFirebaseDb(), "gemtrack_trip_gems"), {
        tripId,
        ownerUid,
        gemId,
        role: "parcel",
        purchaseCost: null,
        salePrice: null,
        saleDate: null,
        status: "on_trip",
        createdAt: now,
        updatedAt: now,
      });
      await updateGemStatus(
        gemId,
        ownerUid,
        "on_trip",
        "Added to selling trip parcel",
      );
    }),
  );
  await refreshTripSummary(tripId, ownerUid);
}

export async function recordTripGemSale(
  ownerUid: string,
  tripId: string,
  tripGemId: string,
  gemId: string,
  salePrice: number,
): Promise<void> {
  const now = Timestamp.now();
  await updateDoc(doc(getFirebaseDb(), "gemtrack_trip_gems", tripGemId), {
    salePrice,
    saleDate: now,
    status: "sold",
    updatedAt: serverTimestamp(),
  });
  await updateGemStatus(
    gemId,
    ownerUid,
    "sold",
    `Sold on trip for ${salePrice}`,
  );
  await createTransaction(ownerUid, {
    type: "income",
    amount: salePrice,
    currency: "LKR",
    category: "gem_sale",
    description: "Sale during selling trip",
    gemId,
    contactId: null,
    date: now,
  });
  await refreshTripSummary(tripId, ownerUid);
}

export async function distributeTripOverhead(
  ownerUid: string,
  tripId: string,
): Promise<number> {
  const [expenses, tripGems] = await Promise.all([
    fetchTripExpenses(tripId),
    fetchTripGems(tripId),
  ]);
  const purchases = tripGems.filter((tg) => tg.role === "purchase");
  if (purchases.length === 0)
    throw new Error("No gems purchased on this trip to allocate overhead.");
  const overhead = expenses.reduce((s, e) => s + e.amountBase, 0);
  if (overhead <= 0) throw new Error("No trip expenses to distribute.");

  const totalPurchase = purchases.reduce(
    (s, tg) => s + (tg.purchaseCost ?? 0),
    0,
  );
  const now = Timestamp.now();
  let distributed = 0;

  for (const tg of purchases) {
    const share =
      totalPurchase > 0
        ? (overhead * (tg.purchaseCost ?? 0)) / totalPurchase
        : overhead / purchases.length;
    if (share <= 0) continue;

    const gem = await fetchGem(tg.gemId);
    if (!gem) continue;

    await addDoc(collection(getFirebaseDb(), "gemtrack_gem_costs"), {
      gemId: tg.gemId,
      ownerUid,
      costType: "trip_overhead",
      description: "Trip overhead allocation",
      amount: share,
      currency: "LKR",
      amountBase: share,
      serviceRecordId: null,
      date: now,
      createdAt: now,
    });

    await updateDoc(doc(getFirebaseDb(), "gemtrack_gems", tg.gemId), {
      totalCost: gem.totalCost + share,
      updatedAt: serverTimestamp(),
    });
    distributed += share;
  }

  return distributed;
}

// ─── Listings ─────────────────────────────────────

export async function fetchListingBySlug(slug: string) {
  const q = query(
    collection(getFirebaseDb(), "gems"),
    where("shareableSlug", "==", slug),
    where("status", "==", "active"),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as import("@/types").MarketplaceListing;
}

export async function createListing(
  sellerUid: string,
  businessId: string,
  input: Record<string, unknown>,
) {
  const now = Timestamp.now();
  const countSnap = await getDocs(
    query(
      collection(getFirebaseDb(), "gems"),
      where("sellerUid", "==", sellerUid),
    ),
  );
  const slug = `GF-L-${String(countSnap.size + 1).padStart(5, "0")}`;
  const ref = await addDoc(collection(getFirebaseDb(), "gems"), {
    ...input,
    sellerUid,
    businessId,
    shareableSlug: slug,
    shareableUrl: `https://gemfort.app/l/${slug}`,
    status: "active",
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

export async function fetchNotifications(
  recipientUid: string,
): Promise<import("@/types").AppNotification[]> {
  const q = query(
    collection(getFirebaseDb(), "notifications"),
    where("recipientUid", "==", recipientUid),
    orderBy("createdAt", "desc"),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as import("@/types").AppNotification,
  );
}

export async function createNotification(
  recipientUid: string,
  input: {
    type: string;
    title: string;
    message: string;
    referenceType?: string;
    referenceId?: string;
  },
) {
  /** @deprecated Notifications are created by Cloud Functions only. */
  const now = Timestamp.now();
  await addDoc(collection(getFirebaseDb(), "notifications"), {
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
  await updateDoc(doc(getFirebaseDb(), "notifications", notifId), {
    isRead: true,
  });
}

export async function markAllNotificationsRead(recipientUid: string) {
  const q = query(
    collection(getFirebaseDb(), "notifications"),
    where("recipientUid", "==", recipientUid),
    where("isRead", "==", false),
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
    await addDoc(collection(getFirebaseDb(), "verification_applications"), {
      applicantUid,
      ...input,
      status: "pending",
      adminUid: null,
      adminNotes: "",
      submittedAt: now,
    })
  ).id;

  await updateDoc(doc(getFirebaseDb(), "users", applicantUid), {
    verificationStatus: "pending",
    updatedAt: serverTimestamp(),
  });

  return applicationId;
}

// ─── Overdue detection ────────────────────────────

export function detectOverdueServices(
  services: ServiceRecord[],
): ServiceRecord[] {
  const now = Date.now();
  return services.filter(
    (s) =>
      s.status === "given" && s.expectedReturnDate.toDate().getTime() < now,
  );
}

export function detectOverdueAp(apRecords: ApRecord[]): ApRecord[] {
  const now = Date.now();
  return apRecords.filter(
    (a) =>
      a.status === "with_holder" &&
      a.expectedReturnDate.toDate().getTime() < now,
  );
}
