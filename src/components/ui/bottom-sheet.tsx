import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Optional sticky footer (e.g. Apply/Reset buttons). */
  footer?: ReactNode;
};

/**
 * Dependency-free themed bottom sheet built on RN Modal + Animated.
 * Slides up from the bottom, dim backdrop tap-to-close, safe-area aware.
 */
export function BottomSheet({ visible, onClose, title, children, footer }: BottomSheetProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(600)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      translateY.setValue(600);
      backdrop.setValue(0);
    }
  }, [visible, translateY, backdrop]);

  function handleClose() {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 600, duration: 200, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(onClose);
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
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
              <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
                <Icon name="close" size={22} color={colors.onSurfaceVariant} />
              </Pressable>
            </View>
          ) : null}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
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
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  title: { ...Typography.headlineSm },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0 },
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
