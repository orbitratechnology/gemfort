import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Accent, ListItem, ListSectionHeader } from "@/components/ui/detail-kit";
import { EmptyState } from "@/components/ui/empty-state";
import { FlashList } from "@/components/ui/gesture-lists";
import { Icon } from "@/components/ui/icon";
import { InfiniteListFooter } from "@/components/ui/infinite-list-footer";
import { StackHeader } from "@/components/ui/stack-header";
import { ApSideTabs } from "@/components/workspace/ap-side-tabs";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import {
    ContextActionsLink,
    type ContextMenuAction,
} from "@/components/workspace/context-actions-link";
import { GemArtwork } from "@/components/workspace/gem-artwork";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { WorkspaceScreenBackdrop } from "@/components/workspace/workspace-screen-backdrop";
import { FontFamily, Spacing } from "@/constants/design-tokens";
import {
    fetchBusinessByOwnerUid,
    fetchBusinesses,
} from "@/features/marketplace/marketplace-service";
import {
    deleteApRecord,
    ensureApReceiverPayoutExpense,
    requestApCancellation,
    respondApCancellation,
    respondApRequest,
} from "@/features/workspace/ap-lifecycle-service";
import {
    apAgreedTotal,
    apStatusLabel,
    isApOngoing,
} from "@/features/workspace/ap-normalize";
import { isApOverdue } from "@/features/workspace/ap-utils";
import {
    canDeleteAp,
    canRequestApCancellation,
    canRespondApCancellation,
} from "@/features/workspace/delete-gates";
import {
    subscribeBusinessesByOwnerUids,
    subscribeContacts,
    subscribeGems,
    subscribeGemsByIds,
    subscribeVerifiedBusinesses,
} from "@/features/workspace/firestore-subscriptions";
import {
    gemPrimaryPhotoUrl,
    resolvePartyPhotoUrl,
} from "@/features/workspace/party-photo";
import {
    fetchGivenApPage,
    fetchTakenApPage,
} from "@/features/workspace/workspace-pagination";
import {
    fetchContacts,
    fetchGem,
    fetchGems,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreInfiniteQuery } from "@/hooks/use-firestore-infinite-query";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import { formatRelativeDue } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { confirmDelete } from "@/providers/confirm-bridge";
import { useToast } from "@/providers/toast-provider";
import type {
    ApLifecycleStatus,
    ApRecord,
    Business,
    Contact,
    WorkspaceGem,
} from "@/types";

type ApSide = "given" | "taken";

/** Which row action is in flight, so only the tapped control spins. */
type ApRowAction =
  | "accepted"
  | "rejected"
  | "cancel-accepted"
  | "cancel-rejected"
  | "request-cancel";

type SectionKey = "pending" | "accepted" | "payment_sent" | "done" | "closed";

type ApListRow =
  | { kind: "section"; key: string; title: string; count: number; accent: string }
  | { kind: "record"; key: string; record: ApRecord; isLast: boolean };

const SECTION_ORDER: SectionKey[] = [
  "pending",
  "accepted",
  "payment_sent",
  "done",
  "closed",
];

const SECTION_TITLE: Record<SectionKey, string> = {
  pending: "Pending",
  accepted: "With holder",
  payment_sent: "Payment sent",
  done: "Done",
  closed: "Closed",
};

/** Section dot colour — same meaning as the status chips below it. */
const SECTION_ACCENT: Record<SectionKey, string> = {
  pending: Accent.amber,
  accepted: Accent.blue,
  payment_sent: Accent.amber,
  done: Accent.emerald,
  closed: Accent.slate,
};

const THUMB = 52;

function sectionFor(status: ApLifecycleStatus): SectionKey {
  if (status === "pending") return "pending";
  if (isApOngoing(status)) return "accepted";
  if (status === "payment_sent" || status === "sold") return "payment_sent";
  if (status === "done") return "done";
  return "closed";
}

/**
 * Status accent: amber = waiting on someone, blue = out with the holder,
 * emerald = settled, rose = overdue / rejected, slate = cancelled.
 */
function statusAccent(record: ApRecord): string {
  if (isApOverdue(record)) return Accent.rose;
  switch (record.status) {
    case "pending":
    case "payment_sent":
    case "cancellation_requested":
      return Accent.amber;
    case "accepted":
    case "with_holder":
    case "partial":
      return Accent.blue;
    case "done":
    case "sold":
    case "returned":
      return Accent.emerald;
    case "rejected":
      return Accent.rose;
    default:
      return Accent.slate;
  }
}

function gemHeadline(record: ApRecord): string {
  const items = record.items ?? [];
  if (items.length === 0) return "AP stones";
  const first = items[0]?.gemLabel?.trim() || "Gem";
  if (items.length === 1) return first;
  return `${first} +${items.length - 1}`;
}

function gemBreakdown(record: ApRecord): string {
  const items = record.items ?? [];
  if (items.length === 0) return "No gems";
  const held = items.filter((i) => i.lineStatus === "held").length;
  const sold = items.filter((i) => i.lineStatus === "sold").length;
  const returned = items.filter((i) => i.lineStatus === "returned").length;
  const parts: string[] = [];
  if (held) parts.push(`${held} held`);
  if (sold) parts.push(`${sold} sold`);
  if (returned) parts.push(`${returned} returned`);
  if (parts.length === 0) {
    return `${items.length} gem${items.length === 1 ? "" : "s"}`;
  }
  return parts.join(" · ");
}

function resolvePartyPhoto(
  record: ApRecord,
  side: ApSide,
  contactById: Map<string, Contact>,
  logoByOwnerUid: Map<string, string>,
  businesses: Business[],
): string | null {
  if (side === "given") {
    const contact = contactById.get(record.receiverContactId);
    const fromContact = resolvePartyPhotoUrl(contact, businesses);
    if (fromContact) return fromContact;
    return logoByOwnerUid.get(record.receiverUid) ?? null;
  }
  const byName = [...contactById.values()].find(
    (c) =>
      c.displayName.trim().toLowerCase() ===
      (record.senderName || "").trim().toLowerCase(),
  );
  const fromContact = resolvePartyPhotoUrl(byName, businesses);
  if (fromContact) return fromContact;
  return logoByOwnerUid.get(record.senderUid) ?? null;
}

/** Gem photo (or its artwork) with the counterparty's avatar tucked on the corner. */
function ApLeading({
  gem,
  label,
  party,
  partyPhotoUrl,
}: {
  gem: WorkspaceGem | null;
  label: string;
  party: string;
  partyPhotoUrl: string | null;
}) {
  const { colors } = useAppTheme();
  const photo = gem ? gemPrimaryPhotoUrl(gem) : null;
  return (
    <View style={styles.leading}>
      {photo || !gem ? (
        <GemThumb uri={photo} label={label} size={THUMB} radius={14} />
      ) : (
        <GemArtwork gem={gem} artScale={0.8} style={styles.artwork} />
      )}
      <View
        style={[
          styles.partyBadge,
          { borderColor: colors.surfaceContainerLowest },
        ]}
      >
        <ContactAvatar name={party} photoUrl={partyPhotoUrl} size={22} />
      </View>
    </View>
  );
}

function ApRow({
  record,
  side,
  gem,
  partyPhotoUrl,
  isLast,
  onRespond,
  pendingAction,
  uid,
  onDelete,
  onRequestCancellation,
  onRespondCancellation,
}: {
  record: ApRecord;
  side: ApSide;
  gem: WorkspaceGem | null;
  partyPhotoUrl: string | null;
  isLast: boolean;
  onRespond?: (action: "accepted" | "rejected") => void;
  pendingAction?: ApRowAction | null;
  uid?: string | null;
  onDelete: (apId: string) => void | Promise<void>;
  onRequestCancellation: (apId: string) => void | Promise<void>;
  onRespondCancellation: (
    apId: string,
    action: "accepted" | "rejected",
  ) => void | Promise<void>;
}) {
  const { colors } = useAppTheme();
  const { formatBase } = usePreferredMoney();
  const overdue = isApOverdue(record);
  const party =
    side === "given"
      ? record.receiverName || "Holder"
      : record.senderName || "Sender";
  const total = apAgreedTotal(record);
  const accent = statusAccent(record);
  const statusText = overdue ? "Overdue" : apStatusLabel(record.status);
  const showActions =
    side === "taken" && record.status === "pending" && !!onRespond;
  const showCancelActions = !!uid && canRespondApCancellation(record, uid);
  const hasActions = showActions || showCancelActions;
  const menuActions: ContextMenuAction[] = [];
  if (canDeleteAp(record)) {
    menuActions.push({
      label: "Delete",
      icon: "trash",
      destructive: true,
      onPress: () =>
        confirmDelete(
          "Delete AP",
          "Remove this AP record? This cannot be undone.",
          () => onDelete(record.id),
        ),
    });
  }
  if (uid && canRequestApCancellation(record, uid)) {
    menuActions.push({
      label: "Request cancellation",
      icon: "xmark.circle",
      onPress: () => onRequestCancellation(record.id),
    });
  }
  const dueLabel =
    isApOngoing(record.status) || record.status === "pending"
      ? formatRelativeDue(record.expectedReturnDate)
      : null;
  const amountColor = overdue
    ? Accent.rose
    : record.status === "done"
      ? Accent.emerald
      : colors.onSurface;
  const headline = gemHeadline(record);

  return (
    <View style={{ backgroundColor: colors.surfaceContainerLowest }}>
      <ContextActionsLink
        href={`/(marketplace)/(tabs)/workspace/ap/${record.id}` as never}
        accessibilityLabel={`${headline}, ${side === "given" ? "to" : "from"} ${party}, ${formatBase(total)}, ${statusText}`}
        actions={menuActions}
      >
        <ListItem
          leading={
            <ApLeading
              gem={gem}
              label={headline}
              party={party}
              partyPhotoUrl={partyPhotoUrl}
            />
          }
          title={headline}
          subtitle={`${side === "given" ? "To" : "From"} ${party}`}
          meta={`${gemBreakdown(record)}${dueLabel ? ` · ${dueLabel}` : ""}`}
          amount={formatBase(total)}
          amountColor={amountColor}
          status={{ label: statusText, accent }}
          isLast={isLast || hasActions}
          right={
            pendingAction === "request-cancel" ? (
              <View style={styles.trailingBusy}>
                <Text
                  style={[styles.trailingAmount, { color: amountColor }]}
                  numberOfLines={1}
                >
                  {formatBase(total)}
                </Text>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : undefined
          }
        />
      </ContextActionsLink>

      {hasActions ? (
        <View
          style={[
            styles.actions,
            !isLast && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.outlineVariant,
            },
          ]}
        >
          {showActions ? (
            <>
              <Button
                title="Accept"
                icon="check"
                loading={pendingAction === "accepted"}
                disabled={!!pendingAction}
                onPress={() => onRespond!("accepted")}
                style={styles.actionBtn}
              />
              <Button
                title="Reject"
                variant="secondary"
                loading={pendingAction === "rejected"}
                disabled={!!pendingAction}
                onPress={() => onRespond!("rejected")}
                style={styles.actionBtn}
              />
            </>
          ) : (
            <>
              <Button
                title="Accept cancellation"
                icon="check"
                loading={pendingAction === "cancel-accepted"}
                disabled={!!pendingAction}
                onPress={() => onRespondCancellation(record.id, "accepted")}
                style={styles.actionBtn}
              />
              <Button
                title="Decline"
                variant="secondary"
                loading={pendingAction === "cancel-rejected"}
                disabled={!!pendingAction}
                onPress={() => onRespondCancellation(record.id, "rejected")}
                style={styles.actionBtn}
              />
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default function ApListScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [side, setSide] = useState<ApSide>("given");
  const [rowPending, setRowPending] = useState<{
    id: string;
    action: ApRowAction;
  } | null>(null);
  const rowPendingRef = useRef(false);

  /** Runs one row action with local loading; ignores taps while one is in flight. */
  async function runRowAction(
    apId: string,
    action: ApRowAction,
    work: () => Promise<void>,
  ) {
    if (rowPendingRef.current) return;
    rowPendingRef.current = true;
    setRowPending({ id: apId, action });
    try {
      await work();
    } finally {
      rowPendingRef.current = false;
      setRowPending(null);
    }
  }

  const givenQ = useFirestoreInfiniteQuery({
    queryKey: ["ap", "given", user?.uid, "infinite"],
    fetchPage: (cursor, pageSize) =>
      fetchGivenApPage(user!.uid, cursor, pageSize),
    enabled: !!user,
  });

  const takenQ = useFirestoreInfiniteQuery({
    queryKey: ["ap", "taken", user?.uid, "infinite"],
    fetchPage: (cursor, pageSize) =>
      fetchTakenApPage(user!.uid, cursor, pageSize),
    enabled: !!user,
  });

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    subscribe: (onData, onError) =>
      subscribeContacts(user!.uid, onData, onError),
    enabled: !!user,
  });

  const { data: ownedGems = [] } = useFirestoreLiveQuery({
    queryKey: ["gems", user?.uid],
    queryFn: () => fetchGems(user!.uid),
    subscribe: (onData, onError) => subscribeGems(user!.uid, onData, onError),
    enabled: !!user,
  });

  const allRecords = useMemo(
    () => [...givenQ.items, ...takenQ.items],
    [givenQ.items, takenQ.items],
  );

  useEffect(() => {
    for (const r of takenQ.items) {
      if (r.status === "done") {
        void ensureApReceiverPayoutExpense(r).catch(() => {});
      }
    }
  }, [takenQ.items]);

  const missingGemIds = useMemo(() => {
    const known = new Set(ownedGems.map((g) => g.id));
    const ids = new Set<string>();
    for (const r of allRecords) {
      for (const item of r.items ?? []) {
        if (item.gemId && !known.has(item.gemId)) ids.add(item.gemId);
      }
    }
    return [...ids].sort();
  }, [allRecords, ownedGems]);

  const { data: extraGems = [] } = useFirestoreLiveQuery({
    queryKey: ["ap", "gem-photos", user?.uid, missingGemIds.join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        missingGemIds.map((id) => fetchGem(id)),
      );
      return results.filter((g): g is WorkspaceGem => !!g);
    },
    subscribe: (onData, onError) =>
      subscribeGemsByIds(missingGemIds, onData, onError),
    enabled: !!user && missingGemIds.length > 0,
  });

  const counterpartyUids = useMemo(() => {
    const uids = new Set<string>();
    for (const r of givenQ.items) {
      if (r.receiverUid) uids.add(r.receiverUid);
    }
    for (const r of takenQ.items) {
      if (r.senderUid) uids.add(r.senderUid);
    }
    return [...uids].sort();
  }, [givenQ.items, takenQ.items]);

  const { data: logosByOwner = {} } = useFirestoreLiveQuery({
    queryKey: ["ap", "party-logos", user?.uid, counterpartyUids.join(",")],
    queryFn: async () => {
      const entries = await Promise.all(
        counterpartyUids.map(async (uid) => {
          const biz = await fetchBusinessByOwnerUid(uid);
          return [uid, biz?.logoUrl ?? null] as const;
        }),
      );
      const map: Record<string, string> = {};
      for (const [uid, logo] of entries) {
        if (logo) map[uid] = logo;
      }
      return map;
    },
    subscribe: (onData, onError) =>
      subscribeBusinessesByOwnerUids(
        counterpartyUids,
        (byUid) => {
          const map: Record<string, string> = {};
          for (const [uid, biz] of Object.entries(byUid)) {
            if (biz?.logoUrl) map[uid] = biz.logoUrl;
          }
          onData(map);
        },
        onError,
      ),
    enabled: !!user && counterpartyUids.length > 0,
  });

  const contactById = useMemo(
    () => new Map(contacts.map((c) => [c.id, c])),
    [contacts],
  );

  const gemById = useMemo(() => {
    const map = new Map<string, WorkspaceGem>();
    for (const g of ownedGems) map.set(g.id, g);
    for (const g of extraGems) map.set(g.id, g);
    return map;
  }, [ownedGems, extraGems]);

  const { data: businesses = [] } = useFirestoreLiveQuery({
    queryKey: ["home-businesses"],
    queryFn: () => fetchBusinesses(),
    subscribe: (onData, onError) =>
      subscribeVerifiedBusinesses(onData, onError),
    enabled: !!user,
  });

  const logoByOwnerUid = useMemo(
    () => new Map(Object.entries(logosByOwner)),
    [logosByOwner],
  );

  const records = useMemo(
    () => (side === "given" ? givenQ.items : takenQ.items),
    [side, givenQ.items, takenQ.items],
  );
  const isRefetching = givenQ.isRefetching || takenQ.isRefetching;
  const takenPending = useMemo(
    () => takenQ.items.filter((r) => r.status === "pending").length,
    [takenQ.items],
  );

  const sections = useMemo(() => {
    const map = new Map<SectionKey, ApRecord[]>();
    for (const key of SECTION_ORDER) map.set(key, []);
    for (const r of records) {
      const section = map.get(sectionFor(r.status));
      if (section) section.push(r);
    }
    return SECTION_ORDER.map((key) => ({
      key,
      title: SECTION_TITLE[key],
      accent: SECTION_ACCENT[key],
      data: map.get(key) ?? [],
    })).filter((s) => s.data.length > 0);
  }, [records]);

  const listRows = useMemo<ApListRow[]>(
    () =>
      sections.flatMap((section) => [
        {
          kind: "section" as const,
          key: `section:${section.key}`,
          title: section.title,
          count: section.data.length,
          accent: section.accent,
        },
        ...section.data.map((record, i) => ({
          kind: "record" as const,
          key: record.id,
          record,
          isLast: i === section.data.length - 1,
        })),
      ]),
    [sections],
  );

  const activeQuery = side === "given" ? givenQ : takenQ;

  async function refetch() {
    await Promise.all([givenQ.refetch(), takenQ.refetch()]);
  }

  async function onRespond(apId: string, action: "accepted" | "rejected") {
    await runRowAction(apId, action, async () => {
      try {
        await respondApRequest(apId, action);
        toast.success(action === "accepted" ? "AP accepted" : "AP rejected");
        await queryClient.invalidateQueries({ queryKey: ["ap"] });
        await queryClient.invalidateQueries({ queryKey: ["gems"] });
      } catch (e) {
        toast.error(friendlyError(e, "Could not respond to AP."));
      }
    });
  }

  async function onDelete(apId: string) {
    try {
      await deleteApRecord(apId);
      toast.success("AP deleted");
      await queryClient.invalidateQueries({ queryKey: ["ap"] });
    } catch (e) {
      toast.error(friendlyError(e, "Could not delete AP."));
    }
  }

  async function onRequestCancellation(apId: string) {
    await runRowAction(apId, "request-cancel", async () => {
      try {
        await requestApCancellation(apId);
        toast.success("Cancellation requested");
        await queryClient.invalidateQueries({ queryKey: ["ap"] });
      } catch (e) {
        toast.error(friendlyError(e, "Could not request cancellation."));
      }
    });
  }

  async function onRespondCancellation(
    apId: string,
    action: "accepted" | "rejected",
  ) {
    await runRowAction(
      apId,
      action === "accepted" ? "cancel-accepted" : "cancel-rejected",
      async () => {
        try {
          await respondApCancellation(apId, action);
          toast.success(
            action === "accepted" ? "AP cancelled" : "Cancellation declined",
          );
          await queryClient.invalidateQueries({ queryKey: ["ap"] });
          await queryClient.invalidateQueries({ queryKey: ["gems"] });
        } catch (e) {
          toast.error(friendlyError(e, "Could not respond to cancellation."));
        }
      },
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <WorkspaceScreenBackdrop kind="ap" />
      <StackHeader title="AP Stones" />

      <ApSideTabs
        side={side}
        onChange={setSide}
        takenPendingCount={takenPending}
      />

      <FlashList<ApListRow>
        data={listRows}
        keyExtractor={(item) => item.key}
        getItemType={(item) => item.kind}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        onEndReached={() => {
          if (activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) {
            void activeQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <EmptyState
            icon={side === "given" ? "call-made" : "call-received"}
            title={side === "given" ? "No AP given" : "No AP taken"}
            subtitle={
              side === "given"
                ? "Send gems on AP to a GemFort trader"
                : "When a trader sends you stones, they appear here"
            }
          />
        }
        ListFooterComponent={
          <InfiniteListFooter
            hasNextPage={activeQuery.hasNextPage}
            isFetchingNextPage={activeQuery.isFetchingNextPage}
            isFetchNextPageError={activeQuery.isFetchNextPageError}
            onRetry={() => void activeQuery.fetchNextPage()}
          />
        }
        renderItem={({ item }) => {
          if (item.kind === "section") {
            return (
              <ListSectionHeader
                title={item.title}
                count={item.count}
                accent={item.accent}
              />
            );
          }
          const record = item.record;
          const firstGemId = record.items?.[0]?.gemId;
          return (
            <ApRow
              record={record}
              side={side}
              isLast={item.isLast}
              gem={firstGemId ? (gemById.get(firstGemId) ?? null) : null}
              partyPhotoUrl={resolvePartyPhoto(
                record,
                side,
                contactById,
                logoByOwnerUid,
                businesses,
              )}
              pendingAction={
                rowPending?.id === record.id ? rowPending.action : null
              }
              onRespond={
                side === "taken"
                  ? (action) => onRespond(record.id, action)
                  : undefined
              }
              uid={user?.uid}
              onDelete={onDelete}
              onRequestCancellation={onRequestCancellation}
              onRespondCancellation={onRespondCancellation}
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
          onPress={() => router.push("/(marketplace)/ap/add" as never)}
        >
          <Icon name="add" size={28} color={colors.onPrimary} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 112 },
  leading: { width: THUMB, height: THUMB },
  artwork: {
    width: THUMB,
    height: THUMB,
    borderRadius: 14,
    borderCurve: "continuous",
  },
  partyBadge: {
    position: "absolute",
    right: -5,
    bottom: -5,
    borderRadius: 14,
    borderWidth: 2,
  },
  trailingBusy: { alignItems: "flex-end", gap: 6, maxWidth: "45%" },
  trailingAmount: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.md,
  },
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
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.18)",
  },
});
