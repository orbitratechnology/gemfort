import { keepPreviousData } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import type { KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { CashFlowChart } from "@/components/money/cash-flow-chart";
import { InsightGrid, InsightTile } from "@/components/money/insight-tile";
import { MoneyActionsSheet } from "@/components/money/money-actions-sheet";
import { useMoneyChartTheme } from "@/components/money/money-chart-theme";
import { MoneyInsightSheet, type MoneyInsight } from "@/components/money/money-insight-sheet";
import { MoneySummaryCard } from "@/components/money/money-summary-card";
import { SegmentedControl } from "@/components/money/segmented-control";
import { ShareBars } from "@/components/money/share-bars";
import { SpendBreakdown } from "@/components/money/spend-breakdown";
import { TourHelpButton } from "@/components/onboarding/tour-help-button";
import { Accent, IconBubble, ListItem } from "@/components/ui/detail-kit";
import {
    FormSection,
    FormSectionLabel,
    ScreenInset,
} from "@/components/ui/form-section";
import { Icon, type IconName } from "@/components/ui/icon";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { DateRangeSheet } from "@/components/workspace/date-range-sheet";
import { QuickActionsFab } from "@/components/workspace/quick-actions-sheet";
import { WorkspaceScreenBackdrop } from "@/components/workspace/workspace-screen-backdrop";
import { FontFamily, Radius, Spacing } from "@/constants/design-tokens";
import { getCategoryMeta } from "@/constants/transaction-categories";
import {
    subscribeAllGems,
    subscribeContacts,
    subscribeOpenPayables,
    subscribeOpenReceivables,
    subscribePendingCheques,
    subscribeTransactionsInRange,
} from "@/features/workspace/firestore-subscriptions";
import {
    getChequeOutlook,
    getStockPosition,
    getStoneSales,
} from "@/features/workspace/money-insights";
import {
    getCashFlowBuckets,
    getCashFlowBucketsForRange,
    getCategoryBreakdown,
    getComparisonWindow,
    getNetTrend,
    getNetTrendForRange,
    getOutstanding,
    getPeriodRange,
    getRangeTotals,
    MONEY_PERIODS,
    type DateRange,
    type MoneyPeriod,
} from "@/features/workspace/money-utils";
import {
    getPaymentSourceMeta,
    paymentSourceHref,
    sourceOfTransaction,
} from "@/features/workspace/payment-source";
import {
    effectivePayableStatus,
    effectiveReceivableStatus,
} from "@/features/workspace/payment-utils";
import {
    fetchAllGems,
    fetchContacts,
    fetchOpenPayables,
    fetchOpenReceivables,
    fetchPendingCheques,
    fetchTransactionsInRange,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { useTourTarget } from "@/lib/tour-target";
import { useAuth } from "@/providers/auth-provider";

const MONEY = "/(marketplace)/(tabs)/money";
const RECENT_LIMIT = 5;

const COMPARISON_LABEL: Record<MoneyPeriod, string> = {
  this_month: "vs last month",
  last_month: "vs the month before",
  this_year: "vs last year",
};

export default function MoneyDashboard() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const chart = useMoneyChartTheme();
  const { formatBase, formatBaseCompact, formatStored } = usePreferredMoney();
  const uid = user?.uid;

  const [period, setPeriod] = useState<MoneyPeriod>("this_month");
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [insight, setInsight] = useState<MoneyInsight | null>(null);
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const periodTourTarget = useTourTarget("money-period", { scrollRef });
  const dateFilterTourTarget = useTourTarget("money-date-filter");
  const actionsTourTarget = useTourTarget("money-record-sale");

  // Load exactly the selected range plus the span its trend compares with —
  // uncapped, so totals never silently drop older transactions.
  const txWindow = useMemo(
    () => getComparisonWindow(period, customRange),
    [period, customRange],
  );
  const txQuery = useFirestoreLiveQuery({
    queryKey: ["transactions", uid, "range", txWindow.start.getTime(), txWindow.end.getTime()],
    queryFn: () => fetchTransactionsInRange(uid!, txWindow.start, txWindow.end),
    subscribe: (onData, onError) =>
      subscribeTransactionsInRange(uid!, txWindow.start, txWindow.end, onData, onError),
    enabled: !!uid,
    placeholderData: keepPreviousData,
  });
  const recQuery = useFirestoreLiveQuery({
    queryKey: ["receivables", uid, "open"],
    queryFn: () => fetchOpenReceivables(uid!),
    subscribe: (onData, onError) => subscribeOpenReceivables(uid!, onData, onError),
    enabled: !!uid,
  });
  const payQuery = useFirestoreLiveQuery({
    queryKey: ["payables", uid, "open"],
    queryFn: () => fetchOpenPayables(uid!),
    subscribe: (onData, onError) => subscribeOpenPayables(uid!, onData, onError),
    enabled: !!uid,
  });
  const gemsQuery = useFirestoreLiveQuery({
    queryKey: ["gems", uid, "all"],
    queryFn: () => fetchAllGems(uid!),
    subscribe: (onData, onError) => subscribeAllGems(uid!, onData, onError),
    enabled: !!uid,
  });
  const chequeQuery = useFirestoreLiveQuery({
    queryKey: ["cheques", uid, "pending"],
    queryFn: () => fetchPendingCheques(uid!),
    subscribe: (onData, onError) => subscribePendingCheques(uid!, onData, onError),
    enabled: !!uid,
  });
  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ["contacts", uid],
    queryFn: () => fetchContacts(uid!),
    subscribe: (onData, onError) => subscribeContacts(uid!, onData, onError),
    enabled: !!uid,
  });

  const transactions = useMemo(() => txQuery.data ?? [], [txQuery.data]);
  const receivables = useMemo(() => recQuery.data ?? [], [recQuery.data]);
  const payables = useMemo(() => payQuery.data ?? [], [payQuery.data]);
  const gems = useMemo(() => gemsQuery.data ?? [], [gemsQuery.data]);
  const cheques = useMemo(() => chequeQuery.data ?? [], [chequeQuery.data]);
  const loadingTx = txQuery.isLoading && !txQuery.data;
  const loadingGems = gemsQuery.isLoading && !gemsQuery.data;

  const contactName = useMemo(() => {
    const map = new Map(contacts.map((c) => [c.id, c.displayName?.trim() || null]));
    return (id: string | null) => (id ? map.get(id) ?? null : null);
  }, [contacts]);

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
  const spend = useMemo(
    () => getCategoryBreakdown(transactions, range, "expense"),
    [transactions, range],
  );
  const sales = useMemo(() => getStoneSales(gems, range), [gems, range]);
  const stock = useMemo(() => getStockPosition(gems), [gems]);
  const chequeOutlook = useMemo(() => getChequeOutlook(cheques), [cheques]);
  const outstanding = useMemo(
    () => getOutstanding(receivables, payables),
    [receivables, payables],
  );
  const overdue = useMemo(
    () => ({
      collect: receivables.filter((r) => effectiveReceivableStatus(r) === "overdue").length,
      pay: payables.filter((p) => effectivePayableStatus(p) === "overdue").length,
    }),
    [receivables, payables],
  );
  const recent = useMemo(
    () =>
      transactions
        .filter((t) => {
          const date = t.date?.toDate?.();
          return !!date && date >= range.start && date <= range.end;
        })
        .slice(0, RECENT_LIMIT),
    [transactions, range],
  );

  const periodText = range.label.toLowerCase();
  const comparison = customRange ? "vs the previous span" : COMPARISON_LABEL[period];

  const onRefresh = () => {
    void txQuery.refetch();
    void recQuery.refetch();
    void payQuery.refetch();
    void gemsQuery.refetch();
    void chequeQuery.refetch();
  };

  const clearRange = () => {
    setCustomRange(null);
    setPeriod("this_month");
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
        left={
          <Pressable
            ref={dateFilterTourTarget}
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
        }
        right={<TourHelpButton tourId="money" />}
      />

      <ThemedScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={
              txQuery.isRefetching ||
              recQuery.isRefetching ||
              payQuery.isRefetching ||
              gemsQuery.isRefetching ||
              chequeQuery.isRefetching
            }
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenInset style={styles.inset}>
          <View ref={periodTourTarget} collapsable={false}>
            <SegmentedControl
              accessibilityLabel="Period"
              options={MONEY_PERIODS}
              value={customRange ? null : period}
              onChange={(id) => {
                setCustomRange(null);
                setPeriod(id);
              }}
            />
          </View>

          {customRange ? (
            <View style={[styles.rangeChip, { backgroundColor: colors.surfaceContainerHigh }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Date range ${customRange.label}. Change`}
                onPress={() => setCalendarOpen(true)}
                style={styles.rangeChipMain}
              >
                <Icon name="date-range" size={16} color={colors.onSurface} />
                <Text style={[styles.rangeChipText, { color: colors.onSurface }]} numberOfLines={1}>
                  {customRange.label}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear date filter"
                hitSlop={10}
                onPress={clearRange}
                style={styles.rangeChipClear}
              >
                <Icon name="close" size={16} color={colors.onSurfaceVariant} />
              </Pressable>
            </View>
          ) : null}

          <MoneySummaryCard
            periodLabel={range.label}
            net={net}
            income={income}
            expense={expense}
            trend={trend}
            comparison={comparison}
            loading={loadingTx}
            formatAmount={formatBase}
            onOpenIncome={() =>
              router.push({ pathname: `${MONEY}/transactions`, params: { show: "income" } } as Href)
            }
            onOpenExpense={() =>
              router.push({ pathname: `${MONEY}/transactions`, params: { show: "expense" } } as Href)
            }
          />
        </ScreenInset>

        <View style={styles.block}>
          <FormSectionLabel title="Your gem business" />
          <ScreenInset>
            <InsightGrid>
              <InsightTile
                icon="diamond"
                accent={Accent.violet}
                label={`Stones sold · ${range.label}`}
                value={loadingGems ? "—" : `${sales.count} stone${sales.count === 1 ? "" : "s"}`}
                sub={sales.count > 0 ? `${formatBase(sales.revenue)} sold` : "No sales in this period"}
                onPress={() => setInsight("sales")}
              />
              <InsightTile
                icon="percent"
                accent={sales.profit < 0 ? Accent.rose : Accent.emerald}
                label="Margin on stones"
                value={loadingGems || sales.marginPct == null ? "—" : `${Math.round(sales.marginPct)}%`}
                sub={
                  sales.count > 0
                    ? `${sales.profit < 0 ? "−" : "+"}${formatBase(Math.abs(sales.profit))} over cost`
                    : "Sale price vs full stone cost"
                }
                onPress={() => setInsight("sales")}
              />
              <InsightTile
                icon="inventory-2"
                accent={Accent.blue}
                label="Stock at cost"
                value={loadingGems ? "—" : formatBase(stock.cost)}
                sub={`${stock.count} stone${stock.count === 1 ? "" : "s"} in stock`}
                alert={
                  stock.slowMovers.count > 0
                    ? { text: `${stock.slowMovers.count} held 6+ months`, color: chart.dueSoon }
                    : null
                }
                onPress={() => setInsight("stock")}
              />
              <InsightTile
                icon="money-check-dollar"
                accent={Accent.amber}
                label="Cheques · 30 days"
                value={`${chequeOutlook.incoming.amount > 0 ? "+" : ""}${formatBase(chequeOutlook.incoming.amount)}`}
                sub={
                  chequeOutlook.outgoing.count > 0
                    ? `${formatBase(chequeOutlook.outgoing.amount)} going out`
                    : `${chequeOutlook.incoming.count} to bank, none going out`
                }
                alert={
                  chequeOutlook.readyToDeposit > 0
                    ? { text: `${chequeOutlook.readyToDeposit} ready to deposit`, color: chart.overdue }
                    : null
                }
                onPress={() => setInsight("cheques")}
              />
            </InsightGrid>

            <View style={styles.outRow}>
              <OutstandingCard
                icon="south-west"
                accent={chart.income}
                label="To collect"
                value={formatBase(outstanding.toCollect)}
                open={receivables.length}
                overdue={overdue.collect}
                overdueColor={chart.overdue}
                onPress={() => router.push(`${MONEY}/receivables` as Href)}
              />
              <OutstandingCard
                icon="north-east"
                accent={chart.expense}
                label="To pay"
                value={formatBase(outstanding.toPay)}
                open={payables.length}
                overdue={overdue.pay}
                overdueColor={chart.overdue}
                onPress={() => router.push(`${MONEY}/payables` as Href)}
              />
            </View>
          </ScreenInset>
        </View>

        <FormSection title="Cash flow">
          <CashFlowChart
            buckets={buckets}
            formatAmount={formatBase}
            formatCompact={formatBaseCompact}
            loading={loadingTx}
          />
        </FormSection>

        {stock.count > 0 ? (
          <FormSection
            title="Where your stock is"
            hint={`${formatBase(stock.cost)} at cost across ${stock.count} stone${stock.count === 1 ? "" : "s"}`}
          >
            <ShareBars
              formatAmount={formatBase}
              color={Accent.blue}
              rows={stock.places
                .filter((p) => p.count > 0)
                .map((p) => ({
                  key: p.key,
                  label: p.label,
                  detail: `${p.count} stone${p.count === 1 ? "" : "s"}`,
                  amount: p.cost,
                  onPress: () => setInsight("stock"),
                }))}
            />
          </FormSection>
        ) : null}

        {spend.length > 0 ? (
          <FormSection title="Where it went" hint={`${formatBase(expense)} spent ${periodText}`}>
            <SpendBreakdown categories={spend} formatAmount={formatBase} />
          </FormSection>
        ) : null}

        <View style={styles.recentHeader}>
          <FormSectionLabel title="Recent activity" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View all transactions"
            onPress={() => router.push(`${MONEY}/transactions` as Href)}
            hitSlop={8}
            style={styles.viewAll}
          >
            <Text style={[styles.viewAllText, { color: colors.onSurface }]}>View all</Text>
            <Icon name="chevron-right" size={18} color={colors.onSurface} />
          </Pressable>
        </View>

        {recent.length > 0 ? (
          <View>
            {recent.map((t, i) => {
              const meta = getCategoryMeta(t.category);
              const isIncome = t.type === "income";
              const source = sourceOfTransaction(t);
              const href = paymentSourceHref(source.type, source.id);
              const date = t.date?.toDate?.();
              return (
                <ListItem
                  key={t.id}
                  leading={
                    <IconBubble
                      icon={isIncome ? "south-west" : "north-east"}
                      accent={isIncome ? chart.income : chart.expense}
                      size={40}
                    />
                  }
                  title={t.description || meta.label}
                  subtitle={[
                    meta.label,
                    source.type ? getPaymentSourceMeta(source.type).label : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  meta={date ? date.toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null}
                  amount={`${isIncome ? "+" : "−"}${formatStored({
                    amount: t.amount,
                    currency: t.currency,
                    amountBase: t.amountBase,
                  })}`}
                  amountColor={isIncome ? chart.income : undefined}
                  onPress={href ? () => router.push(href) : undefined}
                  isLast={i === recent.length - 1}
                />
              );
            })}
          </View>
        ) : (
          <FormSection>
            <View style={styles.emptyBox}>
              <Icon name="receipt-long" size={26} color={colors.outline} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                {loadingTx ? "Loading activity…" : `Nothing recorded for ${periodText}`}
              </Text>
              {!loadingTx ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Tap + to record a sale, income or an expense.
                </Text>
              ) : null}
            </View>
          </FormSection>
        )}
      </ThemedScrollView>

      <QuickActionsFab
        targetRef={actionsTourTarget}
        accessibilityLabel="Money actions"
        accessibilityHint="Record a sale, income or expense, track cheques, or scan a receipt"
        onPress={() => setActionsOpen(true)}
      />

      <MoneyActionsSheet visible={actionsOpen} onClose={() => setActionsOpen(false)} />

      <MoneyInsightSheet
        insight={insight}
        onClose={() => setInsight(null)}
        periodLabel={range.label}
        sales={sales}
        stock={stock}
        cheques={chequeOutlook}
        contactName={contactName}
        formatAmount={formatBase}
      />

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
          clearRange();
          setCalendarOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function OutstandingCard({
  icon,
  accent,
  label,
  value,
  open,
  overdue,
  overdueColor,
  onPress,
}: {
  icon: IconName;
  accent: string;
  label: string;
  value: string;
  open: number;
  overdue: number;
  overdueColor: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}, ${open} open, ${overdue} overdue`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.outCard,
        {
          backgroundColor: colors.surfaceContainerLowest,
          borderColor: colors.outlineVariant,
        },
        pressed && { backgroundColor: colors.surfaceContainerLow },
      ]}
    >
      <View style={styles.outTop}>
        <IconBubble icon={icon} accent={accent} size={30} />
        <Icon name="chevron-right" size={18} color={colors.outline} />
      </View>
      <Text style={[styles.outLabel, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.outValue, { color: colors.onSurface }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
      >
        {value}
      </Text>
      <View style={styles.outMeta}>
        {overdue > 0 ? (
          <>
            <View style={[styles.dot, { backgroundColor: overdueColor }]} />
            <Text style={[styles.outMetaText, { color: colors.onSurface }]} numberOfLines={1}>
              {overdue} overdue
            </Text>
          </>
        ) : (
          <Text style={[styles.outMetaText, { color: colors.textMuted }]} numberOfLines={1}>
            {open === 0 ? "All settled" : `${open} open`}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingTop: Spacing.stackSm,
    paddingBottom: 120,
    gap: Spacing.gutterMd,
  },
  inset: { gap: Spacing.gutterMd },
  block: { gap: Spacing.sm },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  rangeChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    borderRadius: Radius.full,
  },
  rangeChipMain: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 12,
    paddingVertical: 8,
  },
  rangeChipText: { ...text, flexShrink: 1, fontFamily: FontFamily.semibold, fontSize: 13 },
  rangeChipClear: { paddingHorizontal: 12, paddingVertical: 8 },

  outRow: { flexDirection: "row", gap: Spacing.stackMd, marginTop: Spacing.stackMd },
  outCard: {
    flex: 1,
    minWidth: 0,
    padding: Spacing.gutterMd,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
  },
  outTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  outLabel: { ...text, fontFamily: FontFamily.medium, fontSize: 12 },
  outValue: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 19,
    lineHeight: 26,
    fontVariant: ["tabular-nums"],
  },
  outMeta: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 18 },
  outMetaText: { ...text, flexShrink: 1, fontFamily: FontFamily.medium, fontSize: 12 },
  dot: { width: 7, height: 7, borderRadius: 4 },

  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: Spacing.containerMargin,
    marginBottom: -Spacing.sm,
  },
  viewAll: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 32 },
  viewAllText: { ...text, fontFamily: FontFamily.semibold, fontSize: 13 },

  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sectionGap,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  emptyTitle: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, textAlign: "center" },
  emptyText: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18, textAlign: "center" },
});
