import NativeBottomSheet from '@expo/ui/community/bottom-sheet';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
    type LayoutChangeEvent,
} from 'react-native';
import {
    KeyboardAwareScrollView,
} from 'react-native-keyboard-controller';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { haptics } from '@/lib/haptics';

const SHEET_SNAP_POINTS = ['55%', '85%'];

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Optional sticky footer (e.g. Apply/Reset buttons). */
  footer?: ReactNode;
  /**
   * When false, children are not wrapped in ScrollView (use FlashList inside).
   * Defaults to true.
   */
  scrollable?: boolean;
  /** Size the native sheet to its content instead of using the shared detents. */
  fitToContents?: boolean;
  /** Disable focused-input auto-scrolling when the sheet already avoids the keyboard. */
  autoScrollToFocusedInput?: boolean;
};

/**
 * Themed native bottom sheet with interactive detents and pan-down dismissal.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  scrollable = true,
  fitToContents = false,
  autoScrollToFocusedInput = true,
}: BottomSheetProps) {
  const { colors } = useAppTheme();
  const pinFooter = Platform.OS === 'android' && Boolean(footer) && !fitToContents;
  const [footerHeight, setFooterHeight] = useState(0);

  const visibleRef = useRef(visible);

  useEffect(() => {
    visibleRef.current = visible;
    if (visible) {
      haptics.sheetOpen();
    }
  }, [visible]);

  const handleNativeClose = useCallback(() => {
    if (!visibleRef.current) return;
    haptics.sheetClose();
    onClose();
  }, [onClose]);

  const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setFooterHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight,
    );
  }, []);

  return (
    <NativeBottomSheet
      index={visible ? 0 : -1}
      snapPoints={fitToContents ? undefined : SHEET_SNAP_POINTS}
      enableDynamicSizing={fitToContents}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.surfaceContainerLowest }}
      onClose={handleNativeClose}>
      <View
        style={[
          styles.sheet,
          fitToContents && styles.sheetFit,
          pinFooter && styles.sheetPinnedFooter,
        ]}>
        {title ? (
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.primary }]}>{title}</Text>
            <Pressable
              onPress={handleNativeClose}
              style={styles.closeBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <Icon name="close" size={22} color={colors.onSurfaceVariant} />
            </Pressable>
          </View>
        ) : null}
        {scrollable ? (
          <KeyboardAwareScrollView
            style={[styles.body, fitToContents && styles.bodyFit]}
            contentContainerStyle={[
              styles.bodyContent,
              pinFooter && { paddingBottom: footerHeight + Spacing.sm },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            enabled={autoScrollToFocusedInput}
            bottomOffset={62}>
            {children}
          </KeyboardAwareScrollView>
        ) : (
          <View
            style={[
              styles.bodyFlex,
              fitToContents && styles.bodyFit,
              pinFooter && { paddingBottom: footerHeight },
            ]}>
            {children}
          </View>
        )}
        {footer ? (
          <View
            onLayout={pinFooter ? handleFooterLayout : undefined}
            style={[
              styles.footer,
              pinFooter && styles.footerPinned,
              pinFooter && { backgroundColor: colors.surfaceContainerLowest },
            ]}>
            {footer}
          </View>
        ) : null}
      </View>
    </NativeBottomSheet>
  );
}

/** Vertical gap between FlashList rows in bottom sheets (FlashList ignores `gap`). */
export function SheetListSeparator() {
  return <View style={styles.listSeparator} />;
}

/** Labeled row of chips for filter sheets. */
export function FilterChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  renderLeading,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T | null;
  onChange: (id: T) => void;
  renderLeading?: (option: { id: T; label: string }) => ReactNode;
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
              onPress={haptics.wrap('selection', () => onChange(opt.id))}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
              ]}>
              {renderLeading?.(opt)}
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
  sheet: {
    position: 'relative',
    paddingBottom: Spacing.gutterMd,
    flex: 1,
  },
  sheetPinnedFooter: { paddingBottom: 0 },
  sheetFit: { flex: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md, paddingHorizontal: Spacing.containerMargin },
  title: { ...Typography.headlineSm },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minHeight: 0, marginHorizontal: Spacing.containerMargin },
  bodyFlex: { flex: 1, minHeight: 0, marginHorizontal: Spacing.containerMargin },
  bodyFit: { flex: 0 },
  bodyContent: { gap: Spacing.lg, paddingBottom: Spacing.sm },
  listSeparator: { height: Spacing.stackSm },
  footer: { paddingTop: Spacing.md, paddingHorizontal: Spacing.containerMargin, gap: Spacing.sm },
  footerPinned: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: Spacing.gutterMd },
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
    gap: Spacing.xs,
    flexDirection: 'row',
  },
  chipText: { ...Typography.labelMd, lineHeight: 18, includeFontPadding: false },
});
