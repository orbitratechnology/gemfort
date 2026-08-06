import { FlashList } from "@/components/ui/gesture-lists";
import { useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { FormSectionLabel, ScreenInset } from "@/components/ui/form-section";
import { StackHeader } from "@/components/ui/stack-header";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { WorkspaceScreenBackdrop } from "@/components/workspace/workspace-screen-backdrop";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { canAccessModule, resolveProfileRole } from "@/constants/roles";
import { fetchBusinesses } from "@/features/marketplace/marketplace-service";
import {
    createClientNotification,
    fetchIncomingServiceRequests,
    fetchLapidaryJobs,
    respondServiceRequest,
    updateLapidaryJobStatus,
} from "@/features/marketplace/request-service";
import {
    subscribeIncomingServiceRequests,
    subscribeLapidaryJobs,
    subscribeProviderServices,
    subscribeVerifiedBusinesses,
} from "@/features/workspace/firestore-subscriptions";
import { resolveBusinessPhotoByOwnerUid } from "@/features/workspace/party-photo";
import { respondServiceCancellation } from "@/features/workspace/service-lifecycle-service";
import { fetchProviderServices } from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { friendlyError } from "@/lib/errors";
import { formatRelativeTime } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
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

function statusTone(
  status: LapidaryJob["status"],
  colors: ReturnType<typeof useAppTheme>["colors"],
): { bg: string; fg: string; accent: string; icon: IconName; label: string } {
  switch (status) {
    case "in_progress":
      return {
        bg: colors.primaryContainer,
        fg: colors.onPrimaryContainer,
        accent: colors.primary,
        icon: "sync",
        label: "In Progress",
      };
    case "ready":
      return {
        bg: colors.successEmerald + "22",
        fg: colors.successEmerald,
        accent: colors.successEmerald,
        icon: "check-circle",
        label: "Ready",
      };
    case "returned":
      return {
        bg: colors.successEmerald + "22",
        fg: colors.successEmerald,
        accent: colors.successEmerald,
        icon: "done-all",
        label: "Returned",
      };
    case "cancelled":
      return {
        bg: colors.surfaceContainerHighest,
        fg: colors.onSurfaceVariant,
        accent: colors.outline,
        icon: "cancel",
        label: "Cancelled",
      };
    default:
      return {
        bg: colors.secondaryContainer,
        fg: colors.onSecondaryContainer,
        accent: colors.secondary,
        icon: "hourglass-top",
        label: "Queued",
      };
  }
}

export default function LapidaryJobsScreen() {
  const { user, profile } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const role = resolveProfileRole(profile);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const canView = !!user && canAccessModule(role, "jobs");

  const {
    data: jobs = [],
    refetch,
    isRefetching,
    isLoading,
  } = useFirestoreLiveQuery({
    queryKey: ["lapidary-jobs", user?.uid],
    queryFn: () => fetchLapidaryJobs(user!.uid),
    subscribe: (onData, onError) =>
      subscribeLapidaryJobs(user!.uid, onData, onError),
    enabled: canView,
  });

  const { data: incoming = [] } = useFirestoreLiveQuery({
    queryKey: ["incoming-service-requests", user?.uid],
    queryFn: () => fetchIncomingServiceRequests(user!.uid),
    subscribe: (onData, onError) =>
      subscribeIncomingServiceRequests(user!.uid, onData, onError),
    enabled: canView,
  });

  const { data: providerServices = [] } = useFirestoreLiveQuery({
    queryKey: ["provider-services", user?.uid],
    queryFn: () => fetchProviderServices(user!.uid),
    subscribe: (onData, onError) =>
      subscribeProviderServices(user!.uid, onData, onError),
    enabled: canView,
  });

  const { data: businesses = [] } = useFirestoreLiveQuery({
    queryKey: ["home-businesses"],
    queryFn: () => fetchBusinesses(),
    subscribe: (onData, onError) =>
      subscribeVerifiedBusinesses(onData, onError),
    enabled: canView,
  });

  const traderLabel = useMemo(
    () => (uid: string | null | undefined) => {
      if (!uid) return "Trader";
      const business = businesses.find((b) => b.ownerUid === uid);
      return business?.businessName?.trim() || `Trader · ${uid.slice(0, 8)}`;
    },
    [businesses],
  );

  const traderPhoto = useMemo(
    () => (uid: string | null | undefined) =>
      resolveBusinessPhotoByOwnerUid(uid, businesses),
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
          traderLabel(j.traderUid).toLowerCase().includes(q) ||
          j.id.toLowerCase().includes(q)
        );
      });
    }
    return [...list].sort(
      (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis(),
    );
  }, [jobs, filter, debouncedSearch, traderLabel]);

  async function onRespond(
    id: string,
    decision: "accepted" | "rejected",
    traderUid: string,
  ) {
    try {
      await respondServiceRequest(id, decision);
      await createClientNotification({
        recipientUid: traderUid,
        type:
          decision === "accepted"
            ? "service_request_accepted"
            : "service_request_rejected",
        title:
          decision === "accepted"
            ? "Service request accepted"
            : "Service request declined",
        message:
          decision === "accepted"
            ? "Your lapidary accepted the job. Tracking is synced."
            : "Your lapidary declined this service request.",
        referenceType: "service_request",
        referenceId: id,
      });
      await queryClient.invalidateQueries({
        queryKey: ["incoming-service-requests"],
      });
      await queryClient.invalidateQueries({ queryKey: ["lapidary-jobs"] });
      toast.success(decision === "accepted" ? "Job accepted." : "Request declined.");
    } catch (e) {
      toast.error(friendlyError(e, "Could not update request."));
    }
  }

  async function onJobStatus(
    jobId: string,
    status: "in_progress" | "ready" | "returned",
    traderUid: string,
  ) {
    try {
      await updateLapidaryJobStatus(jobId, status);
      await createClientNotification({
        recipientUid: traderUid,
        type: "service_job_updated",
        title: "Workshop update",
        message: `Job status is now ${status.replace("_", " ")}.`,
        referenceType: "lapidary_job",
        referenceId: jobId,
      });
      await queryClient.invalidateQueries({ queryKey: ["lapidary-jobs"] });
      toast.success("Job updated.");
    } catch (e) {
      toast.error(friendlyError(e, "Could not update job."));
    }
  }

  async function onRespondCancellation(
    serviceId: string,
    action: "accepted" | "rejected",
  ) {
    try {
      await respondServiceCancellation(serviceId, action);
      await queryClient.invalidateQueries({ queryKey: ["provider-services"] });
      toast.success(
        action === "accepted" ? "Service cancelled." : "Cancellation declined.",
      );
    } catch (e) {
      toast.error(friendlyError(e, "Could not respond to cancellation."));
    }
  }

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

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <WorkspaceScreenBackdrop kind="jobs" />
      <StackHeader title="Workshop jobs" />

      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {pending.length > 0 ? (
              <View style={styles.actionSection}>
                <FormSectionLabel title="Incoming requests" />
                <ScreenInset style={styles.sectionBody}>
                  {pending.map((r) => (
                    <View
                      key={r.id}
                      style={[
                        styles.card,
                        { backgroundColor: colors.surfaceContainerLowest },
                      ]}
                    >
                      <Text
                        style={[styles.title, { color: colors.onSurface }]}
                        numberOfLines={1}
                      >
                        {r.gemName}
                      </Text>
                      <Text style={[styles.sub, { color: colors.textMuted }]}>
                        {r.serviceTypes
                          .map((t) => t.replace(/_/g, " "))
                          .join(", ")}
                        {r.notes ? ` · ${r.notes}` : ""}
                      </Text>
                      <View style={styles.row}>
                        <Button
                          title="Accept"
                          onPress={() =>
                            onRespond(r.id, "accepted", r.traderUid)
                          }
                        />
                        <Button
                          title="Reject"
                          variant="secondary"
                          onPress={() =>
                            onRespond(r.id, "rejected", r.traderUid)
                          }
                        />
                      </View>
                    </View>
                  ))}
                </ScreenInset>
              </View>
            ) : null}

            {cancellationRequests.length > 0 ? (
              <View style={styles.actionSection}>
                <FormSectionLabel title="Cancellation requests" />
                <ScreenInset style={styles.sectionBody}>
                  {cancellationRequests.map((s) => (
                    <View
                      key={s.id}
                      style={[
                        styles.card,
                        { backgroundColor: colors.surfaceContainerLowest },
                      ]}
                    >
                      <Text
                        style={[styles.title, { color: colors.onSurface }]}
                        numberOfLines={1}
                      >
                        {s.serviceType.replace(/_/g, " ")}
                      </Text>
                      <Text style={[styles.sub, { color: colors.textMuted }]}>
                        A trader asked to cancel this service.
                      </Text>
                      <View style={styles.row}>
                        <Button
                          title="Accept"
                          onPress={() =>
                            onRespondCancellation(s.id, "accepted")
                          }
                        />
                        <Button
                          title="Decline"
                          variant="secondary"
                          onPress={() =>
                            onRespondCancellation(s.id, "rejected")
                          }
                        />
                      </View>
                    </View>
                  ))}
                </ScreenInset>
              </View>
            ) : null}

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
                  placeholder="Search gems, services, or traders..."
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
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="construction"
              title="No jobs"
              subtitle={
                debouncedSearch.trim() || filter !== "all"
                  ? "No jobs match this search."
                  : "Accepted trader stones appear here as workshop jobs."
              }
            />
          )
        }
        renderItem={({ item: j }) => {
          const tone = statusTone(j.status, colors);
          const traderName = traderLabel(j.traderUid);
          const traderAvatar = traderPhoto(j.traderUid);
          const types = j.serviceTypes
            .map((t) => t.replace(/_/g, " "))
            .join(", ");
          return (
            <View
              style={[
                styles.jobRow,
                { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
              ]}
            >
              <View style={styles.jobRowTop}>
                <View style={styles.mediaCol}>
                  <View style={styles.mediaStack}>
                    <GemThumb
                      uri={null}
                      label={j.gemName}
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
                        name={traderName}
                        photoUrl={traderAvatar}
                        size={28}
                      />
                    </View>
                  </View>
                </View>
                <View style={styles.rowBody}>
                  <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                    <Icon name={tone.icon} size={11} color={tone.fg} />
                    <Text
                      style={[styles.badgeText, { color: tone.fg }]}
                      numberOfLines={1}
                    >
                      {tone.label}
                    </Text>
                  </View>
                  <Text
                    style={[styles.rowTitle, { color: colors.onSurface }]}
                    numberOfLines={1}
                  >
                    {j.gemName}
                  </Text>
                  <View style={styles.partyRow}>
                    <Icon
                      name="call-received"
                      size={14}
                      color={colors.onSurfaceVariant}
                    />
                    <Text
                      style={[styles.rowSub, { color: colors.onSurfaceVariant }]}
                      numberOfLines={1}
                    >
                      From {traderName}
                    </Text>
                  </View>
                  <Text
                    style={[styles.rowSub, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {types}
                    {j.notes ? ` · ${j.notes}` : ""} ·{" "}
                    {formatRelativeTime(j.updatedAt)}
                  </Text>
                </View>
              </View>
              <View style={styles.jobActions}>
                {j.status === "queued" ? (
                  <Button
                    title="Start"
                    icon="play-arrow"
                    onPress={() =>
                      onJobStatus(j.id, "in_progress", j.traderUid)
                    }
                  />
                ) : null}
                {j.status === "in_progress" ? (
                  <Button
                    title="Mark ready"
                    icon="check"
                    onPress={() => onJobStatus(j.id, "ready", j.traderUid)}
                  />
                ) : null}
                {j.status === "ready" ? (
                  <Button
                    title="Returned"
                    icon="done-all"
                    variant="secondary"
                    onPress={() => onJobStatus(j.id, "returned", j.traderUid)}
                  />
                ) : null}
              </View>
            </View>
          );
        }}
      />
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
  actionSection: { gap: Spacing.gutterMd },
  sectionBody: { gap: Spacing.md },
  card: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: Spacing.lg,
    gap: 6,
    marginBottom: Spacing.sm,
  },
  title: { ...Typography.headlineSmMobile, fontWeight: "700" },
  sub: { ...Typography.caption },
  row: { flexDirection: "row", gap: Spacing.stackSm, marginTop: Spacing.stackSm },

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

  jobRowWrap: { marginBottom: Spacing.gutterMd },
  jobRow: {
    gap: Spacing.stackSm,
    padding: 12,
    marginBottom: Spacing.gutterMd,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
  },
  jobRowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  mediaCol: {
    width: 72,
    alignItems: "center",
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
  rowTitle: { ...Typography.bodyMd, fontWeight: "700" },
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
    alignSelf: "flex-start",
    gap: 3,
    maxWidth: "100%",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgeText: { fontSize: 10, fontWeight: "700" },
  jobActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.stackSm,
  },
});
