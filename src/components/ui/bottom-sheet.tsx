import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import NativeBottomSheet from '@expo/ui/community/bottom-sheet';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
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
  autoScrollToFocusedInput = true,
}: BottomSheetProps) {
  const { colors } = useAppTheme();

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

  return (
    <NativeBottomSheet
      index={visible ? 0 : -1}
      snapPoints={SHEET_SNAP_POINTS}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.surfaceContainerLowest }}
      onClose={handleNativeClose}>
      <View style={styles.sheet}>
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
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            enabled={autoScrollToFocusedInput}
            bottomOffset={62}>
            {children}
          </KeyboardAwareScrollView>
        ) : (
          <View style={styles.bodyFlex}>{children}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
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
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.gutterMd,
    flex: 1,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  title: { ...Typography.headlineSm },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0 },
  bodyFlex: { flex: 1, minHeight: 0 },
  bodyContent: { gap: Spacing.lg, paddingBottom: Spacing.sm },
  listSeparator: { height: Spacing.stackSm },
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
    gap: Spacing.xs,
  },
  chipText: { ...Typography.labelMd, lineHeight: 18, includeFontPadding: false },
});
