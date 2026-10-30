import { EmptyState } from "@/components/ui/empty-state";
import { Accent, IconBubble, ListItem, ListSectionHeader } from "@/components/ui/detail-kit";
import { FlashList } from "@/components/ui/gesture-lists";
import { Icon } from "@/components/ui/icon";
import { InfiniteListFooter } from "@/components/ui/infinite-list-footer";
import { StackHeader } from "@/components/ui/stack-header";
import { ApSideTabs, type ApSide } from "@/components/workspace/ap-side-tabs";
import { CHEQUE_STATUS_ACCENT } from "@/components/workspace/cheque-preview-card";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { ContextActionsLink } from "@/components/workspace/context-actions-link";
import { WorkspaceScreenBackdrop } from "@/components/workspace/workspace-screen-backdrop";
import { Spacing } from "@/constants/design-tokens";
import { fetchBusinesses } from "@/features/marketplace/marketplace-service";
import {
    CHEQUE_STATUS_LABELS,
    daysUntilMaturity,
    getUpcomingCheques,
    maturityLabel,
    toDate,
} from "@/features/workspace/cheque-utils";
import {
    subscribeContacts,
    subscribeVerifiedBusinesses,
} from "@/features/workspace/firestore-subscriptions";
import { buildContactPhotoMap } from "@/features/workspace/party-photo";
import {
    deleteCheque,
    fetchContacts,
} from "@/features/workspace/workspace-service";
import { fetchChequesPage } from "@/features/workspace/workspace-pagination";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreInfiniteQuery } from "@/hooks/use-firestore-infinite-query";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { confirmDelete } from "@/providers/confirm-bridge";
import { useToast } from "@/providers/toast-provider";
import type { Cheque } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
    Pressable,
    RefreshControl,
    StyleSheet,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ListRow =
  | { type: "header"; key: string; title: string; count: number; accent?: string }
  | { type: "cheque"; key: string; cheque: Cheque; isLast: boolean };

/** Upcoming cheques grouped by when they mature: matured, this week, then by month. */
function groupUpcoming(cheques: Cheque[]): ListRow[] {
  const groups: { key: string; title: string; accent?: string; items: Cheque[] }[] = [];
  for (const cheque of cheques) {
    const days = daysUntilMaturity(cheque);
    const maturity = toDate(cheque.maturityDate);
    const group =
      days < 0
        ? { key: "matured", title: "Matured", accent: Accent.amber }
        : days <= 7
          ? { key: "week", title: "Due this week", accent: Accent.amber }
          : {
              key: maturity ? format(maturity, "yyyy-MM") : "later",
              title: maturity ? format(maturity, "MMMM yyyy") : "Later",
            };
    const last = groups[groups.length - 1];
    if (last && last.key === group.key) last.items.push(cheque);
    else groups.push({ ...group, items: [cheque] });
  }
  return groups.flatMap((g) => [
    {
      type: "header" as const,
      key: `header-${g.key}`,
      title: g.title,
      count: g.items.length,
      accent: g.accent,
    },
    ...g.items.map((cheque, i) => ({
      type: "cheque" as const,
      key: cheque.id,
      cheque,
      isLast: i === g.items.length - 1,
    })),
  ]);
}

/** Contact photo with a status-tinted direction badge, or a tinted icon bubble. */
function ChequeLeading({
  cheque,
  partyLabel,
  photoUrl,
}: {
  cheque: Cheque;
  partyLabel: string;
  photoUrl: string | null;
}) {
  const { colors } = useAppTheme();
  const accent = CHEQUE_STATUS_ACCENT[cheque.status];
  const icon = cheque.direction === "received" ? "call-received" : "call-made";
  if (!photoUrl) return <IconBubble icon={icon} accent={accent} size={44} />;
  return (
    <View style={styles.leading}>
      <ContactAvatar name={partyLabel} photoUrl={photoUrl} size={44} />
      <View
        style={[
          styles.leadingBadge,
          {
            backgroundColor: accent,
            borderColor: colors.surfaceContainerLowest,
          },
        ]}
      >
        <Icon name={icon} size={11} color="#FFFFFF" />
      </View>
    </View>
  );
}

function ChequeRow({
  cheque,
  contactName,
  contactPhotoUrl,
  isLast,
  onDelete,
}: {
  cheque: Cheque;
  contactName: string;
  contactPhotoUrl: string | null;
  isLast?: boolean;
  onDelete: () => void | Promise<void>;
}) {
  const { formatStored } = usePreferredMoney();
  const isBounced = cheque.status === "bounced";
  const partyLabel = contactName || cheque.issuedBy || "Counterparty";
  const label = `${cheque.chequeNumber} · ${cheque.bankName}`;

  return (
    <ContextActionsLink
      href={`/(marketplace)/(tabs)/workspace/cheques/${cheque.id}` as never}
      accessibilityLabel={label}
      actions={[
        {
          label: "Delete",
          icon: "trash",
          destructive: true,
          onPress: () =>
            confirmDelete(
              "Delete cheque",
              `Remove cheque ${cheque.chequeNumber}? This cannot be undone.`,
              onDelete,
            ),
        },
      ]}
    >
      <ListItem
        leading={
          <ChequeLeading
            cheque={cheque}
            partyLabel={partyLabel}
            photoUrl={contactPhotoUrl || cheque.photoUrl}
          />
        }
        title={partyLabel}
        subtitle={`No. ${cheque.chequeNumber} · ${cheque.bankName}`}
        meta={`${maturityLabel(cheque)} · ${formatDate(cheque.maturityDate)}`}
        amount={formatStored({
          amount: cheque.amount,
          currency: cheque.currency,
          amountBase: cheque.amountBase,
        })}
        amountColor={isBounced ? Accent.rose : undefined}
        status={{
          label: CHEQUE_STATUS_LABELS[cheque.status],
          accent: CHEQUE_STATUS_ACCENT[cheque.status],
        }}
        isLast={isLast}
      />
    </ContextActionsLink>
  );
}

export default function ChequesScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [side, setSide] = useState<ApSide>("given");

  const {
    items: cheques,
    refetch,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useFirestoreInfiniteQuery({
    queryKey: ["cheques", user?.uid, "infinite"],
    fetchPage: (cursor, pageSize) =>
      fetchChequesPage(user!.uid, cursor, pageSize),
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
  const sideCheques = useMemo(
    () =>
      cheques.filter((cheque) =>
        side === "given"
          ? cheque.direction === "given"
          : cheque.direction === "received",
      ),
    [cheques, side],
  );
  const upcoming = getUpcomingCheques(sideCheques);
  const rows = groupUpcoming(upcoming);
  const bounced = sideCheques.filter((c) => c.status === "bounced");

  async function handleDelete(chequeId: string) {
    if (!user) return;
    try {
      await deleteCheque(chequeId, user.uid);
      await queryClient.invalidateQueries({ queryKey: ["cheques", user.uid] });
      toast.success("Cheque deleted");
    } catch (e) {
      toast.error(friendlyError(e, "Could not delete cheque."));
    }
  }

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
      <ApSideTabs side={side} onChange={setSide} />

      <FlashList
        data={rows}
        keyExtractor={(item) => item.key}
        getItemType={(item) => item.type}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          bounced.length > 0 ? (
            <View style={styles.bouncedBlock}>
              <ListSectionHeader
                title="Bounced"
                count={bounced.length}
                accent={Accent.rose}
              />
              {bounced.map((c, i) => (
                <ChequeRow
                  key={c.id}
                  cheque={c}
                  contactName={
                    contactMap.get(c.counterpartyContactId) ?? c.issuedBy
                  }
                  contactPhotoUrl={
                    contactPhotoMap.get(c.counterpartyContactId) ?? null
                  }
                  isLast={i === bounced.length - 1}
                  onDelete={() => handleDelete(c.id)}
                />
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="money-check-dollar"
            title="No pending cheques"
            subtitle="Add a post-dated cheque to track maturity and clearance."
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
        renderItem={({ item }) =>
          item.type === "header" ? (
            <ListSectionHeader
              title={item.title}
              count={item.count}
              accent={item.accent}
            />
          ) : (
            <ChequeRow
              cheque={item.cheque}
              contactName={
                contactMap.get(item.cheque.counterpartyContactId) ??
                item.cheque.issuedBy
              }
              contactPhotoUrl={
                contactPhotoMap.get(item.cheque.counterpartyContactId) ?? null
              }
              isLast={item.isLast}
              onDelete={() => handleDelete(item.cheque.id)}
            />
          )
        }
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add cheque"
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
        ]}
        onPress={() => router.push("/(marketplace)/cheques/add" as never)}
      >
        <Icon name="add" size={28} color={colors.onPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 100 },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  bouncedBlock: { marginBottom: Spacing.xs },
  leading: { width: 44, height: 44 },
  leadingBadge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
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
  },
});
