import { FlashList } from "@/components/ui/gesture-lists";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import { Accent, ListItem, ListSectionHeader } from "@/components/ui/detail-kit";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { InfiniteListFooter } from "@/components/ui/infinite-list-footer";
import { SearchField } from "@/components/ui/search-field";
import { StackHeader } from "@/components/ui/stack-header";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import {
    ContextActionsLink,
    type ContextMenuAction,
} from "@/components/workspace/context-actions-link";
import { GemArtwork } from "@/components/workspace/gem-artwork";
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
} from "@/features/workspace/workspace-service";
import { fetchServicesPage } from "@/features/workspace/workspace-pagination";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFirestoreInfiniteQuery } from "@/hooks/use-firestore-infinite-query";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import { formatRelativeDue } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { confirmDelete } from "@/providers/confirm-bridge";
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

const THUMB = 52;

/** Status label + semantic accent (see `Accent` in the detail kit). */
function statusMeta(status: ServiceRecord["status"]): {
  label: string;
  accent: string;
} {
  switch (status) {
    case "in_progress":
      return { label: "In Progress", accent: Accent.blue };
    case "ready":
      return { label: "Ready", accent: Accent.emerald };
    case "completed":
    case "received_back":
      return { label: "Completed", accent: Accent.emerald };
    case "overdue":
      return { label: "Overdue", accent: Accent.rose };
    case "cancellation_requested":
      return { label: "Cancel requested", accent: Accent.amber };
    case "cancelled":
      return { label: "Cancelled", accent: Accent.slate };
    case "rejected":
      return { label: "Declined", accent: Accent.rose };
    default:
      return { label: "Pending", accent: Accent.amber };
  }
}

function isClosed(status: ServiceRecord["status"]) {
  return (
    status === "completed" ||
    status === "received_back" ||
    status === "cancelled" ||
    status === "rejected"
  );
}

type Row =
  | { kind: "header"; key: string; title: string; count: number }
  | { kind: "item"; key: string; item: ServiceRecord; isLast: boolean };

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
    items: services,
    refetch,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useFirestoreInfiniteQuery({
    queryKey: ["services", user?.uid, "infinite"],
    fetchPage: (cursor, pageSize) =>
      fetchServicesPage(user!.uid, cursor, pageSize),
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

  // "All" splits open work from finished records; a status filter is one list.
  const rows = useMemo<Row[]>(() => {
    const toItems = (list: ServiceRecord[]): Row[] =>
      list.map((item, i) => ({
        kind: "item",
        key: item.id,
        item,
        isLast: i === list.length - 1,
      }));
    if (filter !== "all") return toItems(filtered);
    const open = filtered.filter((s) => !isClosed(s.status));
    const closed = filtered.filter((s) => isClosed(s.status));
    const out: Row[] = [];
    if (open.length) {
      out.push({ kind: "header", key: "h-open", title: "Active", count: open.length });
      out.push(...toItems(open));
    }
    if (closed.length) {
      out.push({
        kind: "header",
        key: "h-closed",
        title: "Completed & closed",
        count: closed.length,
      });
      out.push(...toItems(closed));
    }
    return out;
  }, [filtered, filter]);

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

  function renderService(item: ServiceRecord, isLast: boolean) {
    const status = statusMeta(item.status);
    const gem = gemById.get(item.gemId);
    const gemTitle = gemTitleFor(item.gemId);
    const gemPhoto = gemPrimaryPhotoUrl(gem) ?? null;
    const providerName = providerLabelFor(item);
    const providerPhoto = providerPhotoFor(item);
    const serviceTypeLabel = item.serviceType.replace(/_/g, " ");
    const serviceTypeTitle =
      serviceTypeLabel.charAt(0).toUpperCase() + serviceTypeLabel.slice(1);
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
      ? Accent.rose
      : item.status === "completed" || item.status === "received_back"
        ? Accent.emerald
        : undefined;
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
        href={`/(marketplace)/(tabs)/workspace/services/${item.id}` as never}
        accessibilityLabel={`${gemTitle}, ${serviceTypeLabel}, to ${providerName}, ${status.label}`}
        actions={actions}
      >
        <ListItem
          leading={
            <View style={styles.media}>
              {gemPhoto || !gem ? (
                <GemThumb uri={gemPhoto} label={gemTitle} size={THUMB} radius={14} />
              ) : (
                <GemArtwork gem={gem} style={styles.gemArt} />
              )}
              <View
                style={[
                  styles.partyBadge,
                  { borderColor: colors.surfaceContainerLowest },
                ]}
              >
                <ContactAvatar
                  name={providerName}
                  photoUrl={providerPhoto}
                  size={22}
                />
              </View>
            </View>
          }
          title={gemTitle}
          subtitle={`${serviceTypeTitle} · To ${providerName}`}
          meta={
            dueLabel
              ? overdue || dueLabel.includes("overdue")
                ? dueLabel
                : `Due ${dueLabel.toLowerCase()}`
              : null
          }
          amount={amountLabel}
          amountColor={amountColor}
          status={status}
          isLast={isLast}
        />
      </ContextActionsLink>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <WorkspaceScreenBackdrop kind="services" />
      <StackHeader title="Service Records" />

      <FlashList
        data={rows}
        keyExtractor={(row) => row.key}
        getItemType={(row) => row.kind}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          <InfiniteListFooter
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isFetchNextPageError={isFetchNextPageError}
            onRetry={() => void fetchNextPage()}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <SearchField
              placeholder="Search gems, providers, or IDs..."
              value={search}
              onChangeText={setSearch}
              style={styles.search}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setFilter(f.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
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
        renderItem={({ item: row }) =>
          row.kind === "header" ? (
            <ListSectionHeader title={row.title} count={row.count} />
          ) : (
            renderService(row.item, row.isLast)
          )
        }
      />

      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push("/(marketplace)/services/add")}
        accessibilityRole="button"
        accessibilityLabel="Add service"
      >
        <Icon name="add" size={28} color={colors.onPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  content: { paddingBottom: 100 },
  listHeader: { gap: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
  search: { marginHorizontal: Spacing.containerMargin },
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

  media: { width: THUMB, height: THUMB },
  gemArt: { width: THUMB, height: THUMB, borderRadius: 14 },
  partyBadge: {
    position: "absolute",
    right: -5,
    bottom: -5,
    borderRadius: 8,
    borderWidth: 2,
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
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.18)",
  },
});
