import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import {
  FormSection,
  ScreenInset,
} from "@/components/ui/form-section";
import { Icon, type IconName } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { BankAvatar } from "@/components/workspace/bank-picker-sheet";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { getBankByCode, getBankByName } from "@/constants/sri-lanka-banks";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import { fetchBusinesses } from "@/features/marketplace/marketplace-service";
import {
  CHEQUE_STATUS_LABELS,
  maturityLabel,
} from "@/features/workspace/cheque-utils";
import {
  subscribeCheque,
  subscribeContacts,
  subscribeGem,
  subscribeVerifiedBusinesses,
} from "@/features/workspace/firestore-subscriptions";
import {
  gemPrimaryPhotoUrl,
  resolvePartyPhotoUrl,
} from "@/features/workspace/party-photo";
import {
  fetchCheque,
  fetchContacts,
  fetchGem,
  updateChequeStatus,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import {
  formatDate,
  formatRelativeDue,
  formatRelativeTime,
  openPhone,
  openWhatsApp,
} from "@/lib/utils";
import { confirm } from "@/providers/confirm-provider";
import { useIsBusy, withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";
import type { Cheque, ChequeStatus } from "@/types";

type StepState = "done" | "active" | "pending" | "overdue";

function chequeStatusMeta(
  status: ChequeStatus,
): {
  label: string;
  icon: IconName;
  tone: "neutral" | "warning" | "success" | "error";
} {
  switch (status) {
    case "holding":
      return { label: "Holding", icon: "schedule", tone: "warning" };
    case "deposited":
      return { label: "Deposited", icon: "account-balance", tone: "warning" };
    case "cleared":
      return { label: "Cleared", icon: "check-circle", tone: "success" };
    case "bounced":
      return { label: "Bounced", icon: "error-outline", tone: "error" };
    case "replaced":
      return { label: "Replaced", icon: "swap-horiz", tone: "neutral" };
    case "cancelled":
      return { label: "Cancelled", icon: "cancel", tone: "neutral" };
    default:
      return { label: CHEQUE_STATUS_LABELS[status], icon: "money-check-dollar", tone: "neutral" };
  }
}

function chequeTimelineSteps(
  cheque: Cheque,
): { key: string; label: string; sub: string; state: StepState }[] {
  const status = cheque.status;
  const cleared = status === "cleared";
  const bounced = status === "bounced";
  const cancelled = status === "cancelled" || status === "replaced";
  const deposited =
    status === "deposited" || cleared || bounced;
  const holdingActive = status === "holding";

  return [
    {
      key: "issued",
      label: "Issued",
      sub: formatDate(cheque.issueDate),
      state: "done",
    },
    {
      key: "maturity",
      label: holdingActive ? "Maturity" : deposited ? "Held" : "Maturity",
      sub: maturityLabel(cheque),
      state: cancelled
        ? "pending"
        : holdingActive
          ? "active"
          : deposited || cleared || bounced
            ? "done"
            : "pending",
    },
    {
      key: "bank",
      label: bounced
        ? "Bounced"
        : cleared
          ? "Cleared"
          : status === "deposited"
            ? "Deposited"
            : cancelled
              ? CHEQUE_STATUS_LABELS[status]
              : "Bank",
      sub: bounced
        ? cheque.bouncedReason?.trim() || "Did not clear"
        : cleared && cheque.clearedDate
          ? formatRelativeTime(cheque.clearedDate)
          : status === "deposited" && cheque.depositedDate
            ? formatRelativeTime(cheque.depositedDate)
            : cancelled
              ? "No longer pending"
              : "Awaiting deposit",
      state: bounced
        ? "overdue"
        : cleared || cancelled
          ? "done"
          : status === "deposited"
            ? "active"
            : "pending",
    },
  ];
}

export default function ChequeDetailScreen() {
  const { chequeId } = useLocalSearchParams<{ chequeId: string }>();
  const { colors } = useAppTheme();
  const { formatStored } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const busy = useIsBusy();
  const [bounceReason, setBounceReason] = useState("");
  const [showBounceForm, setShowBounceForm] = useState(false);

  const { data: cheque, isLoading } = useFirestoreLiveQuery({
    queryKey: ["cheque", chequeId],
    queryFn: () => fetchCheque(chequeId!),
    subscribe: (onData, onError) =>
      subscribeCheque(chequeId!, onData, onError),
    enabled: !!chequeId,
  });

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ["contacts", cheque?.ownerUid],
    queryFn: () => fetchContacts(cheque!.ownerUid),
    subscribe: (onData, onError) =>
      subscribeContacts(cheque!.ownerUid, onData, onError),
    enabled: !!cheque?.ownerUid,
  });

  const { data: businesses = [] } = useFirestoreLiveQuery({
    queryKey: ["home-businesses"],
    queryFn: () => fetchBusinesses(),
    subscribe: (onData, onError) =>
      subscribeVerifiedBusinesses(onData, onError),
    enabled: !!cheque,
  });

  const { data: gem } = useFirestoreLiveQuery({
    queryKey: ["gem", cheque?.gemId],
    queryFn: () => fetchGem(cheque!.gemId!),
    subscribe: (onData, onError) =>
      subscribeGem(cheque!.gemId!, onData, onError),
    enabled: !!cheque?.gemId,
  });

  const contact =
    contacts.find((c) => c.id === cheque?.counterpartyContactId) ?? null;
  const contactName =
    contact?.displayName ?? cheque?.issuedBy ?? "—";
  const contactPhoto = resolvePartyPhotoUrl(contact, businesses);

  async function handleStatus(status: ChequeStatus) {
    if (!cheque) return;

    if (status === "bounced") {
      setShowBounceForm(true);
      return;
    }

    if (status === "cancelled") {
      void confirm({
        title: "Cancel cheque",
        message: "Mark this cheque as cancelled?",
        tone: "destructive",
        confirmLabel: "Yes",
        cancelLabel: "No",
        icon: "cancel",
        onConfirm: async () => {
          await updateChequeStatus(cheque.id, "cancelled");
          await queryClient.invalidateQueries({ queryKey: ["cheques"] });
          await queryClient.invalidateQueries({
            queryKey: ["cheque", chequeId],
          });
          await queryClient.invalidateQueries({ queryKey: ["notifications"] });
          toast.success(
            `Cheque marked as ${CHEQUE_STATUS_LABELS.cancelled.toLowerCase()}.`,
          );
        },
      });
      return;
    }

    await applyStatus(status);
  }

  async function applyStatus(status: ChequeStatus, reason?: string) {
    if (!cheque) return;
    try {
      await withLoading(async () => {
        await updateChequeStatus(
          cheque.id,
          status,
          reason ? { bouncedReason: reason } : undefined,
        );
        await queryClient.invalidateQueries({ queryKey: ["cheques"] });
        await queryClient.invalidateQueries({
          queryKey: ["cheque", chequeId],
        });
        await queryClient.invalidateQueries({ queryKey: ["notifications"] });
        toast.success(
          `Cheque marked as ${CHEQUE_STATUS_LABELS[status].toLowerCase()}.`,
        );
      }, "Updating…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not update status."));
    }
  }

  function handleReplace() {
    if (!cheque) return;
    router.push({
      pathname: "/(marketplace)/cheques/add",
      params: {
        amount: String(cheque.amount),
        contactId: cheque.counterpartyContactId,
        gemId: cheque.gemId ?? undefined,
        apRecordId: cheque.apRecordId ?? undefined,
      },
    });
  }

  if (isLoading || !cheque) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <StackHeader title="Cheque" />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>
            {isLoading ? "Loading…" : "Cheque not found."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isBounced = cheque.status === "bounced";
  const isPending =
    cheque.status === "holding" || cheque.status === "deposited";
  const isReceived = cheque.direction === "received";
  const directionLabel = isReceived ? "Taken" : "Given";
  const meta = chequeStatusMeta(cheque.status);
  const steps = chequeTimelineSteps(cheque);
  const bank =
    getBankByCode(cheque.bankCode) ?? getBankByName(cheque.bankName) ?? null;
  const amountLabel = formatStored({
    amount: cheque.amount,
    currency: cheque.currency,
    amountBase: cheque.amountBase,
  });
  const gemTitle =
    gem?.title?.trim() ||
    gem?.variety?.trim() ||
    (gem ? formatGemType(gem.gemType) : null) ||
    (cheque.gemId ? `Gem · ${cheque.gemId.slice(0, 8)}` : null);

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

  const phone = contact?.phone?.trim() || null;
  const whatsapp =
    contact?.whatsapp?.trim() || contact?.phone?.trim() || null;

  const statusActions: {
    status: ChequeStatus;
    label: string;
    sub: string;
    icon: IconName;
    tone: "primary" | "danger";
  }[] = [
    {
      status: "deposited",
      label: "Mark deposited",
      sub: "Sent to the bank",
      icon: "account-balance",
      tone: "primary",
    },
    {
      status: "cleared",
      label: "Mark cleared",
      sub: "Funds received",
      icon: "check-circle",
      tone: "primary",
    },
    {
      status: "bounced",
      label: "Mark bounced",
      sub: "Did not clear",
      icon: "cancel",
      tone: "danger",
    },
    {
      status: "cancelled",
      label: "Cancel cheque",
      sub: "Void this record",
      icon: "cancel",
      tone: "danger",
    },
  ].filter((a) =>
    cheque.status === "holding"
      ? ["deposited", "cleared", "bounced", "cancelled"].includes(a.status)
      : ["cleared", "bounced", "cancelled"].includes(a.status),
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title={directionLabel} />

      <ThemedScrollView contentContainerStyle={styles.content}>
        {/* Hero */}
        <ScreenInset>
          <Animated.View entering={FadeIn.duration(280)} style={styles.hero}>
            <View style={[styles.statusPill, { backgroundColor: toneBg }]}>
              <Icon name={meta.icon} size={14} color={toneColor} />
              <Text style={[styles.statusPillText, { color: toneColor }]}>
                {meta.label}
              </Text>
            </View>
            <Text
              style={[
                styles.amount,
                {
                  color: isBounced ? colors.error : colors.primary,
                },
              ]}
              selectable
            >
              {amountLabel}
            </Text>
            <Text style={[styles.amountMeta, { color: colors.textMuted }]}>
              {maturityLabel(cheque)}
              {cheque.chequeNumber ? ` · No. ${cheque.chequeNumber}` : ""}
            </Text>
          </Animated.View>
        </ScreenInset>

        {/* Party ↔ bank visual */}
        <ScreenInset>
          <Animated.View
            entering={FadeInDown.delay(60).duration(320)}
            style={styles.relation}
          >
            <Pressable
              style={({ pressed }) => [
                styles.partyBlock,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                if (cheque.counterpartyContactId) {
                  router.push(
                    `/(marketplace)/(tabs)/workspace/contacts/${cheque.counterpartyContactId}` as never,
                  );
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`Open contact ${contactName}`}
            >
              <ContactAvatar
                name={contactName}
                photoUrl={contactPhoto}
                size={88}
              />
              <Text
                style={[styles.partyName, { color: colors.onSurface }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {contactName}
              </Text>
              <Text style={[styles.partyRole, { color: colors.textMuted }]}>
                {isReceived ? "Cheque from them" : "Cheque you gave"}
              </Text>
            </Pressable>

            {phone || whatsapp ? (
              <View style={styles.partyActions}>
                {phone ? (
                  <Pressable
                    onPress={() => void Linking.openURL(openPhone(phone))}
                    style={[
                      styles.roundBtn,
                      { backgroundColor: colors.primary },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Call contact"
                  >
                    <Icon name="call" size={18} color={colors.onPrimary} />
                  </Pressable>
                ) : null}
                {whatsapp ? (
                  <Pressable
                    onPress={() =>
                      void Linking.openURL(openWhatsApp(whatsapp))
                    }
                    style={[styles.roundBtn, { backgroundColor: "#25D366" }]}
                    accessibilityRole="button"
                    accessibilityLabel="WhatsApp contact"
                  >
                    <Icon name="whatsapp" size={18} color="#FFFFFF" />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={styles.relationMid} pointerEvents="none">
              <View
                style={[
                  styles.relationLine,
                  { backgroundColor: colors.outlineVariant },
                ]}
              />
              <Icon
                name={isReceived ? "keyboard-arrow-down" : "keyboard-arrow-up"}
                size={22}
                color={colors.outline}
              />
              <View
                style={[
                  styles.directionBadge,
                  {
                    backgroundColor: isBounced
                      ? colors.errorContainer
                      : colors.primaryContainer,
                    borderColor: colors.background,
                  },
                ]}
              >
                <Icon
                  name={isReceived ? "call-received" : "call-made"}
                  size={16}
                  color={
                    isBounced ? colors.error : colors.onPrimaryContainer
                  }
                />
                <Text
                  style={[
                    styles.directionBadgeText,
                    {
                      color: isBounced
                        ? colors.error
                        : colors.onPrimaryContainer,
                    },
                  ]}
                >
                  {directionLabel}
                </Text>
              </View>
            </View>

            <View style={styles.bankBlock}>
              {bank ? (
                <BankAvatar bank={bank} size={64} />
              ) : (
                <View
                  style={[
                    styles.bankPlaceholder,
                    { backgroundColor: colors.surfaceContainerHigh },
                  ]}
                >
                  <Icon
                    name="account-balance"
                    size={28}
                    color={colors.outline}
                  />
                </View>
              )}
              <Text
                style={[styles.bankName, { color: colors.onSurface }]}
                numberOfLines={2}
              >
                {cheque.bankName || bank?.name || "Bank"}
              </Text>
              {cheque.branch ? (
                <Text
                  style={[styles.bankBranch, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {cheque.branch}
                </Text>
              ) : null}
            </View>
          </Animated.View>
        </ScreenInset>

        {/* Paper cheque card */}
        <ScreenInset>
          <Animated.View
            entering={FadeInDown.delay(100).duration(300)}
            style={[
              styles.chequeCard,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: isBounced
                  ? colors.error + "55"
                  : colors.outlineVariant,
              },
            ]}
          >
            <View style={styles.chequeTop}>
              <View style={styles.chequeBankRow}>
                {bank ? (
                  <BankAvatar bank={bank} size={40} />
                ) : (
                  <View
                    style={[
                      styles.bankPlaceholderSm,
                      { backgroundColor: colors.surfaceContainerHigh },
                    ]}
                  >
                    <Icon
                      name="account-balance"
                      size={18}
                      color={colors.outline}
                    />
                  </View>
                )}
                <View style={styles.chequeBankText}>
                  <Text
                    style={[styles.chequeBankName, { color: colors.onSurface }]}
                    numberOfLines={1}
                  >
                    {cheque.bankName}
                  </Text>
                  <Text
                    style={[styles.microLabel, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {cheque.branch || "Branch"}
                  </Text>
                </View>
              </View>
              <View style={styles.chequeMeta}>
                <Text
                  style={[styles.microLabel, { color: colors.textMuted }]}
                >
                  No.
                </Text>
                <Text
                  style={[styles.chequeNo, { color: colors.onSurface }]}
                  selectable
                >
                  {cheque.chequeNumber || "—"}
                </Text>
              </View>
            </View>

            <View style={styles.chequeLine}>
              <Text style={[styles.microLabel, { color: colors.textMuted }]}>
                {isReceived ? "From" : "Pay to"}
              </Text>
              <Text
                style={[
                  styles.chequeLineValue,
                  {
                    color: colors.onSurface,
                    borderBottomColor: colors.outlineVariant,
                  },
                ]}
                selectable
                numberOfLines={1}
              >
                {cheque.issuedBy}
              </Text>
            </View>

            <View style={styles.chequeBottom}>
              <View
                style={[
                  styles.amountBox,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <Text style={[styles.microLabel, { color: colors.textMuted }]}>
                  Amount
                </Text>
                <Text
                  style={[
                    styles.amountBoxValue,
                    { color: isBounced ? colors.error : colors.onSurface },
                  ]}
                  selectable
                  numberOfLines={1}
                >
                  {amountLabel}
                </Text>
              </View>
              <View style={styles.maturityBlock}>
                <Text style={[styles.microLabel, { color: colors.textMuted }]}>
                  Matures
                </Text>
                <Text
                  style={[styles.maturityValue, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {formatRelativeDue(cheque.maturityDate)}
                </Text>
                <Text
                  style={[styles.maturityDate, { color: colors.textMuted }]}
                >
                  {formatDate(cheque.maturityDate)}
                </Text>
              </View>
            </View>
          </Animated.View>
        </ScreenInset>

        {/* Timeline */}
        <FormSection title="Timeline">
          <View style={styles.timeline}>
            {steps.map((step, i) => {
              const active = step.state === "active";
              const done = step.state === "done";
              const overdue = step.state === "overdue";
              const filled = done || active || overdue;
              const nextFilled =
                i < steps.length - 1 &&
                (steps[i + 1]!.state === "done" ||
                  steps[i + 1]!.state === "active" ||
                  steps[i + 1]!.state === "overdue");
              const dotColor = overdue
                ? colors.error
                : done || active
                  ? colors.primary
                  : colors.surfaceVariant;
              const labelColor = overdue
                ? colors.error
                : done || active
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
                      {done ? (
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
                      {overdue ? (
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
                                ? overdue ||
                                  steps[i + 1]?.state === "overdue"
                                  ? colors.error
                                  : colors.primary
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
                          active || overdue
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
                      selectable
                    >
                      {step.sub}
                    </Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        </FormSection>

        {cheque.photoUrl ? (
          <FormSection title="Photo" padded={false}>
            <Animated.View
              entering={FadeInDown.delay(160).duration(280)}
              style={styles.photoWrap}
            >
              <Image
                source={{ uri: cheque.photoUrl }}
                style={styles.photo}
                contentFit="contain"
                recyclingKey={cheque.photoUrl}
                accessibilityLabel="Cheque photo"
              />
            </Animated.View>
          </FormSection>
        ) : null}

        {gemTitle && cheque.gemId ? (
          <ScreenInset>
            <Pressable
              onPress={() =>
                router.push(
                  `/(marketplace)/(tabs)/workspace/gems/${cheque.gemId}` as never,
                )
              }
              style={({ pressed }) => [
                styles.gemLink,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
              accessibilityRole="link"
              accessibilityLabel={`Open gem ${gemTitle}`}
            >
              <GemThumb
                uri={gemPrimaryPhotoUrl(gem)}
                label={gemTitle}
                size={48}
                radius={12}
              />
              <View style={styles.gemLinkBody}>
                <Text
                  style={[styles.gemLinkTitle, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {gemTitle}
                </Text>
                <Text style={[styles.gemLinkSub, { color: colors.textMuted }]}>
                  Linked gem
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.outline} />
            </Pressable>
          </ScreenInset>
        ) : null}

        {cheque.notes ? (
          <FormSection title="Notes">
            <Text
              style={[styles.notes, { color: colors.onSurfaceVariant }]}
              selectable
            >
              {cheque.notes}
            </Text>
          </FormSection>
        ) : null}

        {showBounceForm ? (
          <FormSection title="Bounce reason">
            <Input
              label="Why did it bounce?"
              value={bounceReason}
              onChangeText={setBounceReason}
              placeholder="Insufficient funds, signature mismatch…"
              leftIcon="notes"
            />
            <View style={styles.bounceActions}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setShowBounceForm(false)}
              />
              <Button
                title="Confirm bounce"
                icon="cancel"
                onPress={() => {
                  if (!bounceReason.trim()) {
                    toast.error("Enter a reason for the bounce.");
                    return;
                  }
                  void applyStatus("bounced", bounceReason).then(() =>
                    setShowBounceForm(false),
                  );
                }}
              />
            </View>
          </FormSection>
        ) : null}

        {isPending && !showBounceForm ? (
          <ScreenInset style={styles.bottomActions}>
            {statusActions.map((a, i) => (
              <Animated.View
                key={a.status}
                entering={FadeInDown.delay(180 + i * 40).duration(260)}
              >
                <Pressable
                  onPress={() => handleStatus(a.status)}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      borderColor:
                        a.tone === "danger" ? colors.error : colors.primary,
                      opacity: pressed || busy ? 0.85 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                >
                  <View
                    style={[
                      styles.actionIconWrap,
                      {
                        backgroundColor:
                          a.tone === "danger"
                            ? colors.errorContainer
                            : colors.primary + "22",
                      },
                    ]}
                  >
                    <Icon
                      name={a.icon}
                      size={20}
                      color={
                        a.tone === "danger" ? colors.error : colors.primary
                      }
                    />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text
                      style={[
                        styles.actionTitle,
                        {
                          color:
                            a.tone === "danger"
                              ? colors.error
                              : colors.onSurface,
                        },
                      ]}
                    >
                      {a.label}
                    </Text>
                    <Text
                      style={[styles.actionSub, { color: colors.textMuted }]}
                    >
                      {a.sub}
                    </Text>
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </ScreenInset>
        ) : null}

        {isBounced ? (
          <ScreenInset>
            <Pressable
              onPress={handleReplace}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.primary,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Add replacement cheque"
            >
              <View
                style={[
                  styles.actionIconWrap,
                  { backgroundColor: colors.primary + "22" },
                ]}
              >
                <Icon name="swap-horiz" size={20} color={colors.primary} />
              </View>
              <View style={styles.actionTextCol}>
                <Text
                  style={[styles.actionTitle, { color: colors.onSurface }]}
                >
                  Add replacement
                </Text>
                <Text style={[styles.actionSub, { color: colors.textMuted }]}>
                  Issue a new cheque for the same amount
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.outline} />
            </Pressable>
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
  partyBlock: {
    alignItems: "center",
    gap: 8,
    maxWidth: "80%",
  },
  partyName: {
    ...Typography.headlineSm,
    fontWeight: "700",
    textAlign: "center",
    width: "100%",
  },
  partyRole: {
    ...Typography.bodyMd,
    fontSize: 13,
    textAlign: "center",
  },
  partyActions: {
    flexDirection: "row",
    gap: 12,
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  relationMid: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 72,
    width: 140,
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
  bankBlock: {
    alignItems: "center",
    gap: 8,
    maxWidth: "80%",
  },
  bankPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  bankPlaceholderSm: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bankName: {
    ...Typography.labelMd,
    fontWeight: "700",
    textAlign: "center",
  },
  bankBranch: {
    ...Typography.bodyMd,
    fontSize: 13,
    textAlign: "center",
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },

  chequeCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: Spacing.gutterMd,
    gap: Spacing.lg,
  },
  chequeTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  chequeBankRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  chequeBankText: { flex: 1, minWidth: 0, gap: 2 },
  chequeBankName: { ...Typography.bodyLg, fontWeight: "700" },
  chequeMeta: { alignItems: "flex-end", gap: 2 },
  microLabel: {
    ...Typography.caption,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chequeNo: {
    ...Typography.bodyMd,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  chequeLine: { gap: 4 },
  chequeLineValue: {
    ...Typography.bodyLg,
    fontWeight: "500",
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chequeBottom: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  amountBox: {
    flex: 1.5,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  amountBoxValue: {
    ...Typography.headlineMdMobile,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.3,
  },
  maturityBlock: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
  maturityValue: {
    ...Typography.bodyMd,
    fontWeight: "700",
  },
  maturityDate: { ...Typography.caption },

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

  photoWrap: {
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.lg,
  },
  photo: {
    width: "100%",
    height: 220,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },

  gemLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  gemLinkBody: { flex: 1, gap: 2, minWidth: 0 },
  gemLinkTitle: { ...Typography.labelMd, fontWeight: "700" },
  gemLinkSub: { ...Typography.bodyMd, fontSize: 13 },

  notes: { ...Typography.bodyMd, lineHeight: 22 },

  bounceActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "flex-end",
  },

  bottomActions: { gap: Spacing.sm },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: 1.5,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTextCol: { flex: 1, gap: 2, minWidth: 0 },
  actionTitle: { ...Typography.labelMd, fontWeight: "700" },
  actionSub: { ...Typography.bodyMd, fontSize: 13 },
});
