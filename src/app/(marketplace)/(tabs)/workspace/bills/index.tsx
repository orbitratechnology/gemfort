import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
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
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { WorkspaceScreenBackdrop } from "@/components/workspace/workspace-screen-backdrop";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { fetchBusinesses } from "@/features/marketplace/marketplace-service";
import {
  BILL_DIRECTION_LABELS,
  BILL_STATUS_LABELS,
  dueLabel,
  getBillSummary,
  isOpenBill,
  remainingAmount,
} from "@/features/workspace/bill-utils";
import { buildContactPhotoMap } from "@/features/workspace/party-photo";
import {
  fetchBills,
  fetchContacts,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import type { Bill } from "@/types";
import { useMemo } from "react";

function BillRow({
  bill,
  contactName,
  contactPhotoUrl,
  colors,
}: {
  bill: Bill;
  contactName: string;
  contactPhotoUrl: string | null;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const isPayable = bill.direction === "payable";
  const remaining = remainingAmount(bill);
  const partyLabel = contactName || "Contact";

  return (
    <Link
      href={`/(marketplace)/(tabs)/workspace/bills/${bill.id}` as never}
      asChild
    >
      <Pressable
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: colors.outlineVariant,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        {contactPhotoUrl ? (
          <ContactAvatar
            name={partyLabel}
            photoUrl={contactPhotoUrl}
            size={44}
          />
        ) : (
          <View
            style={[
              styles.rowIcon,
              {
                backgroundColor: isPayable
                  ? colors.errorContainer
                  : colors.secondaryContainer,
              },
            ]}
          >
            <Icon
              name={isPayable ? "call-made" : "call-received"}
              size={20}
              color={
                isPayable ? colors.error : colors.onSecondaryContainer
              }
            />
          </View>
        )}
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text
              style={[styles.rowTitle, { color: colors.onSurface }]}
              numberOfLines={1}
            >
              {partyLabel}
            </Text>
            <Text
              style={[styles.rowAmount, { color: colors.primary }]}
              selectable
            >
              {formatCurrency(remaining, bill.currency)}
            </Text>
          </View>
          <Text
            style={[styles.rowSub, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {BILL_DIRECTION_LABELS[bill.direction]}
            {bill.commissionPercent != null
              ? ` · ${bill.commissionPercent}% commission`
              : ""}
          </Text>
          <View style={styles.rowMeta}>
            <Text style={[styles.rowDate, { color: colors.onSurfaceVariant }]}>
              {dueLabel(bill)}
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
                {BILL_STATUS_LABELS[bill.status]}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

export default function BillsIndexScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();

  const {
    data: bills = [],
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["bills", user?.uid],
    queryFn: () => fetchBills(user!.uid),
    enabled: !!user,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: !!user,
  });

  const { data: businesses = [] } = useQuery({
    queryKey: ["home-businesses"],
    queryFn: () => fetchBusinesses(),
    enabled: !!user,
  });

  const contactMap = useMemo(
    () => new Map(contacts.map((c) => [c.id, c.displayName])),
    [contacts],
  );
  const contactPhotoMap = useMemo(
    () => buildContactPhotoMap(contacts, businesses),
    [contacts, businesses],
  );
  const summary = getBillSummary(bills);
  const open = bills.filter(isOpenBill);
  const closed = bills.filter((b) => !isOpenBill(b));

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <WorkspaceScreenBackdrop kind="bills" />
      <StackHeader
        title="Bills"
        right={
          <Link href="/(marketplace)/(tabs)/workspace/bills/add" asChild>
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Add bill"
            >
              <Icon name="add" size={24} color={colors.primary} />
            </Pressable>
          </Link>
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
          Track amounts to pay or receive, due dates, and commission.
        </Text>

        <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text
                style={[
                  styles.summaryLabel,
                  { color: colors.onPrimary + "99" },
                ]}
              >
                TO PAY
              </Text>
              <Text
                style={[styles.summaryValue, { color: colors.onPrimary }]}
                selectable
              >
                {summary.payableCount} ·{" "}
                {formatCurrency(summary.payableTotal)}
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
                TO RECEIVE
              </Text>
              <Text
                style={[styles.summaryValue, { color: colors.onPrimary }]}
                selectable
              >
                {summary.receivableCount} ·{" "}
                {formatCurrency(summary.receivableTotal)}
              </Text>
            </View>
          </View>
        </View>

        {open.length === 0 && closed.length === 0 ? (
          <EmptyState
            icon="receipt-long"
            title="No bills yet"
            subtitle="Add a bill to remind yourself who to pay or collect from."
          />
        ) : null}

        {open.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
              Open
            </Text>
            {open.map((b) => (
              <BillRow
                key={b.id}
                bill={b}
                contactName={contactMap.get(b.counterpartyContactId) ?? ""}
                contactPhotoUrl={
                  contactPhotoMap.get(b.counterpartyContactId) ?? null
                }
                colors={colors}
              />
            ))}
          </View>
        ) : null}

        {closed.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
              Settled
            </Text>
            {closed.map((b) => (
              <BillRow
                key={b.id}
                bill={b}
                contactName={contactMap.get(b.counterpartyContactId) ?? ""}
                contactPhotoUrl={
                  contactPhotoMap.get(b.counterpartyContactId) ?? null
                }
                colors={colors}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  subtitle: { ...Typography.bodySmall },
  summaryCard: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: Spacing.lg,
  },
  summaryRow: { flexDirection: "row", alignItems: "center" },
  summaryCol: { flex: 1, gap: 4 },
  summaryDivider: { width: 1, alignSelf: "stretch", marginHorizontal: 12 },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  summaryValue: { ...Typography.bodyMd, fontWeight: "700" },
  section: { gap: 8 },
  sectionTitle: { ...Typography.bodyLg, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, gap: 2, minWidth: 0 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: { ...Typography.bodyMd, fontWeight: "600", flex: 1 },
  rowAmount: {
    ...Typography.bodyMd,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  rowSub: { ...Typography.caption },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  rowDate: { ...Typography.caption, fontWeight: "500" },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  badgeText: { fontSize: 10, fontWeight: "700" },
});
