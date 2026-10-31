import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

import { useMoneyChartTheme } from './money-chart-theme';

export type ShareRow = {
  key: string;
  label: string;
  /** e.g. "12 stones" */
  detail?: string | null;
  amount: number;
  onPress?: () => void;
};

/**
 * Ranked rows, each with a one-hue bar sized by its share of the total —
 * for "where is it" breakdowns where every row is labelled, so no legend or
 * extra hues are needed. Empty rows stay listed but dimmed.
 */
export function ShareBars({
  rows,
  formatAmount,
  color,
}: {
  rows: ShareRow[];
  formatAmount: (amountBase: number) => string;
  color?: string;
}) {
  const { colors } = useAppTheme();
  const chart = useMoneyChartTheme();
  const fill = color ?? colors.onSurfaceVariant;
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const largest = Math.max(1, ...rows.map((r) => r.amount));

  return (
    <View style={styles.container}>
      {rows.map((row) => {
        const share = total > 0 ? Math.round((row.amount / total) * 100) : 0;
        const empty = row.amount <= 0;
        const body = (
          <>
            <View style={styles.top}>
              <Text
                style={[styles.label, { color: empty ? colors.textMuted : colors.onSurface }]}
                numberOfLines={1}
              >
                {row.label}
              </Text>
              <Text
                style={[styles.amount, { color: empty ? colors.textMuted : colors.onSurface }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formatAmount(row.amount)}
              </Text>
              {row.onPress ? <Icon name="chevron-right" size={16} color={colors.outline} /> : null}
            </View>
            <View style={styles.meterRow}>
              <View style={[styles.track, { backgroundColor: chart.track }]}>
                {!empty ? (
                  <View
                    style={[
                      styles.fill,
                      { backgroundColor: fill, width: `${Math.max(2, (row.amount / largest) * 100)}%` },
                    ]}
                  />
                ) : null}
              </View>
              <Text style={[styles.detail, { color: colors.textMuted }]} numberOfLines={1}>
                {[row.detail, empty ? null : `${share}%`].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </>
        );
        const a11y = `${row.label}: ${formatAmount(row.amount)}${row.detail ? `, ${row.detail}` : ''}, ${share}%`;
        return row.onPress ? (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            accessibilityLabel={a11y}
            onPress={row.onPress}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
          >
            {body}
          </Pressable>
        ) : (
          <View key={row.key} style={styles.row} accessible accessibilityLabel={a11y}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  container: { gap: Spacing.lg },
  row: { gap: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { ...text, flex: 1, minWidth: 0, fontFamily: FontFamily.semibold, fontSize: 14, lineHeight: 20 },
  amount: {
    ...text,
    flexShrink: 1,
    maxWidth: '55%',
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  track: { flex: 1, height: 6, borderRadius: Radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.full },
  detail: {
    ...text,
    flexShrink: 0,
    maxWidth: '45%',
    textAlign: 'right',
    fontFamily: FontFamily.medium,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});
