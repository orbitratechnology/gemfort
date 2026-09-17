import type {
  DocumentData,
  Query,
  QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';

import { getDocs, limit, onSnapshot, query, startAfter } from '@/lib/firebase/db';

export type FirestoreCursor = QueryDocumentSnapshot<DocumentData, DocumentData>;

export type FirestorePage<TItem> = {
  items: TItem[];
  cursor: FirestoreCursor | null;
  hasNextPage: boolean;
};

export type FirestorePageQuery = (
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) => Query<DocumentData, DocumentData>;

export type FirestorePageMapper<TItem> = (doc: FirestoreCursor) => TItem;

function pageQuery(
  buildQuery: FirestorePageQuery,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
) {
  // Read one extra document so the page can know whether another page exists
  // without making a second empty request at the end of the collection.
  return buildQuery(cursor, pageSize + 1);
}

export async function fetchFirestorePage<TItem>({
  buildQuery,
  mapDoc,
  cursor,
  pageSize,
}: {
  buildQuery: FirestorePageQuery;
  mapDoc: FirestorePageMapper<TItem>;
  cursor: FirestoreCursor | undefined;
  pageSize: number;
}): Promise<FirestorePage<TItem>> {
  const snapshot = await getDocs(pageQuery(buildQuery, cursor, pageSize));
  const docs = snapshot.docs as FirestoreCursor[];
  const pageDocs = docs.slice(0, pageSize);

  return {
    items: pageDocs.map(mapDoc),
    cursor: pageDocs[pageDocs.length - 1] ?? null,
    hasNextPage: docs.length > pageSize,
  };
}

/**
 * Subscribe to the same bounded first page used by the infinite query.
 * Older pages are fetched on demand; the list hook reconciles this page with
 * the cached pages and resets stale boundaries when a new item changes order.
 */
export function subscribeFirestoreFirstPage<TItem>({
  buildQuery,
  mapDoc,
  pageSize,
  onData,
}: {
  buildQuery: FirestorePageQuery;
  mapDoc: FirestorePageMapper<TItem>;
  pageSize: number;
  onData: (page: FirestorePage<TItem>) => void;
}): () => void {
  return onSnapshot(
    buildQuery(undefined, pageSize + 1),
    (snapshot) => {
      const docs = snapshot.docs as FirestoreCursor[];
      const pageDocs = docs.slice(0, pageSize);
      onData({
        items: pageDocs.map(mapDoc),
        cursor: pageDocs[pageDocs.length - 1] ?? null,
        hasNextPage: docs.length > pageSize,
      });
    },
    () => {
      // Pull-to-refresh and React Query retry remain responsible for errors.
    },
  );
}

/** Apply a cursor and page limit to a query that already has its filters/order. */
export function withFirestoreCursor(
  baseQuery: Query<DocumentData, DocumentData>,
  cursor: FirestoreCursor | undefined,
  pageSize: number,
): Query<DocumentData, DocumentData> {
  return cursor
    ? query(baseQuery, startAfter(cursor), limit(pageSize))
    : query(baseQuery, limit(pageSize));
}
