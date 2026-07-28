import { normalizeApRecord } from '@/features/workspace/ap-normalize';
import { pickPrimaryBusiness } from '@/features/marketplace/marketplace-service';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/config';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from '@/lib/firebase/db';
import type {
  Announcement,
  ApRecord,
  AppNotification,
  Bill,
  Business,
  Cheque,
  Contact,
  GemCost,
  GemEvent,
  LapidaryJob,
  MarketplaceListing,
  Payable,
  Payment,
  PublicCertificate,
  Receivable,
  ServiceRecord,
  ServiceRequest,
  Transaction,
  Trip,
  TripExpense,
  TripGem,
  WorkspaceGem,
} from '@/types';

type ErrCb = (error: Error) => void;
type Unsub = () => void;

function asError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

function listenCollection<T>(
  q: ReturnType<typeof query>,
  map: (docs: { id: string; data: () => Record<string, unknown> }[]) => T,
  onData: (data: T) => void,
  onError?: ErrCb,
): Unsub {
  return onSnapshot(
    q,
    (snap) => {
      onData(
        map(
          snap.docs.map((d) => ({
            id: d.id,
            data: () => d.data() as Record<string, unknown>,
          })),
        ),
      );
    },
    (err) => onError?.(asError(err)),
  );
}

function listenDoc<T>(
  ref: ReturnType<typeof doc>,
  map: (id: string, data: Record<string, unknown> | undefined, exists: boolean) => T,
  onData: (data: T) => void,
  onError?: ErrCb,
): Unsub {
  return onSnapshot(
    ref,
    (snap) => {
      onData(
        map(
          snap.id,
          snap.exists() ? (snap.data() as Record<string, unknown>) : undefined,
          snap.exists(),
        ),
      );
    },
    (err) => onError?.(asError(err)),
  );
}

function mapBill(id: string, raw: Record<string, unknown>): Bill {
  return {
    id,
    ...raw,
    jobId: (raw.jobId as string | null | undefined) ?? null,
    gemIds:
      Array.isArray(raw.gemIds) && raw.gemIds.length > 0
        ? raw.gemIds
        : raw.gemId
          ? [raw.gemId]
          : [],
  } as Bill;
}

function mapContact(id: string, data: Record<string, unknown>): Contact {
  return {
    id,
    ...data,
    contactTypes: Array.isArray(data.contactTypes) ? data.contactTypes : [],
    photoUrl: data.photoUrl ?? null,
    deviceContactId: data.deviceContactId ?? null,
    linkedBusinessId: data.linkedBusinessId ?? null,
    linkedBusinessName: data.linkedBusinessName ?? null,
    linkedBusinessType: data.linkedBusinessType ?? null,
  } as Contact;
}

// ─── Gems ───────────────────────────────────────────

export function subscribeGems(
  ownerUid: string,
  onData: (gems: WorkspaceGem[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gemtrack_gems'),
      where('ownerUid', '==', ownerUid),
      orderBy('updatedAt', 'desc'),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as WorkspaceGem),
    onData,
    onError,
  );
}

export function subscribeGem(
  gemId: string,
  onData: (gem: WorkspaceGem | null) => void,
  onError?: ErrCb,
): Unsub {
  return listenDoc(
    doc(getFirebaseDb(), 'gemtrack_gems', gemId),
    (id, data, exists) => (exists && data ? ({ id, ...data } as WorkspaceGem) : null),
    onData,
    onError,
  );
}

export function subscribeGemEvents(
  gemId: string,
  onData: (events: GemEvent[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gemtrack_gem_events'),
      where('gemId', '==', gemId),
      orderBy('createdAt', 'asc'),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as GemEvent),
    onData,
    onError,
  );
}

export function subscribeGemCosts(
  gemId: string,
  onData: (costs: GemCost[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gemtrack_gem_costs'),
      where('gemId', '==', gemId),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as GemCost),
    onData,
    onError,
  );
}

// ─── Services ───────────────────────────────────────

export function subscribeServices(
  ownerUid: string,
  onData: (services: ServiceRecord[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gemtrack_services'),
      where('ownerUid', '==', ownerUid),
      orderBy('updatedAt', 'desc'),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as ServiceRecord),
    onData,
    onError,
  );
}

export function subscribeService(
  serviceId: string,
  onData: (service: ServiceRecord | null) => void,
  onError?: ErrCb,
): Unsub {
  return listenDoc(
    doc(getFirebaseDb(), 'gemtrack_services', serviceId),
    (id, data, exists) =>
      exists && data ? ({ id, ...data } as ServiceRecord) : null,
    onData,
    onError,
  );
}

export function subscribeProviderServices(
  providerUid: string,
  onData: (services: ServiceRecord[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gemtrack_services'),
      where('providerUid', '==', providerUid),
      orderBy('updatedAt', 'desc'),
      limit(50),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as ServiceRecord),
    onData,
    onError,
  );
}

// ─── AP ─────────────────────────────────────────────

export function subscribeGivenApRecords(
  uid: string,
  onData: (records: ApRecord[]) => void,
  onError?: ErrCb,
): Unsub {
  const db = getFirebaseDb();
  const bySender = query(
    collection(db, 'gemtrack_ap_records'),
    where('senderUid', '==', uid),
    orderBy('updatedAt', 'desc'),
  );
  const byOwner = query(
    collection(db, 'gemtrack_ap_records'),
    where('ownerUid', '==', uid),
    orderBy('updatedAt', 'desc'),
  );

  let senderDocs: ApRecord[] | null = null;
  let ownerDocs: ApRecord[] | null = null;
  let senderFailed = false;

  const emit = () => {
    // Match fetchGivenApRecords: prefer senderUid results when non-empty;
    // otherwise fall back to legacy ownerUid docs.
    if (!senderFailed && senderDocs !== null && senderDocs.length > 0) {
      onData(senderDocs);
      return;
    }
    if (ownerDocs !== null) {
      onData(ownerDocs);
      return;
    }
    if (!senderFailed && senderDocs !== null) {
      onData(senderDocs);
    }
  };

  const u1 = onSnapshot(
    bySender,
    (snap) => {
      senderFailed = false;
      senderDocs = snap.docs.map((d) =>
        normalizeApRecord({ id: d.id, ...d.data() } as ApRecord),
      );
      emit();
    },
    () => {
      senderFailed = true;
      senderDocs = null;
      emit();
    },
  );
  const u2 = onSnapshot(
    byOwner,
    (snap) => {
      ownerDocs = snap.docs.map((d) =>
        normalizeApRecord({ id: d.id, ...d.data() } as ApRecord),
      );
      emit();
    },
    (err) => onError?.(asError(err)),
  );

  return () => {
    u1();
    u2();
  };
}

export function subscribeTakenApRecords(
  uid: string,
  onData: (records: ApRecord[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gemtrack_ap_records'),
      where('receiverUid', '==', uid),
      orderBy('updatedAt', 'desc'),
    ),
    (docs) =>
      docs.map((d) =>
        normalizeApRecord({ id: d.id, ...d.data() } as ApRecord),
      ),
    onData,
    onError,
  );
}

export function subscribeApRecordsForUser(
  uid: string,
  onData: (records: ApRecord[]) => void,
  onError?: ErrCb,
): Unsub {
  let given: ApRecord[] = [];
  let taken: ApRecord[] = [];

  const emit = () => {
    const map = new Map<string, ApRecord>();
    for (const r of [...given, ...taken]) map.set(r.id, r);
    onData(
      [...map.values()].sort(
        (a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis(),
      ),
    );
  };

  const u1 = subscribeGivenApRecords(
    uid,
    (rows) => {
      given = rows;
      emit();
    },
    onError,
  );
  const u2 = subscribeTakenApRecords(
    uid,
    (rows) => {
      taken = rows;
      emit();
    },
    () => {
      taken = [];
      emit();
    },
  );

  return () => {
    u1();
    u2();
  };
}

// ─── Contacts ───────────────────────────────────────

export function subscribeContacts(
  ownerUid: string,
  onData: (contacts: Contact[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gemtrack_contacts'),
      where('ownerUid', '==', ownerUid),
    ),
    (docs) =>
      docs
        .map((d) => mapContact(d.id, d.data()))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    onData,
    onError,
  );
}

// ─── Money ──────────────────────────────────────────

export function subscribeTransactions(
  ownerUid: string,
  onData: (rows: Transaction[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gemtrack_transactions'),
      where('ownerUid', '==', ownerUid),
      orderBy('date', 'desc'),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction),
    onData,
    onError,
  );
}

export function subscribeReceivables(
  ownerUid: string,
  onData: (rows: Receivable[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gemtrack_receivables'),
      where('ownerUid', '==', ownerUid),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as Receivable),
    onData,
    onError,
  );
}

export function subscribePayables(
  ownerUid: string,
  onData: (rows: Payable[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gemtrack_payables'),
      where('ownerUid', '==', ownerUid),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as Payable),
    onData,
    onError,
  );
}

export function subscribePayments(
  ownerUid: string,
  onData: (rows: Payment[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gemtrack_payments'),
      where('ownerUid', '==', ownerUid),
      orderBy('paymentDate', 'desc'),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as Payment),
    onData,
    onError,
  );
}

// ─── Bills ──────────────────────────────────────────

export function subscribeBills(
  ownerUid: string,
  onData: (bills: Bill[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gemtrack_bills'),
      where('ownerUid', '==', ownerUid),
      orderBy('dueDate', 'asc'),
    ),
    (docs) => docs.map((d) => mapBill(d.id, d.data())),
    onData,
    onError,
  );
}

export function subscribeBill(
  billId: string,
  onData: (bill: Bill | null) => void,
  onError?: ErrCb,
): Unsub {
  return listenDoc(
    doc(getFirebaseDb(), 'gemtrack_bills', billId),
    (id, data, exists) => (exists && data ? mapBill(id, data) : null),
    onData,
    onError,
  );
}

// ─── Cheques ────────────────────────────────────────

export function subscribeCheques(
  ownerUid: string,
  onData: (cheques: Cheque[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gemtrack_cheques'),
      where('ownerUid', '==', ownerUid),
      orderBy('maturityDate', 'asc'),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as Cheque),
    onData,
    onError,
  );
}

export function subscribeCheque(
  chequeId: string,
  onData: (cheque: Cheque | null) => void,
  onError?: ErrCb,
): Unsub {
  return listenDoc(
    doc(getFirebaseDb(), 'gemtrack_cheques', chequeId),
    (id, data, exists) => (exists && data ? ({ id, ...data } as Cheque) : null),
    onData,
    onError,
  );
}

// ─── Trips ──────────────────────────────────────────

export function subscribeTrips(
  ownerUid: string,
  onData: (trips: Trip[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gemtrack_trips'),
      where('ownerUid', '==', ownerUid),
      orderBy('startDate', 'desc'),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as Trip),
    onData,
    onError,
  );
}

export function subscribeTrip(
  tripId: string,
  onData: (trip: Trip | null) => void,
  onError?: ErrCb,
): Unsub {
  return listenDoc(
    doc(getFirebaseDb(), 'gemtrack_trips', tripId),
    (id, data, exists) => (exists && data ? ({ id, ...data } as Trip) : null),
    onData,
    onError,
  );
}

export function subscribeTripExpenses(
  tripId: string,
  ownerUid: string,
  onData: (expenses: TripExpense[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gemtrack_trip_expenses'),
      where('ownerUid', '==', ownerUid),
      where('tripId', '==', tripId),
      orderBy('date', 'desc'),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as TripExpense),
    onData,
    onError,
  );
}

export function subscribeTripGems(
  tripId: string,
  ownerUid: string,
  onData: (gems: TripGem[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gemtrack_trip_gems'),
      where('ownerUid', '==', ownerUid),
      where('tripId', '==', tripId),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as TripGem),
    onData,
    onError,
  );
}

// ─── Notifications ──────────────────────────────────

export function subscribeNotifications(
  recipientUid: string,
  onData: (rows: AppNotification[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'notifications'),
      where('recipientUid', '==', recipientUid),
      orderBy('createdAt', 'desc'),
      limit(50),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification),
    onData,
    onError,
  );
}

// ─── Marketplace / directory ────────────────────────

export function subscribeAnnouncements(
  onData: (rows: Announcement[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'announcements'),
      where('isVisible', '==', true),
      orderBy('publishedAt', 'desc'),
      limit(50),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as Announcement),
    onData,
    onError,
  );
}

export function subscribeVerifiedBusinesses(
  onData: (rows: Business[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'businesses'),
      where('verificationStatus', '==', 'verified'),
      where('isActive', '==', true),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as Business),
    onData,
    onError,
  );
}

export function subscribeBusiness(
  businessId: string,
  onData: (business: Business | null) => void,
  onError?: ErrCb,
): Unsub {
  return listenDoc(
    doc(getFirebaseDb(), 'businesses', businessId),
    (id, data, exists) =>
      exists && data ? ({ id, ...data } as Business) : null,
    onData,
    onError,
  );
}

export function subscribeBusinessByOwnerUid(
  ownerUid: string,
  onData: (business: Business | null) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'businesses'),
      where('ownerUid', '==', ownerUid),
    ),
    (docs) => {
      const items = docs.map((d) => ({ id: d.id, ...d.data() }) as Business);
      return pickPrimaryBusiness(items);
    },
    onData,
    onError,
  );
}

export function subscribePublicListings(
  onData: (rows: MarketplaceListing[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gems'),
      where('visibility', '==', 'public'),
      where('status', '==', 'active'),
      limit(50),
    ),
    (docs) =>
      docs.map((d) => ({ id: d.id, ...d.data() }) as MarketplaceListing),
    onData,
    onError,
  );
}

export function subscribeListingBySlug(
  slug: string,
  onData: (listing: MarketplaceListing | null) => void,
  onError?: ErrCb,
): Unsub {
  const normalized = slug.trim();
  if (!normalized) {
    onData(null);
    return () => undefined;
  }

  const visibilities: Array<
    'public' | 'contacts' | 'private' | 'members_only'
  > = ['public', 'private', 'members_only'];
  try {
    if (getFirebaseAuth().currentUser) visibilities.push('contacts');
  } catch {
    // Auth unavailable — public + legacy link visibilities only.
  }

  return listenCollection(
    query(
      collection(getFirebaseDb(), 'gems'),
      where('shareableSlug', '==', normalized),
      where('status', '==', 'active'),
      where('visibility', 'in', visibilities),
      limit(1),
    ),
    (docs) => {
      if (docs.length === 0) return null;
      const d = docs[0]!;
      return { id: d.id, ...d.data() } as MarketplaceListing;
    },
    onData,
    onError,
  );
}

// ─── Jobs / requests / certificates ─────────────────

export function subscribeOutgoingServiceRequests(
  traderUid: string,
  onData: (rows: ServiceRequest[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'service_requests'),
      where('traderUid', '==', traderUid),
      orderBy('createdAt', 'desc'),
      limit(50),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as ServiceRequest),
    onData,
    onError,
  );
}

export function subscribeIncomingServiceRequests(
  lapidaryUid: string,
  onData: (rows: ServiceRequest[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'service_requests'),
      where('lapidaryUid', '==', lapidaryUid),
      orderBy('createdAt', 'desc'),
      limit(50),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as ServiceRequest),
    onData,
    onError,
  );
}

export function subscribeLapidaryJobs(
  lapidaryUid: string,
  onData: (rows: LapidaryJob[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'lapidary_jobs'),
      where('lapidaryUid', '==', lapidaryUid),
      orderBy('createdAt', 'desc'),
      limit(100),
    ),
    (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as LapidaryJob),
    onData,
    onError,
  );
}

export function subscribeLabCertificates(
  labUid: string,
  onData: (rows: PublicCertificate[]) => void,
  onError?: ErrCb,
): Unsub {
  return listenCollection(
    query(
      collection(getFirebaseDb(), 'certificates'),
      where('labUid', '==', labUid),
      orderBy('createdAt', 'desc'),
      limit(100),
    ),
    (docs) =>
      docs.map((d) => ({ id: d.id, ...d.data() }) as PublicCertificate),
    onData,
    onError,
  );
}

export function subscribeGemsByIds(
  gemIds: string[],
  onData: (gems: WorkspaceGem[]) => void,
  onError?: ErrCb,
): Unsub {
  const unique = [...new Set(gemIds.filter(Boolean))];
  if (unique.length === 0) {
    onData([]);
    return () => undefined;
  }

  const byId = new Map<string, WorkspaceGem | null>();
  const unsubs: Unsub[] = [];

  const emit = () => {
    onData(
      unique
        .map((id) => byId.get(id))
        .filter((g): g is WorkspaceGem => g != null),
    );
  };

  for (const id of unique) {
    unsubs.push(
      subscribeGem(
        id,
        (gem) => {
          byId.set(id, gem);
          emit();
        },
        onError,
      ),
    );
  }

  return () => {
    for (const u of unsubs) u();
  };
}

export function subscribeBusinessesByOwnerUids(
  ownerUids: string[],
  onData: (byUid: Record<string, Business | null>) => void,
  onError?: ErrCb,
): Unsub {
  const unique = [...new Set(ownerUids.filter(Boolean))];
  if (unique.length === 0) {
    onData({});
    return () => undefined;
  }

  const byUid: Record<string, Business | null> = {};
  const unsubs: Unsub[] = [];

  const emit = () => {
    onData({ ...byUid });
  };

  for (const uid of unique) {
    unsubs.push(
      subscribeBusinessByOwnerUid(
        uid,
        (biz) => {
          byUid[uid] = biz;
          emit();
        },
        onError,
      ),
    );
  }

  return () => {
    for (const u of unsubs) u();
  };
}

export function subscribeExchangeRates(
  onData: (data: {
    rates: Record<string, number>;
    updatedAt: number;
    provider: string;
  } | null) => void,
  onError?: ErrCb,
): Unsub {
  return listenDoc(
    doc(getFirebaseDb(), 'system', 'exchange_rates'),
    (_id, data, exists) => {
      if (!exists || !data?.rates) return null;
      let updatedAt = Date.now();
      const raw = data.updatedAt as
        | { toMillis?: () => number }
        | number
        | undefined;
      if (typeof raw === 'number') updatedAt = raw;
      else if (raw?.toMillis) updatedAt = raw.toMillis();
      return {
        rates: data.rates as Record<string, number>,
        updatedAt,
        provider: (data.provider as string) ?? 'firestore',
      };
    },
    onData,
    onError,
  );
}
