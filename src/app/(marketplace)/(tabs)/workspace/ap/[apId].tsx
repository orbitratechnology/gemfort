import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  Accent,
  Callout,
  DetailBand,
  DetailHeader,
  DetailRow,
  DetailRows,
  IconBubble,
  KeyStats,
  StatusChip,
  TintHero,
  TitleBand,
  detailStyles,
  useCollapsingHeader,
} from "@/components/ui/detail-kit";
import { Icon, type IconName } from "@/components/ui/icon";
import { MaskedInput } from "@/components/ui/masked-input";
import { ReceiptField } from "@/components/ui/receipt-field";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { ApGemSaleSplit, ApGemSenderDue } from "@/components/workspace/ap-gem-sale-split";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemArtwork, gemTint } from "@/components/workspace/gem-artwork";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { PaymentMethodPicker } from "@/components/workspace/payment-method-picker";
import { FontFamily, Radius, Spacing } from "@/constants/design-tokens";
import { paymentMethodOptions } from "@/constants/payment-methods";
import {
  fetchBusinessByOwnerUid,
  fetchBusinesses,
} from "@/features/marketplace/marketplace-service";
import {
  apAgreedTotal,
  apAmountPaid,
  apBalanceDue,
  apSettlementCurrency,
  apStatusLabel,
  isApActive,
  isApOngoing,
} from "@/features/workspace/ap-normalize";
import {
  apPaymentReceived,
  apPaymentSent,
  cancelApRequest,
  deleteApRecord,
  ensureApReceiverPayoutExpense,
  fetchApRecordsForUser,
  requestApCancellation,
  respondApCancellation,
  respondApRequest,
  returnApGem,
} from "@/features/workspace/ap-lifecycle-service";
import { isApOverdue } from "@/features/workspace/ap-utils";
import {
  canDeleteAp,
  canRequestApCancellation,
  canRespondApCancellation,
} from "@/features/workspace/delete-gates";
import {
  subscribeApRecordsForUser,
  subscribeBusinessByOwnerUid,
  subscribeContacts,
  subscribeGemsByIds,
  subscribeVerifiedBusinesses,
} from "@/features/workspace/firestore-subscriptions";
import {
  gemPrimaryPhotoUrl,
  resolveBusinessPhotoByOwnerUid,
  resolvePartyPhotoUrl,
} from "@/features/workspace/party-photo";
import {
  fetchContacts,
  fetchGem,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import { uploadReceipt } from "@/lib/firebase/receipt-service";
import type { LocalMedia } from "@/lib/firebase/storage-service";
import { formatDate, formatRelativeDue } from "@/lib/utils";
import { parseForm, recordPaymentSchema } from "@/lib/validation/form-schemas";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type {
  ApGemLineStatus,
  ApLifecycleStatus,
  ApPaymentMethod,
  ApRecord,
  WorkspaceGem,
} from "@/types";

const PAY_METHODS = paymentMethodOptions(["cash", "transfer", "cheque"] as const);

type StepState = "done" | "active" | "pending" | "overdue";

/**
 * Status chip meaning: amber = waiting on someone, blue = out with the
 * holder, emerald = settled, rose = overdue / rejected, slate = cancelled.
 */
function apStatusMeta(
  status: ApLifecycleStatus,
  overdue: boolean,
): { label: string; icon: IconName; accent: string } {
  if (overdue && isApOngoing(status)) {
    return { label: "Overdue", icon: "error-outline", accent: Accent.rose };
  }
  switch (status) {
    case "pending":
      return { label: apStatusLabel(status), icon: "hourglass-top", accent: Accent.amber };
    case "accepted":
    case "with_holder":
      return { label: apStatusLabel(status), icon: "ap", accent: Accent.blue };
    case "payment_sent":
      return { label: apStatusLabel(status), icon: "payments", accent: Accent.amber };
    case "partial":
      return { label: apStatusLabel(status), icon: "payments", accent: Accent.blue };
    case "done":
    case "sold":
    case "returned":
      return { label: apStatusLabel(status), icon: "check-circle", accent: Accent.emerald };
    case "cancellation_requested":
      return { label: apStatusLabel(status), icon: "hourglass-top", accent: Accent.amber };
    case "rejected":
      return { label: apStatusLabel(status), icon: "cancel", accent: Accent.rose };
    case "cancelled":
      return { label: apStatusLabel(status), icon: "cancel", accent: Accent.slate };
    default:
      return { label: apStatusLabel(status), icon: "ap", accent: Accent.slate };
  }
}

const LINE_ACCENT: Record<ApGemLineStatus, string> = {
  held: Accent.blue,
  sold: Accent.emerald,
  returned: Accent.slate,
};

function apTimelineSteps(
  ap: ApRecord,
  overdue: boolean,
): { key: string; label: string; sub: string; state: StepState }[] {
  const status = ap.status;
  const settled = status === "done" || status === "sold" || status === "returned";
  const withHolder =
    status === "accepted" ||
    status === "partial" ||
    status === "with_holder" ||
    status === "cancellation_requested" ||
    status === "payment_sent" ||
    settled;
  const requestedDone = status !== "pending";

  return [
    {
      key: "requested",
      label: "Requested",
      sub: formatDate(ap.createdAt),
      state: status === "pending" ? "active" : requestedDone ? "done" : "pending",
    },
    {
      key: "with_holder",
      label: overdue && withHolder && !settled ? "Overdue" : "With holder",
      sub: ap.dateGiven
        ? formatDate(ap.dateGiven)
        : ap.expectedReturnDate
          ? `Due ${formatRelativeDue(ap.expectedReturnDate)}`
          : "Awaiting accept",
      state:
        overdue && withHolder && !settled
          ? "overdue"
          : status === "accepted" ||
              status === "partial" ||
              status === "with_holder" ||
              status === "cancellation_requested" ||
              status === "payment_sent"
            ? "active"
            : settled
              ? "done"
              : "pending",
    },
    {
      key: "settled",
      label: "Settled",
      sub: ap.paymentReceivedAt
        ? formatDate(ap.paymentReceivedAt)
        : settled
          ? "Complete"
          : "Awaiting settlement",
      state: settled
        ? "done"
        : status === "payment_sent" || status === "partial"
          ? "active"
          : "pending",
    },
  ];
}

function lineBreakdown(items: ApRecord["items"]): string | null {
  const held = items.filter((i) => i.lineStatus === "held").length;
  const sold = items.filter((i) => i.lineStatus === "sold").length;
  const returned = items.filter((i) => i.lineStatus === "returned").length;
  const parts: string[] = [];
  if (held) parts.push(`${held} held`);
  if (sold) parts.push(`${sold} sold`);
  if (returned) parts.push(`${returned} returned`);
  return parts.length ? parts.join(" · ") : null;
}

/** Gem photo, else its artwork, else a plain thumb while the gem loads. */
function GemVisual({
  gem,
  photo,
  label,
  size,
}: {
  gem: WorkspaceGem | null;
  photo: string | null;
  label: string;
  size: number;
}) {
  if (photo || !gem) {
    return <GemThumb uri={photo} label={label} size={size} radius={12} />;
  }
  return (
    <GemArtwork
      gem={gem}
      artScale={0.8}
      style={{ width: size, height: size, borderRadius: 12, borderCurve: "continuous" }}
    />
  );
}

/** Short tinted note with a leading icon (waiting, settled, deleted party…). */
function NoteRow({ icon, accent, text }: { icon: IconName; accent: string; text: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.noteRow}>
      <IconBubble icon={icon} accent={accent} size={32} />
      <Text style={[styles.noteText, { color: colors.onSurfaceVariant }]}>{text}</Text>
    </View>
  );
}

function Timeline({
  steps,
  activeAccent,
}: {
  steps: ReturnType<typeof apTimelineSteps>;
  activeAccent: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const accent =
          step.state === "done"
            ? Accent.emerald
            : step.state === "overdue"
              ? Accent.rose
              : step.state === "active"
                ? activeAccent
                : colors.outlineVariant;
        const filled = step.state === "done" || step.state === "overdue";
        return (
          <View key={step.key} style={styles.stepRow}>
            <View style={styles.stepRail}>
              <View
                style={[
                  styles.stepDot,
                  filled
                    ? { backgroundColor: accent }
                    : step.state === "active"
                      ? { backgroundColor: `${accent}1F`, borderColor: accent, borderWidth: 2 }
                      : { borderColor: accent, borderWidth: 2 },
                ]}
              >
                {step.state === "done" ? (
                  <Icon name="check" size={14} color="#FFFFFF" />
                ) : step.state === "overdue" ? (
                  <Icon name="priority-high" size={14} color="#FFFFFF" />
                ) : step.state === "active" ? (
                  <View style={[styles.stepPulse, { backgroundColor: accent }]} />
                ) : null}
              </View>
              {!isLast ? (
                <View
                  style={[
                    styles.stepConnector,
                    {
                      backgroundColor:
                        step.state === "done" ? Accent.emerald : colors.outlineVariant,
                    },
                  ]}
                />
              ) : null}
            </View>
            <View style={[styles.stepCopy, !isLast && styles.stepCopyGap]}>
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color:
                      step.state === "overdue"
                        ? Accent.rose
                        : step.state === "pending"
                          ? colors.textMuted
                          : colors.onSurface,
                  },
                ]}
              >
                {step.label}
              </Text>
              <Text style={[styles.stepSub, { color: colors.textMuted }]} selectable={false}>
                {step.sub}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

type BarKey =
  | "cancel-request"
  | "accept"
  | "reject"
  | "request-cancel"
  | "cancel-accept"
  | "cancel-decline"
  | "pay-sent"
  | "delete";

type BarAction = {
  key: BarKey;
  title: string;
  icon: IconName;
  variant?: "primary" | "secondary";
};

export default function ApDetailScreen() {
  const { apId } = useLocalSearchParams<{ apId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { formatBase, formatStored, formatFace, rates } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const heroHeight = Math.round(windowWidth * 0.78);
  // Floating hero controls become a solid titled bar once the hero scrolls away.
  const { solid: headerSolid, scrollProps } = useCollapsingHeader(heroHeight);

  const [payMethod, setPayMethod] = useState<ApPaymentMethod>("cash");
  const [payAmount, setPayAmount] = useState("");
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [sentReceipt, setSentReceipt] = useState<LocalMedia | null>(null);
  const [receivedReceipt, setReceivedReceipt] = useState<LocalMedia | null>(null);
  const [receiveMethodOverride, setReceiveMethodOverride] =
    useState<ApPaymentMethod | null>(null);
  // Key of the action in flight, so only the tapped control spins.
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const { data: records = [], isLoading } = useFirestoreLiveQuery({
    queryKey: ["ap", "detail", user?.uid],
    queryFn: () => fetchApRecordsForUser(user!.uid),
    subscribe: (onData, onError) =>
      subscribeApRecordsForUser(user!.uid, onData, onError),
    enabled: !!user,
  });

  const ap = records.find((r) => r.id === apId);
  const isSender = !!user && !!ap && ap.senderUid === user.uid;
  const isReceiver = !!user && !!ap && ap.receiverUid === user.uid;

  useEffect(() => {
    if (!ap || !isReceiver || ap.status !== "done") return;
    void ensureApReceiverPayoutExpense(ap).catch(() => {});
  }, [ap, isReceiver]);

  // Everything the holder pays is in the AP's settlement currency, so the
  // prefilled amount, the label, and the request all use the same currency.
  const settlementCurrency = ap ? apSettlementCurrency(ap) : "LKR";
  const balanceDue = useMemo(() => (ap ? apBalanceDue(ap, rates) : 0), [ap, rates]);
  const amountPaid = ap ? apAmountPaid(ap) : 0;

  const gemIds = useMemo(
    () => [...new Set((ap?.items ?? []).map((i) => i.gemId).filter(Boolean))],
    [ap?.items],
  );

  // Gems on this AP, for photos and the photo-less artwork fallback.
  const { data: gemsById = {} } = useFirestoreLiveQuery({
    queryKey: ["ap", "detail-gems", apId, gemIds.join(",")],
    queryFn: async () => {
      const entries = await Promise.all(
        gemIds.map(async (id) => [id, await fetchGem(id)] as const),
      );
      const map: Record<string, WorkspaceGem | null> = {};
      for (const [id, gem] of entries) map[id] = gem ?? null;
      return map;
    },
    subscribe: (onData, onError) =>
      subscribeGemsByIds(
        gemIds,
        (gems: WorkspaceGem[]) => {
          const map: Record<string, WorkspaceGem | null> = {};
          for (const id of gemIds) map[id] = null;
          for (const gem of gems) map[gem.id] = gem;
          onData(map);
        },
        onError,
      ),
    enabled: gemIds.length > 0,
  });

  // Only the sender owns the receiver contact. Taken APs must not query another
  // trader's private contacts collection just to resolve a photo.
  const contactsOwnerUid = isSender ? (ap?.ownerUid || ap?.senderUid) : null;

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ["contacts", contactsOwnerUid],
    queryFn: () => fetchContacts(contactsOwnerUid!),
    subscribe: (onData, onError) =>
      subscribeContacts(contactsOwnerUid!, onData, onError),
    enabled: !!contactsOwnerUid,
  });

  const { data: businesses = [] } = useFirestoreLiveQuery({
    queryKey: ["home-businesses"],
    queryFn: () => fetchBusinesses(),
    subscribe: (onData, onError) => subscribeVerifiedBusinesses(onData, onError),
    enabled: !!ap,
  });

  const { data: myBusiness } = useFirestoreLiveQuery({
    queryKey: ["my-business", user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    subscribe: (onData, onError) =>
      subscribeBusinessByOwnerUid(user!.uid, onData, onError),
    enabled: !!user,
  });

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["ap"] });
    await queryClient.invalidateQueries({ queryKey: ["gems"] });
    await queryClient.invalidateQueries({ queryKey: ["transactions"] });
    await queryClient.invalidateQueries({ queryKey: ["money"] });
  }

  async function run(key: string, action: () => Promise<unknown>, ok: string) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPendingKey(key);
    try {
      await action();
      toast.success(ok);
      await invalidate();
    } catch (e) {
      toast.error(friendlyError(e, "Could not update AP."));
    } finally {
      pendingRef.current = false;
      setPendingKey(null);
    }
  }
  const busy = pendingKey !== null;

  if (isLoading || !ap) {
    return (
      <View
        style={[
          styles.safe,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <StackHeader title="AP" />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>
            {isLoading ? "Loading…" : "AP not found."}
          </Text>
        </View>
      </View>
    );
  }

  const overdue = isApOverdue(ap);
  const done = ap.status === "done";
  const directionLabel = isSender ? "Given" : "Taken";
  const agreed = apAgreedTotal(ap);
  const items = ap.items ?? [];
  const gemCount = items.length || 1;
  const meta = apStatusMeta(ap.status, overdue);
  const steps = apTimelineSteps(ap, overdue);
  const receiveMethod: ApPaymentMethod =
    receiveMethodOverride ??
    (ap.paymentMethod === "cash" ||
    ap.paymentMethod === "transfer" ||
    ap.paymentMethod === "cheque"
      ? ap.paymentMethod
      : "cash");

  const receiverContact =
    contacts.find((c) => c.id === ap.receiverContactId) ?? null;
  const holderName = isSender
    ? ap.receiverName || receiverContact?.displayName || "Holder"
    : myBusiness?.businessName?.trim() || "Your Business";
  const holderPhoto = isSender
    ? resolvePartyPhotoUrl(receiverContact, businesses) ||
      resolveBusinessPhotoByOwnerUid(ap.receiverUid, businesses)
    : user?.photoURL ?? null;
  const counterpartyName = isSender
    ? ap.receiverName || "Holder"
    : ap.senderName || "Sender";
  const ownerPhoto = isReceiver
    ? resolveBusinessPhotoByOwnerUid(ap.senderUid, businesses)
    : null;
  const partyName = isSender ? holderName : counterpartyName;
  const partyPhoto = isSender ? holderPhoto : ownerPhoto;
  const partyRole = isSender
    ? "Holding your gems"
    : "Gave you these gems";
  const partyHref =
    isSender && ap.receiverContactId
      ? `/(marketplace)/(tabs)/workspace/contacts/${ap.receiverContactId}`
      : isSender && ap.receiverBusinessId
        ? `/business/${ap.receiverBusinessId}`
        : null;

  const firstLine = items[0];
  const heroGem = firstLine ? (gemsById[firstLine.gemId] ?? null) : null;
  const heroPhoto = heroGem ? gemPrimaryPhotoUrl(heroGem) : null;
  const headline = !firstLine
    ? "AP stones"
    : items.length === 1
      ? firstLine.gemLabel?.trim() || "Gem"
      : `${firstLine.gemLabel?.trim() || "Gem"} +${items.length - 1}`;
  const returnLive = overdue && isApOngoing(ap.status);
  const breakdown = lineBreakdown(items);
  const owesLabel = isReceiver
    ? amountPaid > 0
      ? "Balance you owe"
      : "You owe the sender"
    : amountPaid > 0
      ? "Balance owed to you"
      : "Owed to you";

  // Sticky bar actions (data only — handled in onBarAction).
  const barActions: BarAction[] = [];
  if (isSender && ap.status === "pending") {
    barActions.push({ key: "cancel-request", title: "Cancel request", icon: "cancel", variant: "secondary" });
  }
  if (isReceiver && ap.status === "pending") {
    barActions.push(
      { key: "accept", title: "Accept", icon: "check" },
      { key: "reject", title: "Reject", icon: "close", variant: "secondary" },
    );
  }
  if (isSender && canRequestApCancellation(ap, user!.uid)) {
    barActions.push({ key: "request-cancel", title: "Request cancellation", icon: "cancel", variant: "secondary" });
  }
  if (isReceiver && canRespondApCancellation(ap, user!.uid)) {
    barActions.push(
      { key: "cancel-accept", title: "Accept", icon: "check" },
      { key: "cancel-decline", title: "Decline", icon: "close", variant: "secondary" },
    );
  }
  if (isReceiver && isApActive(ap.status) && balanceDue > 0) {
    barActions.push({
      key: "pay-sent",
      title: `Pay ${formatFace(balanceDue, settlementCurrency)}`,
      icon: "payments",
    });
  }
  if (canDeleteAp(ap)) {
    barActions.push({ key: "delete", title: "Delete AP", icon: "delete", variant: "secondary" });
  }

  function onBarAction(key: BarKey) {
    if (!ap) return;
    switch (key) {
      case "cancel-request":
        return run("cancel-request", async () => {
          await cancelApRequest(ap.id);
          router.back();
        }, "AP cancelled");
      case "accept":
        return run("accept", () => respondApRequest(ap.id, "accepted"), "AP accepted");
      case "reject":
        return run("reject", async () => {
          await respondApRequest(ap.id, "rejected");
          router.back();
        }, "AP rejected");
      case "request-cancel":
        return run("request-cancel", () => requestApCancellation(ap.id), "Cancellation requested");
      case "cancel-accept":
        return run("cancel-accept", () => respondApCancellation(ap.id, "accepted"), "AP cancelled");
      case "cancel-decline":
        return run(
          "cancel-decline",
          () => respondApCancellation(ap.id, "rejected"),
          "Cancellation declined",
        );
      case "pay-sent":
        // Button already fires the light press haptic.
        setPayAmount(String(balanceDue));
        setPaySheetOpen(true);
        return;
      case "delete":
        return run("delete", async () => {
          await deleteApRecord(ap.id);
          router.back();
        }, "AP deleted");
    }
  }
  const bottomBarPad = Math.max(insets.bottom, 12);

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar style={heroPhoto && !headerSolid ? "light" : "auto"} />

      <ThemedScrollView
        contentContainerStyle={[
          detailStyles.scrollContent,
          barActions.length ? { paddingBottom: 96 + bottomBarPad } : null,
        ]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        <View style={{ height: heroHeight }}>
          {heroPhoto ? (
            <Image
              source={{ uri: heroPhoto }}
              style={{ width: windowWidth, height: heroHeight }}
              contentFit="cover"
              accessibilityLabel={`${headline} photo`}
            />
          ) : heroGem ? (
            <GemArtwork
              gem={heroGem}
              artScale={0.7}
              style={{ width: windowWidth, height: heroHeight, paddingTop: insets.top }}
            />
          ) : (
            <TintHero accent={meta.accent} icon="ap" height={heroHeight} />
          )}
          {items.length > 1 ? (
            <View style={styles.heroCount} pointerEvents="none">
              <Icon name="diamond" size={14} color="#FFFFFF" />
              <Text style={styles.heroCountText}>{items.length} gems</Text>
            </View>
          ) : null}
        </View>

        <TitleBand
          overlapHero
          chips={
            <>
              <StatusChip label={meta.label} accent={meta.accent} />
              <StatusChip label={`${directionLabel} on AP`} accent={Accent.violet} />
            </>
          }
          title={headline}
          subtitle={isSender ? `Given to ${partyName}` : `Taken from ${counterpartyName}`}
          subtitleDot={heroGem ? gemTint(heroGem) : null}
        >
          <KeyStats
            items={[
              { label: "Agreed", value: formatBase(agreed) },
              {
                label: "Gems",
                value: String(gemCount),
                sub: breakdown,
              },
              {
                label: "Return",
                value: ap.expectedReturnDate ? formatDate(ap.expectedReturnDate) : "—",
                sub: ap.expectedReturnDate ? formatRelativeDue(ap.expectedReturnDate) : null,
                color: returnLive ? Accent.rose : undefined,
              },
            ]}
          />
          {balanceDue > 0 && !done ? (
            <Callout
              icon={isReceiver ? "call-made" : "call-received"}
              accent={returnLive ? Accent.rose : Accent.amber}
              label={owesLabel}
              value={formatFace(balanceDue, settlementCurrency)}
              pill={amountPaid > 0 ? "Part paid" : null}
            />
          ) : done && amountPaid > 0 ? (
            <Callout
              icon="check-circle"
              accent={Accent.emerald}
              label="Settled · paid"
              value={formatFace(amountPaid, settlementCurrency)}
            />
          ) : null}
        </TitleBand>

        {isSender && ap.status === "payment_sent" ? (
          <DetailBand title="Confirm payment">
            <DetailRow
              icon="payments"
              accent={Accent.amber}
              label={
                ap.paymentMethod
                  ? `Marked sent as ${ap.paymentMethod}`
                  : "Payment"
              }
              value={formatFace(ap.paymentAmount ?? balanceDue, settlementCurrency)}
              isLast
            />
            <PaymentMethodPicker
              label="How was it received?"
              options={PAY_METHODS}
              value={receiveMethod}
              onChange={setReceiveMethodOverride}
            />
            <ReceiptField value={receivedReceipt} onChange={setReceivedReceipt} />
            <Button
              title={
                receiveMethod === "cheque"
                  ? "Continue with cheque"
                  : "Payment Received"
              }
              icon={
                receiveMethod === "cheque"
                  ? "cheque"
                  : "check-circle"
              }
              loading={pendingKey === "pay-received"}
              disabled={busy}
              onPress={() => {
                if (receiveMethod === "cheque") {
                  router.push({
                    pathname: "/(marketplace)/cheques/add",
                    params: {
                      amount: String(ap.paymentAmount ?? balanceDue),
                      currency: settlementCurrency,
                      contactId: ap.receiverContactId,
                      apRecordId: ap.id,
                      gemId: items[0]?.gemId,
                      direction: "received",
                      confirmApReceived: "1",
                    },
                  });
                  return;
                }
                run(
                  "pay-received",
                  async () =>
                    apPaymentReceived(ap.id, {
                      method: receiveMethod,
                      receiptUrl: await uploadReceipt(user!.uid, receivedReceipt),
                    }),
                  "Payment confirmed",
                );
              }}
            />
          </DetailBand>
        ) : null}

        {ap.rejectionReason ? (
          <DetailBand title="Details">
            <NoteRow icon="cancel" accent={Accent.rose} text={ap.rejectionReason} />
          </DetailBand>
        ) : null}

        <DetailBand title="Status">
          <Timeline steps={steps} activeAccent={meta.accent} />
          {isReceiver && canRespondApCancellation(ap, user!.uid) ? (
            <NoteRow
              icon="hourglass-top"
              accent={Accent.amber}
              text="Cancellation requested. Accept or decline it below."
            />
          ) : null}
          {isSender && isApOngoing(ap.status) ? (
            <NoteRow
              icon="schedule"
              accent={Accent.blue}
              text="Holder can sell or return gems. You confirm payment when they mark it sent."
            />
          ) : null}
          {done ? (
            <NoteRow
              icon="check-circle"
              accent={Accent.emerald}
              text="Payment received. Money ledgers updated on both sides."
            />
          ) : null}
          {ap.partyDeleted ? (
            <NoteRow
              icon="info-outline"
              accent={Accent.slate}
              text={`${counterpartyName} deleted their GemFort account. This record is kept for your history.`}
            />
          ) : null}
        </DetailBand>

        <DetailBand title={items.length > 1 ? `Gems · ${items.length}` : "Gem"}>
          {items.map((line, i) => {
            const sold = line.lineStatus === "sold" && line.soldPrice != null;
            const yours = line.commission ?? 0;
            const gem = gemsById[line.gemId] ?? null;
            const canAct =
              isReceiver && isApActive(ap.status) && line.lineStatus === "held";
            return (
              <View
                key={line.gemId}
                style={[
                  styles.line,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.outlineVariant,
                  },
                ]}
              >
                <Pressable
                  style={({ pressed }) => [styles.lineTop, pressed && styles.pressed]}
                  onPress={() =>
                    router.push(
                      `/(marketplace)/(tabs)/workspace/gems/${line.gemId}` as never,
                    )
                  }
                  accessibilityRole="link"
                  accessibilityLabel={line.gemLabel}
                >
                  <GemVisual
                    gem={gem}
                    photo={gem ? gemPrimaryPhotoUrl(gem) : null}
                    label={line.gemLabel}
                    size={48}
                  />
                  <View style={styles.lineBody}>
                    <Text
                      style={[styles.lineTitle, { color: colors.onSurface }]}
                      numberOfLines={1}
                    >
                      {line.gemLabel}
                    </Text>
                    <Text
                      style={[styles.lineSub, { color: colors.onSurfaceVariant }]}
                      numberOfLines={1}
                    >
                      {sold
                        ? `Sold${line.soldToName ? ` to ${line.soldToName}` : ""}`
                        : `AP price ${formatStored({
                            amount: line.agreedPrice,
                            currency: line.currency,
                            amountBase: line.agreedPriceBase,
                          })}`}
                    </Text>
                  </View>
                  <StatusChip
                    label={line.lineStatus}
                    accent={LINE_ACCENT[line.lineStatus] ?? Accent.slate}
                    size="sm"
                  />
                  <Icon name="chevron-right" size={18} color={colors.outline} />
                </Pressable>

                {sold && line.ownerReceives != null ? (
                  isReceiver ? (
                    <ApGemSaleSplit
                      soldLabel={formatStored({
                        amount: line.soldPrice!,
                        currency: line.currency,
                        amountBase: line.soldPriceBase ?? undefined,
                      })}
                      senderLabel={formatStored({
                        amount: line.ownerReceives,
                        currency: line.currency,
                        amountBase: line.ownerReceivesBase ?? undefined,
                      })}
                      yoursLabel={formatStored({
                        amount: yours,
                        currency: line.currency,
                        amountBase: line.commissionBase ?? undefined,
                      })}
                    />
                  ) : isSender ? (
                    <ApGemSenderDue
                      amountLabel={formatStored({
                        amount: line.ownerReceives,
                        currency: line.currency,
                        amountBase: line.ownerReceivesBase ?? undefined,
                      })}
                    />
                  ) : null
                ) : null}

                {canAct ? (
                  <View style={styles.buttonRow}>
                    <Button
                      title="Sell"
                      icon="sell"
                      onPress={() =>
                        router.push({
                          pathname: "/(marketplace)/ap/sell",
                          params: { apId: ap.id, gemId: line.gemId },
                        })
                      }
                      style={styles.flex}
                    />
                    <Button
                      title="Return"
                      variant="secondary"
                      icon="undo"
                      loading={pendingKey === `return:${line.gemId}`}
                      disabled={busy}
                      onPress={() =>
                        run(
                          `return:${line.gemId}`,
                          () => returnApGem(ap.id, line.gemId),
                          "Gem returned",
                        )
                      }
                      style={styles.flex}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </DetailBand>

        <DetailBand title={isSender ? "Holder" : "Sender"}>
          <Pressable
            disabled={!partyHref}
            onPress={() => {
              if (partyHref) router.push(partyHref as never);
            }}
            accessibilityRole={partyHref ? "button" : undefined}
            accessibilityLabel={`AP party ${partyName}`}
            style={({ pressed }) => [styles.partyRow, pressed && styles.pressed]}
          >
            <ContactAvatar name={partyName} photoUrl={partyPhoto} size={48} />
            <View style={styles.partyCopy}>
              <Text
                style={[styles.partyName, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                {partyName}
              </Text>
              <Text style={[styles.partyRole, { color: colors.onSurfaceVariant }]}>
                {partyRole}
              </Text>
            </View>
            {partyHref ? (
              <Icon name="chevron-right" size={18} color={colors.outline} />
            ) : null}
          </Pressable>
        </DetailBand>

        {amountPaid > 0 && !done ? (
          <DetailBand title="Payments">
            <DetailRows
              rows={[
                {
                  key: "paid",
                  icon: "check-circle",
                  accent: Accent.emerald,
                  label: "Paid",
                  value: formatFace(amountPaid, settlementCurrency),
                },
                {
                  key: "owed",
                  icon: "payments",
                  accent: Accent.amber,
                  label: "Still owed",
                  value: formatFace(balanceDue, settlementCurrency),
                },
              ]}
            />
          </DetailBand>
        ) : null}
      </ThemedScrollView>

      <DetailHeader title={`${directionLabel} · ${headline}`} solid={headerSolid} />

      {barActions.length ? (
        <View
          style={[
            detailStyles.actionBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.outlineVariant,
              paddingBottom: bottomBarPad,
            },
          ]}
        >
          {barActions.map((action) => (
            <Button
              key={action.key}
              title={action.title}
              icon={action.icon}
              variant={action.variant ?? "primary"}
              loading={pendingKey === action.key}
              disabled={busy}
              onPress={() => void onBarAction(action.key)}
              style={styles.flex}
            />
          ))}
        </View>
      ) : null}

      <BottomSheet
        visible={paySheetOpen}
        onClose={() => setPaySheetOpen(false)}
        title={`Pay ${counterpartyName}`}
        footer={
          <Button
            title={
              payMethod === "cheque"
                ? "Continue with cheque"
                : "Payment Sent"
            }
            icon={payMethod === "cheque" ? "cheque" : "send"}
            loading={pendingKey === "pay-sent"}
            disabled={busy}
            onPress={() => {
              const amountToValidate =
                payAmount || (balanceDue > 0 ? String(balanceDue) : "");
              const result = parseForm(recordPaymentSchema, {
                amount: amountToValidate,
              });
              if (!result.success) {
                toast.error(result.errors.amount ?? "Enter payment amount");
                return;
              }
              const amount = result.data.amount;
              if (amount - balanceDue > 0.005) {
                toast.error(
                  `Payment cannot exceed ${formatFace(balanceDue, settlementCurrency)}.`,
                );
                return;
              }
              setPaySheetOpen(false);
              if (payMethod === "cheque") {
                router.push({
                  pathname: "/(marketplace)/cheques/add",
                  params: {
                    amount: String(amount),
                    currency: settlementCurrency,
                    apRecordId: ap.id,
                    gemId: items[0]?.gemId,
                    direction: "given",
                    confirmApSent: "1",
                  },
                });
                return;
              }
              run(
                "pay-sent",
                async () =>
                  apPaymentSent({
                    apId: ap.id,
                    method: payMethod,
                    amount,
                    currency: settlementCurrency,
                    receiptUrl: await uploadReceipt(user!.uid, sentReceipt),
                  }),
                amount < balanceDue ? "Part payment marked sent" : "Payment marked sent",
              );
            }}
          />
        }
      >
        <View>
          <View style={styles.payParty}>
            <ContactAvatar name={counterpartyName} photoUrl={ownerPhoto} size={44} />
            <View style={styles.partyCopy}>
              <Text style={[styles.partyName, { color: colors.onSurface }]} numberOfLines={1}>
                {counterpartyName}
              </Text>
              <Text style={[styles.partyRole, { color: colors.onSurfaceVariant }]}>
                Pay all or part, in {settlementCurrency}
              </Text>
            </View>
          </View>
          <Callout
            icon="call-made"
            accent={Accent.amber}
            label={amountPaid > 0 ? "Balance owed" : "Owed to sender"}
            value={formatFace(balanceDue, settlementCurrency)}
          />
        </View>

        <PaymentMethodPicker
          label="Payment method"
          options={PAY_METHODS}
          value={payMethod}
          onChange={setPayMethod}
        />

        <MaskedInput
          mode="currency"
          value={payAmount || (balanceDue > 0 ? String(balanceDue) : "")}
          onChangeText={setPayAmount}
          label={`Amount (${settlementCurrency})`}
          leftIcon="payments"
        />
        <ReceiptField value={sentReceipt} onChange={setSentReceipt} />
      </BottomSheet>
    </View>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },

  heroCount: {
    position: "absolute",
    right: Spacing.containerMargin,
    bottom: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  heroCountText: { ...text, color: "#FFFFFF", fontFamily: FontFamily.semibold, fontSize: 12 },

  stepRow: { flexDirection: "row", gap: 14 },
  stepRail: { width: 28, alignItems: "center" },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepPulse: { width: 10, height: 10, borderRadius: 5 },
  stepConnector: { flex: 1, width: 2, minHeight: 18, marginVertical: 4, borderRadius: 1 },
  stepCopy: { flex: 1, minWidth: 0, paddingTop: 3, gap: 1 },
  stepCopyGap: { paddingBottom: Spacing.lg },
  stepLabel: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 22 },
  stepSub: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },

  noteRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  noteText: { ...text, flex: 1, fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20 },

  line: { gap: Spacing.md, paddingVertical: Spacing.md },
  lineTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  lineBody: { flex: 1, minWidth: 0, gap: 2 },
  lineTitle: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 21 },
  lineSub: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18, fontVariant: ["tabular-nums"] },
  buttonRow: { flexDirection: "row", gap: Spacing.sm },

  partyRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  partyCopy: { flex: 1, minWidth: 0, gap: 2 },
  partyName: { ...text, fontFamily: FontFamily.semibold, fontSize: 16, lineHeight: 22 },
  partyRole: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },

  payParty: { flexDirection: "row", alignItems: "center", gap: 12 },
});
