import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, Radius, Spacing } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

import { useMoneyChartTheme } from './money-chart-theme';

export type AgingSegment = {
  key: string;
  label: string;
  /** Outstanding in LKR base. */
  amount: number;
  count: number;
  color: string;
};

/**
 * One stacked bar of an outstanding balance split by urgency (overdue, due
 * within a week, later), with a labelled legend so state is never colour-only.
 */
export function AgingBar({
  segments,
  formatAmount,
}: {
  segments: AgingSegment[];
  formatAmount: (amountBase: number) => string;
}) {
  const { colors } = useAppTheme();
  const chart = useMoneyChartTheme();
  const total = segments.reduce((sum, s) => sum + s.amount, 0);
  const visible = segments.filter((s) => s.amount > 0);

  return (
    <View style={styles.container}>
      <View
        style={[styles.bar, { backgroundColor: total > 0 ? 'transparent' : chart.track }]}
        accessibilityRole="image"
        accessibilityLabel={
          total > 0
            ? visible
                .map((s) => `${s.label} ${Math.round((s.amount / total) * 100)}%`)
                .join(', ')
            : 'Nothing outstanding'
        }
      >
        {visible.map((s) => (
          <View
            key={s.key}
            style={[styles.segment, { flexGrow: s.amount, backgroundColor: s.color }]}
          />
        ))}
      </View>

      <View style={styles.legend}>
        {segments.map((s) => (
          <View key={s.key} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={[styles.legendLabel, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
              {s.label}
              <Text style={{ color: colors.textMuted }}>{s.count > 0 ? `  ${s.count}` : ''}</Text>
            </Text>
            <Text
              style={[
                styles.legendValue,
                { color: s.amount > 0 ? colors.onSurface : colors.textMuted },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatAmount(s.amount)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  bar: {
    flexDirection: 'row',
    height: 10,
    gap: 2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  segment: { flexBasis: 0, minWidth: 4, height: '100%' },
  legend: { gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 20 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { ...text, flex: 1, minWidth: 0, fontFamily: FontFamily.medium, fontSize: 13 },
  legendValue: {
    ...text,
    flexShrink: 1,
    maxWidth: '55%',
    fontFamily: FontFamily.semibold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
});
