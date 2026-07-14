import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo } from "react";
import {
    FlatList,
    Image,
    Linking,
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
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import {
    type ApHolderGroup,
    findGemForAp,
    getApSummary,
    groupApByHolder,
    isApOverdue,
} from "@/features/workspace/ap-utils";
import {
    fetchApRecords,
    fetchContacts,
    fetchGems,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatCurrency, formatDate, openPhone } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import type { WorkspaceGem } from "@/types";

function holderInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function gemLabel(gem: WorkspaceGem | undefined) {
  if (!gem) return "Gem";
  const named =
    "name" in gem && typeof (gem as { name?: string }).name === "string"
      ? (gem as { name?: string }).name?.trim()
      : "";
  return named || formatGemType(gem.gemType) || gem.sku;
}

function HolderGroupCard({
  group,
  gems,
  colors,
}: {
  group: ApHolderGroup;
  gems: WorkspaceGem[];
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const stoneCount = group.records.length;
  const stoneWord = stoneCount === 1 ? "stone" : "stones";

  return (
    <View
      style={[
        styles.holderCard,
        {
          backgroundColor: colors.surfaceContainerLowest,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      {/* Holder — parent of the stones below */}
      <View style={styles.holderHeader}>
        <View
          style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}
        >
          <Text
            style={[styles.avatarText, { color: colors.onPrimaryContainer }]}
          >
            {holderInitials(group.holderName)}
          </Text>
        </View>

        <View style={styles.holderText}>
          <View style={styles.holderTitleRow}>
            <Text
              style={[styles.holderName, { color: colors.onSurface }]}
              numberOfLines={1}
            >
              {group.holderName}
            </Text>
            {group.overdueCount > 0 ? (
              <View
                style={[
                  styles.overduePill,
                  { backgroundColor: colors.errorContainer },
                ]}
              >
                <Icon name="warning" size={12} color={colors.error} />
                <Text style={[styles.overduePillText, { color: colors.error }]}>
                  {group.overdueCount} overdue
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.holderRelation, { color: colors.primary }]}>
            Holding {stoneCount} {stoneWord} on AP
          </Text>
          <Text style={[styles.holderValue, { color: colors.textMuted }]}>
            Min total {formatCurrency(group.totalMinimumValue)}
          </Text>
        </View>

        {group.holderPhone ? (
          <Pressable
            onPress={() => Linking.openURL(openPhone(group.holderPhone!))}
            style={[
              styles.callBtn,
              { backgroundColor: colors.surfaceContainerHigh },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Call ${group.holderName}`}
          >
            <Icon name="call" size={18} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      {/* Nested stones — visually attached to this holder */}
      <View
        style={[
          styles.stonesBlock,
          {
            borderTopColor: colors.outlineVariant,
            backgroundColor: colors.surfaceContainerLow,
          },
        ]}
      >
        {group.records.map((record, index) => {
          const gem = findGemForAp(gems, record.gemId);
          const overdue = isApOverdue(record);
          const photo = gem?.photoUrls?.[0];
          const isLast = index === group.records.length - 1;

          return (
            <Pressable
              key={record.id}
              onPress={() =>
                router.push(`/(marketplace)/(tabs)/workspace/ap/${record.id}`)
              }
              style={({ pressed }) => [
                styles.stoneRow,
                overdue && { backgroundColor: colors.errorContainer + "55" },
                pressed && { opacity: 0.88 },
              ]}
            >
              <View style={styles.treeCol}>
                <View
                  style={[
                    styles.treeLineTop,
                    { backgroundColor: colors.primary + "40" },
                  ]}
                />
                <View
                  style={[styles.treeDot, { borderColor: colors.primary }]}
                />
                {!isLast ? (
                  <View
                    style={[
                      styles.treeLineBottom,
                      { backgroundColor: colors.primary + "40" },
                    ]}
                  />
                ) : (
                  <View style={styles.treeLineBottomSpacer} />
                )}
              </View>

              <View
                style={[
                  styles.thumb,
                  { backgroundColor: colors.primaryContainer },
                ]}
              >
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.thumbImg} />
                ) : (
                  <Icon
                    name="diamond"
                    size={20}
                    color={colors.onPrimaryContainer}
                  />
                )}
              </View>

              <View style={styles.stoneBody}>
                <View style={styles.stoneTop}>
                  <Text
                    style={[styles.stoneTitle, { color: colors.onSurface }]}
                    numberOfLines={1}
                  >
                    {gemLabel(gem)}
                  </Text>
                  <Text style={[styles.stonePrice, { color: colors.primary }]}>
                    {formatCurrency(record.ownerMinimumPrice, record.currency)}
                  </Text>
                </View>
                <Text
                  style={[styles.stoneSub, { color: colors.onSurfaceVariant }]}
                  numberOfLines={1}
                >
                  {gem
                    ? `${formatGemType(gem.gemType)} · ${gem.currentWeight} ct`
                    : record.gemId.slice(0, 8)}
                </Text>
                <View style={styles.stoneMeta}>
                  <Icon
                    name="schedule"
                    size={13}
                    color={overdue ? colors.error : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.stoneMetaText,
                      { color: overdue ? colors.error : colors.textMuted },
                    ]}
                  >
                    {overdue
                      ? "Overdue"
                      : `Due ${formatDate(record.expectedReturnDate)}`}
                  </Text>
                  <Text
                    style={[styles.stoneStatus, { color: colors.textMuted }]}
                  >
                    {record.status.replace(/_/g, " ")}
                  </Text>
                </View>
              </View>

              <View style={styles.chevronWrap}>
                <Icon name="chevron-right" size={18} color={colors.outline} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function ApListScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();

  const {
    data: records = [],
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["ap", user?.uid],
    queryFn: () => fetchApRecords(user!.uid),
    enabled: !!user,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: !!user,
  });

  const { data: gems = [] } = useQuery({
    queryKey: ["gems", user?.uid],
    queryFn: () => fetchGems(user!.uid),
    enabled: !!user,
  });

  const summary = useMemo(() => getApSummary(records), [records]);
  const groups = useMemo(
    () => groupApByHolder(records, contacts),
    [records, contacts],
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="AP Stones" />

      <FlatList
        data={groups}
        keyExtractor={(g) => g.holderId}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={[styles.lead, { color: colors.textMuted }]}>
              Stones grouped by the person holding them on approval.
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
                  Stones out
                </Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {summary.totalOut}
                </Text>
                <Text style={[styles.statHint, { color: colors.textMuted }]}>
                  {groups.length} holder{groups.length === 1 ? "" : "s"}
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
                  Min value
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
                    : "Across all holders"}
                </Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="handshake"
            title="No AP stones"
            subtitle="Give a gem on AP to track who is holding it"
            action={
              <Button
                title="Give on AP"
                icon="add"
                onPress={() =>
                  router.push("/(marketplace)/(tabs)/workspace/ap/add")
                }
              />
            }
          />
        }
        renderItem={({ item: group }) => (
          <HolderGroupCard group={group} gems={gems} colors={colors} />
        )}
      />

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 100,
    gap: Spacing.gutterMd,
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

  holderCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: Spacing.stackSm,
  },
  holderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...Typography.labelMd, fontWeight: "700" },
  holderText: { flex: 1, gap: 2 },
  holderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  holderName: { ...Typography.headlineSmMobile, flexShrink: 1 },
  holderRelation: { ...Typography.bodySmall, fontWeight: "600" },
  holderValue: { ...Typography.caption },
  overduePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  overduePillText: { ...Typography.caption, fontWeight: "600" },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  stonesBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.xs,
  },
  stoneRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingRight: Spacing.md,
    paddingLeft: Spacing.sm,
    minHeight: 72,
  },
  treeCol: {
    width: 16,
    alignItems: "center",
  },
  treeLineTop: {
    width: 2,
    flex: 1,
    minHeight: 8,
  },
  treeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  treeLineBottom: {
    width: 2,
    flex: 1,
    minHeight: 8,
  },
  treeLineBottomSpacer: {
    width: 2,
    flex: 1,
    minHeight: 8,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    alignSelf: "center",
  },
  thumbImg: { width: "100%", height: "100%" },
  stoneBody: { flex: 1, gap: 2, justifyContent: "center", paddingVertical: 2 },
  stoneTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  stoneTitle: { ...Typography.bodyMd, fontWeight: "600", flex: 1 },
  stonePrice: { ...Typography.bodyMd, fontWeight: "600" },
  stoneSub: { ...Typography.bodySmall },
  stoneMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  stoneMetaText: { ...Typography.caption, flex: 1 },
  stoneStatus: { ...Typography.caption, textTransform: "capitalize" },
  chevronWrap: { justifyContent: "center" },
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
