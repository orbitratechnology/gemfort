import { FlashList } from "@/components/ui/gesture-lists";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { StackHeader } from "@/components/ui/stack-header";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import {
    ContextActionsLink,
    type ContextMenuAction,
} from "@/components/workspace/context-actions-link";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { WorkspaceScreenBackdrop } from "@/components/workspace/workspace-screen-backdrop";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import { fetchBusinesses } from "@/features/marketplace/marketplace-service";
import {
    canDeleteService,
    canRequestServiceCancellation,
} from "@/features/workspace/delete-gates";
import {
    subscribeContacts,
    subscribeGems,
    subscribeServices,
    subscribeVerifiedBusinesses,
} from "@/features/workspace/firestore-subscriptions";
import {
    gemPrimaryPhotoUrl,
    resolveBusinessPhotoById,
    resolvePartyPhotoUrl,
} from "@/features/workspace/party-photo";
import { requestServiceCancellation } from "@/features/workspace/service-lifecycle-service";
import {
    deleteService,
    fetchContacts,
    fetchGems,
    fetchServices,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
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

function statusTone(
  status: ServiceRecord["status"],
  colors: ReturnType<typeof useAppTheme>["colors"],
): { bg: string; fg: string; accent: string; icon: IconName; label: string } {
  const meta = statusMeta(status);
  if (status === "overdue") {
    return {
      bg: colors.errorContainer,
      fg: colors.error,
      accent: colors.error,
      icon: "warning",
      label: "Overdue",
    };
  }
  if (status === "given") {
    return {
      bg: colors.secondaryContainer,
      fg: colors.onSecondaryContainer,
      accent: colors.secondary,
      icon: "hourglass-top",
      label: meta.label,
    };
  }
  if (status === "completed" || status === "received_back") {
    return {
      bg: colors.successEmerald + "22",
      fg: colors.successEmerald,
      accent: colors.successEmerald,
      icon: "check-circle",
      label: meta.label,
    };
  }
  if (status === "cancellation_requested") {
    return {
      bg: colors.errorContainer,
      fg: colors.error,
      accent: colors.error,
      icon: "hourglass-top",
      label: meta.label,
    };
  }
  if (status === "cancelled") {
    return {
      bg: colors.surfaceContainerHighest,
      fg: colors.onSurfaceVariant,
      accent: colors.outline,
      icon: "cancel",
      label: meta.label,
    };
  }
  return {
    bg: colors.primaryContainer,
    fg: colors.onPrimaryContainer,
    accent: colors.primary,
    icon: meta.icon,
    label: meta.label,
  };
}

export default function ServicesListScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { formatFace } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const {
    data: services = [],
    refetch,
    isRefetching,
  } = useFirestoreLiveQuery({
    queryKey: ["services", user?.uid],
    queryFn: () => fetchServices(user!.uid),
    subscribe: (onData, onError) =>
      subscribeServices(user!.uid, onData, onError),
    enabled: !!user,
  });

  const { data: gems = [] } = useFirestoreLiveQuery({
    queryKey: ["gems", user?.uid],
    queryFn: () => fetchGems(user!.uid),
    subscribe: (onData, onError) => subscribeGems(user!.uid, onData, onError),
    enabled: !!user,
  });

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    subscribe: (onData, onError) =>
      subscribeContacts(user!.uid, onData, onError),
    enabled: !!user,
  });

  const { data: businesses = [] } = useFirestoreLiveQuery({
    queryKey: ["home-businesses"],
    queryFn: () => fetchBusinesses(),
    subscribe: (onData, onError) =>
      subscribeVerifiedBusinesses(onData, onError),
    enabled: !!user,
  });

  const gemById = useMemo(() => {
    const map = new Map<string, (typeof gems)[number]>();
    for (const g of gems) map.set(g.id, g);
    return map;
  }, [gems]);

  const contactById = useMemo(() => {
    const map = new Map(contacts.map((c) => [c.id, c]));
    return map;
  }, [contacts]);

  function gemTitleFor(gemId: string) {
    const gem = gemById.get(gemId);
    return (
      gem?.title?.trim() || (gem ? formatGemType(gem.gemType) : null) || "Gem"
    );
  }

  function providerPhotoFor(service: ServiceRecord) {
    const contact = contactById.get(service.providerContactId) ?? null;
    return (
      resolvePartyPhotoUrl(contact, businesses) ||
      resolveBusinessPhotoById(service.providerBusinessId, businesses)
    );
  }

  function providerLabelFor(service: ServiceRecord) {
    return (
      service.providerName?.trim() ||
      contactById.get(service.providerContactId)?.displayName ||
      (service.providerContactId
        ? `Contact · ${service.providerContactId.slice(0, 8)}`
        : "Provider")
    );
  }

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
      list = list.filter((s) => {
        const gem = gemById.get(s.gemId);
        const gemTitle =
          gem?.title?.trim() || (gem ? formatGemType(gem.gemType) : "") || "";
        return (
          gemTitle.toLowerCase().includes(q) ||
          s.serviceType.toLowerCase().includes(q) ||
          (s.providerName ?? "").toLowerCase().includes(q) ||
          s.providerContactId.toLowerCase().includes(q) ||
          (s.providerBusinessId ?? "").toLowerCase().includes(q) ||
          s.gemId.toLowerCase().includes(q)
        );
      });
    }
    return [...list].sort(
      (a, b) => b.dateGiven.toMillis() - a.dateGiven.toMillis(),
    );
  }, [services, filter, debouncedSearch, gemById]);

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

      <FlashList
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
          const tone = statusTone(item.status, colors);
          const gemTitle = gemTitleFor(item.gemId);
          const providerName = providerLabelFor(item);
          const providerPhoto = providerPhotoFor(item);
          const serviceTypeLabel = item.serviceType.replace(/_/g, " ");
          const overdue = item.status === "overdue";
          const dueLabel =
            item.status === "completed" ||
            item.status === "received_back" ||
            item.status === "cancelled"
              ? null
              : formatRelativeDue(item.expectedReturnDate);
          const amountLabel =
            item.finalCost != null
              ? formatFace(item.finalCost, item.finalCostCurrency)
              : item.agreedPrice != null
                ? formatFace(item.agreedPrice, item.agreedPriceCurrency)
                : null;
          const amountColor = overdue
            ? colors.error
            : item.status === "completed" || item.status === "received_back"
              ? colors.successEmerald
              : colors.primary;
          const cardBg = overdue
            ? colors.errorContainer + "66"
            : item.status === "given"
              ? colors.secondaryContainer + "55"
              : colors.surfaceContainerLowest;
          const actions: ContextMenuAction[] = canDeleteService(item)
            ? [
                {
                  label: "Delete",
                  icon: "trash",
                  destructive: true,
                  onPress: () =>
                    confirmDelete(
                      "Delete service",
                      `Remove this ${serviceTypeLabel} record? This cannot be undone.`,
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
              href={
                `/(marketplace)/(tabs)/workspace/services/${item.id}` as never
              }
              accessibilityLabel={`${gemTitle}, ${serviceTypeLabel}, to ${providerName}, ${tone.label}`}
              actions={actions}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.row,
                    {
                      backgroundColor: cardBg,
                      borderColor: overdue
                        ? colors.error + "66"
                        : colors.outlineVariant,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <View style={styles.mediaCol}>
                    <View style={styles.mediaStack}>
                      <GemThumb
                        uri={gemPrimaryPhotoUrl(gemById.get(item.gemId)) ?? null}
                        label={gemTitle}
                        size={56}
                        radius={12}
                      />
                      <View
                        style={[
                          styles.partyBadge,
                          { borderColor: colors.surfaceContainerLowest },
                        ]}
                      >
                        <ContactAvatar
                          name={providerName}
                          photoUrl={providerPhoto}
                          size={28}
                        />
                      </View>
                    </View>
                    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                      <Icon name={tone.icon} size={11} color={tone.fg} />
                      <Text
                        style={[styles.badgeText, { color: tone.fg }]}
                        numberOfLines={1}
                      >
                        {tone.label}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowBody}>
                    <View style={styles.rowTop}>
                      <Text
                        style={[styles.rowTitle, { color: colors.onSurface }]}
                        numberOfLines={1}
                      >
                        {gemTitle}
                      </Text>
                      {amountLabel ? (
                        <Text
                          style={[styles.rowAmount, { color: amountColor }]}
                        >
                          {amountLabel}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.partyRow}>
                      <Icon
                        name="call-made"
                        size={14}
                        color={colors.onSurfaceVariant}
                      />
                      <Text
                        style={[
                          styles.rowSub,
                          { color: colors.onSurfaceVariant },
                        ]}
                        numberOfLines={1}
                      >
                        To {providerName}
                      </Text>
                    </View>
                    <Text
                      style={[styles.rowSub, { color: colors.textMuted }]}
                      numberOfLines={1}
                    >
                      {serviceTypeLabel}
                      {dueLabel ? ` · ${dueLabel}` : ""}
                    </Text>
                  </View>
                  <Icon
                    name="chevron-right"
                    size={20}
                    color={colors.outline}
                  />
                </View>
              )}
            </ContextActionsLink>
          );
        }}
      />

      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push("/(marketplace)/services/add")}
      >
        <Icon name="add" size={28} color={colors.onPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  content: {
    padding: Spacing.containerMargin,
    paddingBottom: 100,
    gap: Spacing.gutterMd,
  },
  listHeader: { gap: Spacing.gutterMd },
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

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
  },
  mediaCol: {
    width: 72,
    alignItems: "center",
    gap: 8,
  },
  mediaStack: {
    width: 56,
    height: 56,
  },
  partyBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    borderRadius: 16,
    borderWidth: 2,
  },
  rowBody: { flex: 1, gap: 4, minWidth: 0, paddingTop: 2 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: { ...Typography.bodyMd, fontWeight: "700", flex: 1 },
  rowAmount: {
    ...Typography.bodyMd,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  partyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rowSub: { ...Typography.caption },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    maxWidth: "100%",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgeText: { fontSize: 10, fontWeight: "700" },

  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.18)",
  },
});
