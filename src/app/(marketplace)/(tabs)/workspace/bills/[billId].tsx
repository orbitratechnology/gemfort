import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  Accent,
  Callout,
  DetailBand,
  DetailHeader,
  DetailRows,
  IconBubble,
  KeyStats,
  StatusChip,
  StatusGrid,
  TintHero,
  TitleBand,
  TotalRow,
  detailStyles,
  useCollapsingHeader,
  type DetailRowProps,
} from "@/components/ui/detail-kit";
import { Icon, type IconName } from "@/components/ui/icon";
import { MaskedInput } from "@/components/ui/masked-input";
import { ReceiptField } from "@/components/ui/receipt-field";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { JOB_STATUS_LABELS } from "@/components/workspace/job-picker-sheet";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemArtwork } from "@/components/workspace/gem-artwork";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { PaymentMethodPicker } from "@/components/workspace/payment-method-picker";
import { FontFamily, Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import { paymentMethodOptions } from "@/constants/payment-methods";
import { fetchBusinesses } from "@/features/marketplace/marketplace-service";
import { fetchLapidaryJobs } from "@/features/marketplace/request-service";
import {
  BILL_DIRECTION_LABELS,
  BILL_STATUS_LABELS,
  billCommissionAmount,
  billGemIds,
  billNetAfterCommission,
  daysUntilDue,
  dueLabel,
  isOpenBill,
  remainingAmount,
} from "@/features/workspace/bill-utils";
import {
  subscribeBill,
  subscribeContacts,
  subscribeGems,
  subscribeLapidaryJobs,
  subscribePayments,
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
  fetchPayments,
  recordBillPayment,
  updateBillStatus,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePendingAction } from "@/hooks/use-pending-action";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import { uploadReceipt } from "@/lib/firebase/receipt-service";
import type { LocalMedia } from "@/lib/firebase/storage-service";
import {
  formatDate,
  formatRelativeDue,
  openPhone,
  openWhatsApp,
  toJsDate,
} from "@/lib/utils";
import { parseForm, recordPaymentSchema } from "@/lib/validation/form-schemas";
import { useAuth } from "@/providers/auth-provider";
import { confirm } from "@/providers/confirm-bridge";
import { useToast } from "@/providers/toast-provider";
import type {
  ApPaymentMethod,
  Bill,
  BillStatus,
  WorkspaceGem,
} from "@/types";

const PAY_METHODS = paymentMethodOptions(["cash", "transfer", "cheque"] as const);
/** Labels/icons for any method a recorded payment may carry. */
const PAYMENT_METHOD_META = paymentMethodOptions([
  "cash",
  "card",
  "transfer",
  "bank_transfer",
  "cheque",
  "bill",
  "other",
] as const);

type StepState = "done" | "active" | "pending" | "overdue";

/** Status → semantic accent (amber unpaid, violet work, rose overdue…). */
const STATUS_ACCENT: Record<BillStatus, string> = {
  open: Accent.amber,
  partial: Accent.amber,
  ongoing: Accent.violet,
  overdue: Accent.rose,
  paid: Accent.emerald,
  cancelled: Accent.slate,
};

const STATUS_ICON: Record<BillStatus, IconName> = {
  open: "receipt-long",
  partial: "sync",
  ongoing: "sync",
  overdue: "error-outline",
  paid: "check-circle",
  cancelled: "cancel",
};

const STEP_META: Record<StepState, { icon: IconName; accent: string }> = {
  done: { icon: "check-circle", accent: Accent.emerald },
  active: { icon: "schedule", accent: Accent.amber },
  overdue: { icon: "error-outline", accent: Accent.rose },
  pending: { icon: "radio-button-unchecked", accent: Accent.slate },
};

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

/** Receipts can be photos or PDFs; only photos can fill the hero. */
function isPdfUrl(url: string): boolean {
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    // keep the raw URL
  }
  return /\.pdf($|[?#])/i.test(decoded);
}

function paymentMethodMeta(method: string | null): {
  label: string;
  icon: IconName;
} {
  const hit = PAYMENT_METHOD_META.find((m) => m.value === method);
  if (hit) {
    return {
      label: hit.label,
      icon:
        hit.icon ??
        (method === "cheque" ? "money-check-dollar" : "receipt-long"),
    };
  }
  const label = method
    ? method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, " ")
    : "Payment";
  return { label, icon: "payments" };
}

/** Gem photo, else the gem's artwork on its own colour. */
function GemLeading({ gem, label }: { gem: WorkspaceGem | undefined; label: string }) {
  const photo = gemPrimaryPhotoUrl(gem);
  if (photo || !gem) {
    return <GemThumb uri={photo} label={label} size={44} radius={12} />;
  }
  return <GemArtwork gem={gem} artScale={0.8} style={styles.gemArt} />;
}

export default function BillDetailScreen() {
  const { billId } = useLocalSearchParams<{ billId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { formatStored, formatFace } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [payMethod, setPayMethod] = useState<ApPaymentMethod>("cash");
  const [paymentReceipt, setPaymentReceipt] = useState<LocalMedia | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const { data: bill, isLoading } = useFirestoreLiveQuery({
    queryKey: ["bill", billId],
    queryFn: () => fetchBill(billId!),
    subscribe: (onData, onError) => subscribeBill(billId!, onData, onError),
    enabled: !!billId,
  });

  const receiptUrl = bill?.receiptUrl?.trim() || null;
  const receiptIsPdf = receiptUrl ? isPdfUrl(receiptUrl) : false;
  const heroImage = receiptUrl && !receiptIsPdf ? receiptUrl : null;
  const heroHeight = Math.round(windowWidth * (heroImage ? 0.9 : 0.62));
  // Floating hero controls become a solid titled bar once the hero scrolls away.
  const { solid: headerSolid, scrollProps } = useCollapsingHeader(heroHeight);

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

  // Payment history lives in the owner's payments ledger, linked by billId.
  const isOwner = !!user && !!bill && user.uid === bill.ownerUid;
  const { data: payments = [] } = useFirestoreLiveQuery({
    queryKey: ["payments", bill?.ownerUid],
    queryFn: () => fetchPayments(bill!.ownerUid),
    subscribe: (onData, onError) =>
      subscribePayments(bill!.ownerUid, onData, onError),
    enabled: isOwner,
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

  const [recordingPayment, handleRecordPayment] = usePendingAction(async () => {
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
      const receiptUrl = await uploadReceipt(user.uid, paymentReceipt);
      await recordBillPayment(user.uid, bill.id, result.data.amount, {
        currency: bill.currency,
        paymentMethod: payMethod,
        receiptUrl,
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
      setPaymentReceipt(null);
    } catch (e) {
      toast.error(friendlyError(e, "Payment could not be recorded."));
    }
  });

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
  const isOverdue =
    bill.status === "overdue" || (open && daysUntilDue(bill) < 0);
  const commissionOnFace = billCommissionAmount(
    bill.amount,
    bill.commissionPercent,
  );
  const netOnFace = billNetAfterCommission(
    bill.amount,
    bill.commissionPercent,
  );
  const linkedGemIds = billGemIds(bill);
  const steps = billTimelineSteps(bill);
  const settlePct =
    bill.amount > 0
      ? Math.min(100, Math.round((bill.amountSettled / bill.amount) * 100))
      : bill.status === "paid"
        ? 100
        : 0;

  const statusAccent = STATUS_ACCENT[bill.status];
  const heroAccent = isOverdue ? Accent.rose : statusAccent;
  const balanceAccent = !open
    ? colors.textMuted
    : isOverdue
      ? Accent.rose
      : Accent.amber;
  const progressAccent =
    settlePct >= 100 ? Accent.emerald : isOverdue ? Accent.rose : Accent.amber;
  const billNo = bill.id.slice(-6).toUpperCase();
  const settledWord = isPayable ? "Paid" : "Received";

  const phone = contact?.phone?.trim() || null;
  const whatsapp =
    contact?.whatsapp?.trim() || contact?.phone?.trim() || null;

  const billPayments = payments
    .filter((p) => p.billId === bill.id)
    .sort(
      (a, b) =>
        (toJsDate(b.paymentDate ?? b.createdAt)?.getTime() ?? 0) -
        (toJsDate(a.paymentDate ?? a.createdAt)?.getTime() ?? 0),
    );

  const openReceipt = (url: string) => () => void Linking.openURL(url);

  // ─── Line items ──────────────────────────────────────────────────────
  const itemRows: ({ key: string } & DetailRowProps)[] = [];
  if (bill.jobId) {
    const jobLabel = linkedJob?.gemName ?? "Lapidary job";
    itemRows.push({
      key: "job",
      leading: linkedJob?.gemPhotoUrl ? (
        <GemThumb uri={linkedJob.gemPhotoUrl} label={jobLabel} size={44} radius={12} />
      ) : (
        <IconBubble icon="handyman" accent={Accent.violet} size={44} />
      ),
      label: jobLabel,
      hint: linkedJob?.serviceTypes?.length
        ? linkedJob.serviceTypes.join(", ")
        : null,
      value: linkedJob ? JOB_STATUS_LABELS[linkedJob.status] : "—",
    });
  } else {
    for (const id of linkedGemIds) {
      const gem = gems.find((g) => g.id === id);
      const label =
        gem?.title?.trim() ||
        gem?.variety?.trim() ||
        (gem ? formatGemType(gem.gemType) : null) ||
        gem?.sku ||
        id.slice(0, 8);
      itemRows.push({
        key: `gem-${id}`,
        leading: <GemLeading gem={gem} label={label} />,
        label,
        hint: gem
          ? [formatGemType(gem.gemType), gem.variety?.trim()]
              .filter(Boolean)
              .join(" · ")
          : null,
        value: gem ? `${gem.currentWeight} ct` : "",
        onPress: () =>
          router.push(`/(marketplace)/(tabs)/workspace/gems/${id}` as never),
      });
    }
  }
  if (commissionOnFace > 0) {
    itemRows.push(
      {
        key: "face",
        icon: "receipt-long",
        accent: colors.onSurfaceVariant,
        label: "Bill amount",
        value: formatStored(faceStored),
      },
      {
        key: "commission",
        icon: "percent",
        accent: isPayable ? Accent.emerald : Accent.rose,
        label: isPayable
          ? `Your cut (${bill.commissionPercent}%)`
          : `Their cut (${bill.commissionPercent}%)`,
        value: formatFace(commissionOnFace, bill.currency),
      },
    );
  }

  // ─── Payments ────────────────────────────────────────────────────────
  const paymentRows: ({ key: string } & DetailRowProps)[] = billPayments.map(
    (p) => {
      const method = paymentMethodMeta(p.paymentMethod);
      const receipt = p.receiptUrl?.trim() || null;
      return {
        key: p.id,
        icon: method.icon,
        accent: Accent.emerald,
        label: method.label,
        hint: `${formatDate(p.paymentDate ?? p.createdAt)}${receipt ? " · Receipt" : ""}`,
        value: formatStored({
          amount: p.amount,
          currency: p.currency,
          amountBase: p.amountBase,
        }),
        onPress: receipt ? openReceipt(receipt) : undefined,
      };
    },
  );

  const bottomBarPad = Math.max(insets.bottom, 12);

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar style={heroImage && !headerSolid ? "light" : "auto"} />

      <ThemedScrollView
        contentContainerStyle={
          open
            ? { paddingBottom: 96 + bottomBarPad }
            : detailStyles.scrollContent
        }
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        {heroImage ? (
          <Pressable
            onPress={openReceipt(heroImage)}
            accessibilityRole="imagebutton"
            accessibilityLabel="Open bill receipt"
          >
            <Image
              source={{ uri: heroImage }}
              style={{ width: windowWidth, height: heroHeight }}
              contentFit="cover"
              recyclingKey={heroImage}
              accessibilityIgnoresInvertColors
            />
          </Pressable>
        ) : (
          <TintHero accent={heroAccent} icon="receipt-long" height={heroHeight} />
        )}

        <TitleBand
          overlapHero
          chips={
            <>
              <StatusChip label={BILL_STATUS_LABELS[bill.status]} accent={statusAccent} />
              <StatusChip label={directionLabel} accent={Accent.blue} />
            </>
          }
          title={contactName}
          subtitle={`Bill #${billNo} · ${formatDate(bill.createdAt)}`}
        >
          <KeyStats
            items={[
              { label: "Total", value: formatStored(faceStored) },
              {
                label: settledWord,
                value: formatStored(settledStored),
                sub: `${settlePct}%`,
                color: bill.amountSettled > 0 ? Accent.emerald : colors.textMuted,
              },
              {
                label: "Balance",
                value: formatStored(remainingStored),
                color: remaining > 0 ? balanceAccent : colors.textMuted,
              },
            ]}
          />
          <View
            style={[styles.track, { backgroundColor: colors.surfaceContainerHigh }]}
            accessibilityRole="progressbar"
            accessibilityLabel={`${settlePct}% settled`}
          >
            <View
              style={[
                styles.fill,
                { width: `${settlePct}%`, backgroundColor: progressAccent },
              ]}
            />
          </View>
          {open ? (
            <Callout
              icon={isOverdue ? "error-outline" : "schedule"}
              accent={isOverdue ? Accent.rose : statusAccent}
              label={
                isOverdue
                  ? isPayable
                    ? "Overdue · balance due"
                    : "Overdue · balance to collect"
                  : isPayable
                    ? "Balance due"
                    : "Balance to collect"
              }
              value={formatStored(remainingStored)}
              pill={dueLabel(bill)}
            />
          ) : bill.status === "paid" ? (
            <Callout
              icon="check-circle"
              accent={Accent.emerald}
              label="Fully settled"
              value={formatStored(faceStored)}
            />
          ) : (
            <Callout
              icon="cancel"
              accent={Accent.slate}
              label="Cancelled · left unsettled"
              value={formatStored(remainingStored)}
            />
          )}
        </TitleBand>

        <DetailBand title="Status">
          <StatusGrid
            tiles={[
              {
                icon: STATUS_ICON[bill.status],
                label: "Status",
                value: BILL_STATUS_LABELS[bill.status],
                accent: statusAccent,
              },
              {
                icon: "event",
                label: "Due",
                value: open ? dueLabel(bill) : formatDate(bill.dueDate),
                accent: open ? (isOverdue ? Accent.rose : Accent.amber) : Accent.slate,
              },
              {
                icon: isPayable ? "call-made" : "call-received",
                label: "Direction",
                value: isPayable ? "You owe them" : "They owe you",
                accent: Accent.blue,
              },
              {
                icon: "donut-large",
                label: "Settled",
                value: `${settlePct}%`,
                accent: settlePct > 0 ? Accent.emerald : Accent.slate,
              },
            ]}
          />
        </DetailBand>

        <DetailBand title={bill.jobId ? "Job" : "Items"}>
          {itemRows.length ? (
            <DetailRows rows={itemRows} />
          ) : (
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              No linked gems
            </Text>
          )}
          {commissionOnFace > 0 ? (
            <TotalRow
              label={isPayable ? "You pay" : "You keep"}
              value={formatFace(netOnFace, bill.currency)}
            />
          ) : (
            <TotalRow label="Total" value={formatStored(faceStored)} />
          )}
        </DetailBand>

        {isOwner ? (
          <DetailBand title="Payments">
            {paymentRows.length ? (
              <DetailRows rows={paymentRows} />
            ) : (
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                {open
                  ? isPayable
                    ? "No payments recorded yet"
                    : "Nothing received yet"
                  : "No payments recorded"}
              </Text>
            )}
            <TotalRow
              label={`${settledWord} so far`}
              value={formatStored(settledStored)}
              accent={bill.amountSettled > 0 ? Accent.emerald : undefined}
            />
          </DetailBand>
        ) : null}

        <DetailBand title={isPayable ? "Pay to" : "Collect from"}>
          <Pressable
            style={({ pressed }) => [styles.partyRow, pressed && styles.pressed]}
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
            <ContactAvatar name={contactName} photoUrl={contactPhoto} size={48} />
            <View style={styles.partyCopy}>
              <Text
                style={[styles.partyName, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                {contactName}
              </Text>
              <Text style={[styles.partyRole, { color: colors.onSurfaceVariant }]}>
                {isPayable ? "You owe them" : "They owe you"}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.outline} />
          </Pressable>
          {phone || whatsapp ? (
            <View style={styles.partyActions}>
              {phone ? (
                <Button
                  title="Call"
                  icon="call"
                  variant="phone"
                  accessibilityLabel="Call contact"
                  onPress={() => void Linking.openURL(openPhone(phone))}
                  style={styles.flex}
                />
              ) : null}
              {whatsapp ? (
                <Button
                  title="WhatsApp"
                  icon="whatsapp"
                  variant="whatsapp"
                  accessibilityLabel="WhatsApp contact"
                  onPress={() => void Linking.openURL(openWhatsApp(whatsapp))}
                  style={styles.flex}
                />
              ) : null}
            </View>
          ) : null}
        </DetailBand>

        <DetailBand title="Timeline">
          <DetailRows
            rows={steps.map((step) => ({
              key: step.key,
              icon: STEP_META[step.state].icon,
              accent: STEP_META[step.state].accent,
              label: step.label,
              value: step.sub,
            }))}
          />
        </DetailBand>

        {bill.notes ? (
          <DetailBand title="Notes">
            <Text
              style={[styles.notes, { color: colors.onSurfaceVariant }]}
              selectable={false}
            >
              {bill.notes}
            </Text>
          </DetailBand>
        ) : null}

        {receiptUrl ? (
          <DetailBand title="Attachments">
            <DetailRows
              rows={[
                {
                  key: "receipt",
                  icon: receiptIsPdf ? "picture-as-pdf" : "image",
                  accent: Accent.blue,
                  label: "Bill receipt",
                  hint: receiptIsPdf ? "PDF document" : "Photo",
                  value: "Open",
                  onPress: openReceipt(receiptUrl),
                },
              ]}
            />
          </DetailBand>
        ) : null}
      </ThemedScrollView>

      <DetailHeader title={contactName} solid={headerSolid} />

      {open ? (
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
          <Button
            title="Cancel bill"
            icon="cancel"
            variant="secondary"
            iconColor={colors.error}
            textStyle={{ color: colors.error }}
            accessibilityLabel="Cancel bill"
            onPress={handleCancel}
            style={[styles.flex, { borderColor: colors.error }]}
          />
          <Button
            title={isPayable ? "Mark paid" : "Mark received"}
            icon="check-circle"
            accessibilityLabel={isPayable ? "Record payment" : "Record receipt"}
            onPress={() => openPayForm(remaining)}
            style={styles.flex}
          />
        </View>
      ) : null}

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
              payMethod === "cheque" ? "cheque" : "check-circle"
            }
            loading={recordingPayment}
            onPress={handleRecordPayment}
          />
        }
      >
        <DetailRows
          rows={[
            {
              key: "party",
              leading: (
                <ContactAvatar name={contactName} photoUrl={contactPhoto} size={40} />
              ),
              label: isPayable ? "Pay to" : "Collect from",
              value: contactName,
            },
            {
              key: "total",
              icon: "receipt-long",
              accent: colors.onSurfaceVariant,
              label: "Bill total",
              value: formatStored(faceStored),
            },
            {
              key: "settled",
              icon: "check-circle",
              accent: Accent.emerald,
              label: `${settledWord} so far`,
              value: formatStored(settledStored),
            },
          ]}
        />
        <Callout
          icon={isPayable ? "call-made" : "call-received"}
          accent={isOverdue ? Accent.rose : Accent.amber}
          label={isPayable ? "Balance due" : "Balance to collect"}
          value={formatStored(remainingStored)}
          pill={open ? dueLabel(bill) : null}
          style={styles.sheetCallout}
        />

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
        <PaymentMethodPicker
          label="How was it paid?"
          options={PAY_METHODS}
          value={payMethod}
          onChange={setPayMethod}
        />
        <ReceiptField value={paymentReceipt} onChange={setPaymentReceipt} />
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

  track: {
    height: 6,
    marginTop: Spacing.md,
    borderRadius: Radius.full,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: Radius.full },

  gemArt: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderCurve: "continuous",
  },

  partyRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  partyCopy: { flex: 1, minWidth: 0, gap: 2 },
  partyName: { ...text, fontFamily: FontFamily.semibold, fontSize: 16, lineHeight: 22 },
  partyRole: { ...text, fontFamily: FontFamily.regular, fontSize: 13 },
  partyActions: { flexDirection: "row", gap: Spacing.sm },

  notes: { ...text, ...Typography.bodyMd, fontSize: 15, lineHeight: 24 },
  emptyHint: { ...text, ...Typography.bodyMd },

  sheetCallout: { marginTop: 0, marginBottom: Spacing.sm },
});
