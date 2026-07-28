import {
  hashKey,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

type SubscribeFn<TData> = (
  onData: (data: TData) => void,
  onError: (error: Error) => void,
) => () => void;

type LiveQueryOptions<TData, TError = Error> = Omit<
  UseQueryOptions<TData, TError, TData, QueryKey>,
  'queryKey' | 'queryFn'
> & {
  queryKey: QueryKey;
  queryFn: () => Promise<TData>;
  /**
   * Firestore `onSnapshot` subscription. Keeps React Query cache in sync in
   * realtime (and serves cached data while offline when persistence is on).
   */
  subscribe: SubscribeFn<TData>;
};

/**
 * React Query + Firestore realtime bridge.
 *
 * - `queryFn` (getDocs/getDoc) powers pull-to-refresh / reconnect refetch
 * - `subscribe` (onSnapshot) pushes live updates into the same queryKey cache
 * - `staleTime: Infinity` — the listener is the source of freshness
 */
export function useFirestoreLiveQuery<TData, TError = Error>(
  options: LiveQueryOptions<TData, TError>,
): UseQueryResult<TData, TError> {
  const { subscribe, queryKey, queryFn, enabled = true, ...rest } = options;
  const queryClient = useQueryClient();
  const subscribeRef = useRef(subscribe);
  subscribeRef.current = subscribe;
  const keyHash = hashKey(queryKey);

  useEffect(() => {
    if (enabled === false) return;

    return subscribeRef.current(
      (data) => {
        queryClient.setQueryData(queryKey, data);
      },
      () => {
        // Keep last good cache; offline persistence + queryFn refetch recover.
      },
    );
    // queryKey identity is tracked via keyHash; setQueryData needs the array.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyHash stands in for queryKey
  }, [enabled, keyHash, queryClient]);

  return useQuery({
    queryKey,
    queryFn,
    enabled,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    networkMode: 'offlineFirst',
    ...rest,
  });
}
