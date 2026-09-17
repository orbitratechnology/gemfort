import type { DocumentData, Query } from '@react-native-firebase/firestore';

import { normalizeContactTypes } from '@/constants/contact-types';
import { normalizeApRecord } from '@/features/workspace/ap-normalize';
import { filterGems } from '@/features/workspace/gem-utils';
import {
  collection,
  orderBy,
  query,
  where,
} from '@/lib/firebase/db';
import { getFirebaseDb } from '@/lib/firebase/config';
import {
  fetchFirestorePage,
  withFirestoreCursor,
  type FirestoreCursor,
  type FirestorePage,
} from '@/lib/firebase/firestore-pagination';
import type {
  AppNotification,
  ApRecord,
  Bill,
  Cheque,
  Contact,
  Payable,
  Payment,
  Receivable,
  ServiceRecord,
  Transaction,
  Trip,
  WorkspaceGem,
} from '@/types';

type PageMapper<TItem> = (doc: FirestoreCursor) => TItem;

function page<TItem>(
  baseQuery: Query<DocumentData, DocumentData>,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
  mapDoc: PageMapper<TItem>,
): Promise<FirestorePage<TItem>> {
  return fetchFirestorePage({
    buildQuery: (nextCursor, nextPageSize) =>
      withFirestoreCursor(baseQuery, nextCursor, nextPageSize),
    mapDoc,
    cursor,
    pageSize,
  });
}

function mapRecord<TItem>(doc: FirestoreCursor): TItem {
  return { id: doc.id, ...doc.data() } as TItem;
}

function mapContact(doc: FirestoreCursor): Contact {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    contactTypes: normalizeContactTypes(data.contactTypes),
    photoUrl: data.photoUrl ?? null,
    deviceContactId: data.deviceContactId ?? null,
    linkedBusinessId: data.linkedBusinessId ?? null,
    linkedBusinessName: data.linkedBusinessName ?? null,
    linkedBusinessType: data.linkedBusinessType ?? null,
  } as Contact;
}

function mapBill(doc: FirestoreCursor): Bill {
  const raw = doc.data();
  return {
    id: doc.id,
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

export function fetchGemsPage(
  ownerUid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return page(
    query(
      collection(getFirebaseDb(), 'gemtrack_gems'),
      where('ownerUid', '==', ownerUid),
      orderBy('updatedAt', 'desc'),
    ),
    cursor,
    pageSize,
    mapRecord<WorkspaceGem>,
  );
}

/**
 * Archive is a derived view: sold/returned is represented by lifecycle fields
 * rather than one Firestore value. Skip empty raw pages so an archive with
 * older records does not look empty before the user can reach page two.
 */
export async function fetchArchivedGemsPage(
  ownerUid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
): Promise<FirestorePage<WorkspaceGem>> {
  let nextCursor = cursor;
  for (;;) {
    const result = await fetchGemsPage(ownerUid, nextCursor, pageSize);
    const items = filterGems(result.items, { archiveOnly: true });
    if (items.length > 0 || !result.hasNextPage || !result.cursor) {
      return { ...result, items };
    }
    nextCursor = result.cursor;
  }
}

export function fetchServicesPage(
  ownerUid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return page(
    query(
      collection(getFirebaseDb(), 'gemtrack_services'),
      where('ownerUid', '==', ownerUid),
      orderBy('updatedAt', 'desc'),
    ),
    cursor,
    pageSize,
    mapRecord<ServiceRecord>,
  );
}

export function fetchProviderServicesPage(
  providerUid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return page(
    query(
      collection(getFirebaseDb(), 'gemtrack_services'),
      where('providerUid', '==', providerUid),
      orderBy('updatedAt', 'desc'),
    ),
    cursor,
    pageSize,
    mapRecord<ServiceRecord>,
  );
}

export function fetchContactsPage(
  ownerUid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return page(
    query(
      collection(getFirebaseDb(), 'gemtrack_contacts'),
      where('ownerUid', '==', ownerUid),
    ),
    cursor,
    pageSize,
    mapContact,
  );
}

export function fetchTransactionsPage(
  ownerUid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return page(
    query(
      collection(getFirebaseDb(), 'gemtrack_transactions'),
      where('ownerUid', '==', ownerUid),
      orderBy('date', 'desc'),
    ),
    cursor,
    pageSize,
    mapRecord<Transaction>,
  );
}

export function fetchReceivablesPage(
  ownerUid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return page(
    query(
      collection(getFirebaseDb(), 'gemtrack_receivables'),
      where('ownerUid', '==', ownerUid),
    ),
    cursor,
    pageSize,
    mapRecord<Receivable>,
  );
}

export function fetchPayablesPage(
  ownerUid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return page(
    query(
      collection(getFirebaseDb(), 'gemtrack_payables'),
      where('ownerUid', '==', ownerUid),
    ),
    cursor,
    pageSize,
    mapRecord<Payable>,
  );
}

export function fetchPaymentsPage(
  ownerUid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return page(
    query(
      collection(getFirebaseDb(), 'gemtrack_payments'),
      where('ownerUid', '==', ownerUid),
      orderBy('paymentDate', 'desc'),
    ),
    cursor,
    pageSize,
    mapRecord<Payment>,
  );
}

export function fetchBillsPage(
  ownerUid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return page(
    query(
      collection(getFirebaseDb(), 'gemtrack_bills'),
      where('ownerUid', '==', ownerUid),
      orderBy('dueDate', 'asc'),
    ),
    cursor,
    pageSize,
    mapBill,
  );
}

export function fetchChequesPage(
  ownerUid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return page(
    query(
      collection(getFirebaseDb(), 'gemtrack_cheques'),
      where('ownerUid', '==', ownerUid),
      orderBy('maturityDate', 'asc'),
    ),
    cursor,
    pageSize,
    mapRecord<Cheque>,
  );
}

export function fetchTripsPage(
  ownerUid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return page(
    query(
      collection(getFirebaseDb(), 'gemtrack_trips'),
      where('ownerUid', '==', ownerUid),
      orderBy('startDate', 'desc'),
    ),
    cursor,
    pageSize,
    mapRecord<Trip>,
  );
}

export function fetchNotificationsPage(
  recipientUid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return page(
    query(
      collection(getFirebaseDb(), 'notifications'),
      where('recipientUid', '==', recipientUid),
      orderBy('createdAt', 'desc'),
    ),
    cursor,
    pageSize,
    mapRecord<AppNotification>,
  );
}

export function fetchGivenApPage(
  uid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return page(
    query(
      collection(getFirebaseDb(), 'gemtrack_ap_records'),
      where('senderUid', '==', uid),
      orderBy('updatedAt', 'desc'),
    ),
    cursor,
    pageSize,
    (doc) => normalizeApRecord(mapRecord<ApRecord>(doc)),
  );
}

export function fetchTakenApPage(
  uid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return page(
    query(
      collection(getFirebaseDb(), 'gemtrack_ap_records'),
      where('receiverUid', '==', uid),
      orderBy('updatedAt', 'desc'),
    ),
    cursor,
    pageSize,
    (doc) => normalizeApRecord(mapRecord<ApRecord>(doc)),
  );
}
