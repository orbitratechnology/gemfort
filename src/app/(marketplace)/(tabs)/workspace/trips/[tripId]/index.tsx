import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { PlaceLabel } from "@/components/ui/country-flag";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import {
    TRIP_STATUS_LABELS,
    TRIP_TYPES,
    getExpenseCategoryIcon,
    getExpenseCategoryLabel,
} from "@/constants/trip-options";
import {
    budgetUsedPercent,
    canCompleteTrip,
    canStartTrip,
    computeTripSummary,
    formatTripDates,
    tripDurationDays,
} from "@/features/workspace/trip-utils";
import {
    distributeTripOverhead,
    fetchGems,
    fetchTrip,
    fetchTripExpenses,
    fetchTripGems,
    recordTripGemSale,
    updateTripStatus,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { alert } from "@/lib/alert";
import { friendlyError } from "@/lib/errors";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type { TripGem } from "@/types";

export default function TripDetailScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saleTarget, setSaleTarget] = useState<TripGem | null>(null);
  const [salePrice, setSalePrice] = useState("");

  const { data: trip, isLoading } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchTrip(tripId!),
    enabled: !!tripId,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["trip-expenses", tripId],
    queryFn: () => fetchTripExpenses(tripId!),
    enabled: !!tripId,
  });

  const { data: tripGems = [] } = useQuery({
    queryKey: ["trip-gems", tripId],
    queryFn: () => fetchTripGems(tripId!),
    enabled: !!tripId,
  });

  const { data: gems = [] } = useQuery({
    queryKey: ["gems", user?.uid],
    queryFn: () => fetchGems(user!.uid),
    enabled: !!user,
  });

  const gemMap = useMemo(() => new Map(gems.map((g) => [g.id, g])), [gems]);
  const summary = useMemo(
    () => (trip ? computeTripSummary(expenses, tripGems, gems) : null),
    [trip, expenses, tripGems, gems],
  );

  const typeMeta = TRIP_TYPES.find((t) => t.id === trip?.tripType);
  const isSourcing = trip?.tripType === "sourcing" || trip?.tripType === "both";
  const isSelling = trip?.tripType === "selling" || trip?.tripType === "both";
  const canRecordSales = isSelling && trip?.status === "ongoing";
  const base = `/(marketplace)/(tabs)/workspace/trips/${tripId}`;

  async function handleStatus(next: "ongoing" | "completed" | "cancelled") {
    if (!trip) return;
    setLoading(true);
    try {
      await updateTripStatus(trip.id, next);
      await queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      toast.success(
        `Trip marked as ${TRIP_STATUS_LABELS[next].toLowerCase()}.`,
      );
    } catch (e) {
      toast.error(friendlyError(e, "Could not update trip."));
    } finally {
      setLoading(false);
    }
  }

  async function handleDistributeOverhead() {
    if (!user || !trip) return;
    alert(
      "Distribute overhead",
      "Split trip expenses across gems purchased on this trip by purchase cost?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Distribute",
          onPress: async () => {
            setLoading(true);
            try {
              const amount = await distributeTripOverhead(user.uid, trip.id);
              await queryClient.invalidateQueries({ queryKey: ["gems"] });
              toast.success(
                `Distributed ${formatCurrency(amount)} across gems.`,
              );
            } catch (e) {
              toast.error(friendlyError(e, "Could not distribute overhead."));
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  }

  async function handleRecordSale() {
    if (!user || !trip || !saleTarget) return;
    const price = parseFloat(salePrice);
    if (!price || price <= 0) {
      toast.error("Enter a valid sale price.");
      return;
    }

    setLoading(true);
    try {
      await recordTripGemSale(
        user.uid,
        trip.id,
        saleTarget.id,
        saleTarget.gemId,
        price,
      );
      await queryClient.invalidateQueries({ queryKey: ["trip-gems", tripId] });
      await queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      await queryClient.invalidateQueries({ queryKey: ["gems"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Sale recorded on trip.");
      setSaleTarget(null);
      setSalePrice("");
    } catch (e) {
      toast.error(friendlyError(e, "Could not record sale."));
    } finally {
      setLoading(false);
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

  const budgetPct = budgetUsedPercent(
    trip,
    summary.totalExpenses + summary.purchaseSpend,
  );
  const netPositive = summary.netResult >= 0;
  const saleGem = saleTarget ? gemMap.get(saleTarget.gemId) : null;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title={trip.tripName} />

      <ThemedScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <View style={styles.heroTop}>
            <View
              style={[
                styles.heroIcon,
                { backgroundColor: colors.onPrimary + "22" },
              ]}
            >
              <Icon
                name={typeMeta?.icon ?? "flight"}
                size={26}
                color={colors.onPrimary}
              />
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: colors.surfaceContainerLowest },
              ]}
            >
              <Text
                style={[styles.statusText, { color: colors.onSurfaceVariant }]}
              >
                {TRIP_STATUS_LABELS[trip.status]}
              </Text>
            </View>
          </View>
          <PlaceLabel
            parts={[trip.destinationCity]}
            country={trip.destinationCountry}
            size="sm"
            textStyle={[styles.heroLoc, { color: colors.onPrimary + "CC" }]}
          />
          <Text style={[styles.heroDates, { color: colors.onPrimary + "AA" }]}>
            {formatTripDates(trip)}
          </Text>
          <Text style={[styles.heroDur, { color: colors.onPrimary + "99" }]}>
            {tripDurationDays(trip)} days · {typeMeta?.label}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surfaceContainerLowest },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.primary }]}>
            Summary
          </Text>
          <View style={styles.statGrid}>
            <Stat
              label="Expenses"
              value={formatCurrency(summary.totalExpenses)}
              colors={colors}
            />
            <Stat
              label="Purchases"
              value={String(summary.totalGemsPurchased)}
              colors={colors}
            />
            <Stat
              label="Sold"
              value={String(summary.totalGemsSold)}
              colors={colors}
            />
            <Stat
              label="Net result"
              value={formatCurrency(summary.netResult)}
              colors={colors}
              accent={netPositive ? colors.successEmerald : colors.error}
            />
          </View>
          {trip.budget > 0 ? (
            <View style={styles.budgetWrap}>
              <View style={styles.budgetRow}>
                <Text style={[styles.budgetLabel, { color: colors.textMuted }]}>
                  Budget used
                </Text>
                <Text style={[styles.budgetPct, { color: colors.onSurface }]}>
                  {budgetPct}%
                </Text>
              </View>
              <View
                style={[
                  styles.budgetTrack,
                  { backgroundColor: colors.surfaceContainerHigh },
                ]}
              >
                <View
                  style={[
                    styles.budgetFill,
                    {
                      width: `${budgetPct}%`,
                      backgroundColor:
                        budgetPct > 90 ? colors.error : colors.primary,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}
        </View>

        {canStartTrip(trip.status) ? (
          <Button
            title="Start trip"
            icon="flight"
            loading={loading}
            onPress={() => handleStatus("ongoing")}
          />
        ) : null}
        {canCompleteTrip(trip.status) ? (
          <View style={styles.actionRow}>
            <Button
              title="Complete trip"
              icon="done-all"
              loading={loading}
              onPress={() => handleStatus("completed")}
              style={{ flex: 1 }}
            />
          </View>
        ) : null}

        <View style={styles.linkRow}>
          <Pressable
            onPress={() => router.push(`${base}/add-expense` as never)}
            style={({ pressed }) => [
              styles.linkBtn,
              { backgroundColor: colors.surfaceContainerLow },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Icon name="receipt" size={20} color={colors.primary} />
            <Text style={[styles.linkLabel, { color: colors.onSurface }]}>
              Add expense
            </Text>
          </Pressable>
          {isSourcing ? (
            <Pressable
              onPress={() => router.push(`${base}/add-purchase` as never)}
              style={({ pressed }) => [
                styles.linkBtn,
                { backgroundColor: colors.secondaryContainer },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Icon
                name="diamond"
                size={20}
                color={colors.onSecondaryContainer}
              />
              <Text
                style={[
                  styles.linkLabel,
                  { color: colors.onSecondaryContainer },
                ]}
              >
                Buy gem
              </Text>
            </Pressable>
          ) : null}
          {isSelling ? (
            <Pressable
              onPress={() => router.push(`${base}/add-gems` as never)}
              style={({ pressed }) => [
                styles.linkBtn,
                { backgroundColor: colors.primaryContainer },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Icon
                name="inventory-2"
                size={20}
                color={colors.onPrimaryContainer}
              />
              <Text
                style={[styles.linkLabel, { color: colors.onPrimaryContainer }]}
              >
                Add gems
              </Text>
            </Pressable>
          ) : null}
        </View>

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

        {saleTarget ? (
          <View
            style={[
              styles.saleCard,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.primary,
              },
            ]}
          >
            <Text style={[styles.saleTitle, { color: colors.onSurface }]}>
              Record sale · {saleGem ? formatGemType(saleGem.gemType) : "Gem"}
            </Text>
            <Input
              label="Sale price (LKR)"
              value={salePrice}
              onChangeText={setSalePrice}
              keyboardType="decimal-pad"
              placeholder="0.00"
              leftIcon="payments"
            />
            <View style={styles.saleActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setSaleTarget(null);
                  setSalePrice("");
                }}
                style={{ flex: 1 }}
              />
              <Button
                title="Confirm sale"
                icon="check-circle"
                loading={loading}
                onPress={handleRecordSale}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
            Expenses
          </Text>
          {expenses.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              No expenses logged yet.
            </Text>
          ) : (
            expenses.map((e) => (
              <View
                key={e.id}
                style={[
                  styles.listRow,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <View
                  style={[
                    styles.listIcon,
                    { backgroundColor: colors.primary + "14" },
                  ]}
                >
                  <Icon
                    name={getExpenseCategoryIcon(e.category)}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.listBody}>
                  <Text style={[styles.listTitle, { color: colors.onSurface }]}>
                    {getExpenseCategoryLabel(e.category)}
                  </Text>
                  <Text
                    style={[styles.listSub, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {e.description || formatRelativeTime(e.date)}
                  </Text>
                </View>
                <Text
                  style={[styles.listAmt, { color: colors.onSurface }]}
                  selectable
                >
                  {formatCurrency(e.amount, e.currency)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
            Gems
          </Text>
          {tripGems.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              No gems linked to this trip yet.
            </Text>
          ) : (
            tripGems.map((tg) => {
              const gem = gemMap.get(tg.gemId);
              const showSale =
                canRecordSales &&
                tg.role === "parcel" &&
                tg.status === "on_trip" &&
                saleTarget?.id !== tg.id;

              return (
                <View key={tg.id} style={styles.gemRowWrap}>
                  <Pressable
                    onPress={() =>
                      router.push(
                        `/(marketplace)/(tabs)/workspace/gems/${tg.gemId}` as never,
                      )
                    }
                    style={({ pressed }) => [
                      styles.listRow,
                      {
                        backgroundColor: colors.surfaceContainerLowest,
                        borderColor: colors.outlineVariant,
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View
                      style={[
                        styles.listIcon,
                        { backgroundColor: colors.secondaryContainer },
                      ]}
                    >
                      <Icon
                        name="diamond"
                        size={18}
                        color={colors.onSecondaryContainer}
                      />
                    </View>
                    <View style={styles.listBody}>
                      <Text
                        style={[styles.listTitle, { color: colors.onSurface }]}
                      >
                        {gem?.sku ?? tg.gemId.slice(0, 8)} ·{" "}
                        {tg.role === "purchase" ? "Purchase" : "Parcel"}
                      </Text>
                      <Text
                        style={[styles.listSub, { color: colors.textMuted }]}
                      >
                        {gem
                          ? `${formatGemType(gem.gemType)} · ${gem.currentWeight}ct`
                          : tg.status}
                      </Text>
                    </View>
                    <Text
                      style={[styles.listAmt, { color: colors.primary }]}
                      selectable
                    >
                      {tg.salePrice != null
                        ? formatCurrency(tg.salePrice)
                        : tg.purchaseCost != null
                          ? formatCurrency(tg.purchaseCost)
                          : "—"}
                    </Text>
                  </Pressable>
                  {showSale ? (
                    <Pressable
                      onPress={() => {
                        setSaleTarget(tg);
                        setSalePrice("");
                      }}
                      style={({ pressed }) => [
                        styles.saleBtn,
                        { backgroundColor: colors.primaryContainer },
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Icon
                        name="sell"
                        size={16}
                        color={colors.onPrimaryContainer}
                      />
                      <Text
                        style={[
                          styles.saleBtnText,
                          { color: colors.onPrimaryContainer },
                        ]}
                      >
                        Record sale
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

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
            <Text
              style={[styles.notes, { color: colors.onSurfaceVariant }]}
              selectable
            >
              {trip.notes}
            </Text>
          </View>
        ) : null}
      </ThemedScrollView>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  colors,
  accent,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
  accent?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text
        style={[styles.statValue, { color: accent ?? colors.onSurface }]}
        selectable
      >
        {value}
      </Text>
    </View>
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
    padding: Spacing.lg,
    gap: Spacing.xs,
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
  heroLoc: { ...Typography.headlineMdMobile, fontWeight: "700", color: "#fff" },
  heroDates: { ...Typography.bodySmall },
  heroDur: { ...Typography.bodySmall },
  card: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardTitle: { ...Typography.headlineMdMobile, fontWeight: "700" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  stat: { width: "47%", gap: 2 },
  statLabel: {
    ...Typography.labelMd,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statValue: {
    ...Typography.headlineMdMobile,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  budgetWrap: { gap: Spacing.sm },
  budgetRow: { flexDirection: "row", justifyContent: "space-between" },
  budgetLabel: { ...Typography.bodySmall },
  budgetPct: { ...Typography.labelMd, fontWeight: "600" },
  budgetTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  budgetFill: { height: "100%", borderRadius: 3 },
  actionRow: { flexDirection: "row", gap: Spacing.sm },
  linkRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    minHeight: 44,
  },
  linkLabel: { ...Typography.labelMd, fontWeight: "600" },
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
  saleCard: {
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: 1,
    gap: Spacing.md,
  },
  saleTitle: { ...Typography.labelMd, fontWeight: "700" },
  saleActions: { flexDirection: "row", gap: Spacing.sm },
  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.headlineMdMobile, fontWeight: "700" },
  empty: { ...Typography.bodySmall, paddingVertical: Spacing.sm },
  gemRowWrap: { gap: Spacing.xs },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  listBody: { flex: 1, gap: 2, minWidth: 0 },
  listTitle: { ...Typography.labelMd, fontWeight: "600" },
  listSub: { ...Typography.bodySmall },
  listAmt: {
    ...Typography.labelMd,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  saleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    alignSelf: "flex-end",
    minHeight: 36,
  },
  saleBtnText: { ...Typography.labelMd, fontWeight: "600" },
  notes: { ...Typography.bodyMd, lineHeight: 22 },
});
