import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    FormSection,
    FormSectionLabel,
    ScreenInset,
} from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { DateRangeSheet } from "@/components/workspace/date-range-sheet";
import { WorkspaceScreenBackdrop } from "@/components/workspace/workspace-screen-backdrop";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { getCategoryMeta } from "@/constants/transaction-categories";
import {
    MONEY_PERIODS,
    type DateRange,
    type MoneyPeriod,
    getCashFlowBuckets,
    getCashFlowBucketsForRange,
    getCategoryBreakdown,
    getNetTrend,
    getNetTrendForRange,
    getOutstanding,
    getPeriodRange,
    getRangeTotals,
} from "@/features/workspace/money-utils";
import {
  subscribeCheques,
  subscribePayables,
  subscribeReceivables,
  subscribeTransactions,
} from "@/features/workspace/firestore-subscriptions";
import {
    fetchCheques,
    fetchPayables,
    fetchReceivables,
    fetchTransactions,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { useAuth } from "@/providers/auth-provider";

const MONEY = "/(marketplace)/(tabs)/money";

export default function MoneyDashboard() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { formatBase, formatStored } = usePreferredMoney();
  const uid = user?.uid;

  const [period, setPeriod] = useState<MoneyPeriod>("this_month");
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const txQuery = useFirestoreLiveQuery({
    queryKey: ["transactions", uid],
    queryFn: () => fetchTransactions(uid!),
    subscribe: (onData, onError) => subscribeTransactions(uid!, onData, onError),
    enabled: !!uid,
  });
  const recQuery = useFirestoreLiveQuery({
    queryKey: ["receivables", uid],
    queryFn: () => fetchReceivables(uid!),
    subscribe: (onData, onError) => subscribeReceivables(uid!, onData, onError),
    enabled: !!uid,
  });
  const payQuery = useFirestoreLiveQuery({
    queryKey: ["payables", uid],
    queryFn: () => fetchPayables(uid!),
    subscribe: (onData, onError) => subscribePayables(uid!, onData, onError),
    enabled: !!uid,
  });
  const chequeQuery = useFirestoreLiveQuery({
    queryKey: ["cheques", uid],
    queryFn: () => fetchCheques(uid!),
    subscribe: (onData, onError) => subscribeCheques(uid!, onData, onError),
    enabled: !!uid,
  });

  const transactions = useMemo(() => txQuery.data ?? [], [txQuery.data]);
  const receivables = useMemo(() => recQuery.data ?? [], [recQuery.data]);
  const payables = useMemo(() => payQuery.data ?? [], [payQuery.data]);

  const range = useMemo(
    () => customRange ?? getPeriodRange(period),
    [customRange, period],
  );
  const { income, expense, net } = useMemo(
    () => getRangeTotals(transactions, range),
    [transactions, range],
  );
  const trend = useMemo(
    () =>
      customRange
        ? getNetTrendForRange(transactions, customRange)
        : getNetTrend(transactions, period),
    [transactions, period, customRange],
  );
  const buckets = useMemo(
    () =>
      customRange
        ? getCashFlowBucketsForRange(transactions, customRange)
        : getCashFlowBuckets(transactions, period),
    [transactions, period, customRange],
  );
  const categories = useMemo(
    () => getCategoryBreakdown(transactions, range, "expense").slice(0, 4),
    [transactions, range],
  );
  const outstanding = useMemo(
    () => getOutstanding(receivables, payables),
    [receivables, payables],
  );

  const maxBucket = Math.max(
    1,
    ...buckets.map((b) => Math.max(b.income, b.expense)),
  );
  const maxCategory = Math.max(1, ...categories.map((c) => c.amount));
  const hasCashFlow = buckets.some((b) => b.income > 0 || b.expense > 0);
  const rangedTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        const date = t.date.toDate();
        return date >= range.start && date <= range.end;
      }),
    [transactions, range],
  );
  const recent = rangedTransactions.slice(0, 5);

  const onPrimarySoft = colors.onPrimary + "99";
  const onPrimaryHair = colors.onPrimary + "24";

  const onRefresh = () => {
    txQuery.refetch();
    recQuery.refetch();
    payQuery.refetch();
    chequeQuery.refetch();
  };

  const selectPeriod = (id: MoneyPeriod) => {
    setCustomRange(null);
    setPeriod(id);
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <WorkspaceScreenBackdrop kind="money" />
      <StackHeader
        title="Money"
        showBack={false}
        right={
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Filter by date range"
              hitSlop={8}
              onPress={() => setCalendarOpen(true)}
              style={styles.headerBtn}
            >
              <Icon
                name="calendar-month"
                size={24}
                color={customRange ? colors.primary : colors.onSurface}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="PDF Reports"
              hitSlop={8}
              onPress={() => router.push(`${MONEY}/reports` as never)}
              style={styles.headerBtn}
            >
              <Icon name="picture-as-pdf" size={24} color={colors.onSurface} />
            </Pressable>
          </View>
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
        }
      >
        <ScreenInset style={styles.inset}>
          {/* Period segmented control */}
          <View
            style={[
              styles.segment,
              { backgroundColor: colors.surfaceContainerLow },
            ]}
          >
            {MONEY_PERIODS.map((p) => {
              const active = !customRange && period === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => selectPeriod(p.id)}
                  style={[
                    styles.segmentBtn,
                    active && {
                      backgroundColor: colors.surfaceContainerLowest,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: active
                          ? colors.primary
                          : colors.onSurfaceVariant,
                      },
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {customRange ? (
            <Pressable
              onPress={() => setCalendarOpen(true)}
              style={[
                styles.rangeChip,
                {
                  backgroundColor: colors.primary + "14",
                  borderColor: colors.primary + "33",
                },
              ]}
            >
              <Icon name="date-range" size={16} color={colors.primary} />
              <Text
                selectable
                style={[styles.rangeChipText, { color: colors.primary }]}
              >
                {customRange.label}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear date filter"
                hitSlop={8}
                onPress={() => {
                  setCustomRange(null);
                  setPeriod("this_month");
                }}
              >
                <Icon name="close" size={16} color={colors.primary} />
              </Pressable>
            </Pressable>
          ) : null}

          {/* Net profit hero */}
          <View style={[styles.hero, { backgroundColor: colors.primary }]}>
            <View style={styles.heroTop}>
              <Text style={[styles.heroLabel, { color: onPrimarySoft }]}>
                NET PROFIT
              </Text>
              <View
                style={[styles.trendBadge, { backgroundColor: onPrimaryHair }]}
              >
                <Icon
                  name={trend.up ? "trending-up" : "trending-down"}
                  size={14}
                  color={colors.onPrimary}
                />
                <Text style={[styles.trendText, { color: colors.onPrimary }]}>
                  {trend.up ? "+" : ""}
                  {trend.pct}%
                </Text>
              </View>
            </View>

            <Text style={[styles.heroValue, { color: colors.onPrimary }]}>
              {formatBase(net)}
            </Text>

            <View
              style={[styles.heroDivider, { backgroundColor: onPrimaryHair }]}
            />

            <View style={styles.heroSplit}>
              <View style={styles.heroCol}>
                <View style={styles.heroColLabel}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: colors.successEmerald },
                    ]}
                  />
                  <Text
                    style={[styles.heroColCaption, { color: onPrimarySoft }]}
                  >
                    Income
                  </Text>
                </View>
                <Text
                  style={[styles.heroColValue, { color: colors.onPrimary }]}
                >
                  {formatBase(income)}
                </Text>
              </View>
              <View style={styles.heroCol}>
                <View style={styles.heroColLabel}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: colors.warningAmber },
                    ]}
                  />
                  <Text
                    style={[styles.heroColCaption, { color: onPrimarySoft }]}
                  >
                    Expenses
                  </Text>
                </View>
                <Text
                  style={[styles.heroColValue, { color: colors.onPrimary }]}
                >
                  {formatBase(expense)}
                </Text>
              </View>
            </View>
          </View>

          {/* Outstanding */}
          <View style={styles.outRow}>
            <Pressable
              onPress={() => router.push(`${MONEY}/receivables` as never)}
              style={({ pressed }) => [
                styles.outCard,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.surfaceVariant,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View
                style={[
                  styles.outIcon,
                  { backgroundColor: colors.successEmerald + "1F" },
                ]}
              >
                <Icon
                  name="south-west"
                  size={18}
                  color={colors.successEmerald}
                />
              </View>
              <Text style={[styles.outValue, { color: colors.onSurface }]}>
                {formatBase(outstanding.toCollect)}
              </Text>
              <Text style={[styles.outLabel, { color: colors.textMuted }]}>
                To collect
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push(`${MONEY}/payables` as never)}
              style={({ pressed }) => [
                styles.outCard,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.surfaceVariant,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View
                style={[
                  styles.outIcon,
                  { backgroundColor: colors.warningAmber + "1F" },
                ]}
              >
                <Icon name="north-east" size={18} color={colors.warningAmber} />
              </View>
              <Text style={[styles.outValue, { color: colors.onSurface }]}>
                {formatBase(outstanding.toPay)}
              </Text>
              <Text style={[styles.outLabel, { color: colors.textMuted }]}>
                To pay
              </Text>
            </Pressable>
          </View>

          {/* Payments */}
          <Pressable
            onPress={() => router.push(`${MONEY}/payments` as never)}
            style={({ pressed }) => [
              styles.toolCard,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.surfaceVariant,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Icon name="payments" size={22} color={colors.primary} />
            <Text style={[styles.toolLabel, { color: colors.onSurface }]}>
              Payments
            </Text>
          </Pressable>
        </ScreenInset>

        {/* Cash flow */}
        <FormSection title="Cash flow">
          {hasCashFlow ? (
            <View style={styles.chartArea}>
              {buckets.map((b, i) => (
                <View key={i} style={styles.barGroup}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${(b.income / maxBucket) * 100}%`,
                          backgroundColor: colors.successEmerald,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${(b.expense / maxBucket) * 100}%`,
                          backgroundColor: colors.warningAmber,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barLabel, { color: colors.textMuted }]}>
                    {b.label}
                  </Text>
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

          <View
            style={[
              styles.legendRow,
              { borderTopColor: colors.surfaceVariant },
            ]}
          >
            <View style={styles.legendItem}>
              <View
                style={[styles.dot, { backgroundColor: colors.successEmerald }]}
              />
              <Text
                style={[styles.legendText, { color: colors.onSurfaceVariant }]}
              >
                Income
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.dot, { backgroundColor: colors.warningAmber }]}
              />
              <Text
                style={[styles.legendText, { color: colors.onSurfaceVariant }]}
              >
                Expenses
              </Text>
            </View>
          </View>
        </FormSection>

        {/* Spend categories */}
        {categories.length > 0 ? (
          <FormSection title="Top spend">
            {categories.map((cat, i) => {
              const meta = getCategoryMeta(cat.category);
              return (
                <View
                  key={cat.category}
                  style={[styles.catRow, i > 0 && styles.catRowGap]}
                >
                  <View
                    style={[
                      styles.catIcon,
                      { backgroundColor: colors.primary + "14" },
                    ]}
                  >
                    <Icon name={meta.icon} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.catBody}>
                    <View style={styles.catTop}>
                      <Text
                        style={[styles.catLabel, { color: colors.onSurface }]}
                        numberOfLines={1}
                      >
                        {meta.label}
                      </Text>
                      <Text
                        style={[styles.catAmount, { color: colors.onSurface }]}
                      >
                        {formatBase(cat.amount)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.catTrack,
                        { backgroundColor: colors.surfaceContainerHigh },
                      ]}
                    >
                      <View
                        style={[
                          styles.catFill,
                          {
                            backgroundColor: colors.warningAmber,
                            width: `${(cat.amount / maxCategory) * 100}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </FormSection>
        ) : null}

        {/* Recent transactions */}
        <FormSectionLabel title="Recent activity" />
        <ScreenInset style={styles.sectionHeader}>
          {rangedTransactions.length > 0 ? (
            <Pressable
              onPress={() => router.push(`${MONEY}/transactions` as never)}
              hitSlop={8}
              style={styles.viewAllBtn}
            >
              <Text style={[styles.viewAll, { color: colors.primary }]}>
                View all
              </Text>
            </Pressable>
          ) : null}
        </ScreenInset>

        {recent.length > 0 ? (
          <FormSection>
            {recent.map((t, i) => {
              const meta = getCategoryMeta(t.category);
              const isIncome = t.type === "income";
              const tone = isIncome ? colors.successEmerald : colors.error;
              return (
                <View
                  key={t.id}
                  style={[
                    styles.txRow,
                    i > 0 && {
                      borderTopWidth: 1,
                      borderTopColor: colors.surfaceVariant,
                    },
                  ]}
                >
                  <View
                    style={[styles.txIcon, { backgroundColor: tone + "1A" }]}
                  >
                    <Icon
                      name={isIncome ? "south-west" : "north-east"}
                      size={18}
                      color={tone}
                    />
                  </View>
                  <View style={styles.txBody}>
                    <Text
                      style={[styles.txTitle, { color: colors.onSurface }]}
                      numberOfLines={1}
                    >
                      {t.description || meta.label}
                    </Text>
                    <Text
                      style={[styles.txSub, { color: colors.textMuted }]}
                      numberOfLines={1}
                    >
                      {meta.label} ·{" "}
                      {t.date?.toDate
                        ? t.date.toDate().toLocaleDateString()
                        : ""}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, { color: tone }]}>
                    {isIncome ? "+" : "−"}
                    {formatStored({
                      amount: t.amount,
                      currency: t.currency,
                      amountBase: t.amountBase,
                    })}
                  </Text>
                </View>
              );
            })}
          </FormSection>
        ) : (
          <FormSection>
            <View style={styles.emptyBox}>
              <Icon name="receipt-long" size={26} color={colors.outline} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No transactions yet
              </Text>
              <Pressable
                onPress={() => router.push(`${MONEY}/record-sale` as never)}
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              >
                <Text
                  style={[styles.emptyBtnText, { color: colors.onPrimary }]}
                >
                  Record a sale
                </Text>
              </Pressable>
            </View>
          </FormSection>
        )}
      </ThemedScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Record a sale"
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
        ]}
        onPress={() => router.push(`${MONEY}/record-sale` as never)}
      >
        <Icon name="add" size={28} color={colors.onPrimary} />
      </Pressable>

      <DateRangeSheet
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        value={range}
        activePeriod={customRange ? null : period}
        onApply={(next, nextPeriod) => {
          if (nextPeriod) {
            setCustomRange(null);
            setPeriod(nextPeriod);
            return;
          }
          setCustomRange(next);
        }}
        onClear={() => {
          setCustomRange(null);
          setPeriod("this_month");
          setCalendarOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingTop: Spacing.stackSm,
    paddingBottom: 120,
    gap: Spacing.gutterMd,
  },
  inset: { gap: Spacing.gutterMd },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 20px rgba(0, 0, 0, 0.28)",
    zIndex: 100,
  },

  segment: {
    flexDirection: "row",
    padding: 4,
    borderRadius: Radius.full,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: Radius.full,
    alignItems: "center",
  },
  segmentText: { ...Typography.labelMd },
  rangeChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  rangeChipText: { ...Typography.labelMd, fontWeight: "600" },

  hero: {
    borderRadius: Radius.xl,
    padding: Spacing.containerMargin,
    gap: 6,
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.12)",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroLabel: { ...Typography.labelMd, letterSpacing: 1 },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  trendText: { ...Typography.labelMd },
  heroValue: { ...Typography.displayLg },
  heroDivider: { height: 1, marginVertical: Spacing.stackMd },
  heroSplit: { flexDirection: "row" },
  heroCol: { flex: 1, gap: 6 },
  heroColLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroColCaption: { ...Typography.bodyMd },
  heroColValue: { ...Typography.headlineSm },
  dot: { width: 8, height: 8, borderRadius: 4 },

  outRow: { flexDirection: "row", gap: Spacing.stackMd },
  outCard: {
    flex: 1,
    padding: Spacing.gutterMd,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 8,
  },
  outIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  outValue: { ...Typography.headlineSm },
  outLabel: { ...Typography.labelMd },

  chequeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.gutterMd,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  chequeCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  chequeCardTitle: { ...Typography.labelMd, fontWeight: "700" },
  chequeCardSub: { ...Typography.bodySmall, marginTop: 2 },

  toolCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.gutterMd,
    borderRadius: Radius.lg,
    borderWidth: 1,
    minHeight: 52,
  },
  toolLabel: { ...Typography.labelMd, fontWeight: "600" },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: -Spacing.sm,
  },
  viewAllBtn: { marginTop: -Spacing.md },
  viewAll: { ...Typography.labelMd },

  chartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 168,
    paddingTop: 8,
  },
  barGroup: { flex: 1, alignItems: "center" },
  barTrack: {
    height: 140,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 4,
  },
  bar: { width: 9, borderRadius: 5, minHeight: 3 },
  barLabel: { ...Typography.labelMd, marginTop: 8, fontSize: 11 },

  legendRow: {
    flexDirection: "row",
    gap: Spacing.gutterMd,
    marginTop: Spacing.gutterMd,
    paddingTop: Spacing.stackMd,
    borderTopWidth: 1,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendText: { ...Typography.labelMd },

  catRow: { flexDirection: "row", alignItems: "center", gap: Spacing.stackMd },
  catRowGap: { marginTop: Spacing.gutterMd },
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  catBody: { flex: 1, gap: 8 },
  catTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  catLabel: {
    ...Typography.bodyLg,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  catAmount: { ...Typography.bodyMd, fontWeight: "700" },
  catTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  catFill: { height: "100%", borderRadius: 3 },

  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.stackMd,
    paddingVertical: Spacing.stackMd,
  },
  txIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  txBody: { flex: 1, gap: 2 },
  txTitle: { ...Typography.bodyLg, fontWeight: "600" },
  txSub: { ...Typography.bodyMd },
  txAmount: { ...Typography.bodyLg, fontWeight: "700" },

  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sectionGap,
    gap: Spacing.stackMd,
  },
  emptyText: { ...Typography.bodyMd, textAlign: "center" },
  emptyBtn: {
    paddingHorizontal: Spacing.gutterMd,
    paddingVertical: 10,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  emptyBtnText: { ...Typography.labelMd },
});
