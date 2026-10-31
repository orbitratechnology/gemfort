import { Stack } from 'expo-router';
import {
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/design-tokens';

/** react-native-keyboard-controller's KeyboardToolbar height (not exported by the library). */
const KEYBOARD_TOOLBAR_HEIGHT = 42;

type Store<T> = {
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
};

function createStore<T>(initial: T): Store<T> {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next) => {
      current = next;
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Height of the mounted native sheet footer; only one form sheet is interactive at a time. */
const activeFooterHeight = createStore(0);

/**
 * Extra keyboard clearance for scroll views in a form sheet, so a focused field
 * lands above the pinned footer rather than behind it. 0 when no footer is mounted.
 */
export function useSheetFooterKeyboardOffset() {
  return useSyncExternalStore(
    activeFooterHeight.subscribe,
    activeFooterHeight.get,
    activeFooterHeight.get,
  );
}

/**
 * Rendered by react-native-screens inside the native sheet footer.
 * The native footer already rides on top of the keyboard; the extra padding
 * clears the app-wide KeyboardToolbar and drops the home-indicator inset while typing.
 */
function NativeFooterSlot({
  store,
  onHeight,
}: {
  store: Store<ReactNode>;
  onHeight: (height: number) => void;
}) {
  const children = useSyncExternalStore(store.subscribe, store.get, store.get);
  const { progress } = useReanimatedKeyboardAnimation();
  const insets = useSafeAreaInsets();
  const lift = KEYBOARD_TOOLBAR_HEIGHT - Math.max(insets.bottom - Spacing.md, 0);

  // Grow rather than translate: the native footer clips overflow and re-anchors
  // its bottom edge to the keyboard whenever its height changes.
  const liftStyle = useAnimatedStyle(() => ({
    paddingBottom: lift * progress.value,
  }));

  return (
    <Animated.View style={liftStyle}>
      <View onLayout={(e) => onHeight(e.nativeEvent.layout.height)}>{children}</View>
    </Animated.View>
  );
}

/**
 * Pins a sheet's action bar to the bottom of a `formSheet`, like gorhom's
 * `BottomSheetFooter`: it stays visible over scrolling content, while the
 * sheet is dragged, and above the keyboard.
 *
 * Android hosts it in the native `unstable_sheetFooter` slot and leaves an
 * equal-height spacer in the layout so `fitToContents` sizing still counts it.
 * iOS has no native slot, so the footer stays in the layout under the scroll view.
 */
export function SheetFooter({ children }: { children: ReactNode }) {
  if (process.env.EXPO_OS !== 'android') return <>{children}</>;
  return <AndroidSheetFooter>{children}</AndroidSheetFooter>;
}

function AndroidSheetFooter({ children }: { children: ReactNode }) {
  const [store] = useState(() => createStore<ReactNode>(null));
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    store.set(children);
  });
  useLayoutEffect(() => {
    activeFooterHeight.set(height);
  }, [height]);
  // The native slot outlives this component (e.g. multi-step sheets), so empty it on unmount.
  useLayoutEffect(
    () => () => {
      store.set(null);
      activeFooterHeight.set(0);
    },
    [store],
  );

  const options = useMemo(
    () => ({
      unstable_sheetFooter: () => <NativeFooterSlot store={store} onHeight={setHeight} />,
    }),
    [store],
  );

  return (
    <>
      <Stack.Screen options={options} />
      <View style={{ height }} />
    </>
  );
}
