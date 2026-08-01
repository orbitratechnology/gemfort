import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { ChipSelect } from "@/components/ui/chip-select";
import {
  FormSection,
  ScreenInset,
} from "@/components/ui/form-section";
import { Icon, type IconName } from "@/components/ui/icon";
import { MaskedInput } from "@/components/ui/masked-input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { JOB_STATUS_LABELS } from "@/components/workspace/job-picker-sheet";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import { fetchBusinesses } from "@/features/marketplace/marketplace-service";
import { fetchLapidaryJobs } from "@/features/marketplace/request-service";
import {
  BILL_DIRECTION_LABELS,
  BILL_STATUS_LABELS,
  billCommissionAmount,
  billGemIds,
  billNetAfterCommission,
  dueLabel,
  isOpenBill,
  remainingAmount,
} from "@/features/workspace/bill-utils";
import {
  subscribeBill,
  subscribeContacts,
  subscribeGems,
  subscribeLapidaryJobs,
  subscribeVerifiedBusinesses,
} from "@/features/workspace/firestore-subscriptions";
import {
  gemPrimaryPhotoUrl,
  resolvePartyPhotoUrl,
} from "@/features/workspace/party-photo";
import {
  fetchBill,
  fetchContacts,
  fetchGems,
  recordBillPayment,
  updateBillStatus,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import {
  formatDate,
  formatRelativeDue,
  openPhone,
  openWhatsApp,
} from "@/lib/utils";
import { parseForm, recordPaymentSchema } from "@/lib/validation/form-schemas";
import { useAuth } from "@/providers/auth-provider";
import { confirm } from "@/providers/confirm-provider";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";
import type { ApPaymentMethod, Bill, BillStatus } from "@/types";

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

function billStatusMeta(
  status: BillStatus,
): { label: string; icon: IconName; tone: "neutral" | "warning" | "success" | "error" } {
  switch (status) {
    case "paid":
      return { label: "Paid", icon: "check-circle", tone: "success" };
    case "partial":
    case "ongoing":
      return { label: BILL_STATUS_LABELS[status], icon: "sync", tone: "warning" };
    case "overdue":
      return { label: "Overdue", icon: "error-outline", tone: "error" };
    case "cancelled":
      return { label: "Cancelled", icon: "cancel", tone: "neutral" };
    default:
      return { label: "Open", icon: "receipt-long", tone: "neutral" };
  }
}

function billTimelineSteps(
  bill: Bill,
): { key: string; label: string; sub: string; state: StepState }[] {
  const open = isOpenBill(bill);
  const paid = bill.status === "paid";
  const cancelled = bill.status === "cancelled";
  const overdue = bill.status === "overdue";
  const partial = bill.status === "partial" || bill.amountSettled > 0;

  return [
    {
      key: "opened",
      label: "Opened",
      sub: formatDate(bill.createdAt),
      state: "done",
    },
    {
      key: "due",
      label: overdue ? "Overdue" : partial && open ? "Settling" : "Due",
      sub: overdue || open
        ? dueLabel(bill)
        : formatRelativeDue(bill.dueDate),
      state: cancelled
        ? "pending"
        : overdue
          ? "overdue"
          : paid
            ? "done"
            : open
              ? "active"
              : "pending",
    },
    {
      key: "settled",
      label: cancelled ? "Cancelled" : "Settled",
      sub: paid
        ? "Fully paid"
        : cancelled
          ? "Bill cancelled"
          : partial
            ? `${Math.round((bill.amountSettled / Math.max(bill.amount, 1)) * 100)}% paid`
            : "Awaiting payment",
      state: paid || cancelled ? "done" : partial ? "active" : "pending",
    },
  ];
}

export default function BillDetailScreen() {
  const { billId } = useLocalSearchParams<{ billId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { formatStored, formatFace } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [payMethod, setPayMethod] = useState<ApPaymentMethod>("cash");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const { data: bill, isLoading } = useFirestoreLiveQuery({
    queryKey: ["bill", billId],
    queryFn: () => fetchBill(billId!),
    subscribe: (onData, onError) => subscribeBill(billId!, onData, onError),
    enabled: !!billId,
  });

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ["contacts", bill?.ownerUid],
    queryFn: () => fetchContacts(bill!.ownerUid),
    subscribe: (onData, onError) =>
      subscribeContacts(bill!.ownerUid, onData, onError),
    enabled: !!bill?.ownerUid,
  });

  const { data: businesses = [] } = useFirestoreLiveQuery({
    queryKey: ["home-businesses"],
    queryFn: () => fetchBusinesses(),
    subscribe: (onData, onError) =>
      subscribeVerifiedBusinesses(onData, onError),
    enabled: !!bill,
  });

  const { data: gems = [] } = useFirestoreLiveQuery({
    queryKey: ["gems", bill?.ownerUid],
    queryFn: () => fetchGems(bill!.ownerUid),
    subscribe: (onData, onError) =>
      subscribeGems(bill!.ownerUid, onData, onError),
    enabled: !!bill?.ownerUid && !bill?.jobId,
  });

  const { data: jobs = [] } = useFirestoreLiveQuery({
    queryKey: ["lapidary-jobs", bill?.ownerUid],
    queryFn: () => fetchLapidaryJobs(bill!.ownerUid),
    subscribe: (onData, onError) =>
      subscribeLapidaryJobs(bill!.ownerUid, onData, onError),
    enabled: !!bill?.ownerUid && !!bill?.jobId,
  });

  const contact =
    contacts.find((c) => c.id === bill?.counterpartyContactId) ?? null;
  const contactName = contact?.displayName ?? "—";
  const contactPhoto = resolvePartyPhotoUrl(contact, businesses);
  const linkedJob = bill?.jobId
    ? (jobs.find((j) => j.id === bill.jobId) ?? null)
    : null;

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["bills"] });
    await queryClient.invalidateQueries({ queryKey: ["bill", billId] });
    await queryClient.invalidateQueries({ queryKey: ["payments"] });
    await queryClient.invalidateQueries({ queryKey: ["transactions"] });
  }

  function openPayForm(amount: number) {
    setPaymentAmount(amount > 0 ? String(amount) : "");
    setPaymentError(null);
    setPaySheetOpen(true);
  }

  function goToCheque(amount: number) {
    if (!bill) return;
    const gemIds = billGemIds(bill);
    router.push({
      pathname: "/(marketplace)/cheques/add",
      params: {
        amount: String(amount),
        settleAmount: String(amount),
        contactId: bill.counterpartyContactId,
        gemId: gemIds[0] ?? undefined,
        billId: bill.id,
        direction: bill.direction === "payable" ? "given" : "received",
      },
    });
  }

  async function handleRecordPayment() {
    if (!user || !bill) return;
    const remaining = remainingAmount(bill);
    const amountToValidate = paymentAmount || String(remaining);
    const result = parseForm(recordPaymentSchema, { amount: amountToValidate });
    if (!result.success) {
      setPaymentError(result.errors.amount ?? "Enter a valid payment amount");
      toast.error(result.errors.amount ?? "Enter a valid payment amount");
      return;
    }
    setPaymentError(null);
    if (!payMethod) {
      toast.error("Select how it was paid");
      return;
    }
    if (payMethod === "cheque") {
      setPaySheetOpen(false);
      goToCheque(result.data.amount);
      return;
    }

    try {
      await withLoading(async () => {
        await recordBillPayment(user.uid, bill.id, result.data.amount, {
          currency: bill.currency,
          paymentMethod: payMethod,
        });
        await invalidate();
        toast.success(
          bill.direction === "receivable"
            ? "Payment received"
            : "Payment recorded",
        );
        setPaySheetOpen(false);
        setPaymentAmount("");
        setPayMethod("cash");
      }, "Recording payment…");
    } catch (e) {
      toast.error(friendlyError(e, "Payment could not be recorded."));
    }
  }

  function handleCancel() {
    if (!bill) return;
    void confirm({
      title: "Cancel bill",
      message: "Mark this bill as cancelled?",
      tone: "destructive",
      confirmLabel: "Yes",
      cancelLabel: "No",
      icon: "cancel",
      onConfirm: async () => {
        try {
          await updateBillStatus(bill.id, "cancelled");
          await invalidate();
          toast.success("Bill cancelled");
        } catch (e) {
          toast.error(friendlyError(e, "Could not cancel bill."));
          throw e;
        }
      },
    });
  }

  if (isLoading || !bill) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <StackHeader title="Bill" />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>
            {isLoading ? "Loading…" : "Bill not found."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const remaining = remainingAmount(bill);
  const remainingStored = {
    amount: remaining,
    currency: bill.currency,
    amountBase:
      bill.amount > 0
        ? (remaining / bill.amount) * bill.amountBase
        : bill.amountBase,
  };
  const settledStored = {
    amount: bill.amountSettled,
    currency: bill.currency,
    amountBase:
      bill.amount > 0
        ? (bill.amountSettled / bill.amount) * bill.amountBase
        : undefined,
  };
  const faceStored = {
    amount: bill.amount,
    currency: bill.currency,
    amountBase: bill.amountBase,
  };
  const isPayable = bill.direction === "payable";
  const directionLabel = BILL_DIRECTION_LABELS[bill.direction];
  const open = isOpenBill(bill);
  const commissionOnFace = billCommissionAmount(
    bill.amount,
    bill.commissionPercent,
  );
  const netOnFace = billNetAfterCommission(
    bill.amount,
    bill.commissionPercent,
  );
  const linkedGemIds = billGemIds(bill);
  const meta = billStatusMeta(bill.status);
  const steps = billTimelineSteps(bill);
  const settlePct =
    bill.amount > 0
      ? Math.min(100, Math.round((bill.amountSettled / bill.amount) * 100))
      : bill.status === "paid"
        ? 100
        : 0;

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
                  color:
                    meta.tone === "error"
                      ? colors.error
                      : meta.tone === "success"
                        ? colors.successEmerald
                        : colors.primary,
                },
              ]}
              selectable
            >
              {formatStored(remainingStored)}
            </Text>
            <Text style={[styles.amountMeta, { color: colors.textMuted }]}>
              {open
                ? `Remaining · Due ${dueLabel(bill)}`
                : bill.status === "paid"
                  ? "Fully settled"
                  : BILL_STATUS_LABELS[bill.status]}
            </Text>
          </Animated.View>
        </ScreenInset>

        {/* Party ↔ gems / job */}
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
                if (bill.counterpartyContactId) {
                  router.push(
                    `/(marketplace)/(tabs)/workspace/contacts/${bill.counterpartyContactId}` as never,
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
                {isPayable ? "You owe them" : "They owe you"}
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
                name={isPayable ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                size={22}
                color={colors.outline}
              />
              <View
                style={[
                  styles.directionBadge,
                  {
                    backgroundColor: isPayable
                      ? colors.errorContainer
                      : colors.primaryContainer,
                    borderColor: colors.background,
                  },
                ]}
              >
                <Icon
                  name={isPayable ? "call-made" : "call-received"}
                  size={16}
                  color={
                    isPayable ? colors.error : colors.onPrimaryContainer
                  }
                />
                <Text
                  style={[
                    styles.directionBadgeText,
                    {
                      color: isPayable
                        ? colors.error
                        : colors.onPrimaryContainer,
                    },
                  ]}
                >
                  {directionLabel}
                </Text>
              </View>
            </View>

            {bill.jobId ? (
              <View style={styles.linkBlock}>
                <View
                  style={[
                    styles.jobThumb,
                    { backgroundColor: colors.surfaceContainerHigh },
                  ]}
                >
                  <Icon name="handyman" size={28} color={colors.primary} />
                </View>
                <Text
                  style={[styles.linkTitle, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {linkedJob?.gemName ?? "Lapidary job"}
                </Text>
                {linkedJob ? (
                  <Text
                    style={[styles.linkSub, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {JOB_STATUS_LABELS[linkedJob.status]}
                    {linkedJob.serviceTypes?.length
                      ? ` · ${linkedJob.serviceTypes.join(", ")}`
                      : ""}
                  </Text>
                ) : null}
              </View>
            ) : linkedGemIds.length > 0 ? (
              <View style={styles.gemsBlock}>
                <View style={styles.gemsRow}>
                  {linkedGemIds.map((id) => {
                    const gem = gems.find((g) => g.id === id);
                    const label =
                      gem?.variety?.trim() ||
                      (gem ? formatGemType(gem.gemType) : null) ||
                      gem?.sku ||
                      id.slice(0, 8);
                    return (
                      <Pressable
                        key={id}
                        style={styles.gemItem}
                        onPress={() =>
                          router.push(
                            `/(marketplace)/(tabs)/workspace/gems/${id}` as never,
                          )
                        }
                        accessibilityRole="link"
                        accessibilityLabel={label}
                      >
                        <GemThumb
                          uri={gemPrimaryPhotoUrl(gem)}
                          label={label}
                          size={56}
                          radius={12}
                        />
                        <Text
                          style={[
                            styles.gemLabel,
                            { color: colors.onSurface },
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={styles.linkBlock}>
                <View
                  style={[
                    styles.jobThumb,
                    { backgroundColor: colors.surfaceContainerHigh },
                  ]}
                >
                  <Icon name="receipt-long" size={28} color={colors.outline} />
                </View>
                <Text style={[styles.linkSub, { color: colors.textMuted }]}>
                  No linked gems
                </Text>
              </View>
            )}
          </Animated.View>
        </ScreenInset>

        {/* Settlement progress */}
        <ScreenInset>
          <Animated.View
            entering={FadeInDown.delay(100).duration(300)}
            style={[
              styles.progressCard,
              { backgroundColor: colors.surfaceContainerLowest },
            ]}
          >
            <View style={styles.progressHead}>
              <Text style={[styles.progressTitle, { color: colors.onSurface }]}>
                Settlement
              </Text>
              <Text
                style={[
                  styles.progressPct,
                  {
                    color:
                      settlePct >= 100
                        ? colors.successEmerald
                        : bill.status === "overdue"
                          ? colors.error
                          : colors.primary,
                  },
                ]}
              >
                {settlePct}%
              </Text>
            </View>
            <View
              style={[
                styles.track,
                { backgroundColor: colors.surfaceContainerHigh },
              ]}
            >
              <Animated.View
                entering={FadeIn.delay(180).duration(420)}
                style={[
                  styles.fill,
                  {
                    width: `${settlePct}%`,
                    backgroundColor:
                      settlePct >= 100
                        ? colors.successEmerald
                        : bill.status === "overdue"
                          ? colors.error
                          : colors.primary,
                  },
                ]}
              />
            </View>
            <View style={styles.moneyRow}>
              <View style={styles.moneyCol}>
                <Text style={[styles.moneyLabel, { color: colors.textMuted }]}>
                  Face
                </Text>
                <Text
                  style={[styles.moneyValue, { color: colors.onSurface }]}
                  selectable
                >
                  {formatStored(faceStored)}
                </Text>
              </View>
              <View style={styles.moneyCol}>
                <Text style={[styles.moneyLabel, { color: colors.textMuted }]}>
                  Settled
                </Text>
                <Text
                  style={[
                    styles.moneyValue,
                    { color: colors.successEmerald },
                  ]}
                  selectable
                >
                  {formatStored(settledStored)}
                </Text>
              </View>
              <View style={styles.moneyCol}>
                <Text style={[styles.moneyLabel, { color: colors.textMuted }]}>
                  Left
                </Text>
                <Text
                  style={[
                    styles.moneyValue,
                    {
                      color: remaining > 0 ? colors.primary : colors.textMuted,
                    },
                  ]}
                  selectable
                >
                  {formatStored(remainingStored)}
                </Text>
              </View>
            </View>
          </Animated.View>
        </ScreenInset>

        {commissionOnFace > 0 ? (
          <ScreenInset>
            <Animated.View
              entering={FadeInDown.delay(120).duration(280)}
              style={styles.commissionRow}
            >
              <View
                style={[
                  styles.commissionCard,
                  { backgroundColor: colors.surfaceContainerLow },
                ]}
              >
                <Icon name="percent" size={18} color={colors.onSurfaceVariant} />
                <View style={styles.commissionBody}>
                  <Text
                    style={[styles.commissionLabel, { color: colors.textMuted }]}
                  >
                    {isPayable
                      ? `Your cut (${bill.commissionPercent}%)`
                      : `Their cut (${bill.commissionPercent}%)`}
                  </Text>
                  <Text
                    style={[styles.commissionValue, { color: colors.onSurface }]}
                    selectable
                  >
                    {formatFace(commissionOnFace, bill.currency)}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.commissionCard,
                  { backgroundColor: colors.surfaceContainerLow },
                ]}
              >
                <Icon
                  name={isPayable ? "payments" : "account-balance-wallet"}
                  size={18}
                  color={colors.primary}
                />
                <View style={styles.commissionBody}>
                  <Text
                    style={[styles.commissionLabel, { color: colors.textMuted }]}
                  >
                    {isPayable ? "You pay" : "You keep"}
                  </Text>
                  <Text
                    style={[styles.commissionValue, { color: colors.primary }]}
                    selectable
                  >
                    {formatFace(netOnFace, bill.currency)}
                  </Text>
                </View>
              </View>
            </Animated.View>
          </ScreenInset>
        ) : null}

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

        {bill.notes ? (
          <FormSection title="Notes">
            <Text
              style={[styles.notes, { color: colors.onSurfaceVariant }]}
              selectable
            >
              {bill.notes}
            </Text>
          </FormSection>
        ) : null}

        {open ? (
          <ScreenInset style={styles.bottomActions}>
            <Animated.View entering={FadeInDown.delay(200).duration(280)}>
              <Pressable
                onPress={() => openPayForm(remaining)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.primary,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={isPayable ? "Record payment" : "Record receipt"}
              >
                <View
                  style={[
                    styles.actionIconWrap,
                    { backgroundColor: colors.primary + "22" },
                  ]}
                >
                  <Icon name="check-circle" size={20} color={colors.primary} />
                </View>
                <View style={styles.actionTextCol}>
                  <Text
                    style={[styles.actionTitle, { color: colors.onSurface }]}
                  >
                    {isPayable ? "Mark paid" : "Mark received"}
                  </Text>
                  <Text style={[styles.actionSub, { color: colors.textMuted }]}>
                    Full or partial · cash, transfer, cheque
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.outline} />
              </Pressable>
            </Animated.View>

            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.error,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cancel bill"
            >
              <View
                style={[
                  styles.actionIconWrap,
                  { backgroundColor: colors.errorContainer },
                ]}
              >
                <Icon name="cancel" size={20} color={colors.error} />
              </View>
              <View style={styles.actionTextCol}>
                <Text style={[styles.actionTitle, { color: colors.error }]}>
                  Cancel bill
                </Text>
                <Text style={[styles.actionSub, { color: colors.textMuted }]}>
                  Close without settling
                </Text>
              </View>
            </Pressable>
          </ScreenInset>
        ) : null}
      </ThemedScrollView>

      <BottomSheet
        visible={paySheetOpen}
        onClose={() => setPaySheetOpen(false)}
        title={isPayable ? "Record payment" : "Record receipt"}
        footer={
          <Button
            title={
              payMethod === "cheque"
                ? "Continue with cheque"
                : isPayable
                  ? "Paid"
                  : "Received"
            }
            icon={
              payMethod === "cheque" ? "money-check-dollar" : "check-circle"
            }
            onPress={handleRecordPayment}
          />
        }
      >
        <View style={styles.payHero}>
          <ContactAvatar
            name={contactName}
            photoUrl={contactPhoto}
            size={64}
          />
          <Icon
            name={isPayable ? "call-made" : "call-received"}
            size={22}
            color={isPayable ? colors.error : colors.primary}
          />
          <Text
            style={[
              styles.payHeroAmount,
              { color: isPayable ? colors.error : colors.primary },
            ]}
            selectable
          >
            {formatStored(remainingStored)}
          </Text>
        </View>

        <MaskedInput
          label="Amount"
          mode="currency"
          value={paymentAmount}
          onChangeText={(v) => {
            setPaymentAmount(v);
            setPaymentError(null);
          }}
          placeholder={String(remaining)}
          leftIcon="payments"
          error={paymentError ?? undefined}
        />
        <ChipSelect
          label="How was it paid?"
          options={PAY_METHODS}
          value={payMethod}
          onChange={setPayMethod}
          layout="split"
        />
      </BottomSheet>
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
  linkBlock: {
    alignItems: "center",
    gap: 8,
    maxWidth: "80%",
  },
  jobThumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  linkTitle: {
    ...Typography.labelMd,
    fontWeight: "700",
    textAlign: "center",
  },
  linkSub: {
    ...Typography.bodyMd,
    fontSize: 13,
    textAlign: "center",
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },

  progressCard: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  progressHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressTitle: { ...Typography.labelMd, fontWeight: "700" },
  progressPct: {
    ...Typography.labelMd,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  moneyRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  moneyCol: { flex: 1, gap: 2 },
  moneyLabel: {
    ...Typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  moneyValue: {
    ...Typography.bodyMd,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  commissionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  commissionCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  commissionBody: { flex: 1, gap: 2, minWidth: 0 },
  commissionLabel: { ...Typography.caption },
  commissionValue: {
    ...Typography.labelMd,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

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

  notes: { ...Typography.bodyMd, lineHeight: 22 },

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

  payHero: {
    alignItems: "center",
    gap: 10,
    paddingVertical: Spacing.md,
  },
  payHeroAmount: {
    ...Typography.headlineSm,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
