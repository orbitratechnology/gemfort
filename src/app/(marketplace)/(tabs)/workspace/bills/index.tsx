import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlashList } from "@/components/ui/gesture-lists";
import {
    Pressable,
    RefreshControl,
    StyleSheet,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    Accent,
    IconBubble,
    ListItem,
    ListSectionHeader,
} from "@/components/ui/detail-kit";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { InfiniteListFooter } from "@/components/ui/infinite-list-footer";
import { StackHeader } from "@/components/ui/stack-header";
import { ApSideTabs, type ApSide } from "@/components/workspace/ap-side-tabs";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { ContextActionsLink } from "@/components/workspace/context-actions-link";
import { WorkspaceScreenBackdrop } from "@/components/workspace/workspace-screen-backdrop";
import { Spacing } from "@/constants/design-tokens";
import { fetchBusinesses } from "@/features/marketplace/marketplace-service";
import {
    BILL_DIRECTION_LABELS,
    BILL_STATUS_LABELS,
    billGemIds,
    daysUntilDue,
    dueLabel,
    isOpenBill,
    remainingAmount,
} from "@/features/workspace/bill-utils";
import {
    subscribeContacts,
    subscribeVerifiedBusinesses,
} from "@/features/workspace/firestore-subscriptions";
import { buildContactPhotoMap } from "@/features/workspace/party-photo";
import {
    deleteBill,
    fetchContacts,
} from "@/features/workspace/workspace-service";
import { fetchBillsPage } from "@/features/workspace/workspace-pagination";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreInfiniteQuery } from "@/hooks/use-firestore-infinite-query";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { confirmDelete } from "@/providers/confirm-bridge";
import { useToast } from "@/providers/toast-provider";
import type { Bill, BillStatus } from "@/types";
import { useMemo, useState } from "react";

/** Status → semantic accent (amber unpaid, violet work, rose overdue…). */
const STATUS_ACCENT: Record<BillStatus, string> = {
  open: Accent.amber,
  partial: Accent.amber,
  ongoing: Accent.violet,
  overdue: Accent.rose,
  paid: Accent.emerald,
  cancelled: Accent.slate,
};

/** Open bills past their due date read as overdue even before the status catches up. */
function billAccent(bill: Bill): string {
  if (isOpenBill(bill) && daysUntilDue(bill) < 0) return Accent.rose;
  return STATUS_ACCENT[bill.status];
}

function billDueText(bill: Bill): string {
  if (!isOpenBill(bill)) return `Due ${formatDate(bill.dueDate)}`;
  const label = dueLabel(bill);
  return label.includes("overdue") ? label : `Due ${label.toLowerCase()}`;
}

function billRemainingStored(bill: Bill) {
  const remaining = remainingAmount(bill);
  return {
    amount: remaining,
    currency: bill.currency,
    amountBase:
      bill.amount > 0
        ? (remaining / bill.amount) * bill.amountBase
        : bill.amountBase,
  };
}

function BillRow({
  bill,
  contactName,
  contactPhotoUrl,
  isLast,
  onDelete,
}: {
  bill: Bill;
  contactName: string;
  contactPhotoUrl: string | null;
  isLast: boolean;
  onDelete: () => void | Promise<void>;
}) {
  const { colors } = useAppTheme();
  const { formatStored } = usePreferredMoney();
  const isPayable = bill.direction === "payable";
  const open = isOpenBill(bill);
  const remainingStored = billRemainingStored(bill);
  const partyLabel = contactName || "Contact";
  const gemCount = billGemIds(bill).length;
  const subtitle = [
    BILL_DIRECTION_LABELS[bill.direction],
    bill.jobId ? "Lapidary job" : null,
    gemCount > 0 ? `${gemCount} gem${gemCount === 1 ? "" : "s"}` : null,
    bill.commissionPercent != null
      ? `${bill.commissionPercent}% commission`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  // Open bills show what's left; settled ones show the face amount.
  const amountLabel = open
    ? formatStored(remainingStored)
    : formatStored({
        amount: bill.amount,
        currency: bill.currency,
        amountBase: bill.amountBase,
      });

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
      <ListItem
        leading={
          contactPhotoUrl ? (
            <ContactAvatar
              name={partyLabel}
              photoUrl={contactPhotoUrl}
              size={44}
            />
          ) : (
            <IconBubble
              icon={isPayable ? "call-made" : "call-received"}
              accent={billAccent(bill)}
              size={44}
            />
          )
        }
        title={partyLabel}
        subtitle={subtitle}
        meta={billDueText(bill)}
        amount={amountLabel}
        amountColor={open ? colors.onSurface : colors.textMuted}
        status={{
          label: BILL_STATUS_LABELS[bill.status],
          accent: STATUS_ACCENT[bill.status],
        }}
        isLast={isLast}
      />
    </ContextActionsLink>
  );
}

export default function BillsIndexScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [side, setSide] = useState<ApSide>("given");

  const {
    items: bills,
    refetch,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useFirestoreInfiniteQuery({
    queryKey: ["bills", user?.uid, "infinite"],
    fetchPage: (cursor, pageSize) =>
      fetchBillsPage(user!.uid, cursor, pageSize),
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

  const contactMap = useMemo(
    () => new Map(contacts.map((c) => [c.id, c.displayName])),
    [contacts],
  );
  const contactPhotoMap = useMemo(
    () => buildContactPhotoMap(contacts, businesses),
    [contacts, businesses],
  );
  const sideBills = useMemo(
    () =>
      bills.filter((bill) =>
        side === "given"
          ? bill.direction === "payable"
          : bill.direction === "receivable",
      ),
    [bills, side],
  );
  const open = sideBills.filter(isOpenBill);
  const closed = sideBills.filter((b) => !isOpenBill(b));
  const orderedBills = useMemo(() => [...open, ...closed], [open, closed]);

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
      <ApSideTabs side={side} onChange={setSide} />

      <FlashList
        data={orderedBills}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-long"
            title="No bills yet"
            subtitle="Add a bill to remind yourself who to pay or collect from."
          />
        }
        ListFooterComponent={
          <InfiniteListFooter
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isFetchNextPageError={isFetchNextPageError}
            onRetry={() => void fetchNextPage()}
          />
        }
        renderItem={({ item, index }) => (
          <View>
            {index === 0 && open.length > 0 ? (
              <ListSectionHeader title="Open" count={open.length} />
            ) : index === open.length && closed.length > 0 ? (
              <ListSectionHeader title="Settled" count={closed.length} />
            ) : null}
            <BillRow
              bill={item}
              contactName={contactMap.get(item.counterpartyContactId) ?? ""}
              contactPhotoUrl={contactPhotoMap.get(item.counterpartyContactId) ?? null}
              isLast={
                index === open.length - 1 || index === orderedBills.length - 1
              }
              onDelete={() => handleDelete(item.id)}
            />
          </View>
        )}
      />

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
    paddingBottom: Spacing.xxl + 72,
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
    zIndex: 100,
  },
});
