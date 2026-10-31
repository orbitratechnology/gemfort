import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconBubble } from '@/components/ui/detail-kit';
import { Icon, type IconName } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

/** Two-per-row grid for `InsightTile`s. */
export function InsightGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

/**
 * Tappable business metric: a headline value with a short qualifier, opening
 * a sheet with the detail behind it. Values shrink to fit rather than crop.
 */
export function InsightTile({
  icon,
  accent,
  label,
  value,
  sub,
  alert,
  onPress,
}: {
  icon: IconName;
  accent: string;
  label: string;
  value: string;
  sub?: string | null;
  /** Short warning line (e.g. "3 slow movers"), shown with a dot. */
  alert?: { text: string; color: string } | null;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[label, value, sub, alert?.text].filter(Boolean).join(', ')}
      accessibilityHint="Shows the detail"
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
        pressed && { backgroundColor: colors.surfaceContainerLow },
      ]}
    >
      <View style={styles.head}>
        <IconBubble icon={icon} accent={accent} size={30} />
        <Icon name="chevron-right" size={18} color={colors.outline} />
      </View>
      <Text style={[styles.label, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.value, { color: colors.onSurface }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
      >
        {value}
      </Text>
      {sub ? (
        <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
      {alert ? (
        <View style={styles.alert}>
          <View style={[styles.dot, { backgroundColor: alert.color }]} />
          <Text style={[styles.alertText, { color: colors.onSurface }]} numberOfLines={1}>
            {alert.text}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.stackMd },
  tile: {
    flexBasis: '46%',
    flexGrow: 1,
    minWidth: 0,
    padding: Spacing.gutterMd,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  label: { ...text, fontFamily: FontFamily.medium, fontSize: 12 },
  value: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 19,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
  },
  sub: { ...text, fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 16 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  alertText: { ...text, flexShrink: 1, fontFamily: FontFamily.medium, fontSize: 12 },
});
