import { useTourTarget as useGuidewayTourTarget, type UseTourTargetOptions } from 'guideway';
import type { RefObject } from 'react';
import type { FlatList, HostInstance, ScrollViewInstance } from 'react-native';

type TourTargetOptions = Omit<UseTourTargetOptions, 'scrollRef'> & {
  scrollRef?: RefObject<ScrollViewInstance | FlatList<unknown> | null>;
};

/**
 * guideway's useTourTarget, typed for React Native 0.88. guideway declares its
 * refs with the pre-0.88 `View`/`ScrollView` class types, which no longer match
 * the `ref` props of host components; the runtime objects are the same.
 */
export function useTourTarget(
  id: string,
  options?: TourTargetOptions,
): RefObject<HostInstance | null> {
  return useGuidewayTourTarget(
    id,
    options as UseTourTargetOptions | undefined,
  ) as unknown as RefObject<HostInstance | null>;
}
