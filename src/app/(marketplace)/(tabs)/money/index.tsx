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
import { moneySeries, useMoneyChartTheme } from "@/components/money/money-chart-theme";
import { SegmentedControl } from "@/components/money/segmented-control";
import { SpendBreakdown } from "@/components/money/spend-breakdown";
import { TourHelpButton } from "@/components/onboarding/tour-help-button";
import { IconBubble, ListItem } from "@/components/ui/detail-kit";
import {
    FormSection,
    FormSectionLabel,
    ScreenInset,
} from "@/components/ui/form-section";
import { Icon, type IconName } from "@/components/ui/icon";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { DateRangeSheet } from "@/components/workspace/date-range-sheet";
import { WorkspaceScreenBackdrop } from "@/components/workspace/workspace-screen-backdrop";
import { FontFamily, Radius, Spacing } from "@/constants/design-tokens";
import { getCategoryMeta } from "@/constants/transaction-categories";
import {
    subscribeOpenPayables,
    subscribeOpenReceivables,
    subscribeTransactionsInRange,
} from "@/features/workspace/firestore-subscriptions";
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
    fetchOpenPayables,
    fetchOpenReceivables,
    fetchTransactionsInRange,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { useTourTarget } from "@/lib/tour-target";
import { useAuth } from "@/providers/auth-provider";

const MONEY = "/(marketplace)/(tabs)/money";
const RECENT_LIMIT = 6;

const COMPARISON_LABEL: Record<MoneyPeriod, string> = {
  this_month: "vs last month",
  last_month: "vs the month before",
  this_year: "vs last year",
};

type QuickAction = {
  key: string;
  label: string;
  icon: IconName;
  href: Href;
};

const QUICK_ACTIONS: QuickAction[] = [
  { key: "sale", label: "Record sale", icon: "price-check", href: "/(marketplace)/money/record-sale" as Href },
  {
    key: "income",
    label: "Add income",
    icon: "south-west",
    href: { pathname: `${MONEY}/transactions`, params: { compose: "income" } } as Href,
  },
  {
    key: "expense",
    label: "Add expense",
    icon: "north-east",
    href: { pathname: `${MONEY}/transactions`, params: { compose: "expense" } } as Href,
  },
  { key: "ledger", label: "Transactions", icon: "receipt-long", href: `${MONEY}/transactions` as Href },
  { key: "payments", label: "Payments", icon: "payments", href: `${MONEY}/payments` as Href },
  { key: "reports", label: "Reports", icon: "picture-as-pdf", href: `${MONEY}/reports` as Href },
];

export default function MoneyDashboard() {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const chart = useMoneyChartTheme();
  const { formatBase, formatBaseCompact, formatStored } = usePreferredMoney();
  const uid = user?.uid;

  const [period, setPeriod] = useState<MoneyPeriod>("this_month");
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const periodTourTarget = useTourTarget("money-period", { scrollRef });
  const dateFilterTourTarget = useTourTarget("money-date-filter");
  const recordSaleTourTarget = useTourTarget("money-record-sale");

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

  const transactions = useMemo(() => txQuery.data ?? [], [txQuery.data]);
  const receivables = useMemo(() => recQuery.data ?? [], [recQuery.data]);
  const payables = useMemo(() => payQuery.data ?? [], [payQuery.data]);
  const loadingTx = txQuery.isLoading && !txQuery.data;

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

  const heroSeries = moneySeries(!isDark);
  const heroInk = colors.onPrimary;
  const heroSoft = colors.onPrimary + "A6";
  const heroHair = colors.onPrimary + "24";
  const flowTotal = income + expense;
  const comparison = customRange
    ? "vs the previous span"
    : COMPARISON_LABEL[period];

  const onRefresh = () => {
    void txQuery.refetch();
    void recQuery.refetch();
    void payQuery.refetch();
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
        right={
          <View style={styles.headerActions}>
            <TourHelpButton tourId="money" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="PDF reports"
              hitSlop={8}
              onPress={() => router.push(`${MONEY}/reports` as Href)}
              style={styles.headerBtn}
            >
              <Icon name="picture-as-pdf" size={24} color={colors.onSurface} />
            </Pressable>
          </View>
        }
      />

      <ThemedScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={txQuery.isRefetching || recQuery.isRefetching || payQuery.isRefetching}
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
            <View
              style={[
                styles.rangeChip,
                { backgroundColor: colors.surfaceContainerHigh },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Date range ${customRange.label}. Change`}
                onPress={() => setCalendarOpen(true)}
                style={styles.rangeChipMain}
              >
                <Icon name="date-range" size={16} color={colors.onSurface} />
                <Text
                  style={[styles.rangeChipText, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
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

          {/* Net profit hero */}
          <View style={[styles.hero, { backgroundColor: colors.primary }]}>
            <View style={styles.heroTop}>
              <Text style={[styles.heroLabel, { color: heroSoft }]} numberOfLines={1}>
                NET PROFIT · {range.label.toUpperCase()}
              </Text>
            </View>

            <Text
              style={[styles.heroValue, { color: heroInk }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              accessibilityLabel={`Net profit ${net < 0 ? "minus " : ""}${formatBase(Math.abs(net))}`}
            >
              {loadingTx ? "—" : `${net < 0 ? "−" : ""}${formatBase(Math.abs(net))}`}
            </Text>

            <View style={styles.trendRow}>
              {trend.pct == null ? (
                <Text style={[styles.trendText, { color: heroSoft }]} numberOfLines={1}>
                  No earlier activity to compare
                </Text>
              ) : (
                <>
                  <View style={[styles.trendBadge, { backgroundColor: heroHair }]}>
                    <Icon
                      name={trend.up ? "trending-up" : "trending-down"}
                      size={14}
                      color={heroInk}
                    />
                    <Text style={[styles.trendValue, { color: heroInk }]}>
                      {trend.up ? "+" : "−"}
                      {Math.abs(trend.pct)}%
                    </Text>
                  </View>
                  <Text style={[styles.trendText, { color: heroSoft }]} numberOfLines={1}>
                    {comparison}
                  </Text>
                </>
              )}
            </View>

            {/* Share of money in vs out this period */}
            <View
              style={[styles.flowBar, { backgroundColor: heroHair }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {flowTotal > 0 ? (
                <>
                  <View style={{ flexGrow: income, backgroundColor: heroSeries.income }} />
                  <View style={{ flexGrow: expense, backgroundColor: heroSeries.expense }} />
                </>
              ) : null}
            </View>

            <View style={styles.heroSplit}>
              <HeroFigure
                color={heroSeries.income}
                label="Income"
                value={loadingTx ? "—" : formatBase(income)}
                ink={heroInk}
                soft={heroSoft}
              />
              <View style={[styles.heroDivider, { backgroundColor: heroHair }]} />
              <HeroFigure
                color={heroSeries.expense}
                label="Expenses"
                value={loadingTx ? "—" : formatBase(expense)}
                ink={heroInk}
                soft={heroSoft}
              />
            </View>
          </View>

          {/* Quick actions */}
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.key}
                ref={action.key === "sale" ? recordSaleTourTarget : undefined}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={() => router.push(action.href)}
                style={({ pressed }) => [
                  styles.actionTile,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                  },
                  pressed && { backgroundColor: colors.surfaceContainerLow },
                ]}
              >
                <Icon name={action.icon} size={22} color={colors.onSurface} />
                <Text
                  style={[styles.actionLabel, { color: colors.onSurface }]}
                  numberOfLines={2}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Outstanding */}
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

        <FormSection title="Cash flow">
          <CashFlowChart
            buckets={buckets}
            formatAmount={formatBase}
            formatCompact={formatBaseCompact}
            loading={loadingTx}
          />
        </FormSection>

        {spend.length > 0 ? (
          <FormSection title="Where it went" hint={`${formatBase(expense)} spent ${range.label.toLowerCase()}`}>
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
                {loadingTx ? "Loading activity…" : `Nothing recorded for ${range.label.toLowerCase()}`}
              </Text>
              {!loadingTx ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Record a sale, or add income and expenses as they happen.
                </Text>
              ) : null}
            </View>
          </FormSection>
        )}
      </ThemedScrollView>

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

function HeroFigure({
  color,
  label,
  value,
  ink,
  soft,
}: {
  color: string;
  label: string;
  value: string;
  ink: string;
  soft: string;
}) {
  return (
    <View style={styles.heroCol}>
      <View style={styles.heroColLabel}>
        <View style={[styles.swatch, { backgroundColor: color }]} />
        <Text style={[styles.heroColCaption, { color: soft }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text
        style={[styles.heroColValue, { color: ink }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
      >
        {value}
      </Text>
    </View>
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
        <IconBubble icon={icon} accent={accent} size={32} />
        <Icon name="chevron-right" size={20} color={colors.outline} />
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
            <View style={[styles.swatch, { backgroundColor: overdueColor }]} />
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
    paddingBottom: Spacing.section + 24,
    gap: Spacing.gutterMd,
  },
  inset: { gap: Spacing.gutterMd },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
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

  hero: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: Spacing.containerMargin,
    gap: 10,
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.12)",
  },
  heroTop: { flexDirection: "row", alignItems: "center" },
  heroLabel: { ...text, flex: 1, fontFamily: FontFamily.semibold, fontSize: 11, letterSpacing: 1.1 },
  heroValue: {
    ...text,
    fontFamily: FontFamily.bold,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 24 },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  trendValue: { ...text, fontFamily: FontFamily.semibold, fontSize: 12, fontVariant: ["tabular-nums"] },
  trendText: { ...text, flexShrink: 1, fontFamily: FontFamily.medium, fontSize: 12 },
  flowBar: {
    flexDirection: "row",
    height: 6,
    gap: 2,
    marginTop: 4,
    borderRadius: Radius.full,
    overflow: "hidden",
  },
  heroSplit: { flexDirection: "row", alignItems: "stretch", gap: Spacing.lg },
  heroDivider: { width: StyleSheet.hairlineWidth },
  heroCol: { flex: 1, minWidth: 0, gap: 4 },
  heroColLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroColCaption: { ...text, flexShrink: 1, fontFamily: FontFamily.medium, fontSize: 13 },
  heroColValue: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 18,
    lineHeight: 24,
    fontVariant: ["tabular-nums"],
  },
  swatch: { width: 8, height: 8, borderRadius: 2 },

  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  actionTile: {
    flexBasis: "31%",
    flexGrow: 1,
    minHeight: 76,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: {
    ...text,
    textAlign: "center",
    fontFamily: FontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
  },

  outRow: { flexDirection: "row", gap: Spacing.stackMd },
  outCard: {
    flex: 1,
    minWidth: 0,
    padding: Spacing.gutterMd,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  outTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  outLabel: { ...text, fontFamily: FontFamily.medium, fontSize: 13 },
  outValue: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 19,
    lineHeight: 26,
    fontVariant: ["tabular-nums"],
  },
  outMeta: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 18 },
  outMetaText: { ...text, flexShrink: 1, fontFamily: FontFamily.medium, fontSize: 12 },

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
