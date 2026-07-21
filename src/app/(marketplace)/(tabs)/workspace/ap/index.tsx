import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Link, router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { StackHeader } from "@/components/ui/stack-header";
import { ApSideTabs } from "@/components/workspace/ap-side-tabs";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { WorkspaceScreenBackdrop } from "@/components/workspace/workspace-screen-backdrop";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { fetchBusinessByOwnerUid, fetchBusinesses } from "@/features/marketplace/marketplace-service";
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
import {
  gemPrimaryPhotoUrl,
  resolvePartyPhotoUrl,
} from "@/features/workspace/party-photo";
import {
  fetchContacts,
  fetchGem,
  fetchGems,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { friendlyError } from "@/lib/errors";
import { formatCurrency, formatRelativeDue } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type {
  ApLifecycleStatus,
  ApRecord,
  Business,
  Contact,
  WorkspaceGem,
} from "@/types";

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
  closed: "Closed",
};

function sectionFor(status: ApLifecycleStatus): SectionKey {
  if (status === "pending") return "pending";
  if (isApOngoing(status)) return "accepted";
  if (status === "payment_sent" || status === "sold") return "payment_sent";
  if (status === "done") return "done";
  return "closed";
}

function statusTone(
  record: ApRecord,
  colors: ReturnType<typeof useAppTheme>["colors"],
): { bg: string; fg: string; accent: string; icon: IconName } {
  if (isApOverdue(record)) {
    return {
      bg: colors.errorContainer,
      fg: colors.error,
      accent: colors.error,
      icon: "warning",
    };
  }
  if (record.status === "pending") {
    return {
      bg: colors.secondaryContainer,
      fg: colors.onSecondaryContainer,
      accent: colors.secondary,
      icon: "hourglass-top",
    };
  }
  if (record.status === "payment_sent" || record.status === "sold") {
    return {
      bg: colors.primaryContainer,
      fg: colors.onPrimaryContainer,
      accent: colors.primary,
      icon: "payments",
    };
  }
  if (record.status === "done") {
    return {
      bg: colors.successEmerald + "22",
      fg: colors.successEmerald,
      accent: colors.successEmerald,
      icon: "check-circle",
    };
  }
  if (record.status === "rejected" || record.status === "cancelled") {
    return {
      bg: colors.surfaceContainerHighest,
      fg: colors.onSurfaceVariant,
      accent: colors.outline,
      icon: "cancel",
    };
  }
  return {
    bg: colors.primaryContainer,
    fg: colors.onPrimaryContainer,
    accent: colors.primary,
    icon: "handshake",
  };
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

function GemThumb({
  uri,
  label,
  colors,
}: {
  uri: string | null;
  label: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={styles.gemPhoto}
        contentFit="cover"
        recyclingKey={uri}
        accessibilityLabel={`${label} photo`}
      />
    );
  }
  return (
    <View
      style={[
        styles.gemPhoto,
        styles.gemFallback,
        { backgroundColor: colors.surfaceContainerHigh },
      ]}
    >
      <Icon name="diamond" size={22} color={colors.outlineVariant} />
    </View>
  );
}

function ApRow({
  record,
  side,
  colors,
  gemPhotoUrl,
  partyPhotoUrl,
  onRespond,
  responding,
}: {
  record: ApRecord;
  side: ApSide;
  colors: ReturnType<typeof useAppTheme>["colors"];
  gemPhotoUrl: string | null;
  partyPhotoUrl: string | null;
  onRespond?: (action: "accepted" | "rejected") => void;
  responding?: boolean;
}) {
  const overdue = isApOverdue(record);
  const party =
    side === "given"
      ? record.receiverName || "Holder"
      : record.senderName || "Sender";
  const total = apAgreedTotal(record);
  const currency = record.items?.[0]?.currency || record.currency || "LKR";
  const tone = statusTone(record, colors);
  const showActions =
    side === "taken" && record.status === "pending" && !!onRespond;
  const dueLabel =
    isApOngoing(record.status) || record.status === "pending"
      ? formatRelativeDue(record.expectedReturnDate)
      : null;
  const amountColor = overdue
    ? colors.error
    : record.status === "done"
      ? colors.successEmerald
      : colors.primary;
  const cardBg = overdue
    ? colors.errorContainer + "66"
    : record.status === "pending"
      ? colors.secondaryContainer + "55"
      : colors.surfaceContainerLowest;

  return (
    <View style={styles.rowWrap}>
      <Link
        href={`/(marketplace)/(tabs)/workspace/ap/${record.id}` as never}
        asChild
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${gemHeadline(record)}, ${side === "given" ? "to" : "from"} ${party}, ${formatCurrency(total, currency)}, ${overdue ? "Overdue" : apStatusLabel(record.status)}`}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: cardBg,
              borderColor: overdue
                ? colors.error + "66"
                : colors.outlineVariant,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          <View style={[styles.accent, { backgroundColor: tone.accent }]} />
          <View style={styles.mediaStack}>
            <GemThumb
              uri={gemPhotoUrl}
              label={gemHeadline(record)}
              colors={colors}
            />
            <View
              style={[
                styles.partyBadge,
                { borderColor: colors.surfaceContainerLowest },
              ]}
            >
              <ContactAvatar
                name={party}
                photoUrl={partyPhotoUrl}
                size={28}
              />
            </View>
          </View>
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text
                style={[styles.rowTitle, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                {gemHeadline(record)}
              </Text>
              <Text
                style={[styles.rowAmount, { color: amountColor }]}
                selectable
              >
                {formatCurrency(total, currency)}
              </Text>
            </View>
            <View style={styles.partyRow}>
              <Icon
                name={side === "given" ? "call-made" : "call-received"}
                size={14}
                color={colors.onSurfaceVariant}
              />
              <Text
                style={[styles.rowSub, { color: colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {side === "given" ? "To" : "From"} {party}
              </Text>
            </View>
            <Text
              style={[styles.rowSub, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {gemBreakdown(record)}
              {dueLabel ? ` · ${dueLabel}` : ""}
            </Text>
            <View style={styles.rowMeta}>
              <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                <Icon name={tone.icon} size={12} color={tone.fg} />
                <Text style={[styles.badgeText, { color: tone.fg }]}>
                  {overdue ? "Overdue" : apStatusLabel(record.status)}
                </Text>
              </View>
            </View>
          </View>
          <Icon name="chevron-right" size={20} color={colors.outline} />
        </Pressable>
      </Link>

      {showActions ? (
        <View style={styles.actions}>
          <Button
            title="Accept"
            icon="check"
            loading={responding}
            onPress={() => onRespond!("accepted")}
            style={styles.actionBtn}
          />
          <Button
            title="Reject"
            variant="secondary"
            loading={responding}
            onPress={() => onRespond!("rejected")}
            style={styles.actionBtn}
          />
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

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: !!user,
  });

  const { data: ownedGems = [] } = useQuery({
    queryKey: ["gems", user?.uid],
    queryFn: () => fetchGems(user!.uid),
    enabled: !!user,
  });

  const allRecords = useMemo(
    () => [...(givenQ.data ?? []), ...(takenQ.data ?? [])],
    [givenQ.data, takenQ.data],
  );

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

  const { data: extraGems = [] } = useQuery({
    queryKey: ["ap", "gem-photos", user?.uid, missingGemIds.join(",")],
    queryFn: async () => {
      const results = await Promise.all(missingGemIds.map((id) => fetchGem(id)));
      return results.filter((g): g is WorkspaceGem => !!g);
    },
    enabled: !!user && missingGemIds.length > 0,
  });

  const counterpartyUids = useMemo(() => {
    const uids = new Set<string>();
    for (const r of givenQ.data ?? []) {
      if (r.receiverUid) uids.add(r.receiverUid);
    }
    for (const r of takenQ.data ?? []) {
      if (r.senderUid) uids.add(r.senderUid);
    }
    return [...uids].sort();
  }, [givenQ.data, takenQ.data]);

  const { data: logosByOwner = {} } = useQuery({
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
    enabled: !!user && counterpartyUids.length > 0,
  });

  const contactById = useMemo(
    () => new Map(contacts.map((c) => [c.id, c])),
    [contacts],
  );

  const gemPhotoById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of ownedGems) {
      const url = gemPrimaryPhotoUrl(g);
      if (url) map.set(g.id, url);
    }
    for (const g of extraGems) {
      const url = gemPrimaryPhotoUrl(g);
      if (url) map.set(g.id, url);
    }
    return map;
  }, [ownedGems, extraGems]);

  const { data: businesses = [] } = useQuery({
    queryKey: ["home-businesses"],
    queryFn: () => fetchBusinesses(),
    enabled: !!user,
  });

  const logoByOwnerUid = useMemo(
    () => new Map(Object.entries(logosByOwner)),
    [logosByOwner],
  );

  const records = useMemo(
    () => (side === "given" ? (givenQ.data ?? []) : (takenQ.data ?? [])),
    [side, givenQ.data, takenQ.data],
  );
  const isRefetching = givenQ.isRefetching || takenQ.isRefetching;
  const summary = useMemo(() => getApSummary(records), [records]);
  const takenPending = useMemo(
    () => (takenQ.data ?? []).filter((r) => r.status === "pending").length,
    [takenQ.data],
  );

  const sections = useMemo(() => {
    const map = new Map<SectionKey, ApRecord[]>();
    for (const key of SECTION_ORDER) map.set(key, []);
    for (const r of records) {
      map.get(sectionFor(r.status))!.push(r);
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

      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {side === "given"
            ? "Stones you sent on approval."
            : "Stones traders sent you on approval."}
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
                {side === "given" ? "OUT" : "HOLDING"}
              </Text>
              <Text
                style={[styles.summaryValue, { color: colors.onPrimary }]}
                selectable
              >
                {summary.totalOut}
                {summary.pendingRequests > 0
                  ? ` · ${summary.pendingRequests} pending`
                  : ""}
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
                AGREED
              </Text>
              <Text
                style={[styles.summaryValue, { color: colors.onPrimary }]}
                selectable
              >
                {formatCurrency(summary.totalValue)}
              </Text>
            </View>
          </View>
          {summary.overdueCount > 0 ? (
            <Text
              style={[styles.summaryHint, { color: colors.onPrimary + "CC" }]}
            >
              {summary.overdueCount} overdue
            </Text>
          ) : null}
        </View>

        {records.length === 0 ? (
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
        ) : (
          sections.map((section) => (
            <View key={section.key} style={styles.section}>
              <Text
                style={[styles.sectionTitle, { color: colors.onSurface }]}
              >
                {section.title}
              </Text>
              <View style={styles.list}>
                {section.data.map((r) => {
                  const firstGemId = r.items?.[0]?.gemId;
                  return (
                    <ApRow
                      key={r.id}
                      record={r}
                      side={side}
                      colors={colors}
                      gemPhotoUrl={
                        firstGemId
                          ? (gemPhotoById.get(firstGemId) ?? null)
                          : null
                      }
                      partyPhotoUrl={resolvePartyPhoto(
                        r,
                        side,
                        contactById,
                        logoByOwnerUid,
                        businesses,
                      )}
                      responding={respondingId === r.id}
                      onRespond={
                        side === "taken"
                          ? (action) => onRespond(r.id, action)
                          : undefined
                      }
                    />
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {side === "given" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Give on AP"
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
          ]}
          onPress={() =>
            router.push("/(marketplace)/(tabs)/workspace/ap/add" as never)
          }
        >
          <Icon name="add" size={28} color={colors.onPrimary} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 112,
    gap: Spacing.lg,
  },
  subtitle: { ...Typography.bodySmall, lineHeight: 20 },
  summaryCard: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: Spacing.lg,
    gap: Spacing.sm,
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
  summaryHint: { ...Typography.caption, fontWeight: "600" },
  section: { gap: Spacing.md },
  sectionTitle: { ...Typography.bodyLg, fontWeight: "700" },
  list: { gap: Spacing.md },
  rowWrap: { gap: Spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingRight: 12,
    paddingLeft: 0,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
  },
  accent: {
    width: 4,
    alignSelf: "stretch",
  },
  mediaStack: {
    width: 56,
    height: 56,
    marginLeft: 10,
  },
  gemPhoto: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  gemFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  partyBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    borderRadius: 16,
    borderWidth: 2,
  },
  rowBody: { flex: 1, gap: 4, minWidth: 0 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: { ...Typography.bodyMd, fontWeight: "700", flex: 1 },
  rowAmount: {
    ...Typography.bodyMd,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  partyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rowSub: { ...Typography.caption },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  actions: { flexDirection: "row", gap: Spacing.sm },
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
