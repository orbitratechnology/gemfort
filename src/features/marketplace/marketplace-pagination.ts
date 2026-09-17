import type { DocumentData, Query } from '@react-native-firebase/firestore';

import { getFirebaseDb } from '@/lib/firebase/config';
import {
  collection,
  orderBy,
  query,
  where,
} from '@/lib/firebase/db';
import {
  fetchFirestorePage,
  withFirestoreCursor,
  type FirestoreCursor,
  type FirestorePage,
} from '@/lib/firebase/firestore-pagination';
import type { Announcement, Business, MarketplaceListing } from '@/types';

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

function mapRecord<TItem>(doc: FirestoreCursor): TItem {
  return { id: doc.id, ...doc.data() } as TItem;
}

export function fetchBusinessesPage(
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return page(
    query(
      collection(getFirebaseDb(), 'public_businesses'),
      where('verificationStatus', '==', 'verified'),
      where('isActive', '==', true),
    ),
    cursor,
    pageSize,
    mapRecord<Business>,
  );
}

export function fetchPublicListingsPage(
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return page(
    query(
      collection(getFirebaseDb(), 'gems'),
      where('visibility', '==', 'public'),
      where('status', '==', 'active'),
    ),
    cursor,
    pageSize,
    mapRecord<MarketplaceListing>,
  );
}

export function fetchAnnouncementsPage(
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  return page(
    query(
      collection(getFirebaseDb(), 'announcements'),
      where('isVisible', '==', true),
      orderBy('publishedAt', 'desc'),
    ),
    cursor,
    pageSize,
    mapRecord<Announcement>,
  );
}
