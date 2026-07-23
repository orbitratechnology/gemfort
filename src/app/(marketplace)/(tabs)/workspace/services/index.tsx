import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
    FlatList,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { StackHeader } from "@/components/ui/stack-header";
import {
  ContextActionsLink,
  type ContextMenuAction,
} from "@/components/workspace/context-actions-link";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { WorkspaceScreenBackdrop } from "@/components/workspace/workspace-screen-backdrop";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
  canDeleteService,
  canRequestServiceCancellation,
} from "@/features/workspace/delete-gates";
import { gemPrimaryPhotoUrl } from "@/features/workspace/party-photo";
import { requestServiceCancellation } from "@/features/workspace/service-lifecycle-service";
import {
  deleteService,
  fetchGems,
  fetchServices,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { friendlyError } from "@/lib/errors";
import { formatRelativeDue } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { confirmDelete } from "@/providers/confirm-provider";
import { useToast } from "@/providers/toast-provider";
import type { ServiceRecord } from "@/types";

type StatusFilter = "all" | "in_progress" | "given" | "completed" | "overdue";

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All Statuses" },
  { id: "in_progress", label: "In Progress" },
  { id: "given", label: "Pending" },
  { id: "completed", label: "Completed" },
  { id: "overdue", label: "Overdue" },
];

function statusMeta(status: ServiceRecord["status"]) {
  switch (status) {
    case "in_progress":
      return {
        label: "In Progress",
        icon: "sync" as IconName,
        tone: "warning" as const,
      };
    case "completed":
    case "received_back":
      return {
        label: "Completed",
        icon: "check-circle" as IconName,
        tone: "success" as const,
      };
    case "overdue":
      return {
        label: "Overdue",
        icon: "error-outline" as IconName,
        tone: "error" as const,
      };
    case "cancellation_requested":
      return {
        label: "Cancel requested",
        icon: "hourglass-top" as IconName,
        tone: "warning" as const,
      };
    case "cancelled":
      return {
        label: "Cancelled",
        icon: "cancel" as IconName,
        tone: "neutral" as const,
      };
    default:
      return {
        label: "Pending",
        icon: "schedule" as IconName,
        tone: "neutral" as const,
      };
  }
}

export default function ServicesListScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const {
    data: services = [],
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["services", user?.uid],
    queryFn: () => fetchServices(user!.uid),
    enabled: !!user,
  });

  const { data: gems = [] } = useQuery({
    queryKey: ["gems", user?.uid],
    queryFn: () => fetchGems(user!.uid),
    enabled: !!user,
  });

  const gemPhotoById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of gems) {
      const url = gemPrimaryPhotoUrl(g);
      if (url) map.set(g.id, url);
    }
    return map;
  }, [gems]);

  const filtered = useMemo(() => {
    let list = services;
    if (filter !== "all") {
      list = list.filter((s) =>
        filter === "completed"
          ? s.status === "completed" || s.status === "received_back"
          : s.status === filter,
      );
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.serviceType.toLowerCase().includes(q) ||
          (s.providerName ?? "").toLowerCase().includes(q) ||
          s.providerContactId.toLowerCase().includes(q) ||
          (s.providerBusinessId ?? "").toLowerCase().includes(q) ||
          s.gemId.toLowerCase().includes(q),
      );
    }
    return [...list].sort(
      (a, b) => b.dateGiven.toMillis() - a.dateGiven.toMillis(),
    );
  }, [services, filter, debouncedSearch]);

  const toneColor = (tone: "warning" | "success" | "error" | "neutral") =>
    tone === "warning"
      ? colors.warningAmber
      : tone === "success"
        ? colors.successEmerald
        : tone === "error"
          ? colors.error
          : colors.onSurfaceVariant;

  async function handleDelete(serviceId: string) {
    if (!user) return;
    try {
      await deleteService(serviceId, user.uid);
      await queryClient.invalidateQueries({ queryKey: ["services", user.uid] });
      toast.success("Service deleted");
    } catch (e) {
      toast.error(friendlyError(e, "Could not delete service."));
    }
  }

  async function handleRequestCancel(serviceId: string) {
    try {
      await requestServiceCancellation(serviceId);
      await queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success("Cancellation requested");
    } catch (e) {
      toast.error(friendlyError(e, "Could not request cancellation."));
    }
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <WorkspaceScreenBackdrop kind="services" />
      <StackHeader title="Service Records" />

      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View
              style={[
                styles.searchBox,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Icon name="search" size={22} color={colors.outline} />
              <TextInput
                style={[styles.searchInput, { color: colors.onSurface }]}
                placeholder="Search gems, providers, or IDs..."
                placeholderTextColor={colors.outline}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.hBleed}
              contentContainerStyle={styles.filterRow}
            >
              {FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setFilter(f.id)}
                    style={[
                      styles.filterChip,
                      active
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.surfaceContainerHighest },
                    ]}
                  >
                    {f.id === "all" ? (
                      <Icon
                        name="tune"
                        size={16}
                        color={
                          active ? colors.onPrimary : colors.onSurfaceVariant
                        }
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.filterText,
                        {
                          color: active
                            ? colors.onPrimary
                            : colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="handyman"
            title="No service records"
            subtitle="Send a gem to a cutter, heater, or lab to track it here."
          />
        }
        renderItem={({ item }) => {
          const meta = statusMeta(item.status);
          const tone = toneColor(meta.tone);
          const actions: ContextMenuAction[] = canDeleteService(item)
            ? [
                {
                  label: "Delete",
                  icon: "trash",
                  destructive: true,
                  onPress: () =>
                    confirmDelete(
                      "Delete service",
                      `Remove this ${item.serviceType.replace(/_/g, " ")} record? This cannot be undone.`,
                      () => handleDelete(item.id),
                    ),
                },
              ]
            : canRequestServiceCancellation(item)
              ? [
                  {
                    label: "Request cancellation",
                    icon: "xmark.circle",
                    onPress: () => handleRequestCancel(item.id),
                  },
                ]
              : [];
          return (
            <ContextActionsLink
              href={`/(marketplace)/(tabs)/workspace/services/${item.id}` as never}
              accessibilityLabel={`${item.serviceType.replace(/_/g, " ")}, ${meta.label}`}
              actions={actions}
              style={[
                styles.card,
                { backgroundColor: colors.surfaceContainerLowest },
              ]}
            >
              <GemThumb
                uri={gemPhotoById.get(item.gemId) ?? null}
                label={item.serviceType}
                size={56}
                radius={12}
              />
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <Text
                    style={[styles.cardTitle, { color: colors.primary }]}
                    numberOfLines={1}
                  >
                    {item.serviceType.replace(/_/g, " ")}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: tone + "1A" },
                    ]}
                  >
                    <Icon name={meta.icon} size={14} color={tone} />
                    <Text style={[styles.statusText, { color: tone }]}>
                      {meta.label}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[styles.cardSub, { color: colors.onSurfaceVariant }]}
                  numberOfLines={1}
                >
                  Gem: {item.gemId.slice(0, 8)}
                </Text>
                <View style={styles.cardMetaRow}>
                  <View style={styles.metaLeft}>
                    <Icon name="person" size={16} color={colors.textMuted} />
                    <Text
                      style={[styles.metaText, { color: colors.textMuted }]}
                      numberOfLines={1}
                    >
                      {item.providerName ||
                        (item.providerContactId
                          ? `Contact · ${item.providerContactId.slice(0, 8)}`
                          : "Provider")}
                    </Text>
                  </View>
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>
                    {formatRelativeDue(item.expectedReturnDate)}
                  </Text>
                </View>
              </View>
            </ContextActionsLink>
          );
        }}
      />

      {/* FAB */}
      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() =>
          router.push("/(marketplace)/(tabs)/workspace/services/add")
        }
      >
        <Icon name="add" size={28} color={colors.onPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.stackMd,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { ...Typography.headlineMdMobile },
  brandSub: { ...Typography.labelMd, fontWeight: "400" },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    padding: Spacing.containerMargin,
    paddingBottom: 100,
    gap: Spacing.gutterMd,
  },
  listHeader: { gap: Spacing.gutterMd, marginBottom: Spacing.stackSm },
  title: { ...Typography.displayLg },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    height: 48,
  },
  searchInput: { flex: 1, ...Typography.bodyLg },
  hBleed: {
    marginHorizontal: -Spacing.containerMargin,
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.stackSm,
    paddingVertical: 2,
    paddingHorizontal: Spacing.containerMargin,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  filterText: { ...Typography.labelMd },

  card: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 8,
  },
  cardTitle: { ...Typography.headlineSm, flex: 1, textTransform: "capitalize" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusText: { ...Typography.labelMd },
  cardSub: { ...Typography.bodyMd, marginBottom: 8 },
  cardMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  metaText: { ...Typography.labelMd },

  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 5,
  },
});
