import { useQueryClient } from "@tanstack/react-query";
import { BlurTargetView, BlurView } from "expo-blur";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/ui/country-flag";
import { Icon, type IconName } from "@/components/ui/icon";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { TripExpensesSheet } from "@/components/workspace/trip-expenses-sheet";
import {
    TripGemsSheet,
    TripSoldGemsSection,
} from "@/components/workspace/trip-gems-sheet";
import {
    TripBudgetCard,
    TripQuickActions,
} from "@/components/workspace/trip-money-cards";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { flagUrl, resolveCountryCode } from "@/constants/gem-options";
import { TRIP_STATUS_LABELS, TRIP_TYPES } from "@/constants/trip-options";
import {
    subscribeGems,
    subscribeTrip,
    subscribeTripExpenses,
    subscribeTripGems,
} from "@/features/workspace/firestore-subscriptions";
import {
    budgetRemaining,
    budgetUsedPercent,
    canCompleteTrip,
    canStartTrip,
    computeTripSummary,
    formatTripDates,
    tripBudgetBase,
    tripBudgetSpent,
    tripDurationDays,
} from "@/features/workspace/trip-utils";
import {
    distributeTripOverhead,
    fetchGems,
    fetchTrip,
    fetchTripExpenses,
    fetchTripGems,
    recordTripGemSale,
    updateTripBudget,
    updateTripStatus,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import { useAuth } from "@/providers/auth-provider";
import { confirm } from "@/providers/confirm-provider";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";

export default function TripDetailScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { formatBase, formatStored } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [gemsOpen, setGemsOpen] = useState(false);
  const flagBlurTargetRef = useRef<View | null>(null);

  const { data: trip, isLoading } = useFirestoreLiveQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchTrip(tripId!),
    subscribe: (onData, onError) => subscribeTrip(tripId!, onData, onError),
    enabled: !!tripId,
  });

  const { data: expenses = [] } = useFirestoreLiveQuery({
    queryKey: ["trip-expenses", tripId, user?.uid],
    queryFn: () => fetchTripExpenses(tripId!, user!.uid),
    subscribe: (onData, onError) =>
      subscribeTripExpenses(tripId!, user!.uid, onData, onError),
    enabled: !!tripId && !!user,
  });

  const { data: tripGems = [] } = useFirestoreLiveQuery({
    queryKey: ["trip-gems", tripId, user?.uid],
    queryFn: () => fetchTripGems(tripId!, user!.uid),
    subscribe: (onData, onError) =>
      subscribeTripGems(tripId!, user!.uid, onData, onError),
    enabled: !!tripId && !!user,
  });

  const { data: gems = [] } = useFirestoreLiveQuery({
    queryKey: ["gems", user?.uid],
    queryFn: () => fetchGems(user!.uid),
    subscribe: (onData, onError) => subscribeGems(user!.uid, onData, onError),
    enabled: !!user,
  });

  const gemMap = useMemo(() => new Map(gems.map((g) => [g.id, g])), [gems]);
  const soldTripGems = useMemo(
    () =>
      tripGems
        .filter((tg) => tg.status === "sold")
        .slice()
        .sort((a, b) => {
          const aMs = a.saleDate?.toMillis?.() ?? 0;
          const bMs = b.saleDate?.toMillis?.() ?? 0;
          return bMs - aMs;
        }),
    [tripGems],
  );
  const activeTripGems = useMemo(
    () => tripGems.filter((tg) => tg.status !== "sold"),
    [tripGems],
  );
  const summary = useMemo(
    () => (trip ? computeTripSummary(expenses, tripGems, gems) : null),
    [trip, expenses, tripGems, gems],
  );

  const typeMeta = TRIP_TYPES.find((t) => t.id === trip?.tripType);
  const isSourcing = trip?.tripType === "sourcing" || trip?.tripType === "both";
  const isSelling = trip?.tripType === "selling" || trip?.tripType === "both";
  const canRecordSales = isSelling && trip?.status === "ongoing";
  const sheets = {
    addExpense: `/(marketplace)/trips/${tripId}/add-expense`,
    addGem: `/(marketplace)/gems/add?tripId=${tripId}`,
    addGems: `/(marketplace)/trips/${tripId}/add-gems`,
  };

  async function handleStatus(next: "ongoing" | "completed" | "cancelled") {
    if (!trip) return;
    try {
      await withLoading(async () => {
        await updateTripStatus(trip.id, next);
        await queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
        await queryClient.invalidateQueries({ queryKey: ["trips"] });
        toast.success(
          `Trip marked as ${TRIP_STATUS_LABELS[next].toLowerCase()}.`,
        );
      }, "Updating…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not update trip."));
    }
  }

  async function handleSaveBudget(next: {
    budget: number;
    budgetCurrency: string;
  }) {
    if (!user || !trip) return;
    try {
      await withLoading(async () => {
        await updateTripBudget(trip.id, user.uid, next);
        await queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
        await queryClient.invalidateQueries({ queryKey: ["trips"] });
        toast.success("Budget updated.");
      }, "Saving budget…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not update budget."));
      throw e;
    }
  }

  async function handleDistributeOverhead() {
    if (!user || !trip) return;
    await confirm({
      title: "Distribute overhead",
      message:
        "Split trip expenses across gems purchased on this trip by purchase cost?",
      confirmLabel: "Distribute",
      cancelLabel: "Cancel",
      icon: "pie-chart",
      onConfirm: async () => {
        try {
          const amount = await distributeTripOverhead(user.uid, trip.id);
          await queryClient.invalidateQueries({ queryKey: ["gems"] });
          toast.success(`Distributed ${formatBase(amount)} across gems.`);
        } catch (e) {
          toast.error(friendlyError(e, "Could not distribute overhead."));
          throw e;
        }
      },
    });
  }

  async function handleConfirmSale(
    tripGem: { id: string; gemId: string },
    price: number,
  ) {
    if (!user || !trip) return;
    if (!price || price <= 0) {
      toast.error("Enter a valid sale price.");
      throw new Error("Invalid sale price");
    }
    try {
      await withLoading(async () => {
        await recordTripGemSale(
          user.uid,
          trip.id,
          tripGem.id,
          tripGem.gemId,
          price,
        );
        await queryClient.invalidateQueries({
          queryKey: ["trip-gems", tripId],
        });
        await queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
        await queryClient.invalidateQueries({ queryKey: ["trips"] });
        await queryClient.invalidateQueries({ queryKey: ["gems"] });
        await queryClient.invalidateQueries({ queryKey: ["transactions"] });
        toast.success("Sale recorded on trip.");
      }, "Recording sale…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not record sale."));
      throw e;
    }
  }

  if (isLoading || !trip || !summary) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <StackHeader title="Trip" />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const budgetBase = tripBudgetBase(trip);
  const spent = tripBudgetSpent(summary.totalExpenses, summary.purchaseSpend);
  const remaining = budgetRemaining(trip, spent);
  const budgetPct = budgetUsedPercent(trip, spent);
  const destinationFlagCode = resolveCountryCode(trip.destinationCountry);
  const locationLine = [trip.destinationCity, trip.destinationCountry]
    .filter((part): part is string => !!part?.trim())
    .join(", ");
  const showStart = canStartTrip(trip.status);
  const showComplete = canCompleteTrip(trip.status);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title={trip.tripName} />

      <ThemedScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.hero,
            {
              backgroundColor: destinationFlagCode ? "#1a1a1a" : colors.primary,
            },
          ]}
        >
          {destinationFlagCode ? (
            <>
              <BlurTargetView ref={flagBlurTargetRef} style={styles.heroFlag}>
                <Image
                  source={{ uri: flagUrl(destinationFlagCode, 640) }}
                  style={styles.heroFlagImage}
                  contentFit="cover"
                  accessibilityLabel={`Flag for ${trip.destinationCountry}`}
                />
              </BlurTargetView>
              <BlurView
                blurTarget={flagBlurTargetRef}
                intensity={40}
                tint="dark"
                blurMethod="dimezisBlurView"
                style={styles.heroBlur}
              >
                <HeroCardContent
                  typeIcon={typeMeta?.icon ?? "flight"}
                  statusLabel={TRIP_STATUS_LABELS[trip.status]}
                  locationLine={locationLine}
                  dates={formatTripDates(trip)}
                  durationLabel={`${tripDurationDays(trip)} days · ${typeMeta?.label}`}
                  statusTextColor={colors.onSurfaceVariant}
                  statusBg={colors.surfaceContainerLowest}
                  onFlagBackground
                />
              </BlurView>
            </>
          ) : (
            <View style={styles.heroBlur}>
              <HeroCardContent
                typeIcon={typeMeta?.icon ?? "flight"}
                statusLabel={TRIP_STATUS_LABELS[trip.status]}
                locationLine={locationLine}
                dates={formatTripDates(trip)}
                durationLabel={`${tripDurationDays(trip)} days · ${typeMeta?.label}`}
                statusTextColor={colors.onSurfaceVariant}
                statusBg={colors.surfaceContainerLowest}
                onFlagBackground={false}
                fallbackIconColor={colors.onPrimary}
              />
            </View>
          )}

          {destinationFlagCode ? (
            <View style={styles.heroFlagCorner} pointerEvents="none">
              <CountryFlag
                country={trip.destinationCountry}
                width={40}
                height={28}
                style={styles.heroFlagCornerImage}
              />
            </View>
          ) : null}
        </View>

        <TripBudgetCard
          budgetLabel={
            budgetBase > 0
              ? formatStored({
                  amount: trip.budget,
                  currency: trip.budgetCurrency,
                  amountBase: budgetBase,
                })
              : "Set a budget"
          }
          usedLabel={formatBase(spent)}
          remainingLabel={
            budgetBase > 0 ? formatBase(remaining) : formatBase(0)
          }
          remainingNegative={budgetBase > 0 && remaining < 0}
          percent={budgetPct}
          budgetAmount={trip.budget}
          budgetCurrency={trip.budgetCurrency}
          onSaveBudget={handleSaveBudget}
        />

        <TripQuickActions
          expenseCount={expenses.length}
          gemCount={activeTripGems.length}
          onExpenses={() => setExpensesOpen(true)}
          onGems={() => setGemsOpen(true)}
        />

        <TripSoldGemsSection
          soldGems={soldTripGems}
          gemMap={gemMap}
          onOpenGem={(gemId) =>
            router.push(
              `/(marketplace)/(tabs)/workspace/gems/${gemId}` as never,
            )
          }
        />

        {isSourcing &&
        summary.totalGemsPurchased > 0 &&
        summary.totalExpenses > 0 ? (
          <Pressable
            onPress={handleDistributeOverhead}
            style={({ pressed }) => [
              styles.overheadBtn,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Icon name="pie-chart" size={20} color={colors.primary} />
            <Text style={[styles.overheadText, { color: colors.primary }]}>
              Distribute overhead to gems
            </Text>
          </Pressable>
        ) : null}

        {trip.notes ? (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surfaceContainerLowest },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.primary }]}>
              Notes
            </Text>
            <Text style={[styles.notes, { color: colors.onSurfaceVariant }]}>
              {trip.notes}
            </Text>
          </View>
        ) : null}

        {showStart ? (
          <Button
            title="Start trip"
            icon="flight"
            onPress={() => handleStatus("ongoing")}
          />
        ) : null}
        {showComplete ? (
          <Button
            title="Complete trip"
            icon="done-all"
            onPress={() => {
              void confirm({
                title: "Complete trip?",
                message: `Mark “${trip.tripName}” as completed? Expenses, gems, and sales stay available to review.`,
                confirmLabel: "Complete",
                cancelLabel: "Cancel",
                icon: "done-all",
                onConfirm: () => handleStatus("completed"),
              });
            }}
          />
        ) : null}
      </ThemedScrollView>

      <TripExpensesSheet
        visible={expensesOpen}
        onClose={() => setExpensesOpen(false)}
        expenses={expenses}
        onAddExpense={() => router.push(sheets.addExpense as never)}
      />
      <TripGemsSheet
        visible={gemsOpen}
        onClose={() => setGemsOpen(false)}
        tripGems={activeTripGems}
        gemMap={gemMap}
        canRecordSales={canRecordSales}
        onOpenGem={(gemId) =>
          router.push(`/(marketplace)/(tabs)/workspace/gems/${gemId}` as never)
        }
        onConfirmSale={handleConfirmSale}
        showAddGem={isSourcing}
        showAddGems={isSelling}
        onAddGem={() => router.push(sheets.addGem as never)}
        onAddGems={() => router.push(sheets.addGems as never)}
      />
    </SafeAreaView>
  );
}

function HeroCardContent({
  typeIcon,
  statusLabel,
  locationLine,
  dates,
  durationLabel,
  statusTextColor,
  statusBg,
  onFlagBackground,
  fallbackIconColor = "#FFFFFF",
}: {
  typeIcon: IconName;
  statusLabel: string;
  locationLine: string;
  dates: string;
  durationLabel: string;
  statusTextColor: string;
  statusBg: string;
  onFlagBackground: boolean;
  fallbackIconColor?: string;
}) {
  const textPrimary = onFlagBackground
    ? "rgba(255,255,255,0.92)"
    : fallbackIconColor + "CC";
  const textSecondary = onFlagBackground
    ? "rgba(255,255,255,0.72)"
    : fallbackIconColor + "AA";
  const textTertiary = onFlagBackground
    ? "rgba(255,255,255,0.62)"
    : fallbackIconColor + "99";
  const iconColor = onFlagBackground ? "#FFFFFF" : fallbackIconColor;

  return (
    <>
      <View style={styles.heroTop}>
        <View
          style={[
            styles.heroIcon,
            {
              backgroundColor: onFlagBackground
                ? "rgba(255,255,255,0.18)"
                : iconColor + "22",
            },
          ]}
        >
          <Icon name={typeIcon} size={26} color={iconColor} />
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
          <Text style={[styles.statusText, { color: statusTextColor }]}>
            {statusLabel}
          </Text>
        </View>
      </View>
      {locationLine ? (
        <Text selectable style={[styles.heroLoc, { color: textPrimary }]}>
          {locationLine}
        </Text>
      ) : null}
      <Text style={[styles.heroDates, { color: textSecondary }]}>{dates}</Text>
      <Text style={[styles.heroDur, { color: textTertiary }]}>
        {durationLabel}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.section,
    gap: Spacing.lg,
  },
  hero: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    overflow: "hidden",
    minHeight: 148,
  },
  heroFlag: {
    ...StyleSheet.absoluteFill,
  },
  heroFlagImage: {
    width: "100%",
    height: "100%",
  },
  heroBlur: {
    padding: Spacing.lg,
    paddingRight: Spacing.lg + 48,
    gap: Spacing.xs,
  },
  heroFlagCorner: {
    position: "absolute",
    right: Spacing.lg,
    bottom: Spacing.lg,
    borderRadius: Radius.sm,
    borderCurve: "continuous",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.4)",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.28)",
  },
  heroFlagCornerImage: {
    borderRadius: Radius.sm,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  statusText: { ...Typography.labelMd, fontWeight: "600" },
  heroLoc: { ...Typography.headlineMdMobile, fontWeight: "700" },
  heroDates: { ...Typography.bodySmall },
  heroDur: { ...Typography.bodySmall },
  overheadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  overheadText: { ...Typography.labelMd, fontWeight: "600" },
  card: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardTitle: { ...Typography.headlineMdMobile, fontWeight: "700" },
  notes: { ...Typography.bodyMd, lineHeight: 22 },
});
