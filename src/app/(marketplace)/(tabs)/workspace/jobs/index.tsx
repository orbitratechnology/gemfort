import { FlashList } from "@/components/ui/gesture-lists";
import { useQueryClient } from "@tanstack/react-query";
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

import { Button } from "@/components/ui/button";
import { Accent, IconBubble, ListItem, ListSectionHeader } from "@/components/ui/detail-kit";
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
import { GemThumb } from "@/components/workspace/gem-thumb";
import { WorkspaceScreenBackdrop } from "@/components/workspace/workspace-screen-backdrop";
import { FontFamily, Radius, Spacing, Typography } from "@/constants/design-tokens";
import { WORKSPACE_ENTITY_IMAGES } from "@/constants/workspace-entity-images";
import { canAccessModule, resolveProfileRole } from "@/constants/roles";
import { fetchBusinesses } from "@/features/marketplace/marketplace-service";
import {
    deleteLapidaryJob,
} from "@/features/marketplace/request-service";
import {
    fetchIncomingServiceRequestsPage,
    fetchLapidaryJobsPage,
    fetchProviderServicesPage,
} from "@/features/marketplace/request-pagination";
import {
    subscribeVerifiedBusinesses,
} from "@/features/workspace/firestore-subscriptions";
import { resolveBusinessPhotoById } from "@/features/workspace/party-photo";
import { respondServiceCancellation } from "@/features/workspace/service-lifecycle-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFirestoreInfiniteQuery } from "@/hooks/use-firestore-infinite-query";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { friendlyError } from "@/lib/errors";
import { formatRelativeTime } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { confirmDelete } from "@/providers/confirm-bridge";
import { useToast } from "@/providers/toast-provider";
import type { LapidaryJob } from "@/types";

type StatusFilter =
  | "all"
  | "queued"
  | "in_progress"
  | "ready"
  | "returned"
  | "cancelled";

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All Statuses" },
  { id: "queued", label: "Queued" },
  { id: "in_progress", label: "In Progress" },
  { id: "ready", label: "Ready" },
  { id: "returned", label: "Returned" },
  { id: "cancelled", label: "Cancelled" },
];

const THUMB = 52;

/** Status label + semantic accent (see `Accent` in the detail kit). */
function statusMeta(status: LapidaryJob["status"]): {
  label: string;
  accent: string;
} {
  switch (status) {
    case "in_progress":
      return { label: "In Progress", accent: Accent.blue };
    case "ready":
      return { label: "Ready", accent: Accent.emerald };
    case "returned":
      return { label: "Returned", accent: Accent.emerald };
    case "cancelled":
      return { label: "Cancelled", accent: Accent.slate };
    default:
      return { label: "Queued", accent: Accent.amber };
  }
}

function isClosed(status: LapidaryJob["status"]) {
  return status === "returned" || status === "cancelled";
}

function typesLabel(types: string[]) {
  const label = types.map((t) => t.replace(/_/g, " ")).join(", ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type Row =
  | { kind: "header"; key: string; title: string; count: number }
  | { kind: "item"; key: string; item: LapidaryJob; isLast: boolean };

export default function LapidaryJobsScreen() {
  const { user, profile } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const role = resolveProfileRole(profile);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [filter, setFilter] = useState<StatusFilter>("all");
  // Cancellation response in flight, so only the tapped button spins.
  const [respondingKey, setRespondingKey] = useState<string | null>(null);

  const canView = !!user && canAccessModule(role, "jobs");

  const {
    items: jobs,
    refetch: refetchJobs,
    isRefetching: isRefetchingJobs,
    isLoading: isLoadingJobs,
    hasNextPage: hasNextJobsPage,
    isFetchingNextPage: isFetchingNextJobsPage,
    isFetchNextPageError: isFetchNextJobsPageError,
    fetchNextPage: fetchNextJobsPage,
  } = useFirestoreInfiniteQuery({
    queryKey: ["lapidary-jobs", user?.uid, "infinite"],
    fetchPage: (cursor, pageSize) =>
      fetchLapidaryJobsPage(user!.uid, cursor, pageSize),
    enabled: canView,
  });

  const incomingQuery = useFirestoreInfiniteQuery({
    queryKey: ["incoming-service-requests", user?.uid, "infinite"],
    fetchPage: (cursor, pageSize) =>
      fetchIncomingServiceRequestsPage(user!.uid, cursor, pageSize),
    enabled: canView,
  });

  const providerServicesQuery = useFirestoreInfiniteQuery({
    queryKey: ["provider-services", user?.uid, "infinite"],
    fetchPage: (cursor, pageSize) =>
      fetchProviderServicesPage(user!.uid, cursor, pageSize),
    enabled: canView,
  });

  const incoming = incomingQuery.items;
  const providerServices = providerServicesQuery.items;
  const isLoading = isLoadingJobs;
  const isRefetching =
    isRefetchingJobs ||
    incomingQuery.isRefetching ||
    providerServicesQuery.isRefetching;
  const hasNextPage =
    hasNextJobsPage ||
    incomingQuery.hasNextPage ||
    providerServicesQuery.hasNextPage;
  const isFetchingNextPage =
    isFetchingNextJobsPage ||
    incomingQuery.isFetchingNextPage ||
    providerServicesQuery.isFetchingNextPage;
  const isFetchNextPageError =
    isFetchNextJobsPageError ||
    incomingQuery.isFetchNextPageError ||
    providerServicesQuery.isFetchNextPageError;

  function loadMore() {
    const requests: Promise<unknown>[] = [];
    if (hasNextJobsPage && !isFetchingNextJobsPage) {
      requests.push(fetchNextJobsPage());
    }
    if (
      incomingQuery.hasNextPage &&
      !incomingQuery.isFetchingNextPage
    ) {
      requests.push(incomingQuery.fetchNextPage());
    }
    if (
      providerServicesQuery.hasNextPage &&
      !providerServicesQuery.isFetchingNextPage
    ) {
      requests.push(providerServicesQuery.fetchNextPage());
    }
    void Promise.all(requests);
  }

  async function refetch() {
    await Promise.all([
      refetchJobs(),
      incomingQuery.refetch(),
      providerServicesQuery.refetch(),
    ]);
  }

  const { data: businesses = [] } = useFirestoreLiveQuery({
    queryKey: ["home-businesses"],
    queryFn: () => fetchBusinesses(),
    subscribe: (onData, onError) =>
      subscribeVerifiedBusinesses(onData, onError),
    enabled: canView,
  });

  const traderLabel = useMemo(
    () => (uid: string | null | undefined, snapshotName?: string | null) => {
      if (snapshotName?.trim()) return snapshotName.trim();
      if (!uid) return "Trader";
      return `Trader · ${uid.slice(0, 8)}`;
    },
    [],
  );

  const traderPhoto = useMemo(
    () => (businessId: string | null | undefined) =>
      resolveBusinessPhotoById(businessId, businesses),
    [businesses],
  );

  const filtered = useMemo(() => {
    let list = jobs;
    if (filter !== "all") {
      list = list.filter((j) => j.status === filter);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((j) => {
        const types = j.serviceTypes.map((t) => t.replace(/_/g, " ")).join(" ");
        return (
          j.gemName.toLowerCase().includes(q) ||
          types.toLowerCase().includes(q) ||
          (j.notes ?? "").toLowerCase().includes(q) ||
          traderLabel(j.traderUid, j.traderBusinessName).toLowerCase().includes(q) ||
          j.id.toLowerCase().includes(q)
        );
      });
    }
    return [...list].sort(
      (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis(),
    );
  }, [jobs, filter, debouncedSearch, traderLabel]);

  async function onDeleteJob(jobId: string) {
    try {
      await deleteLapidaryJob(jobId);
      await queryClient.invalidateQueries({ queryKey: ["lapidary-jobs"] });
      toast.success("Job removed from Workshop Jobs.");
    } catch (e) {
      toast.error(friendlyError(e, "Could not delete job."));
    }
  }

  async function onRespondCancellation(
    serviceId: string,
    action: "accepted" | "rejected",
  ) {
    if (respondingKey) return;
    setRespondingKey(`${serviceId}-${action}`);
    try {
      await respondServiceCancellation(serviceId, action);
      await queryClient.invalidateQueries({ queryKey: ["provider-services"] });
      toast.success(
        action === "accepted" ? "Service cancelled." : "Cancellation declined.",
      );
    } catch (e) {
      toast.error(friendlyError(e, "Could not respond to cancellation."));
    } finally {
      setRespondingKey(null);
    }
  }

  // "All" splits open work from finished jobs; a status filter is one list.
  const rows = useMemo<Row[]>(() => {
    const toItems = (list: LapidaryJob[]): Row[] =>
      list.map((item, i) => ({
        kind: "item",
        key: item.id,
        item,
        isLast: i === list.length - 1,
      }));
    if (filter !== "all") {
      return filtered.length
        ? [
            { kind: "header", key: "h-filtered", title: "Jobs", count: filtered.length },
            ...toItems(filtered),
          ]
        : [];
    }
    const open = filtered.filter((j) => !isClosed(j.status));
    const closed = filtered.filter((j) => isClosed(j.status));
    const out: Row[] = [];
    if (open.length) {
      out.push({ kind: "header", key: "h-open", title: "Active jobs", count: open.length });
      out.push(...toItems(open));
    }
    if (closed.length) {
      out.push({
        kind: "header",
        key: "h-closed",
        title: "Returned & cancelled",
        count: closed.length,
      });
      out.push(...toItems(closed));
    }
    return out;
  }, [filtered, filter]);

  if (!user) return null;
  if (!canAccessModule(role, "jobs")) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        edges={["top"]}
      >
        <StackHeader title="Jobs" />
        <EmptyState
          icon="lock"
          title="Lapidary only"
          subtitle="Jobs are for lapidary workshops."
        />
      </SafeAreaView>
    );
  }

  const pending = incoming.filter((r) => r.status === "pending");
  const cancellationRequests = providerServices.filter(
    (s) => s.status === "cancellation_requested",
  );

  function renderJob(j: LapidaryJob, isLast: boolean) {
    const status = statusMeta(j.status);
    const traderName = traderLabel(j.traderUid, j.traderBusinessName);
    const traderAvatar = traderPhoto(j.traderBusinessId);
    const canDelete = j.status === "cancelled" || j.status === "returned";
    const actions: ContextMenuAction[] = canDelete
      ? [
          {
            label: "Delete",
            icon: "trash",
            destructive: true,
            onPress: () =>
              confirmDelete(
                "Delete workshop job",
                "Remove this completed or cancelled job from Workshop Jobs? The sender's service history will remain.",
                () => onDeleteJob(j.id),
              ),
          },
        ]
      : [];
    return (
      <ContextActionsLink
        href={`/(marketplace)/(tabs)/workspace/jobs/${j.id}` as never}
        accessibilityLabel={`${j.gemName}, ${status.label}, from ${traderName}`}
        actions={actions}
      >
        <ListItem
          leading={
            <View style={styles.media}>
              <GemThumb
                uri={j.gemPhotoUrl}
                label={j.gemName}
                size={THUMB}
                radius={14}
              />
              <View
                style={[
                  styles.partyBadge,
                  { borderColor: colors.surfaceContainerLowest },
                ]}
              >
                <ContactAvatar
                  name={traderName}
                  photoUrl={traderAvatar}
                  size={22}
                />
              </View>
            </View>
          }
          title={j.gemName}
          subtitle={`${typesLabel(j.serviceTypes)} · From ${traderName}`}
          meta={[j.notes, formatRelativeTime(j.updatedAt)]
            .filter(Boolean)
            .join(" · ")}
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
      <WorkspaceScreenBackdrop kind="jobs" />
      <StackHeader title="Workshop jobs" />

      <FlashList
        data={rows}
        keyExtractor={(row) => row.key}
        getItemType={(row) => row.kind}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          <InfiniteListFooter
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isFetchNextPageError={isFetchNextPageError}
            onRetry={loadMore}
          />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {pending.length > 0 ? (
              <View>
                <ListSectionHeader
                  title="Incoming requests"
                  count={pending.length}
                  hint="Tap a request to review the job and respond."
                />
                {pending.map((r, i) => (
                  <ContextActionsLink
                    key={r.id}
                    href={`/(marketplace)/(tabs)/workspace/jobs/${r.id}` as never}
                    accessibilityLabel={`${r.gemName}, incoming service request`}
                  >
                    <ListItem
                      leading={
                        <GemThumb
                          uri={r.gemPhotoUrl}
                          label={r.gemName || "Gem"}
                          size={THUMB}
                          radius={14}
                        />
                      }
                      title={r.gemName || "Gem"}
                      subtitle={
                        r.serviceTypes.length > 0
                          ? typesLabel(r.serviceTypes)
                          : "Service request"
                      }
                      meta={[r.notes, formatRelativeTime(r.updatedAt)]
                        .filter(Boolean)
                        .join(" · ")}
                      status={{ label: "New", accent: Accent.amber }}
                      isLast={i === pending.length - 1}
                    />
                  </ContextActionsLink>
                ))}
              </View>
            ) : null}

            {cancellationRequests.length > 0 ? (
              <View>
                <ListSectionHeader
                  title="Cancellation requests"
                  count={cancellationRequests.length}
                />
                {cancellationRequests.map((s, i) => (
                  <View
                    key={s.id}
                    style={[
                      styles.cancelItem,
                      { backgroundColor: colors.surfaceContainerLowest },
                      i < cancellationRequests.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.outlineVariant,
                      },
                    ]}
                  >
                    <View style={styles.cancelHead}>
                      <IconBubble icon="hourglass-top" accent={Accent.amber} />
                      <View style={styles.cancelCopy}>
                        <Text
                          style={[styles.cancelTitle, { color: colors.onSurface }]}
                          numberOfLines={1}
                        >
                          {typesLabel([s.serviceType])}
                        </Text>
                        <Text
                          style={[styles.cancelSub, { color: colors.onSurfaceVariant }]}
                        >
                          A trader asked to cancel this service.
                        </Text>
                      </View>
                    </View>
                    <View style={styles.buttonRow}>
                      <Button
                        title="Accept"
                        icon="check"
                        loading={respondingKey === `${s.id}-accepted`}
                        disabled={respondingKey !== null}
                        onPress={() =>
                          onRespondCancellation(s.id, "accepted")
                        }
                        style={styles.flex}
                      />
                      <Button
                        title="Decline"
                        icon="close"
                        variant="secondary"
                        loading={respondingKey === `${s.id}-rejected`}
                        disabled={respondingKey !== null}
                        onPress={() =>
                          onRespondCancellation(s.id, "rejected")
                        }
                        style={styles.flex}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.searchBlock}>
              <SearchField
                placeholder="Search gems, services, or traders..."
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
          </View>
        }
        ListEmptyComponent={
          isLoading || pending.length > 0 ? null : (
            <EmptyState
              icon="construction"
              image={WORKSPACE_ENTITY_IMAGES.service}
              title="No jobs"
              subtitle={
                debouncedSearch.trim() || filter !== "all"
                  ? "No jobs match this search."
                  : "Accepted trader stones appear here as workshop jobs."
              }
            />
          )
        }
        renderItem={({ item: row }) =>
          row.kind === "header" ? (
            <ListSectionHeader title={row.title} count={row.count} />
          ) : (
            renderJob(row.item, row.isLast)
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  content: { paddingBottom: 100 },
  flex: { flex: 1 },

  cancelItem: {
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  cancelHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  cancelCopy: { flex: 1, minWidth: 0, gap: 2 },
  cancelTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
  cancelSub: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
  buttonRow: { flexDirection: "row", gap: Spacing.sm },

  searchBlock: { gap: Spacing.md, paddingTop: Spacing.lg },
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
  partyBadge: {
    position: "absolute",
    right: -5,
    bottom: -5,
    borderRadius: 8,
    borderWidth: 2,
  },
});
