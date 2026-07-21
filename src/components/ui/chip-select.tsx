import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { haptics } from '@/lib/haptics';

export type ChipOption<T extends string = string> = {
  value: T;
  label: string;
  subtitle?: string;
  icon?: IconName;
};

type ChipSelectProps<T extends string> = {
  label?: string;
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  error?: string;
  /** wrap = chip grid, stack = full-width rows, split = equal columns */
  layout?: 'wrap' | 'stack' | 'split';
};

export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  layout = 'wrap',
}: ChipSelectProps<T>) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}
      <View
        style={[
          layout === 'wrap' && styles.wrapRow,
          layout === 'stack' && styles.stackCol,
          layout === 'split' && styles.splitRow,
        ]}>
        {options.map((opt) => {
          const active = value === opt.value;
          const isRow = layout === 'stack' || layout === 'split';
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={opt.label}
              onPress={haptics.wrap('selection', () => onChange(opt.value))}
              style={({ pressed }) => [
                isRow ? styles.rowChip : styles.chip,
                layout === 'split' && styles.splitChip,
                {
                  backgroundColor: active ? colors.primary : colors.surfaceContainerLow,
                  borderColor: active ? colors.primary : error ? colors.error : colors.outlineVariant,
                },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}>
              {opt.icon ? (
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor: active
                        ? colors.onPrimary + '22'
                        : colors.surfaceContainerHighest,
                    },
                  ]}>
                  <Icon
                    name={opt.icon}
                    size={isRow ? 18 : 16}
                    color={active ? colors.onPrimary : colors.onSurfaceVariant}
                  />
                </View>
              ) : null}
              <View style={isRow ? styles.textCol : styles.textColWrap}>
                <Text
                  style={[
                    styles.chipLabel,
                    { color: active ? colors.onPrimary : colors.onSurface },
                  ]}
                  numberOfLines={1}>
                  {opt.label}
                </Text>
                {opt.subtitle ? (
                  <Text
                    style={[
                      styles.chipSub,
                      { color: active ? colors.onPrimary + 'CC' : colors.textMuted },
                    ]}
                    numberOfLines={2}>
                    {opt.subtitle}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text style={[styles.error, { color: colors.error }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { ...Typography.labelMd },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.stackSm },
  stackCol: { gap: Spacing.stackSm },
  splitRow: { flexDirection: 'row', gap: Spacing.stackMd },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    borderWidth: 1.5,
  },
  rowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    minHeight: 56,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1.5,
  },
  splitChip: { flex: 1 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, gap: 2, minWidth: 0 },
  /** Wrap chips must not use flex:1 or labels collapse to zero width. */
  textColWrap: { gap: 2, flexShrink: 1 },
  chipLabel: { ...Typography.labelMd, fontWeight: '600' },
  chipSub: { ...Typography.bodySmall, lineHeight: 16 },
  error: { ...Typography.bodySmall },
});
