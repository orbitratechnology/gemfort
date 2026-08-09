import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { ChipSelect } from "@/components/ui/chip-select";
import {
  FormSection,
  FormSectionLabel,
  ScreenInset,
} from "@/components/ui/form-section";
import { Icon, type IconName } from "@/components/ui/icon";
import { MaskedInput } from "@/components/ui/masked-input";
import { ReceiptField } from "@/components/ui/receipt-field";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { ApGemSaleSplit, ApGemSenderDue } from "@/components/workspace/ap-gem-sale-split";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { fetchBusinesses } from "@/features/marketplace/marketplace-service";
import {
  apAgreedTotal,
  apOwnerOwedTotal,
  apStatusLabel,
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
import { haptics } from "@/lib/haptics";
import { formatDate, formatRelativeDue } from "@/lib/utils";
import { parseForm, recordPaymentSchema } from "@/lib/validation/form-schemas";
import { useAuth } from "@/providers/auth-provider";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";
import type {
  ApLifecycleStatus,
  ApPaymentMethod,
  ApRecord,
  WorkspaceGem,
} from "@/types";

const PAY_METHODS: {
  value: ApPaymentMethod;
  label: string;
  icon: "payments" | "account-balance" | "money-check-dollar";
}[] = [
  { value: "cash", label: "Cash", icon: "payments" },
  { value: "transfer", label: "Transfer", icon: "account-balance" },
  { value: "cheque", label: "Cheque", icon: "money-check-dollar" },
];

type StepState = "done" | "active" | "pending" | "overdue";

function apStatusMeta(
  status: ApLifecycleStatus,
  overdue: boolean,
): { label: string; icon: IconName; tone: "neutral" | "warning" | "success" | "error" } {
  if (overdue && isApOngoing(status)) {
    return { label: "Overdue", icon: "error-outline", tone: "error" };
  }
  switch (status) {
    case "pending":
      return { label: "Pending", icon: "schedule", tone: "neutral" };
    case "accepted":
    case "with_holder":
      return { label: "With holder", icon: "handshake", tone: "warning" };
    case "payment_sent":
      return { label: "Payment sent", icon: "send", tone: "warning" };
    case "done":
    case "sold":
    case "returned":
      return { label: "Done", icon: "check-circle", tone: "success" };
    case "cancellation_requested":
      return { label: "Cancel requested", icon: "hourglass-top", tone: "warning" };
    case "cancelled":
    case "rejected":
      return {
        label: apStatusLabel(status),
        icon: "cancel",
        tone: "neutral",
      };
    default:
      return { label: apStatusLabel(status), icon: "handshake", tone: "neutral" };
  }
}

function apTimelineSteps(
  ap: ApRecord,
  overdue: boolean,
): { key: string; label: string; sub: string; state: StepState }[] {
  const status = ap.status;
  const settled = status === "done" || status === "sold" || status === "returned";
  const withHolder =
    status === "accepted" ||
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
      state: settled ? "done" : status === "payment_sent" ? "active" : "pending",
    },
  ];
}

export default function ApDetailScreen() {
  const { apId } = useLocalSearchParams<{ apId: string }>();
  const { user, profile } = useAuth();
  const { colors } = useAppTheme();
  const { formatBase, formatStored } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [payMethod, setPayMethod] = useState<ApPaymentMethod>("cash");
  const [payAmount, setPayAmount] = useState("");
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [sentReceipt, setSentReceipt] = useState<LocalMedia | null>(null);
  const [receivedReceipt, setReceivedReceipt] = useState<LocalMedia | null>(null);
  const [receiveMethodOverride, setReceiveMethodOverride] =
    useState<ApPaymentMethod | null>(null);

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

  const owed = useMemo(() => (ap ? apOwnerOwedTotal(ap) : 0), [ap]);

  const gemIds = useMemo(
    () => [...new Set((ap?.items ?? []).map((i) => i.gemId).filter(Boolean))],
    [ap?.items],
  );

  const { data: gemPhotos = {} } = useFirestoreLiveQuery({
    queryKey: ["ap", "detail-gem-photos", apId, gemIds.join(",")],
    queryFn: async () => {
      const entries = await Promise.all(
        gemIds.map(async (id) => {
          const gem = await fetchGem(id);
          return [id, gemPrimaryPhotoUrl(gem)] as const;
        }),
      );
      const map: Record<string, string | null> = {};
      for (const [id, url] of entries) map[id] = url;
      return map;
    },
    subscribe: (onData, onError) =>
      subscribeGemsByIds(
        gemIds,
        (gems: WorkspaceGem[]) => {
          const map: Record<string, string | null> = {};
          for (const id of gemIds) map[id] = null;
          for (const gem of gems) {
            map[gem.id] = gemPrimaryPhotoUrl(gem);
          }
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

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["ap"] });
    await queryClient.invalidateQueries({ queryKey: ["gems"] });
    await queryClient.invalidateQueries({ queryKey: ["transactions"] });
    await queryClient.invalidateQueries({ queryKey: ["money"] });
  }

  async function run(action: () => Promise<unknown>, ok: string) {
    try {
      await withLoading(async () => {
        await action();
        toast.success(ok);
        await invalidate();
      }, "Updating…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not update AP."));
    }
  }

  if (isLoading || !ap) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <StackHeader title="AP" />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>
            {isLoading ? "Loading…" : "AP not found."}
          </Text>
        </View>
      </SafeAreaView>
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
    : profile?.displayName || user?.displayName || "You";
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

  const toneColor =
    meta.tone === "success"
      ? colors.successEmerald
      : meta.tone === "error"
        ? colors.error
        : meta.tone === "warning"
          ? colors.warningAmber
          : colors.onSurfaceVariant;
  const toneBg =
    meta.tone === "success"
      ? colors.successEmerald + "18"
      : meta.tone === "error"
        ? colors.errorContainer
        : meta.tone === "warning"
          ? colors.warningAmber + "18"
          : colors.surfaceContainerHighest;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title={directionLabel} />

      <ThemedScrollView contentContainerStyle={styles.content}>
        {/* Status */}
        <ScreenInset>
          <Animated.View entering={FadeIn.duration(280)} style={styles.hero}>
            <View style={[styles.statusPill, { backgroundColor: toneBg }]}>
              <Icon name={meta.icon} size={14} color={toneColor} />
              <Text style={[styles.statusPillText, { color: toneColor }]}>
                {meta.label}
              </Text>
            </View>
            <Text style={[styles.amount, { color: colors.primary }]} selectable={false}>
              {formatBase(agreed)}
            </Text>
            <Text style={[styles.amountMeta, { color: colors.textMuted }]}>
              {gemCount} gem{gemCount === 1 ? "" : "s"}
              {ap.expectedReturnDate
                ? ` · Return ${formatRelativeDue(ap.expectedReturnDate)}`
                : ""}
            </Text>
          </Animated.View>
        </ScreenInset>

        {/* Receiver ↔ Gems visual (bottom-to-top) */}
        <ScreenInset>
          <Animated.View
            entering={FadeInDown.delay(60).duration(320)}
            style={styles.relation}
          >
            <Pressable
              style={({ pressed }) => [
                styles.holderBlock,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                if (isSender && ap.receiverContactId) {
                  router.push(
                    `/(marketplace)/(tabs)/workspace/contacts/${ap.receiverContactId}` as never,
                  );
                } else if (isSender && ap.receiverBusinessId) {
                  router.push(`/business/${ap.receiverBusinessId}` as never);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`AP party ${partyName}`}
            >
              <ContactAvatar
                name={partyName}
                photoUrl={partyPhoto}
                size={88}
              />
              <Text
                style={[styles.holderName, { color: colors.onSurface }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {partyName}
              </Text>
              <Text style={[styles.holderRole, { color: colors.textMuted }]}>
                {partyRole}
              </Text>
            </Pressable>

            <View style={styles.relationMid} pointerEvents="none">
              <View
                style={[
                  styles.relationLine,
                  { backgroundColor: colors.outlineVariant },
                ]}
              />
              <Icon
                name={isSender ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                size={22}
                color={colors.outline}
              />
              <View
                style={[
                  styles.directionBadge,
                  {
                    backgroundColor: colors.primaryContainer,
                    borderColor: colors.background,
                  },
                ]}
              >
                <Icon
                  name={isSender ? "call-made" : "call-received"}
                  size={16}
                  color={colors.onPrimaryContainer}
                />
                <Text
                  style={[
                    styles.directionBadgeText,
                    { color: colors.onPrimaryContainer },
                  ]}
                >
                  {directionLabel}
                </Text>
              </View>
            </View>

            <View style={styles.gemsBlock}>
              <View style={styles.gemsRow}>
                {items.map((line) => (
                  <Pressable
                    key={line.gemId}
                    style={styles.gemItem}
                    onPress={() =>
                      router.push(
                        `/(marketplace)/(tabs)/workspace/gems/${line.gemId}` as never,
                      )
                    }
                    accessibilityRole="link"
                    accessibilityLabel={line.gemLabel}
                  >
                    <GemThumb
                      uri={gemPhotos[line.gemId] ?? null}
                      label={line.gemLabel}
                      size={56}
                      radius={12}
                    />
                    <Text
                      style={[styles.gemLabel, { color: colors.onSurface }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {line.gemLabel}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {!isSender ? (
                <Text style={[styles.fromLine, { color: colors.textMuted }]}>
                  From {counterpartyName}
                </Text>
              ) : null}
            </View>
          </Animated.View>
        </ScreenInset>

        {/* Timeline */}
        <FormSection title="Timeline">
          <View style={styles.timeline}>
            {steps.map((step, i) => {
              const active = step.state === "active";
              const stepDone = step.state === "done";
              const stepOverdue = step.state === "overdue";
              const filled = stepDone || active || stepOverdue;
              const nextFilled =
                i < steps.length - 1 &&
                (steps[i + 1]!.state === "done" ||
                  steps[i + 1]!.state === "active" ||
                  steps[i + 1]!.state === "overdue");
              const dotColor = stepOverdue
                ? colors.error
                : stepDone || active
                  ? colors.primary
                  : colors.surfaceVariant;
              const labelColor = stepOverdue
                ? colors.error
                : stepDone || active
                  ? colors.primary
                  : colors.textMuted;

              return (
                <Animated.View
                  key={step.key}
                  entering={FadeInDown.delay(80 + i * 50).duration(280)}
                  style={styles.timelineRow}
                >
                  <View style={styles.timelineRail}>
                    <View
                      style={[
                        styles.timelineDot,
                        {
                          backgroundColor: dotColor,
                          borderColor: colors.surfaceContainerLowest,
                        },
                      ]}
                    >
                      {stepDone ? (
                        <Icon name="check" size={12} color={colors.onPrimary} />
                      ) : null}
                      {active ? (
                        <View
                          style={[
                            styles.pulse,
                            { backgroundColor: colors.onPrimary },
                          ]}
                        />
                      ) : null}
                      {stepOverdue ? (
                        <Icon
                          name="priority-high"
                          size={12}
                          color={colors.onError}
                        />
                      ) : null}
                    </View>
                    {i < steps.length - 1 ? (
                      <View
                        style={[
                          styles.timelineConnector,
                          {
                            backgroundColor:
                              nextFilled || filled
                                ? colors.primary
                                : colors.outlineVariant,
                            opacity: nextFilled ? 1 : filled ? 0.45 : 1,
                          },
                        ]}
                      />
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.timelineCard,
                      {
                        backgroundColor:
                          active || stepOverdue
                            ? toneBg
                            : colors.surfaceContainerLow,
                      },
                    ]}
                  >
                    <Text style={[styles.timelineLabel, { color: labelColor }]}>
                      {step.label}
                    </Text>
                    <Text
                      style={[styles.timelineSub, { color: colors.textMuted }]}
                      selectable={false}
                    >
                      {step.sub}
                    </Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        </FormSection>

        {ap.rejectionReason ? (
          <FormSection title="Details">
            <Text style={{ color: colors.error }} selectable={false}>
              {ap.rejectionReason}
            </Text>
          </FormSection>
        ) : null}

        {/* Gem lines + actions */}
        <FormSection title="Gems">
          {items.map((line) => {
            const sold = line.lineStatus === "sold" && line.soldPrice != null;
            const yours = line.commission ?? 0;
            return (
              <View key={line.gemId} style={styles.lineCard}>
                <View style={styles.lineTop}>
                  <GemThumb
                    uri={gemPhotos[line.gemId] ?? null}
                    label={line.gemLabel}
                    size={40}
                    radius={10}
                  />
                  <View style={styles.lineBody}>
                    <Text
                      style={[styles.lineTitle, { color: colors.onSurface }]}
                      numberOfLines={1}
                    >
                      {line.gemLabel}
                    </Text>
                    {!sold ? (
                      <View style={styles.apPriceRow}>
                        <Icon
                          name="handshake"
                          size={14}
                          color={colors.onSurfaceVariant}
                        />
                        <Text
                          style={[
                            styles.apPrice,
                            { color: colors.onSurfaceVariant },
                          ]}
                          numberOfLines={1}
                        >
                          {formatStored({
                            amount: line.agreedPrice,
                            currency: line.currency,
                            amountBase: line.agreedPriceBase,
                          })}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.lineBadge,
                      {
                        backgroundColor: sold
                          ? colors.successEmerald + "22"
                          : colors.surfaceContainerHighest,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.lineBadgeText,
                        {
                          color: sold
                            ? colors.successEmerald
                            : colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      {line.lineStatus}
                    </Text>
                  </View>
                </View>

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

                {isReceiver &&
                isApOngoing(ap.status) &&
                line.lineStatus === "held" ? (
                  <View style={styles.row}>
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
                      onPress={() =>
                        run(
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
        </FormSection>

        {isSender && ap.status === "pending" ? (
          <ScreenInset>
            <Button
              title="Cancel request"
              variant="secondary"
              icon="cancel"
              onPress={() =>
                run(async () => {
                  await cancelApRequest(ap.id);
                  router.back();
                }, "AP cancelled")
              }
            />
          </ScreenInset>
        ) : null}

        {isReceiver && ap.status === "pending" ? (
          <>
            <FormSectionLabel title="Respond" />
            <ScreenInset style={styles.row}>
              <Button
                title="Accept"
                icon="check"
                onPress={() =>
                  run(
                    () => respondApRequest(ap.id, "accepted"),
                    "AP accepted",
                  )
                }
                style={styles.flex}
              />
              <Button
                title="Reject"
                variant="secondary"
                icon="close"
                onPress={() =>
                  run(async () => {
                    await respondApRequest(ap.id, "rejected");
                    router.back();
                  }, "AP rejected")
                }
                style={styles.flex}
              />
            </ScreenInset>
          </>
        ) : null}

        {isSender && canRequestApCancellation(ap, user!.uid) ? (
          <ScreenInset>
            <Button
              title="Request cancellation"
              variant="secondary"
              icon="cancel"
              onPress={() =>
                run(
                  () => requestApCancellation(ap.id),
                  "Cancellation requested",
                )
              }
            />
          </ScreenInset>
        ) : null}

        {isReceiver && canRespondApCancellation(ap, user!.uid) ? (
          <>
            <FormSectionLabel title="Cancellation requested" />
            <ScreenInset style={styles.row}>
              <Button
                title="Accept"
                icon="check"
                onPress={() =>
                  run(
                    () => respondApCancellation(ap.id, "accepted"),
                    "AP cancelled",
                  )
                }
                style={styles.flex}
              />
              <Button
                title="Decline"
                variant="secondary"
                icon="close"
                onPress={() =>
                  run(
                    () => respondApCancellation(ap.id, "rejected"),
                    "Cancellation declined",
                  )
                }
                style={styles.flex}
              />
            </ScreenInset>
          </>
        ) : null}

        {isReceiver &&
        isApOngoing(ap.status) &&
        items.some((i) => i.lineStatus === "sold") ? (
          <ScreenInset>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Pay owner ${formatBase(owed)}`}
              onPress={haptics.wrap("light", () => {
                if (!payAmount && owed > 0) setPayAmount(String(owed));
                setPaySheetOpen(true);
              })}
              style={({ pressed }) => [
                styles.owedCard,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
            >
              <ContactAvatar
                name={counterpartyName}
                photoUrl={ownerPhoto}
                size={52}
              />
              <View style={styles.owedBody}>
                <Icon name="call-made" size={18} color={colors.onPrimary} />
                <Text
                  style={[styles.owedAmount, { color: colors.onPrimary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatBase(owed)}
                </Text>
              </View>
              <View
                style={[
                  styles.owedChevron,
                  { backgroundColor: colors.onPrimary + "22" },
                ]}
              >
                <Icon name="payments" size={22} color={colors.onPrimary} />
              </View>
            </Pressable>
          </ScreenInset>
        ) : null}

        <BottomSheet
          visible={paySheetOpen}
          onClose={() => setPaySheetOpen(false)}
          footer={
            <Button
              title={
                payMethod === "cheque"
                  ? "Continue with cheque"
                  : "Payment Sent"
              }
              icon={payMethod === "cheque" ? "money-check-dollar" : "send"}
              onPress={() => {
                const amountToValidate =
                  payAmount || (owed > 0 ? String(owed) : "");
                const result = parseForm(recordPaymentSchema, {
                  amount: amountToValidate,
                });
                if (!result.success) {
                  toast.error(result.errors.amount ?? "Enter payment amount");
                  return;
                }
                const amount = result.data.amount;
                setPaySheetOpen(false);
                if (payMethod === "cheque") {
                  router.push({
                    pathname: "/(marketplace)/cheques/add",
                    params: {
                      amount: String(amount),
                      apRecordId: ap.id,
                      gemId: items[0]?.gemId,
                      direction: "given",
                      confirmApSent: "1",
                    },
                  });
                  return;
                }
                run(
                  async () =>
                    apPaymentSent({
                      apId: ap.id,
                      method: payMethod,
                      amount,
                      receiptUrl: await uploadReceipt(user!.uid, sentReceipt),
                    }),
                  "Payment marked sent",
                );
              }}
            />
          }
        >
          <View style={styles.payHero}>
            <ContactAvatar
              name={counterpartyName}
              photoUrl={ownerPhoto}
              size={72}
            />
            <Icon name="call-made" size={22} color={colors.primary} />
            <Text
              style={[styles.payHeroAmount, { color: colors.primary }]}
              selectable={false}
            >
              {formatBase(owed)}
            </Text>
          </View>

          <ChipSelect
            options={PAY_METHODS}
            value={payMethod}
            onChange={setPayMethod}
            layout="stack"
          />

          <MaskedInput
            mode="currency"
            value={payAmount || (owed > 0 ? String(owed) : "")}
            onChangeText={setPayAmount}
            leftIcon="payments"
          />
          <ReceiptField value={sentReceipt} onChange={setSentReceipt} />
        </BottomSheet>

        {isSender && ap.status === "payment_sent" ? (
          <FormSection title="Confirm payment">
            <Text style={[styles.meta, { color: colors.onSurface }]}>
              {ap.paymentMethod
                ? `Marked sent as ${ap.paymentMethod}`
                : "Payment"}{" "}
              · {formatBase(ap.paymentAmount ?? owed)}
            </Text>
            <ChipSelect
              label="How was it received?"
              options={PAY_METHODS}
              value={receiveMethod}
              onChange={setReceiveMethodOverride}
              layout="split"
            />
            <Button
              title={
                receiveMethod === "cheque"
                  ? "Continue with cheque"
                  : "Payment Received"
              }
              icon={
                receiveMethod === "cheque"
                  ? "money-check-dollar"
                  : "check-circle"
              }
              onPress={() => {
                if (receiveMethod === "cheque") {
                  router.push({
                    pathname: "/(marketplace)/cheques/add",
                    params: {
                      amount: String(ap.paymentAmount ?? owed),
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
                  async () =>
                    apPaymentReceived(ap.id, {
                      method: receiveMethod,
                      receiptUrl: await uploadReceipt(user!.uid, receivedReceipt),
                    }),
                  "Payment confirmed — done",
                );
              }}
            />
            <ReceiptField value={receivedReceipt} onChange={setReceivedReceipt} />
          </FormSection>
        ) : null}

        {done ? (
          <FormSection title="Settled">
            <View style={styles.waitRow}>
              <Icon
                name="check-circle"
                size={18}
                color={colors.successEmerald}
              />
              <Text style={{ color: colors.textMuted, flex: 1 }}>
                Payment received. Money ledgers updated on both sides.
              </Text>
            </View>
          </FormSection>
        ) : null}

        {isSender && isApOngoing(ap.status) ? (
          <FormSection title="Waiting">
            <View style={styles.waitRow}>
              <Icon name="schedule" size={18} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, flex: 1 }}>
                Holder can sell or return gems. You confirm payment when they
                mark it sent.
              </Text>
            </View>
          </FormSection>
        ) : null}

        {canDeleteAp(ap) ? (
          <ScreenInset>
            <Button
              title="Delete AP"
              variant="secondary"
              icon="delete"
              onPress={() =>
                run(async () => {
                  await deleteApRecord(ap.id);
                  router.back();
                }, "AP deleted")
              }
            />
          </ScreenInset>
        ) : null}
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { gap: Spacing.sectionGap, paddingBottom: 48 },

  hero: { gap: Spacing.stackSm, alignItems: "center" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  statusPillText: { ...Typography.labelMd, fontWeight: "600" },
  amount: {
    ...Typography.displayLg,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  amountMeta: { ...Typography.bodyMd, textAlign: "center" },

  relation: {
    width: "100%",
    alignItems: "center",
    gap: 10,
  },
  holderBlock: {
    alignItems: "center",
    gap: 8,
    maxWidth: "80%",
  },
  holderName: {
    ...Typography.headlineSm,
    fontWeight: "700",
    textAlign: "center",
    width: "100%",
  },
  holderRole: {
    ...Typography.bodyMd,
    fontSize: 13,
    textAlign: "center",
  },
  relationMid: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 72,
    width: 120,
  },
  relationLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    alignSelf: "center",
  },
  directionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 3,
    zIndex: 1,
  },
  directionBadgeText: {
    ...Typography.labelMd,
    fontWeight: "700",
  },
  gemsBlock: {
    width: "100%",
    alignItems: "center",
    gap: 8,
  },
  gemsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    width: "100%",
  },
  gemItem: {
    width: 72,
    alignItems: "center",
    gap: 6,
  },
  gemLabel: {
    ...Typography.labelMd,
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
  },
  fromLine: {
    ...Typography.bodyMd,
    fontSize: 13,
    textAlign: "center",
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },

  timeline: { gap: 0 },
  timelineRow: {
    flexDirection: "row",
    gap: 14,
    minHeight: 72,
  },
  timelineRail: {
    width: 24,
    alignItems: "center",
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  pulse: { width: 8, height: 8, borderRadius: 4 },
  timelineConnector: {
    flex: 1,
    width: 2,
    marginTop: 2,
    marginBottom: 2,
    borderRadius: 1,
  },
  timelineCard: {
    flex: 1,
    borderRadius: Radius.md,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 2,
  },
  timelineLabel: { ...Typography.labelMd, fontWeight: "700" },
  timelineSub: { ...Typography.bodyMd, fontSize: 13 },

  lineCard: {
    gap: 10,
    marginBottom: Spacing.sm,
  },
  lineTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  lineBody: { flex: 1, gap: 2, minWidth: 0 },
  lineTitle: { ...Typography.bodyMd, fontWeight: "600" },
  lineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  lineBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  apPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  apPrice: {
    ...Typography.bodySmall,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  meta: { ...Typography.bodySmall },
  row: { flexDirection: "row", gap: Spacing.sm },
  flex: { flex: 1 },
  waitRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "flex-start",
  },

  owedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
  },
  owedBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  owedAmount: {
    ...Typography.headlineSm,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  owedChevron: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  payHero: {
    alignItems: "center",
    gap: 10,
    paddingVertical: Spacing.sm,
  },
  payHeroAmount: {
    ...Typography.displayLg,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
});
