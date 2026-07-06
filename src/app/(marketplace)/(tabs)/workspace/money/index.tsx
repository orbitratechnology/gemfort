import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet, FilterChipGroup } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { ThemedScrollView } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { getCategoryMeta } from '@/constants/transaction-categories';
import {
  MONEY_PERIODS,
  type MoneyPeriod,
  getCashFlowBuckets,
  getCategoryBreakdown,
  getNetTrend,
  getPeriodRange,
  getRangeTotals,
} from '@/features/workspace/money-utils';
import { fetchTransactions } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

export default function MoneyDashboard() {
  const { user } = useAuth();
  const { colors } = useAppTheme();

  const [period, setPeriod] = useState<MoneyPeriod>('this_month');
  const [periodSheet, setPeriodSheet] = useState(false);

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', user?.uid],
    queryFn: () => fetchTransactions(user!.uid),
    enabled: !!user,
  });

  const range = useMemo(() => getPeriodRange(period), [period]);
  const { income, expense, net } = useMemo(
    () => getRangeTotals(transactions, range),
    [transactions, range],
  );
  const trend = useMemo(() => getNetTrend(transactions, period), [transactions, period]);
  const buckets = useMemo(() => getCashFlowBuckets(transactions, period), [transactions, period]);
  const categories = useMemo(
    () => getCategoryBreakdown(transactions, range, 'expense').slice(0, 4),
    [transactions, range],
  );

  const periodLabel = MONEY_PERIODS.find((p) => p.id === period)?.label ?? 'This Month';
  const maxBucket = Math.max(1, ...buckets.map((b) => Math.max(b.income, b.expense)));
  const hasCashFlow = buckets.some((b) => b.income > 0 || b.expense > 0);
  const barWidth = buckets.length > 6 ? 5 : 10;
  const trendColor = trend.up ? colors.successEmerald : colors.error;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Money" />

      <ThemedScrollView contentContainerStyle={styles.content}>
        {/* High-Level Summary */}
        <View style={[styles.glassCard, { backgroundColor: colors.surfaceGlass, borderColor: colors.surfaceVariant }]}>
          <View style={styles.summaryTop}>
            <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>NET PROFIT</Text>
            <Pressable
              onPress={() => setPeriodSheet(true)}
              style={[styles.periodBtn, { backgroundColor: colors.primary + '14' }]}>
              <Text style={[styles.periodText, { color: colors.primary }]}>{periodLabel}</Text>
              <Icon name="expand-more" size={16} color={colors.primary} />
            </Pressable>
          </View>
          <View style={styles.rowBetween}>
            <Text style={[styles.displayLg, { color: colors.primary }]}>{formatCurrency(net)}</Text>
            <View style={[styles.trendBadge, { backgroundColor: trendColor + '1A' }]}>
              <Icon name={trend.up ? 'trending-up' : 'trending-down'} size={14} color={trendColor} />
              <Text style={[styles.trendText, { color: trendColor }]}>
                {trend.up ? '+' : ''}
                {trend.pct}%
              </Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: colors.primary + '0D' }]}>
              <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Income</Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>{formatCurrency(income)}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.error + '0D' }]}>
              <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Expenses</Text>
              <Text style={[styles.statValue, { color: colors.error }]}>{formatCurrency(expense)}</Text>
            </View>
          </View>
        </View>

        {/* Cash Flow Visualization */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Cash Flow</Text>
            <Text style={[styles.periodCaption, { color: colors.onSurfaceVariant }]}>{periodLabel}</Text>
          </View>

          <View style={[styles.glassCard, { backgroundColor: colors.surfaceGlass, borderColor: colors.surfaceVariant }]}>
            {hasCashFlow ? (
              <View style={styles.chartArea}>
                {buckets.map((b, i) => (
                  <View key={i} style={styles.barGroup}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            width: barWidth,
                            height: `${(b.income / maxBucket) * 100}%`,
                            backgroundColor: colors.primary,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.bar,
                          {
                            width: barWidth,
                            height: `${(b.expense / maxBucket) * 100}%`,
                            backgroundColor: colors.accent,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barLabel, { color: colors.onSurfaceVariant }]}>{b.label}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No cash flow recorded for this period yet.
              </Text>
            )}

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.legendText, { color: colors.onSurfaceVariant }]}>Income</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.legendText, { color: colors.onSurfaceVariant }]}>Expenses</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Spend Categories */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary, marginBottom: 12 }]}>Spend Categories</Text>
          {categories.length > 0 ? (
            <View style={styles.categoriesGrid}>
              {categories.map((cat, i) => {
                const meta = getCategoryMeta(cat.category);
                const accent = i % 2 === 0 ? colors.primary : colors.onTertiaryContainer;
                const bg = i % 2 === 0 ? colors.primaryFixed : colors.tertiaryFixed;
                return (
                  <View
                    key={cat.category}
                    style={[styles.categoryCard, { backgroundColor: colors.surfaceGlass, borderColor: colors.surfaceVariant }]}>
                    <View style={[styles.catIconWrap, { backgroundColor: bg }]}>
                      <Icon name={meta.icon} size={18} color={accent} />
                    </View>
                    <View>
                      <Text style={[styles.catLabel, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                        {meta.label}
                      </Text>
                      <Text style={[styles.catAmount, { color: colors.primary }]}>{formatCurrency(cat.amount)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={[styles.glassCard, { backgroundColor: colors.surfaceGlass, borderColor: colors.surfaceVariant }]}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No expenses recorded for this period.</Text>
            </View>
          )}
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Recent Transactions</Text>
            <Pressable onPress={() => router.push('/(marketplace)/(tabs)/workspace/money/transactions')}>
              <Text style={[styles.viewAll, { color: colors.primary }]}>View All</Text>
            </Pressable>
          </View>

          <View style={styles.transactionsList}>
            {transactions.slice(0, 4).map((t) => {
              const meta = getCategoryMeta(t.category);
              return (
                <View key={t.id} style={[styles.txItem, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant }]}>
                  <View style={styles.txLeft}>
                    <View style={[styles.txIconWrap, { backgroundColor: t.type === 'income' ? colors.successEmerald + '1A' : colors.error + '1A' }]}>
                      <Icon
                        name={t.type === 'income' ? 'south-west' : 'north-east'}
                        size={18}
                        color={t.type === 'income' ? colors.successEmerald : colors.error}
                      />
                    </View>
                    <View style={styles.txTextWrap}>
                      <Text style={[styles.txTitle, { color: colors.primary }]} numberOfLines={1}>
                        {t.description || meta.label}
                      </Text>
                      <Text style={[styles.txDate, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                        {meta.label} • {t.date?.toDate ? t.date.toDate().toLocaleDateString() : ''}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.txAmount, { color: t.type === 'income' ? colors.successEmerald : colors.error }]}>
                    {t.type === 'income' ? '+' : '-'}
                    {formatCurrency(t.amount)}
                  </Text>
                </View>
              );
            })}
            {transactions.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No recent transactions</Text>
            )}
          </View>
        </View>
      </ThemedScrollView>

      <BottomSheet visible={periodSheet} onClose={() => setPeriodSheet(false)} title="Select Period">
        <FilterChipGroup
          label="Period"
          options={MONEY_PERIODS}
          value={period}
          onChange={(id) => {
            setPeriod(id);
            setPeriodSheet(false);
          }}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  content: { padding: Spacing.containerMargin, paddingBottom: 100, gap: Spacing.sectionGap },

  glassCard: {
    padding: 24,
    borderRadius: Radius.lg,
    borderWidth: 1,
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.05,
    shadowRadius: 30,
    elevation: 3,
  },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { ...Typography.labelMd, textTransform: 'uppercase', letterSpacing: 1 },
  periodBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full },
  periodText: { ...Typography.labelMd },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  displayLg: { ...Typography.displayLg },
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, marginBottom: 4 },
  trendText: { ...Typography.labelMd },

  statsGrid: { flexDirection: 'row', gap: 16, marginTop: 24 },
  statBox: { flex: 1, padding: 16, borderRadius: Radius.md },
  statLabel: { ...Typography.labelMd, marginBottom: 4 },
  statValue: { ...Typography.headlineSm },

  section: {},
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.stackMd },
  sectionTitle: { ...Typography.headlineSm },
  periodCaption: { ...Typography.labelMd },
  viewAll: { ...Typography.labelMd, textDecorationLine: 'underline' },

  chartArea: { flexDirection: 'row', alignItems: 'flex-end', height: 176 },
  barGroup: { flex: 1, alignItems: 'center' },
  barTrack: { height: 150, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 2 },
  barLabel: { ...Typography.labelMd, marginTop: 8, fontSize: 11 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 24 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { ...Typography.labelMd },

  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  categoryCard: { flexBasis: '47%', flexGrow: 1, padding: 16, borderRadius: Radius.lg, borderWidth: 1, height: 128, justifyContent: 'space-between' },
  catIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  catLabel: { ...Typography.labelMd },
  catAmount: { ...Typography.headlineSm, fontWeight: 'bold' },

  transactionsList: { gap: 12 },
  txItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: Radius.lg, borderWidth: 1 },
  txLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 },
  txIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  txTextWrap: { flex: 1 },
  txTitle: { ...Typography.bodyLg, fontWeight: 'bold', marginBottom: 2 },
  txDate: { ...Typography.labelMd, fontWeight: 'normal' },
  txAmount: { ...Typography.bodyLg, fontWeight: 'bold' },
  emptyText: { ...Typography.bodyMd, textAlign: 'center', padding: 24 },
});
