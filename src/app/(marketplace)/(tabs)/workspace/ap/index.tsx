import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { StackHeader } from "@/components/ui/stack-header";
import { WorkspaceScreenBackdrop } from "@/components/workspace/workspace-screen-backdrop";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
  apAgreedTotal,
  apStatusLabel,
  isApOngoing,
} from "@/features/workspace/ap-normalize";
import {
  fetchGivenApRecords,
  fetchTakenApRecords,
  respondApRequest,
} from "@/features/workspace/ap-lifecycle-service";
import { getApSummary, isApOverdue } from "@/features/workspace/ap-utils";
import { useAppTheme } from "@/hooks/use-app-theme";
import { friendlyError } from "@/lib/errors";
import { formatCurrency, formatRelativeDue } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type { ApLifecycleStatus, ApRecord } from "@/types";

type ApSide = "given" | "taken";

type SectionKey =
  | "pending"
  | "accepted"
  | "payment_sent"
  | "done"
  | "closed";

const SECTION_ORDER: SectionKey[] = [
  "pending",
  "accepted",
  "payment_sent",
  "done",
  "closed",
];

const SECTION_TITLE: Record<SectionKey, string> = {
  pending: "Pending",
  accepted: "Accepted",
  payment_sent: "Payment sent",
  done: "Done",
  closed: "Rejected / Cancelled",
};

function sectionFor(status: ApLifecycleStatus): SectionKey {
  if (status === "pending") return "pending";
  if (isApOngoing(status)) return "accepted";
  if (status === "payment_sent" || status === "sold") return "payment_sent";
  if (status === "done") return "done";
  return "closed";
}

function ApRow({
  record,
  side,
  colors,
  onRespond,
  responding,
}: {
  record: ApRecord;
  side: ApSide;
  colors: ReturnType<typeof useAppTheme>["colors"];
  onRespond?: (action: "accepted" | "rejected") => void;
  responding?: boolean;
}) {
  const overdue = isApOverdue(record);
  const gemCount = record.items?.length || 1;
  const party =
    side === "given"
      ? record.receiverName || "Holder"
      : record.senderName || "Sender";
  const total = apAgreedTotal(record);
  const currency = record.items?.[0]?.currency || record.currency || "LKR";

  return (
    <Pressable
      onPress={() =>
        router.push(`/(marketplace)/(tabs)/workspace/ap/${record.id}`)
      }
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surfaceContainerLowest,
          borderColor: overdue ? colors.error + "55" : colors.outlineVariant,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.rowTop}>
        <Text style={[styles.party, { color: colors.onSurface }]} numberOfLines={1}>
          {party}
        </Text>
        <Text style={[styles.price, { color: colors.primary }]}>
          {formatCurrency(total, currency)}
        </Text>
      </View>
      <Text style={[styles.meta, { color: colors.onSurfaceVariant }]}>
        {gemCount} gem{gemCount === 1 ? "" : "s"} · {apStatusLabel(record.status)}
        {isApOngoing(record.status)
          ? ` · ${formatRelativeDue(record.expectedReturnDate)}`
          : ""}
      </Text>
      {side === "taken" && record.status === "pending" && onRespond ? (
        <View style={styles.actions}>
          <Button
            title="Accept"
            loading={responding}
            onPress={() => onRespond("accepted")}
            style={styles.actionBtn}
          />
          <Button
            title="Reject"
            variant="secondary"
            loading={responding}
            onPress={() => onRespond("rejected")}
            style={styles.actionBtn}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function ApListScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [side, setSide] = useState<ApSide>("given");
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const givenQ = useQuery({
    queryKey: ["ap", "given", user?.uid],
    queryFn: () => fetchGivenApRecords(user!.uid),
    enabled: !!user,
  });

  const takenQ = useQuery({
    queryKey: ["ap", "taken", user?.uid],
    queryFn: () => fetchTakenApRecords(user!.uid),
    enabled: !!user,
  });

  const records = side === "given" ? givenQ.data ?? [] : takenQ.data ?? [];
  const isRefetching = givenQ.isRefetching || takenQ.isRefetching;
  const summary = useMemo(() => getApSummary(records), [records]);

  const sections = useMemo(() => {
    const map = new Map<SectionKey, ApRecord[]>();
    for (const key of SECTION_ORDER) map.set(key, []);
    for (const r of records) {
      const key = sectionFor(r.status);
      map.get(key)!.push(r);
    }
    return SECTION_ORDER.map((key) => ({
      key,
      title: SECTION_TITLE[key],
      data: map.get(key)!,
    })).filter((s) => s.data.length > 0);
  }, [records]);

  async function refetch() {
    await Promise.all([givenQ.refetch(), takenQ.refetch()]);
  }

  async function onRespond(apId: string, action: "accepted" | "rejected") {
    setRespondingId(apId);
    try {
      await respondApRequest(apId, action);
      toast.success(action === "accepted" ? "AP accepted" : "AP rejected");
      await queryClient.invalidateQueries({ queryKey: ["ap"] });
      await queryClient.invalidateQueries({ queryKey: ["gems"] });
    } catch (e) {
      toast.error(friendlyError(e, "Could not respond to AP."));
    } finally {
      setRespondingId(null);
    }
  }

  const listData =
    records.length === 0
      ? []
      : sections.flatMap((s) => [
          {
            type: "header" as const,
            key: `h-${s.key}`,
            title: s.title,
            count: s.data.length,
          },
          ...s.data.map((r) => ({
            type: "row" as const,
            key: r.id,
            record: r,
          })),
        ]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <WorkspaceScreenBackdrop kind="ap" />
      <StackHeader title="AP Stones" />

      <View style={styles.tabs}>
        {(["given", "taken"] as const).map((t) => {
          const active = side === t;
          return (
            <Pressable
              key={t}
              onPress={() => setSide(t)}
              style={[
                styles.tab,
                {
                  backgroundColor: active
                    ? colors.primary
                    : colors.surfaceContainerLowest,
                  borderColor: active ? colors.primary : colors.outlineVariant,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.onPrimary : colors.onSurface },
                ]}
              >
                {t === "given" ? "Given" : "Taken"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item) => item.key}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={[styles.lead, { color: colors.textMuted }]}>
              {side === "given"
                ? "Stones you sent on approval."
                : "Stones traders sent you on approval."}
            </Text>
            <View style={styles.statsRow}>
              <View
                style={[
                  styles.statCell,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                  {side === "given" ? "Out" : "Holding"}
                </Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {summary.totalOut}
                </Text>
                <Text style={[styles.statHint, { color: colors.textMuted }]}>
                  {summary.pendingRequests} pending
                </Text>
              </View>
              <View
                style={[
                  styles.statCell,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text
                  style={[styles.statLabel, { color: colors.onPrimary + "CC" }]}
                >
                  Agreed value
                </Text>
                <Text
                  style={[styles.statValue, { color: colors.onPrimary }]}
                  numberOfLines={1}
                >
                  {formatCurrency(summary.totalValue)}
                </Text>
                <Text
                  style={[styles.statHint, { color: colors.onPrimary + "CC" }]}
                >
                  {summary.overdueCount > 0
                    ? `${summary.overdueCount} overdue`
                    : "Active APs"}
                </Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="handshake"
            title={side === "given" ? "No AP given" : "No AP taken"}
            subtitle={
              side === "given"
                ? "Send gems on AP to a GemFort trader"
                : "When a trader sends you stones, they appear here"
            }
            action={
              side === "given" ? (
                <Button
                  title="Give on AP"
                  icon="add"
                  onPress={() =>
                    router.push("/(marketplace)/(tabs)/workspace/ap/add")
                  }
                />
              ) : undefined
            }
          />
        }
        renderItem={({ item }) => {
          if (item.type === "header") {
            return (
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                {item.title}
                {item.count > 0 ? ` (${item.count})` : ""}
              </Text>
            );
          }
          return (
            <ApRow
              record={item.record}
              side={side}
              colors={colors}
              responding={respondingId === item.record.id}
              onRespond={
                side === "taken"
                  ? (action) => onRespond(item.record.id, action)
                  : undefined
              }
            />
          );
        }}
      />

      {side === "given" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Give on AP"
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
          ]}
          onPress={() => router.push("/(marketplace)/(tabs)/workspace/ap/add")}
        >
          <Icon name="add" size={28} color={colors.onPrimary} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  tabs: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.containerMargin,
    marginBottom: Spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  tabText: { ...Typography.labelMd, fontWeight: "700" },
  content: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 100,
    gap: Spacing.sm,
  },
  listHeader: { gap: Spacing.stackMd, marginBottom: Spacing.stackSm },
  lead: { ...Typography.bodyMd },
  statsRow: { flexDirection: "row", gap: Spacing.gutterMd },
  statCell: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 2,
    minHeight: 84,
    justifyContent: "center",
  },
  statLabel: { ...Typography.labelMd },
  statValue: { ...Typography.headlineSm, letterSpacing: -0.3 },
  statHint: { ...Typography.caption },
  sectionTitle: {
    ...Typography.labelMd,
    fontWeight: "700",
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  row: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: 6,
    marginBottom: Spacing.xs,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  party: { ...Typography.headlineSmMobile, flex: 1 },
  price: { ...Typography.bodyMd, fontWeight: "700" },
  meta: { ...Typography.bodySmall },
  actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  actionBtn: { flex: 1 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
});
