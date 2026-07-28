import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { StackHeader } from "@/components/ui/stack-header";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import {
  ContextActionsLink,
} from "@/components/workspace/context-actions-link";
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
  subscribeBills,
  subscribeContacts,
  subscribeVerifiedBusinesses,
} from "@/features/workspace/firestore-subscriptions";
import {
  deleteBill,
  fetchBills,
  fetchContacts,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import { useAuth } from "@/providers/auth-provider";
import { confirmDelete } from "@/providers/confirm-provider";
import { useToast } from "@/providers/toast-provider";
import type { Bill } from "@/types";
import { useMemo } from "react";

function billRemainingStored(bill: Bill) {
  const remaining = remainingAmount(bill);
  return {
    amount: remaining,
    currency: bill.currency,
    amountBase:
      bill.amount > 0 ? (remaining / bill.amount) * bill.amountBase : bill.amountBase,
  };
}

function BillRow({
  bill,
  contactName,
  contactPhotoUrl,
  colors,
  onDelete,
}: {
  bill: Bill;
  contactName: string;
  contactPhotoUrl: string | null;
  colors: ReturnType<typeof useAppTheme>["colors"];
  onDelete: () => void | Promise<void>;
}) {
  const { formatStored } = usePreferredMoney();
  const isPayable = bill.direction === "payable";
  const remaining = remainingAmount(bill);
  const remainingStored = billRemainingStored(bill);
  const partyLabel = contactName || "Contact";

  return (
    <ContextActionsLink
      href={`/(marketplace)/(tabs)/workspace/bills/${bill.id}` as never}
      accessibilityLabel={`${partyLabel}, ${formatStored(remainingStored)}`}
      actions={[
        {
          label: "Delete",
          icon: "trash",
          destructive: true,
          onPress: () =>
            confirmDelete(
              "Delete bill",
              `Remove this bill with ${partyLabel}? This cannot be undone.`,
              onDelete,
            ),
        },
      ]}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.row,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
            },
            pressed && { opacity: 0.85 },
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
            >
              {formatStored(remainingStored)}
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
        </View>
      )}
    </ContextActionsLink>
  );
}

export default function BillsIndexScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { formatBase } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();

  const {
    data: bills = [],
    refetch,
    isRefetching,
  } = useFirestoreLiveQuery({
    queryKey: ["bills", user?.uid],
    queryFn: () => fetchBills(user!.uid),
    subscribe: (onData, onError) => subscribeBills(user!.uid, onData, onError),
    enabled: !!user,
  });

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    subscribe: (onData, onError) => subscribeContacts(user!.uid, onData, onError),
    enabled: !!user,
  });

  const { data: businesses = [] } = useFirestoreLiveQuery({
    queryKey: ["home-businesses"],
    queryFn: () => fetchBusinesses(),
    subscribe: (onData, onError) => subscribeVerifiedBusinesses(onData, onError),
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

  async function handleDelete(billId: string) {
    if (!user) return;
    try {
      await deleteBill(billId, user.uid);
      await queryClient.invalidateQueries({ queryKey: ["bills", user.uid] });
      toast.success("Bill deleted");
    } catch (e) {
      toast.error(friendlyError(e, "Could not delete bill."));
    }
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <WorkspaceScreenBackdrop kind="bills" />
      <StackHeader title="Bills" />

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
              >
                {summary.payableCount} ·{" "}
                {formatBase(summary.payableTotal)}
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
              >
                {summary.receivableCount} ·{" "}
                {formatBase(summary.receivableTotal)}
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
                onDelete={() => handleDelete(b.id)}
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
                onDelete={() => handleDelete(b.id)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add bill"
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
        ]}
        onPress={() => router.push("/(marketplace)/bills/add" as never)}
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
    paddingBottom: Spacing.xxl + 72,
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
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 20px rgba(0, 0, 0, 0.28)",
    zIndex: 100,
  },
});
