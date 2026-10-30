import { StyleSheet, Text, View } from 'react-native';

import { IconBubble } from '@/components/ui/detail-kit';
import { getCategoryMeta } from '@/constants/transaction-categories';
import { FontFamily, Radius, Spacing } from '@/constants/design-tokens';
import type { CategoryTotal } from '@/features/workspace/money-utils';
import { useAppTheme } from '@/hooks/use-app-theme';

import { useMoneyChartTheme } from './money-chart-theme';

const MAX_ROWS = 4;

/**
 * Where the money went: ranked categories as one-hue bars sized by share of
 * total spend. Past four categories the tail folds into "Everything else"
 * rather than inventing more colours.
 */
export function SpendBreakdown({
  categories,
  formatAmount,
}: {
  categories: CategoryTotal[];
  formatAmount: (amountBase: number) => string;
}) {
  const { colors } = useAppTheme();
  const chart = useMoneyChartTheme();
  const total = categories.reduce((sum, c) => sum + c.amount, 0);
  if (total <= 0) return null;

  const head = categories.slice(0, MAX_ROWS);
  const tail = categories.slice(MAX_ROWS);
  const rows = tail.length
    ? [...head, { category: '__rest', amount: tail.reduce((sum, c) => sum + c.amount, 0) }]
    : head;
  const largest = Math.max(...rows.map((r) => r.amount));

  return (
    <View style={styles.container}>
      {rows.map((row) => {
        const rest = row.category === '__rest';
        const meta = rest
          ? { label: `Everything else (${tail.length})`, icon: 'more-horiz' as const }
          : getCategoryMeta(row.category);
        const share = Math.round((row.amount / total) * 100);
        return (
          <View
            key={row.category}
            style={styles.row}
            accessible
            accessibilityLabel={`${meta.label}: ${formatAmount(row.amount)}, ${share}% of spending`}
          >
            <IconBubble icon={meta.icon} accent={colors.onSurfaceVariant} size={36} />
            <View style={styles.body}>
              <View style={styles.top}>
                <Text style={[styles.label, { color: colors.onSurface }]} numberOfLines={1}>
                  {meta.label}
                </Text>
                <Text
                  style={[styles.amount, { color: colors.onSurface }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatAmount(row.amount)}
                </Text>
              </View>
              <View style={styles.meterRow}>
                <View style={[styles.track, { backgroundColor: chart.track }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        backgroundColor: chart.expense,
                        width: `${Math.max(2, (row.amount / largest) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.share, { color: colors.textMuted }]}>{share}%</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  container: { gap: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  body: { flex: 1, minWidth: 0, gap: 8 },
  top: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
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
  share: {
    ...text,
    width: 36,
    textAlign: 'right',
    fontFamily: FontFamily.medium,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});
