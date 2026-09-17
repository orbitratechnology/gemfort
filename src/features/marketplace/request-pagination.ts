import type { DocumentData, Query } from '@react-native-firebase/firestore';

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
import {
  mapServiceToLapidaryJob,
  mapServiceToRequest,
} from '@/features/marketplace/request-service';
import type { LapidaryJob, ServiceRequest, ServiceRecord } from '@/types';

function page<TItem>(
  baseQuery: Query<DocumentData, DocumentData>,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
  mapDoc: (doc: FirestoreCursor) => TItem,
): Promise<FirestorePage<TItem>> {
  return fetchFirestorePage({
    buildQuery: (nextCursor, nextPageSize) =>
      withFirestoreCursor(baseQuery, nextCursor, nextPageSize),
    mapDoc,
    cursor,
    pageSize,
  });
}

function serviceData(doc: FirestoreCursor) {
  return { id: doc.id, data: doc.data() as Record<string, unknown> };
}

function requestOrNull(doc: FirestoreCursor): ServiceRequest | null {
  const { id, data } = serviceData(doc);
  return data.serviceKind === 'lapidary_request'
    ? mapServiceToRequest(id, data)
    : null;
}

function jobOrNull(doc: FirestoreCursor): LapidaryJob | null {
  const { id, data } = serviceData(doc);
  return mapServiceToLapidaryJob(id, data);
}

function serviceRecord(doc: FirestoreCursor): ServiceRecord {
  return { id: doc.id, ...doc.data() } as ServiceRecord;
}

/** Client-side filtering is deliberate: one collection contains both service records and requests. */
function keepItems<TItem>(
  pageResult: FirestorePage<TItem | null>,
): FirestorePage<TItem> {
  return { ...pageResult, items: pageResult.items.filter((item): item is TItem => item != null) };
}

export async function fetchIncomingServiceRequestsPage(
  lapidaryUid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return keepItems(
    await page(
      query(
        collection(getFirebaseDb(), 'gemtrack_services'),
        where('providerUid', '==', lapidaryUid),
        orderBy('updatedAt', 'desc'),
      ),
      cursor,
      pageSize,
      requestOrNull,
    ),
  );
}

export async function fetchOutgoingServiceRequestsPage(
  traderUid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return keepItems(
    await page(
      query(
        collection(getFirebaseDb(), 'gemtrack_services'),
        where('ownerUid', '==', traderUid),
        orderBy('updatedAt', 'desc'),
      ),
      cursor,
      pageSize,
      requestOrNull,
    ),
  );
}

export async function fetchLapidaryJobsPage(
  lapidaryUid: string,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return keepItems(
    await page(
      query(
        collection(getFirebaseDb(), 'gemtrack_services'),
        where('providerUid', '==', lapidaryUid),
        orderBy('updatedAt', 'desc'),
      ),
      cursor,
      pageSize,
      jobOrNull,
    ),
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
    serviceRecord,
  );
}
