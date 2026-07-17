import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Motion, Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { easeOut, useReduceMotion } from '@/hooks/use-reduce-motion';

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Optional sticky footer (e.g. Apply/Reset buttons). */
  footer?: ReactNode;
  /**
   * When false, children are not wrapped in ScrollView (use FlatList inside).
   * Defaults to true.
   */
  scrollable?: boolean;
};

/**
 * Dependency-free themed bottom sheet built on RN Modal + Animated.
 * Slides up from the bottom, dim backdrop tap-to-close, safe-area aware.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  scrollable = true,
}: BottomSheetProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const initialOffset = Dimensions.get('window').height;
  const sheetOffsetRef = useRef(initialOffset);
  const exitingRef = useRef(false);
  const [presented, setPresented] = useState(visible);
  const [wasVisible, setWasVisible] = useState(visible);
  const [translateY] = useState(() => new Animated.Value(initialOffset));
  const [backdrop] = useState(() => new Animated.Value(0));

  // Present Modal when `visible` rises; stay presented through exit animation.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setPresented(true);
  }

  const onSheetLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) sheetOffsetRef.current = h;
  }, []);

  const finishExit = useCallback((after?: () => void) => {
    exitingRef.current = false;
    // Parent `visible` must clear before `presented` so we don't re-present.
    after?.();
    setPresented(false);
  }, []);

  const runEnter = useCallback(() => {
    exitingRef.current = false;
    if (reduceMotion) {
      translateY.setValue(0);
      Animated.timing(backdrop, {
        toValue: 1,
        duration: Motion.fast,
        easing: easeOut,
        useNativeDriver: true,
      }).start();
      return;
    }
    translateY.setValue(sheetOffsetRef.current);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: Motion.spring.damping,
        stiffness: Motion.spring.stiffness,
      }),
      Animated.timing(backdrop, {
        toValue: 1,
        duration: Motion.normal,
        easing: easeOut,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduceMotion, translateY, backdrop]);

  const runExit = useCallback(
    (after?: () => void) => {
      if (exitingRef.current) return;
      exitingRef.current = true;
      const duration = reduceMotion ? Motion.fast : Motion.normal;

      if (reduceMotion) {
        translateY.setValue(0);
        Animated.timing(backdrop, {
          toValue: 0,
          duration,
          easing: easeOut,
          useNativeDriver: true,
        }).start(() => finishExit(after));
        return;
      }

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: sheetOffsetRef.current,
          duration,
          easing: easeOut,
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, {
          toValue: 0,
          duration,
          easing: easeOut,
          useNativeDriver: true,
        }),
      ]).start(() => finishExit(after));
    },
    [reduceMotion, translateY, backdrop, finishExit],
  );

  useEffect(() => {
    if (visible) {
      exitingRef.current = false;
      const id = requestAnimationFrame(() => runEnter());
      return () => cancelAnimationFrame(id);
    }
  }, [visible, runEnter]);

  useEffect(() => {
    if (!visible && presented && !exitingRef.current) {
      runExit();
    }
  }, [visible, presented, runExit]);

  function handleClose() {
    if (!presented || exitingRef.current) return;
    runExit(onClose);
  }

  return (
    <Modal
      visible={presented}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>
        <Animated.View
          onLayout={onSheetLayout}
          style={[
            styles.sheet,
            !scrollable && styles.sheetFlex,
            {
              backgroundColor: colors.surfaceContainerLowest,
              paddingBottom: insets.bottom + Spacing.gutterMd,
              transform: [{ translateY }],
            },
          ]}>
          <View style={[styles.grabber, { backgroundColor: colors.outlineVariant }]} />
          {title ? (
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.primary }]}>{title}</Text>
              <Pressable
                onPress={handleClose}
                style={styles.closeBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close">
                <Icon name="close" size={22} color={colors.onSurfaceVariant} />
              </Pressable>
            </View>
          ) : null}
          {scrollable ? (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={styles.bodyFlex}>{children}</View>
          )}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Labeled row of selectable chips for filter sheets. */
export function FilterChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.chips}>
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onChange(opt.id)}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
              ]}>
              <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 22, 44, 0.45)' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.containerMargin,
    maxHeight: '85%',
  },
  sheetFlex: { height: '85%' },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  title: { ...Typography.headlineSm },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0 },
  bodyFlex: { flex: 1, minHeight: 0 },
  bodyContent: { gap: Spacing.lg, paddingBottom: Spacing.sm },
  footer: { paddingTop: Spacing.md, gap: Spacing.sm },
  group: { gap: Spacing.sm },
  groupLabel: { ...Typography.labelMd, letterSpacing: 0.5, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { ...Typography.labelMd, lineHeight: 18, includeFontPadding: false },
});
