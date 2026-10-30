import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { FontFamily, Radius } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { haptics } from '@/lib/haptics';

export type SegmentOption<T extends string> = {
  id: T;
  label: string;
  icon?: IconName;
  /** Tint for the active segment's icon and label (e.g. emerald for Income). */
  accent?: string;
};

/**
 * Pill segmented control used across Money. Labels shrink to fit instead of
 * truncating, so "Last Month" survives a 320pt screen. Pass `value={null}` when
 * a custom filter overrides every segment.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled,
}: {
  options: readonly SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: colors.surfaceContainerHigh }]}
    >
      {options.map((option) => {
        const active = option.id === value;
        const tint = active ? option.accent ?? colors.onSurface : colors.onSurfaceVariant;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={option.label}
            disabled={disabled}
            onPress={() => {
              if (active) return;
              haptics.selection();
              onChange(option.id);
            }}
            style={[
              styles.segment,
              active && [styles.segmentActive, { backgroundColor: colors.surfaceContainerLowest }],
            ]}
          >
            {option.icon ? <Icon name={option.icon} size={16} color={tint} /> : null}
            <Text
              style={[styles.label, { color: tint }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: Radius.full,
    gap: 3,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
  },
  segmentActive: {
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
  },
  label: {
    flexShrink: 1,
    fontFamily: FontFamily.semibold,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
});
