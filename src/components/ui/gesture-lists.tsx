/**
 * Gesture-handler-backed scrollables.
 *
 * Prefer these over React Native's ScrollView/FlatList so nested gestures
 * (sheets, swipeables, carousels) participate in RNGH's native touch system.
 * @see https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/introduction/
 */
import {
  FlashList as ShopifyFlashList,
  type FlashListProps,
  type FlashListRef,
} from '@shopify/flash-list';
import { forwardRef, type ForwardedRef, type ReactElement, type Ref } from 'react';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';

export { FlatList, ScrollView } from 'react-native-gesture-handler';

type FlashListComponent = <T>(
  props: FlashListProps<T> & { ref?: Ref<FlashListRef<T>> },
) => ReactElement | null;

/**
 * FlashList that scrolls via gesture-handler ScrollView for nested gesture
 * compatibility (bottom sheets, swipeables, parent pans).
 */
export const FlashList = forwardRef(function GestureFlashList<T>(
  { renderScrollComponent, ...props }: FlashListProps<T>,
  ref: ForwardedRef<FlashListRef<T>>,
) {
  return (
    <ShopifyFlashList
      ref={ref}
      renderScrollComponent={renderScrollComponent ?? GHScrollView}
      {...props}
    />
  );
}) as FlashListComponent;

export type { FlashListProps, FlashListRef };
