import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { PlaceLabel } from "@/components/ui/country-flag";
import { StackHeader } from "@/components/ui/stack-header";
import { WorkspaceScreenBackdrop } from "@/components/workspace/workspace-screen-backdrop";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { TRIP_STATUS_LABELS, TRIP_TYPES } from "@/constants/trip-options";
import {
    formatTripDates,
    getTripsByStatus,
} from "@/features/workspace/trip-utils";
import { fetchTrips } from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import type { Trip } from "@/types";

function TripRow({
  trip,
  colors,
  onPress,
}: {
  trip: Trip;
  colors: ReturnType<typeof useAppTheme>["colors"];
  onPress: () => void;
}) {
  const typeMeta =
    TRIP_TYPES.find((t) => t.id === trip.tripType) ?? TRIP_TYPES[0];
  const isActive = trip.status === "planning" || trip.status === "ongoing";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surfaceContainerLowest,
          borderColor: colors.outlineVariant,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View
        style={[
          styles.rowIcon,
          {
            backgroundColor: isActive
              ? colors.primaryContainer
              : colors.surfaceContainerHigh,
          },
        ]}
      >
        <Icon
          name={typeMeta.icon}
          size={22}
          color={isActive ? colors.onPrimaryContainer : colors.onSurfaceVariant}
        />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text
            style={[styles.rowTitle, { color: colors.onSurface }]}
            numberOfLines={1}
          >
            {trip.tripName}
          </Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: colors.surfaceContainerHighest },
            ]}
          >
            <Text
              style={[styles.badgeText, { color: colors.onSurfaceVariant }]}
            >
              {TRIP_STATUS_LABELS[trip.status]}
            </Text>
          </View>
        </View>
        <PlaceLabel
          parts={[trip.destinationCity]}
          country={trip.destinationCountry}
          size="xs"
          textStyle={[styles.rowSub, { color: colors.textMuted }]}
        />
        <Text style={[styles.rowMeta, { color: colors.onSurfaceVariant }]}>
          {formatTripDates(trip)} · {typeMeta.label}
        </Text>
        {trip.summary.netResult !== 0 || trip.summary.totalExpenses > 0 ? (
          <Text
            style={[
              styles.rowNet,
              {
                color:
                  trip.summary.netResult >= 0
                    ? colors.successEmerald
                    : colors.error,
              },
            ]}
            selectable
          >
            Net {formatCurrency(trip.summary.netResult)}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-right" size={20} color={colors.outline} />
    </Pressable>
  );
}

export default function TripsScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();

  const {
    data: trips = [],
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["trips", user?.uid],
    queryFn: () => fetchTrips(user!.uid),
    enabled: !!user,
  });

  const { active, completed } = getTripsByStatus(trips);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <WorkspaceScreenBackdrop kind="trips" />
      <StackHeader title="Trips" />

      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Track sourcing and selling trips — expenses, purchases, and sales in
          one place.
        </Text>

        <Pressable
          onPress={() =>
            router.push("/(marketplace)/(tabs)/workspace/trips/add" as never)
          }
          style={({ pressed }) => [
            styles.createCard,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.92 },
          ]}
        >
          <Icon name="flight-takeoff" size={24} color={colors.onPrimary} />
          <View style={styles.createText}>
            <Text style={[styles.createTitle, { color: colors.onPrimary }]}>
              Plan a new trip
            </Text>
            <Text
              style={[styles.createSub, { color: colors.onPrimary + "AA" }]}
            >
              Ratnapura, Bangkok, or anywhere you trade
            </Text>
          </View>
          <Icon
            name="chevron-right"
            size={22}
            color={colors.onPrimary + "99"}
          />
        </Pressable>

        {trips.length === 0 ? (
          <EmptyState
            icon="flight"
            title="No trips yet"
            subtitle="Create a sourcing or selling trip to track travel costs and gem deals."
          />
        ) : (
          <>
            {active.length > 0 ? (
              <View style={styles.section}>
                <Text
                  style={[styles.sectionTitle, { color: colors.onSurface }]}
                >
                  Active
                </Text>
                {active.map((t) => (
                  <TripRow
                    key={t.id}
                    trip={t}
                    colors={colors}
                    onPress={() =>
                      router.push(
                        `/(marketplace)/(tabs)/workspace/trips/${t.id}` as never,
                      )
                    }
                  />
                ))}
              </View>
            ) : null}

            {completed.length > 0 ? (
              <View style={styles.section}>
                <Text
                  style={[styles.sectionTitle, { color: colors.onSurface }]}
                >
                  Completed
                </Text>
                {completed.map((t) => (
                  <TripRow
                    key={t.id}
                    trip={t}
                    colors={colors}
                    onPress={() =>
                      router.push(
                        `/(marketplace)/(tabs)/workspace/trips/${t.id}` as never,
                      )
                    }
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Plan a new trip"
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
        ]}
        onPress={() =>
          router.push("/(marketplace)/(tabs)/workspace/trips/add" as never)
        }
      >
        <Icon name="add" size={28} color={colors.onPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 100,
    gap: Spacing.lg,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: { ...Typography.bodySmall, lineHeight: 20 },
  createCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
  },
  createText: { flex: 1, gap: 2 },
  createTitle: { ...Typography.labelMd, fontWeight: "700" },
  createSub: { ...Typography.bodySmall },
  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.headlineMdMobile, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, gap: 2, minWidth: 0 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  rowTitle: { ...Typography.labelMd, fontWeight: "600", flex: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgeText: { ...Typography.labelMd, fontSize: 10, fontWeight: "600" },
  rowSub: { ...Typography.bodySmall },
  rowMeta: { ...Typography.bodySmall },
  rowNet: {
    ...Typography.labelMd,
    fontWeight: "700",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
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
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
});
