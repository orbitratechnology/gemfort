import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurTargetView, BlurView } from "expo-blur";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/ui/country-flag";
import { Icon, type IconName } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
    flagUrl,
    formatGemType,
    resolveCountryCode,
} from "@/constants/gem-options";
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
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import { formatRelativeTime } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { confirm } from "@/providers/confirm-provider";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";
import type { TripGem } from "@/types";

export default function TripDetailScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { formatBase, formatStored } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [saleTarget, setSaleTarget] = useState<TripGem | null>(null);
  const [salePrice, setSalePrice] = useState("");
  const flagBlurTargetRef = useRef<View | null>(null);

  const { data: trip, isLoading } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchTrip(tripId!),
    enabled: !!tripId,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["trip-expenses", tripId, user?.uid],
    queryFn: () => fetchTripExpenses(tripId!, user!.uid),
    enabled: !!tripId && !!user,
  });

  const { data: tripGems = [] } = useQuery({
    queryKey: ["trip-gems", tripId, user?.uid],
    queryFn: () => fetchTripGems(tripId!, user!.uid),
    enabled: !!tripId && !!user,
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

  async function handleRecordSale() {
    if (!user || !trip || !saleTarget) return;
    const price = parseFloat(salePrice);
    if (!price || price <= 0) {
      toast.error("Enter a valid sale price.");
      return;
    }

    try {
      await withLoading(async () => {
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
      }, "Recording sale…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not record sale."));
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
  const destinationFlagCode = resolveCountryCode(trip.destinationCountry);
  const locationLine = [trip.destinationCity, trip.destinationCountry]
    .filter((part): part is string => !!part?.trim())
    .join(", ");

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
              value={formatBase(summary.totalExpenses)}
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
              value={formatBase(summary.netResult)}
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
            onPress={() => handleStatus("ongoing")}
          />
        ) : null}
        {canCompleteTrip(trip.status) ? (
          <View style={styles.actionRow}>
            <Button
              title="Complete trip"
              icon="done-all"
              onPress={() => handleStatus("completed")}
              style={{ flex: 1 }}
            />
          </View>
        ) : null}

        <View style={styles.linkRow}>
          <Pressable
            onPress={() => router.push(sheets.addExpense as never)}
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
              onPress={() => router.push(sheets.addGem as never)}
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
                Add gem
              </Text>
            </Pressable>
          ) : null}
          {isSelling ? (
            <Pressable
              onPress={() => router.push(sheets.addGems as never)}
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
                <Text style={[styles.listAmt, { color: colors.onSurface }]}>
                  {formatStored({
                    amount: e.amount,
                    currency: e.currency,
                    amountBase: e.amountBase,
                  })}
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
                    <Text style={[styles.listAmt, { color: colors.primary }]}>
                      {tg.salePrice != null
                        ? formatBase(tg.salePrice)
                        : tg.purchaseCost != null
                          ? formatBase(tg.purchaseCost)
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
            <Text style={[styles.notes, { color: colors.onSurfaceVariant }]}>
              {trip.notes}
            </Text>
          </View>
        ) : null}
      </ThemedScrollView>
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
      <Text style={[styles.statValue, { color: accent ?? colors.onSurface }]}>
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
