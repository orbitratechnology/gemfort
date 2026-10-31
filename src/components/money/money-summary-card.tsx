import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing } from '@/constants/design-tokens';
import type { Trend } from '@/features/workspace/money-utils';
import { useAppTheme } from '@/hooks/use-app-theme';

import { useMoneyChartTheme } from './money-chart-theme';

/**
 * Period headline on the page surface: net profit with how it moved against
 * the previous span, then money in and money out as two tappable halves that
 * open the ledger filtered to that side.
 */
export function MoneySummaryCard({
  periodLabel,
  net,
  income,
  expense,
  trend,
  comparison,
  loading,
  formatAmount,
  onOpenIncome,
  onOpenExpense,
}: {
  periodLabel: string;
  net: number;
  income: number;
  expense: number;
  trend: Trend;
  /** e.g. "vs last month" */
  comparison: string;
  loading?: boolean;
  formatAmount: (amountBase: number) => string;
  onOpenIncome: () => void;
  onOpenExpense: () => void;
}) {
  const { colors } = useAppTheme();
  const chart = useMoneyChartTheme();
  const flow = income + expense;
  const kept = income > 0 ? Math.round((net / income) * 100) : null;
  const trendColor = trend.pct == null ? colors.onSurfaceVariant : trend.up ? chart.income : chart.overdue;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
      ]}
    >
      <View style={styles.headRow}>
        <Text style={[styles.label, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
          Net profit · {periodLabel}
        </Text>
        {trend.pct != null && !loading ? (
          <View
            style={[styles.trend, { backgroundColor: `${trendColor}1A` }]}
            accessibilityLabel={`${trend.up ? 'Up' : 'Down'} ${Math.abs(trend.pct)} percent ${comparison}`}
          >
            <Icon name={trend.up ? 'trending-up' : 'trending-down'} size={14} color={trendColor} />
            <Text style={[styles.trendText, { color: colors.onSurface }]}>
              {Math.abs(trend.pct)}%
            </Text>
          </View>
        ) : null}
      </View>

      <Text
        style={[styles.net, { color: colors.onSurface }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {loading ? '—' : `${net > 0 ? '+' : net < 0 ? '−' : ''}${formatAmount(Math.abs(net))}`}
      </Text>
      <Text style={[styles.caption, { color: colors.textMuted }]} numberOfLines={2}>
        {loading
          ? 'Loading this period…'
          : trend.pct == null
            ? 'No earlier activity to compare with yet'
            : `${trend.up ? 'Up' : 'Down'} ${Math.abs(trend.pct)}% ${comparison}${
                kept != null && kept > 0 ? ` · you kept ${kept}% of what came in` : ''
              }`}
      </Text>

      <View
        style={[styles.flowBar, { backgroundColor: chart.track }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {flow > 0 ? (
          <>
            <View style={{ flexGrow: income, backgroundColor: chart.income }} />
            <View style={{ flexGrow: expense, backgroundColor: chart.expense }} />
          </>
        ) : null}
      </View>

      <View style={[styles.split, { borderTopColor: colors.outlineVariant }]}>
        <FlowHalf
          color={chart.income}
          label="Money in"
          value={loading ? '—' : formatAmount(income)}
          onPress={onOpenIncome}
        />
        <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
        <FlowHalf
          color={chart.expense}
          label="Money out"
          value={loading ? '—' : formatAmount(expense)}
          onPress={onOpenExpense}
        />
      </View>
    </View>
  );
}

function FlowHalf({
  color,
  label,
  value,
  onPress,
}: {
  color: string;
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      accessibilityHint="Opens the matching entries in the ledger"
      onPress={onPress}
      style={({ pressed }) => [styles.half, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.halfHead}>
        <View style={[styles.swatch, { backgroundColor: color }]} />
        <Text style={[styles.halfLabel, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
          {label}
        </Text>
        <Icon name="chevron-right" size={16} color={colors.outline} />
      </View>
      <Text
        style={[styles.halfValue, { color: colors.onSurface }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
      >
        {value}
      </Text>
    </Pressable>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.lg,
    gap: 6,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 24 },
  label: { ...text, flex: 1, fontFamily: FontFamily.medium, fontSize: 13 },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  trendText: { ...text, fontFamily: FontFamily.semibold, fontSize: 12, fontVariant: ['tabular-nums'] },
  net: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  caption: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
  flowBar: {
    flexDirection: 'row',
    height: 8,
    gap: 2,
    marginTop: Spacing.md,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  split: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  divider: { width: StyleSheet.hairlineWidth, marginVertical: Spacing.md },
  half: { flex: 1, minWidth: 0, paddingVertical: Spacing.md, paddingRight: Spacing.sm, gap: 4 },
  halfHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  halfLabel: { ...text, flex: 1, fontFamily: FontFamily.medium, fontSize: 12 },
  halfValue: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 17,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  swatch: { width: 8, height: 8, borderRadius: 2 },
});
