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
import { StackHeader } from "@/components/ui/stack-header";
import { WorkspaceScreenBackdrop } from "@/components/workspace/workspace-screen-backdrop";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
    CHEQUE_STATUS_LABELS,
    getChequeSummary,
    getUpcomingCheques,
    maturityLabel,
} from "@/features/workspace/cheque-utils";
import {
    fetchCheques,
    fetchContacts,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import type { Cheque } from "@/types";

function ChequeRow({
  cheque,
  contactName,
  colors,
  onPress,
}: {
  cheque: Cheque;
  contactName: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
  onPress: () => void;
}) {
  const isBounced = cheque.status === "bounced";
  const isReceived = cheque.direction === "received";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surfaceContainerLowest,
          borderColor: colors.outlineVariant,
        },
        isBounced && { borderColor: colors.error + "55" },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View
        style={[
          styles.rowIcon,
          {
            backgroundColor: isBounced
              ? colors.errorContainer
              : isReceived
                ? colors.secondaryContainer
                : colors.surfaceContainerHigh,
          },
        ]}
      >
        <Icon
          name="money-check-dollar"
          size={20}
          color={
            isBounced
              ? colors.error
              : isReceived
                ? colors.onSecondaryContainer
                : colors.onSurfaceVariant
          }
        />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text
            style={[styles.rowTitle, { color: colors.onSurface }]}
            numberOfLines={1}
          >
            {cheque.chequeNumber} · {cheque.bankName}
          </Text>
          <Text
            style={[styles.rowAmount, { color: colors.primary }]}
            selectable
          >
            {formatCurrency(cheque.amount, cheque.currency)}
          </Text>
        </View>
        <Text
          style={[styles.rowSub, { color: colors.textMuted }]}
          numberOfLines={1}
        >
          {isReceived ? "From" : "To"} {contactName || cheque.issuedBy}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={[styles.rowDate, { color: colors.onSurfaceVariant }]}>
            {maturityLabel(cheque)}
          </Text>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: isBounced
                  ? colors.errorContainer
                  : colors.surfaceContainerHighest,
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: isBounced ? colors.error : colors.onSurfaceVariant },
              ]}
            >
              {CHEQUE_STATUS_LABELS[cheque.status]}
            </Text>
          </View>
        </View>
      </View>
      <Icon name="chevron-right" size={20} color={colors.outline} />
    </Pressable>
  );
}

export default function ChequesScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();

  const {
    data: cheques = [],
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["cheques", user?.uid],
    queryFn: () => fetchCheques(user!.uid),
    enabled: !!user,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: !!user,
  });

  const contactMap = new Map(contacts.map((c) => [c.id, c.displayName]));
  const summary = getChequeSummary(cheques);
  const upcoming = getUpcomingCheques(cheques);
  const bounced = cheques.filter((c) => c.status === "bounced");

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <WorkspaceScreenBackdrop kind="cheques" />

      <StackHeader
        title="Cheques"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cheque calendar"
            hitSlop={8}
            onPress={() =>
              router.push(
                "/(marketplace)/(tabs)/workspace/cheques/calendar" as never,
              )
            }
            style={styles.headerBtn}
          >
            <Icon name="calendar-month" size={24} color={colors.onSurface} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Track post-dated cheques, maturity dates, and clearance status.
        </Text>

        {/* Summary strip */}
        <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text
                style={[
                  styles.summaryLabel,
                  { color: colors.onPrimary + "99" },
                ]}
              >
                HOLDING
              </Text>
              <Text
                style={[styles.summaryValue, { color: colors.onPrimary }]}
                selectable
              >
                {summary.holdingCount} · {formatCurrency(summary.holdingTotal)}
              </Text>
            </View>
            <View
              style={[
                styles.summaryDivider,
                { backgroundColor: colors.onPrimary + "22" },
              ]}
            />
            <View style={styles.summaryCol}>
              <Text
                style={[
                  styles.summaryLabel,
                  { color: colors.onPrimary + "99" },
                ]}
              >
                THIS MONTH
              </Text>
              <Text
                style={[styles.summaryValue, { color: colors.onPrimary }]}
                selectable
              >
                {formatCurrency(summary.clearingThisMonth)}
              </Text>
            </View>
          </View>
          {summary.bouncedCount > 0 ? (
            <View
              style={[
                styles.bouncedBanner,
                { backgroundColor: colors.error + "33" },
              ]}
            >
              <Icon name="warning" size={16} color={colors.onPrimary} />
              <Text style={[styles.bouncedText, { color: colors.onPrimary }]}>
                {summary.bouncedCount} bounced · action required
              </Text>
            </View>
          ) : null}
        </View>

        {/* Bounced section */}
        {bounced.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.error }]}>
              Bounced
            </Text>
            {bounced.map((c) => (
              <ChequeRow
                key={c.id}
                cheque={c}
                contactName={
                  contactMap.get(c.counterpartyContactId) ?? c.issuedBy
                }
                colors={colors}
                onPress={() =>
                  router.push(
                    `/(marketplace)/(tabs)/workspace/cheques/${c.id}` as never,
                  )
                }
              />
            ))}
          </View>
        ) : null}

        {/* Upcoming */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
            Upcoming
          </Text>
          {upcoming.length === 0 ? (
            <EmptyState
              icon="money-check-dollar"
              title="No pending cheques"
              subtitle="Add a post-dated cheque to track maturity and clearance."
            />
          ) : (
            upcoming.map((c) => (
              <ChequeRow
                key={c.id}
                cheque={c}
                contactName={
                  contactMap.get(c.counterpartyContactId) ?? c.issuedBy
                }
                colors={colors}
                onPress={() =>
                  router.push(
                    `/(marketplace)/(tabs)/workspace/cheques/${c.id}` as never,
                  )
                }
              />
            ))
          )}
        </View>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add cheque"
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
        ]}
        onPress={() =>
          router.push("/(marketplace)/(tabs)/workspace/cheques/add" as never)
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
  summaryCard: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  summaryRow: { flexDirection: "row", alignItems: "center" },
  summaryCol: { flex: 1, gap: 4 },
  summaryDivider: { width: 1, height: 40, marginHorizontal: Spacing.md },
  summaryLabel: { ...Typography.labelMd, letterSpacing: 1 },
  summaryValue: { ...Typography.headlineMdMobile, fontWeight: "700" },
  bouncedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  bouncedText: { ...Typography.bodySmall, fontWeight: "600" },
  section: { gap: Spacing.sm },
  sectionTitle: {
    ...Typography.headlineMdMobile,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
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
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, gap: 2, minWidth: 0 },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  rowTitle: { ...Typography.labelMd, fontWeight: "600", flex: 1 },
  rowAmount: {
    ...Typography.labelMd,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  rowSub: { ...Typography.bodySmall },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    marginTop: 2,
  },
  rowDate: { ...Typography.bodySmall, flex: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgeText: { ...Typography.labelMd, fontSize: 10, fontWeight: "600" },
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
