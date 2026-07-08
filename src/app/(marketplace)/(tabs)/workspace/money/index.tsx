import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  getOutstanding,
  getPeriodRange,
  getRangeTotals,
} from '@/features/workspace/money-utils';
import { getChequeSummary } from '@/features/workspace/cheque-utils';
import {
  fetchCheques,
  fetchPayables,
  fetchReceivables,
  fetchTransactions,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

const WORKSPACE = '/(marketplace)/(tabs)/workspace';

export default function MoneyDashboard() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const uid = user?.uid;

  const [period, setPeriod] = useState<MoneyPeriod>('this_month');

  const txQuery = useQuery({
    queryKey: ['transactions', uid],
    queryFn: () => fetchTransactions(uid!),
    enabled: !!uid,
  });
  const recQuery = useQuery({
    queryKey: ['receivables', uid],
    queryFn: () => fetchReceivables(uid!),
    enabled: !!uid,
  });
  const payQuery = useQuery({
    queryKey: ['payables', uid],
    queryFn: () => fetchPayables(uid!),
    enabled: !!uid,
  });
  const chequeQuery = useQuery({
    queryKey: ['cheques', uid],
    queryFn: () => fetchCheques(uid!),
    enabled: !!uid,
  });

  const transactions = useMemo(() => txQuery.data ?? [], [txQuery.data]);
  const receivables = useMemo(() => recQuery.data ?? [], [recQuery.data]);
  const payables = useMemo(() => payQuery.data ?? [], [payQuery.data]);
  const cheques = useMemo(() => chequeQuery.data ?? [], [chequeQuery.data]);
  const chequeSummary = useMemo(() => getChequeSummary(cheques), [cheques]);

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
  const outstanding = useMemo(() => getOutstanding(receivables, payables), [receivables, payables]);

  const maxBucket = Math.max(1, ...buckets.map((b) => Math.max(b.income, b.expense)));
  const maxCategory = Math.max(1, ...categories.map((c) => c.amount));
  const hasCashFlow = buckets.some((b) => b.income > 0 || b.expense > 0);
  const recent = transactions.slice(0, 5);

  const onPrimarySoft = colors.onPrimary + '99';
  const onPrimaryHair = colors.onPrimary + '24';

  const onRefresh = () => {
    txQuery.refetch();
    recQuery.refetch();
    payQuery.refetch();
    chequeQuery.refetch();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader
        title="Money"
        right={
          <Pressable
            onPress={() => router.push(`${WORKSPACE}/money/record-sale` as never)}
            hitSlop={8}
            style={[styles.headerAdd, { backgroundColor: colors.primary + '14' }]}>
            <Icon name="add" size={22} color={colors.primary} />
          </Pressable>
        }
      />

      <ThemedScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={txQuery.isRefetching || chequeQuery.isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }>
        {/* Period segmented control */}
        <View style={[styles.segment, { backgroundColor: colors.surfaceContainerLow }]}>
          {MONEY_PERIODS.map((p) => {
            const active = period === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPeriod(p.id)}
                style={[styles.segmentBtn, active && { backgroundColor: colors.surfaceContainerLowest }]}>
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? colors.primary : colors.onSurfaceVariant },
                  ]}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Net profit hero */}
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <View style={styles.heroTop}>
            <Text style={[styles.heroLabel, { color: onPrimarySoft }]}>NET PROFIT</Text>
            <View style={[styles.trendBadge, { backgroundColor: onPrimaryHair }]}>
              <Icon name={trend.up ? 'trending-up' : 'trending-down'} size={14} color={colors.onPrimary} />
              <Text style={[styles.trendText, { color: colors.onPrimary }]}>
                {trend.up ? '+' : ''}
                {trend.pct}%
              </Text>
            </View>
          </View>

          <Text style={[styles.heroValue, { color: colors.onPrimary }]}>{formatCurrency(net)}</Text>

          <View style={[styles.heroDivider, { backgroundColor: onPrimaryHair }]} />

          <View style={styles.heroSplit}>
            <View style={styles.heroCol}>
              <View style={styles.heroColLabel}>
                <View style={[styles.dot, { backgroundColor: colors.successEmerald }]} />
                <Text style={[styles.heroColCaption, { color: onPrimarySoft }]}>Income</Text>
              </View>
              <Text style={[styles.heroColValue, { color: colors.onPrimary }]}>{formatCurrency(income)}</Text>
            </View>
            <View style={styles.heroCol}>
              <View style={styles.heroColLabel}>
                <View style={[styles.dot, { backgroundColor: colors.warningAmber }]} />
                <Text style={[styles.heroColCaption, { color: onPrimarySoft }]}>Expenses</Text>
              </View>
              <Text style={[styles.heroColValue, { color: colors.onPrimary }]}>{formatCurrency(expense)}</Text>
            </View>
          </View>
        </View>

        {/* Outstanding */}
        <View style={styles.outRow}>
          <Pressable
            onPress={() => router.push(`${WORKSPACE}/money/receivables` as never)}
            style={({ pressed }) => [
              styles.outCard,
              { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant },
              pressed && { opacity: 0.7 },
            ]}>
            <View style={[styles.outIcon, { backgroundColor: colors.successEmerald + '1F' }]}>
              <Icon name="south-west" size={18} color={colors.successEmerald} />
            </View>
            <Text style={[styles.outValue, { color: colors.onSurface }]}>{formatCurrency(outstanding.toCollect)}</Text>
            <Text style={[styles.outLabel, { color: colors.textMuted }]}>To collect</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push(`${WORKSPACE}/money/payables` as never)}
            style={({ pressed }) => [
              styles.outCard,
              { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant },
              pressed && { opacity: 0.7 },
            ]}>
            <View style={[styles.outIcon, { backgroundColor: colors.warningAmber + '1F' }]}>
              <Icon name="north-east" size={18} color={colors.warningAmber} />
            </View>
            <Text style={[styles.outValue, { color: colors.onSurface }]}>{formatCurrency(outstanding.toPay)}</Text>
            <Text style={[styles.outLabel, { color: colors.textMuted }]}>To pay</Text>
          </Pressable>
        </View>

        {/* Cheques */}
        <Pressable
          onPress={() => router.push(`${WORKSPACE}/cheques` as never)}
          style={({ pressed }) => [
            styles.chequeCard,
            { backgroundColor: colors.primary, borderColor: 'transparent' },
            pressed && { opacity: 0.92 },
          ]}>
          <View style={styles.chequeCardLeft}>
            <Icon name="receipt-long" size={22} color={colors.onPrimary} />
            <View>
              <Text style={[styles.chequeCardTitle, { color: colors.onPrimary }]}>Cheque tracker</Text>
              <Text style={[styles.chequeCardSub, { color: colors.onPrimary + 'AA' }]}>
                {chequeSummary.pendingCount > 0
                  ? `${chequeSummary.pendingCount} pending · ${formatCurrency(chequeSummary.pendingTotal)}`
                  : 'Track post-dated cheques'}
              </Text>
            </View>
          </View>
          <Icon name="chevron-right" size={22} color={colors.onPrimary + '99'} />
        </Pressable>

        {/* Reports & payments */}
        <View style={styles.toolsRow}>
          <Pressable
            onPress={() => router.push(`${WORKSPACE}/money/reports` as never)}
            style={({ pressed }) => [
              styles.toolCard,
              { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant },
              pressed && { opacity: 0.85 },
            ]}>
            <Icon name="picture-as-pdf" size={22} color={colors.primary} />
            <Text style={[styles.toolLabel, { color: colors.onSurface }]}>PDF Reports</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`${WORKSPACE}/money/payments` as never)}
            style={({ pressed }) => [
              styles.toolCard,
              { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant },
              pressed && { opacity: 0.85 },
            ]}>
            <Icon name="payments" size={22} color={colors.primary} />
            <Text style={[styles.toolLabel, { color: colors.onSurface }]}>Payments</Text>
          </Pressable>
        </View>

        {/* Cash flow */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Cash flow</Text>
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant }]}>
            {hasCashFlow ? (
              <View style={styles.chartArea}>
                {buckets.map((b, i) => (
                  <View key={i} style={styles.barGroup}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          { height: `${(b.income / maxBucket) * 100}%`, backgroundColor: colors.successEmerald },
                        ]}
                      />
                      <View
                        style={[
                          styles.bar,
                          { height: `${(b.expense / maxBucket) * 100}%`, backgroundColor: colors.warningAmber },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barLabel, { color: colors.textMuted }]}>{b.label}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <Icon name="bar-chart" size={26} color={colors.outline} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No cash flow this period yet
                </Text>
              </View>
            )}

            <View style={[styles.legendRow, { borderTopColor: colors.surfaceVariant }]}>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: colors.successEmerald }]} />
                <Text style={[styles.legendText, { color: colors.onSurfaceVariant }]}>Income</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: colors.warningAmber }]} />
                <Text style={[styles.legendText, { color: colors.onSurfaceVariant }]}>Expenses</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Spend categories */}
        {categories.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Top spend</Text>
            <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant }]}>
              {categories.map((cat, i) => {
                const meta = getCategoryMeta(cat.category);
                return (
                  <View key={cat.category} style={[styles.catRow, i > 0 && styles.catRowGap]}>
                    <View style={[styles.catIcon, { backgroundColor: colors.primary + '14' }]}>
                      <Icon name={meta.icon} size={18} color={colors.primary} />
                    </View>
                    <View style={styles.catBody}>
                      <View style={styles.catTop}>
                        <Text style={[styles.catLabel, { color: colors.onSurface }]} numberOfLines={1}>
                          {meta.label}
                        </Text>
                        <Text style={[styles.catAmount, { color: colors.onSurface }]}>
                          {formatCurrency(cat.amount)}
                        </Text>
                      </View>
                      <View style={[styles.catTrack, { backgroundColor: colors.surfaceContainerHigh }]}>
                          <View
                          style={[
                            styles.catFill,
                            { backgroundColor: colors.warningAmber, width: `${(cat.amount / maxCategory) * 100}%` },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Recent transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface, marginBottom: 0 }]}>Recent activity</Text>
            {transactions.length > 0 ? (
              <Pressable onPress={() => router.push(`${WORKSPACE}/money/transactions` as never)} hitSlop={8}>
                <Text style={[styles.viewAll, { color: colors.primary }]}>View all</Text>
              </Pressable>
            ) : null}
          </View>

          {recent.length > 0 ? (
            <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant }]}>
              {recent.map((t, i) => {
                const meta = getCategoryMeta(t.category);
                const isIncome = t.type === 'income';
                const tone = isIncome ? colors.successEmerald : colors.error;
                return (
                  <View key={t.id} style={[styles.txRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.surfaceVariant }]}>
                    <View style={[styles.txIcon, { backgroundColor: tone + '1A' }]}>
                      <Icon name={isIncome ? 'south-west' : 'north-east'} size={18} color={tone} />
                    </View>
                    <View style={styles.txBody}>
                      <Text style={[styles.txTitle, { color: colors.onSurface }]} numberOfLines={1}>
                        {t.description || meta.label}
                      </Text>
                      <Text style={[styles.txSub, { color: colors.textMuted }]} numberOfLines={1}>
                        {meta.label} · {t.date?.toDate ? t.date.toDate().toLocaleDateString() : ''}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount, { color: tone }]}>
                      {isIncome ? '+' : '−'}
                      {formatCurrency(t.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant }]}>
              <View style={styles.emptyBox}>
                <Icon name="receipt-long" size={26} color={colors.outline} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No transactions yet</Text>
                <Pressable
                  onPress={() => router.push(`${WORKSPACE}/money/record-sale` as never)}
                  style={[styles.emptyBtn, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.emptyBtnText, { color: colors.onPrimary }]}>Record a sale</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.stackSm,
    paddingBottom: 120,
    gap: Spacing.gutterMd,
  },
  headerAdd: { width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },

  segment: { flexDirection: 'row', padding: 4, borderRadius: Radius.full, gap: 4 },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: Radius.full, alignItems: 'center' },
  segmentText: { ...Typography.labelMd },

  hero: {
    borderRadius: Radius.xl,
    padding: Spacing.containerMargin,
    gap: 6,
    boxShadow: '0 10px 30px rgba(0, 22, 44, 0.12)',
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { ...Typography.labelMd, letterSpacing: 1 },
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  trendText: { ...Typography.labelMd },
  heroValue: { ...Typography.displayLg },
  heroDivider: { height: 1, marginVertical: Spacing.stackMd },
  heroSplit: { flexDirection: 'row' },
  heroCol: { flex: 1, gap: 6 },
  heroColLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroColCaption: { ...Typography.bodyMd },
  heroColValue: { ...Typography.headlineSm },
  dot: { width: 8, height: 8, borderRadius: 4 },

  outRow: { flexDirection: 'row', gap: Spacing.stackMd },
  outCard: { flex: 1, padding: Spacing.gutterMd, borderRadius: Radius.lg, borderWidth: 1, gap: 8 },
  outIcon: { width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  outValue: { ...Typography.headlineSm },
  outLabel: { ...Typography.labelMd },

  chequeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.gutterMd,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  chequeCardLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  chequeCardTitle: { ...Typography.labelMd, fontWeight: '700' },
  chequeCardSub: { ...Typography.bodySmall, marginTop: 2 },

  toolsRow: { flexDirection: 'row', gap: Spacing.stackMd },
  toolCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.gutterMd,
    borderRadius: Radius.lg,
    borderWidth: 1,
    minHeight: 52,
  },
  toolLabel: { ...Typography.labelMd, fontWeight: '600' },

  section: { gap: Spacing.stackMd },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...Typography.headlineSmMobile, marginBottom: 2 },
  viewAll: { ...Typography.labelMd },

  card: { padding: Spacing.gutterMd, borderRadius: Radius.xl, borderWidth: 1 },

  chartArea: { flexDirection: 'row', alignItems: 'flex-end', height: 168, paddingTop: 8 },
  barGroup: { flex: 1, alignItems: 'center' },
  barTrack: { height: 140, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  bar: { width: 9, borderRadius: 5, minHeight: 3 },
  barLabel: { ...Typography.labelMd, marginTop: 8, fontSize: 11 },

  legendRow: { flexDirection: 'row', gap: Spacing.gutterMd, marginTop: Spacing.gutterMd, paddingTop: Spacing.stackMd, borderTopWidth: 1 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { ...Typography.labelMd },

  catRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.stackMd },
  catRowGap: { marginTop: Spacing.gutterMd },
  catIcon: { width: 40, height: 40, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  catBody: { flex: 1, gap: 8 },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catLabel: { ...Typography.bodyLg, fontWeight: '600', flex: 1, marginRight: 8 },
  catAmount: { ...Typography.bodyMd, fontWeight: '700' },
  catTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  catFill: { height: '100%', borderRadius: 3 },

  txRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.stackMd, paddingVertical: Spacing.stackMd },
  txIcon: { width: 42, height: 42, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  txBody: { flex: 1, gap: 2 },
  txTitle: { ...Typography.bodyLg, fontWeight: '600' },
  txSub: { ...Typography.bodyMd },
  txAmount: { ...Typography.bodyLg, fontWeight: '700' },

  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sectionGap, gap: Spacing.stackMd },
  emptyText: { ...Typography.bodyMd, textAlign: 'center' },
  emptyBtn: { paddingHorizontal: Spacing.gutterMd, paddingVertical: 10, borderRadius: Radius.full, marginTop: 4 },
  emptyBtnText: { ...Typography.labelMd },
});
