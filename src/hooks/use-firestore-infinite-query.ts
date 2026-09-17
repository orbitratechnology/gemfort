import {
  hashKey,
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

import {
  subscribeFirestoreFirstPage,
  type FirestoreCursor,
  type FirestorePage,
  type FirestorePageMapper,
  type FirestorePageQuery,
} from '@/lib/firebase/firestore-pagination';

const DEFAULT_PAGE_SIZE = 30;

type InfiniteQueryData<TItem> = InfiniteData<
  FirestorePage<TItem>,
  FirestoreCursor | undefined
>;

type InfiniteQueryOptions<TItem, TError> = Omit<
  UseInfiniteQueryOptions<
    FirestorePage<TItem>,
    TError,
    InfiniteQueryData<TItem>,
    QueryKey,
    FirestoreCursor | undefined
  >,
  | 'queryKey'
  | 'queryFn'
  | 'initialPageParam'
  | 'getNextPageParam'
  | 'select'
> & {
  queryKey: QueryKey;
  fetchPage: (
    cursor: FirestoreCursor | undefined,
    pageSize: number,
  ) => Promise<FirestorePage<TItem>>;
  buildQuery?: FirestorePageQuery;
  mapDoc?: FirestorePageMapper<TItem>;
  pageSize?: number;
  getItemId?: (item: TItem) => string;
};

export type UseFirestoreInfiniteQueryResult<TItem, TError> =
  UseInfiniteQueryResult<InfiniteQueryData<TItem>, TError> & {
    items: TItem[];
  };

type SharedListener = {
  refCount: number;
  unsubscribe: () => void;
};

const sharedListeners = new Map<string, SharedListener>();

/**
 * React Query + Firestore cursor pagination bridge.
 *
 * Each next page starts after the last document from the previous page. The
 * first page also listens in realtime, while older pages remain bounded and
 * are loaded only when the list reaches its end.
 */
export function useFirestoreInfiniteQuery<TItem, TError = Error>(
  options: InfiniteQueryOptions<TItem, TError>,
): UseFirestoreInfiniteQueryResult<TItem, TError> {
  const {
    queryKey,
    fetchPage,
    buildQuery,
    mapDoc,
    getItemId,
    pageSize: requestedPageSize = DEFAULT_PAGE_SIZE,
    enabled = true,
    ...rest
  } = options;
  const pageSize = Math.max(1, Math.floor(requestedPageSize));
  const queryClient = useQueryClient();
  const keyHash = hashKey(queryKey);
  const buildQueryRef = useRef(buildQuery);
  const mapDocRef = useRef(mapDoc);
  const fetchPageRef = useRef(fetchPage);
  const getItemIdRef = useRef(getItemId);

  buildQueryRef.current = buildQuery;
  mapDocRef.current = mapDoc;
  fetchPageRef.current = fetchPage;
  getItemIdRef.current = getItemId;

  const queryResult = useInfiniteQuery<
    FirestorePage<TItem>,
    TError,
    InfiniteQueryData<TItem>,
    QueryKey,
    FirestoreCursor | undefined
  >({
    queryKey,
    queryFn: ({ pageParam }) => fetchPageRef.current(pageParam, pageSize),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.cursor ?? undefined : undefined,
    enabled,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    networkMode: 'offlineFirst',
    ...rest,
  });

  useEffect(() => {
    const firstPageQuery = buildQueryRef.current;
    const firstPageMap = mapDocRef.current;
    if (enabled === false || !firstPageQuery || !firstPageMap) {
      return;
    }

    const existing = sharedListeners.get(`${keyHash}:${pageSize}`);
    if (existing) {
      existing.refCount += 1;
      return () => {
        existing.refCount -= 1;
        if (existing.refCount <= 0) {
          existing.unsubscribe();
          sharedListeners.delete(`${keyHash}:${pageSize}`);
        }
      };
    }

    const unsubscribe = subscribeFirestoreFirstPage({
      buildQuery: firstPageQuery,
      mapDoc: firstPageMap,
      pageSize,
      onData: (page) => {
        queryClient.setQueryData<InfiniteQueryData<TItem>>(
          queryKey,
          (current) => {
            if (!current?.pages.length) return current;

            const firstPage = current.pages[0];
            const getId = getItemIdRef.current ?? defaultItemId;
            const currentIds = firstPage.items.map(getId);
            const nextIds = page.items.map(getId);
            const sameFirstPage =
              currentIds.length === nextIds.length &&
              currentIds.every((id, index) => id === nextIds[index]);

            if (sameFirstPage || current.pages.length === 1) {
              return {
                ...current,
                pages: [{ ...page }, ...current.pages.slice(1)],
              };
            }

            // A new/removed item changes the cursor boundary. Discard stale
            // older pages so the next fetch cannot skip or duplicate records.
            return { pages: [page], pageParams: [undefined] };
          },
        );
      },
    });

    const entry: SharedListener = { refCount: 1, unsubscribe };
    sharedListeners.set(`${keyHash}:${pageSize}`, entry);

    return () => {
      entry.refCount -= 1;
      if (entry.refCount <= 0) {
        entry.unsubscribe();
        sharedListeners.delete(`${keyHash}:${pageSize}`);
      }
    };
  }, [enabled, keyHash, pageSize, queryClient]);

  const items = useMemo(() => {
    const getId = getItemId ?? defaultItemId;
    const seen = new Set<string>();
    const result: TItem[] = [];

    for (const page of queryResult.data?.pages ?? []) {
      for (const item of page.items) {
        const id = getId(item);
        if (seen.has(id)) continue;
        seen.add(id);
        result.push(item);
      }
    }
    return result;
  }, [getItemId, queryResult.data]);

  return { ...queryResult, items };
}

function defaultItemId<TItem>(item: TItem): string {
  const id = (item as { id?: unknown }).id;
  return typeof id === 'string' ? id : JSON.stringify(item);
}
