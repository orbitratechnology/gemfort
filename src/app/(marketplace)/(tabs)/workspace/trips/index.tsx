import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IconBubble, ListItem } from "@/components/ui/detail-kit";
import { EmptyState } from "@/components/ui/empty-state";
import { FlashList } from "@/components/ui/gesture-lists";
import { Icon } from "@/components/ui/icon";
import { InfiniteListFooter } from "@/components/ui/infinite-list-footer";
import { StackHeader } from "@/components/ui/stack-header";
import { ContextActionsLink } from "@/components/workspace/context-actions-link";
import {
    TripStatusTabs,
    type TripListTab,
} from "@/components/workspace/trip-status-tabs";
import { TripTicket } from "@/components/workspace/trip-ticket";
import { WorkspaceScreenBackdrop } from "@/components/workspace/workspace-screen-backdrop";
import { Radius, Spacing } from "@/constants/design-tokens";
import { getTripsByStatus } from "@/features/workspace/trip-utils";
import { deleteTrip } from "@/features/workspace/workspace-service";
import { fetchTripsPage } from "@/features/workspace/workspace-pagination";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreInfiniteQuery } from "@/hooks/use-firestore-infinite-query";
import { friendlyError } from "@/lib/errors";
import { haptics } from "@/lib/haptics";
import { useAuth } from "@/providers/auth-provider";
import { confirmDelete } from "@/providers/confirm-bridge";
import { useToast } from "@/providers/toast-provider";
import type { Trip } from "@/types";

function TripRow({
  trip,
  onDelete,
}: {
  trip: Trip;
  onDelete: () => void | Promise<void>;
}) {
  const place = [trip.destinationCity, trip.destinationCountry]
    .filter((part): part is string => !!part?.trim())
    .join(", ");
  return (
    <ContextActionsLink
      href={`/(marketplace)/(tabs)/workspace/trips/${trip.id}` as never}
      accessibilityLabel={[trip.tripName, place].filter(Boolean).join(", ")}
      style={styles.ticketRow}
      actions={[
        {
          label: "Delete",
          icon: "trash",
          destructive: true,
          onPress: () =>
            confirmDelete(
              "Delete trip",
              `Remove ${trip.tripName}? This cannot be undone.`,
              onDelete,
            ),
        },
      ]}
    >
      {({ pressed }) => <TripTicket trip={trip} pressed={pressed} />}
    </ContextActionsLink>
  );
}

export default function TripsScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TripListTab>("active");

  const {
    items: trips,
    refetch,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useFirestoreInfiniteQuery({
    queryKey: ["trips", user?.uid, "infinite"],
    fetchPage: (cursor, pageSize) =>
      fetchTripsPage(user!.uid, cursor, pageSize),
    enabled: !!user,
  });

  const { active, completed } = useMemo(() => getTripsByStatus(trips), [trips]);
  const visible = tab === "active" ? active : completed;

  async function handleDelete(tripId: string) {
    if (!user) return;
    try {
      await deleteTrip(tripId, user.uid);
      await queryClient.invalidateQueries({ queryKey: ["trips", user.uid] });
      toast.success("Trip deleted");
    } catch (e) {
      toast.error(friendlyError(e, "Could not delete trip."));
    }
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <WorkspaceScreenBackdrop kind="trips" />
      <StackHeader title="Trips" />

      <TripStatusTabs
        tab={tab}
        onChange={setTab}
        activeCount={active.length}
        completedCount={completed.length}
      />

      <FlashList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={tab === "active" ? (
          <View
            style={[
              styles.flightsRow,
              { backgroundColor: colors.surfaceContainerLowest },
            ]}
          >
            <ListItem
              leading={<IconBubble icon="explore" accent={colors.onSurfaceVariant} size={44} />}
              title="Find flights"
              subtitle="Compare cached fares for your next trade trip"
              onPress={haptics.wrap("light", () =>
                router.push("/(marketplace)/(tabs)/workspace/flights" as never),
              )}
              right={<Icon name="chevron-right" size={20} color={colors.outline} />}
              isLast
            />
          </View>
        ) : null}
        ListEmptyComponent={
          <EmptyState
            icon={tab === "active" ? "flight-takeoff" : "check-circle"}
            title={tab === "active" ? "No active trips" : "No completed trips"}
            subtitle={
              tab === "active"
                ? "Create a sourcing or selling trip to track travel costs and gem deals."
                : "Completed trips will show up here."
            }
          />
        }
        ListFooterComponent={
          <InfiniteListFooter
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isFetchNextPageError={isFetchNextPageError}
            onRetry={() => void fetchNextPage()}
          />
        }
        renderItem={({ item }) => (
          <TripRow trip={item} onDelete={() => handleDelete(item.id)} />
        )}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Plan a new trip"
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
        ]}
        onPress={haptics.wrap("light", () =>
          router.push("/(marketplace)/trips/add" as never),
        )}
      >
        <Icon name="add" size={28} color={colors.onPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 100 },
  flightsRow: {
    marginHorizontal: Spacing.containerMargin,
    marginBottom: Spacing.lg,
    borderRadius: Radius.xl + 4,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  ticketRow: {
    marginHorizontal: Spacing.containerMargin,
    marginBottom: Spacing.md,
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
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
  },
});
