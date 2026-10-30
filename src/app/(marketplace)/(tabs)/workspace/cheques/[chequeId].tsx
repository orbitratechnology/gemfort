import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  Accent,
  Callout,
  DetailBand,
  DetailHeader,
  DetailRows,
  KeyStats,
  StatusChip,
  TintHero,
  TitleBand,
  detailStyles,
  useCollapsingHeader,
  type DetailRowProps,
} from "@/components/ui/detail-kit";
import { Icon, type IconName } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { BankAvatar } from "@/components/workspace/bank-picker-sheet";
import {
  CHEQUE_STATUS_ACCENT,
  CHEQUE_STATUS_ICON,
  ChequePreviewCard,
} from "@/components/workspace/cheque-preview-card";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { FontFamily, Palette, Radius, Spacing } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import { getBankByCode, getBankByName } from "@/constants/sri-lanka-banks";
import { fetchBusinesses } from "@/features/marketplace/marketplace-service";
import {
  CHEQUE_STATUS_LABELS,
  daysUntilMaturity,
  maturityLabel,
  toDate,
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
  formatRelativeTime,
  openPhone,
  openWhatsApp,
} from "@/lib/utils";
import { confirm } from "@/providers/confirm-bridge";
import { useToast } from "@/providers/toast-provider";
import type { Cheque, ChequeStatus } from "@/types";

type StepState = "done" | "active" | "pending" | "overdue";
type TimelineStep = { key: string; label: string; sub: string; state: StepState };

/** Estimated cheque height until the hero card reports its real size. */
const INITIAL_CARD_HEIGHT = 236;

function chequeTimelineSteps(cheque: Cheque): TimelineStep[] {
  const status = cheque.status;
  const cleared = status === "cleared";
  const bounced = status === "bounced";
  const cancelled = status === "cancelled" || status === "replaced";
  const deposited = status === "deposited" || cleared || bounced;
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

/** Headline callout under the title: what the cheque is waiting on. */
function statusCallout(cheque: Cheque): {
  icon: IconName;
  accent: string;
  label: string;
  value: string;
  pill?: string | null;
} {
  const maturity = toDate(cheque.maturityDate);
  const shortMaturity = maturity ? format(maturity, "d MMM") : null;
  switch (cheque.status) {
    case "holding": {
      const days = daysUntilMaturity(cheque);
      if (days > 0) {
        return {
          icon: "event",
          accent: Accent.amber,
          label: "Matures",
          value: maturityLabel(cheque),
          pill: shortMaturity,
        };
      }
      if (days === 0) {
        return {
          icon: "event-available",
          accent: Accent.amber,
          label: "Maturity",
          value: "Matures today",
        };
      }
      return {
        icon: "event-busy",
        accent: Accent.amber,
        label: "Matured · awaiting deposit",
        value: maturityLabel(cheque),
        pill: shortMaturity,
      };
    }
    case "deposited":
      return {
        icon: "account-balance",
        accent: Accent.blue,
        label: "Deposited · awaiting clearance",
        value: cheque.depositedDate
          ? formatRelativeTime(cheque.depositedDate)
          : "With the bank",
      };
    case "cleared":
      return {
        icon: "check-circle",
        accent: Accent.emerald,
        label: "Cleared",
        value: cheque.clearedDate
          ? formatRelativeTime(cheque.clearedDate)
          : "Funds received",
      };
    case "bounced":
      return {
        icon: "error-outline",
        accent: Accent.rose,
        label: "Bounced",
        value: cheque.bouncedReason?.trim() || "Did not clear",
      };
    default:
      return {
        icon: CHEQUE_STATUS_ICON[cheque.status],
        accent: Accent.slate,
        label: CHEQUE_STATUS_LABELS[cheque.status],
        value: "No longer pending",
      };
  }
}

function ChequeTimeline({
  steps,
  activeAccent,
  doneAccent,
}: {
  steps: TimelineStep[];
  activeAccent: string;
  doneAccent: string;
}) {
  const { colors } = useAppTheme();
  const toneFor = (state: StepState) =>
    state === "overdue"
      ? Accent.rose
      : state === "active"
        ? activeAccent
        : state === "done"
          ? doneAccent
          : colors.outlineVariant;

  return (
    <View>
      {steps.map((step, i) => {
        const reached = step.state !== "pending";
        const tone = toneFor(step.state);
        const next = steps[i + 1];
        const isLast = !next;
        return (
          <View key={step.key} style={styles.stepRow}>
            <View style={styles.stepRail}>
              <View
                style={[
                  styles.stepDot,
                  reached
                    ? { backgroundColor: tone }
                    : {
                        backgroundColor: colors.surfaceContainerLowest,
                        borderWidth: 2,
                        borderColor: colors.outlineVariant,
                      },
                ]}
              >
                {step.state === "done" ? (
                  <Icon name="check" size={14} color="#FFFFFF" />
                ) : step.state === "active" ? (
                  <View style={styles.stepPulse} />
                ) : step.state === "overdue" ? (
                  <Icon name="priority-high" size={14} color="#FFFFFF" />
                ) : null}
              </View>
              {!isLast ? (
                <View
                  style={[
                    styles.stepLine,
                    {
                      backgroundColor:
                        next.state !== "pending"
                          ? toneFor(next.state)
                          : colors.outlineVariant,
                    },
                  ]}
                />
              ) : null}
            </View>
            <View style={[styles.stepBody, !isLast && styles.stepBodySpaced]}>
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color:
                      step.state === "overdue"
                        ? Accent.rose
                        : reached
                          ? colors.onSurface
                          : colors.textMuted,
                  },
                ]}
              >
                {step.label}
              </Text>
              <Text
                style={[styles.stepSub, { color: colors.onSurfaceVariant }]}
                selectable={false}
              >
                {step.sub}
              </Text>
            </View>
            {step.state === "active" ? (
              <StatusChip label="Now" accent={tone} size="sm" />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export default function ChequeDetailScreen() {
  const { chequeId } = useLocalSearchParams<{ chequeId: string }>();
  const { colors } = useAppTheme();
  const { formatStored } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  // Status update in flight, so only the tapped action spins.
  const [pendingStatus, setPendingStatus] = useState<ChequeStatus | null>(
    null,
  );
  const pendingRef = useRef(false);
  const busy = pendingStatus !== null;
  const [bounceReason, setBounceReason] = useState("");
  const [showBounceForm, setShowBounceForm] = useState(false);
  const [cardHeight, setCardHeight] = useState(INITIAL_CARD_HEIGHT);
  // Hero = status bar + header clearance + cheque + room for the title band.
  const heroHeight = insets.top + 112 + cardHeight;
  const { solid: headerSolid, scrollProps } = useCollapsingHeader(heroHeight);

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
          try {
            await updateChequeStatus(cheque.id, "cancelled");
            await queryClient.invalidateQueries({ queryKey: ["cheques"] });
            await queryClient.invalidateQueries({
              queryKey: ["cheque", chequeId],
            });
            await queryClient.invalidateQueries({ queryKey: ["notifications"] });
            toast.success(
              `Cheque marked as ${CHEQUE_STATUS_LABELS.cancelled.toLowerCase()}.`,
            );
          } catch (error) {
            toast.error(friendlyError(error, "Could not cancel cheque."));
            throw error;
          }
        },
      });
      return;
    }

    await applyStatus(status);
  }

  async function applyStatus(status: ChequeStatus, reason?: string) {
    if (!cheque || pendingRef.current) return;
    pendingRef.current = true;
    setPendingStatus(status);
    try {
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
    } catch (e) {
      toast.error(friendlyError(e, "Could not update status."));
    } finally {
      pendingRef.current = false;
      setPendingStatus(null);
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

  function handleCardLayout(e: LayoutChangeEvent) {
    const next = Math.ceil(e.nativeEvent.layout.height);
    setCardHeight((prev) => (Math.abs(prev - next) > 1 ? next : prev));
  }

  if (isLoading || !cheque) {
    return (
      <View
        style={[
          styles.safe,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <StackHeader title="Cheque" />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>
            {isLoading ? "Loading…" : "Cheque not found."}
          </Text>
        </View>
      </View>
    );
  }

  const isBounced = cheque.status === "bounced";
  const isPending =
    cheque.status === "holding" || cheque.status === "deposited";
  const isReceived = cheque.direction === "received";
  const directionLabel = isReceived ? "Taken" : "Given";
  const statusAccent = CHEQUE_STATUS_ACCENT[cheque.status];
  const isClosed =
    cheque.status === "cancelled" || cheque.status === "replaced";
  const steps = chequeTimelineSteps(cheque);
  const callout = statusCallout(cheque);
  const bank =
    getBankByCode(cheque.bankCode) ?? getBankByName(cheque.bankName) ?? null;
  const bankLabel = cheque.bankName || bank?.name || "Bank";
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

  const phone = contact?.phone?.trim() || null;
  const whatsapp =
    contact?.whatsapp?.trim() || contact?.phone?.trim() || null;

  const allStatusActions: {
    status: ChequeStatus;
    label: string;
    icon: IconName;
    tone: "primary" | "danger" | "neutral";
  }[] = [
    {
      status: "deposited",
      label: "Mark deposited",
      icon: "account-balance",
      tone: "primary",
    },
    {
      status: "cleared",
      label: "Mark cleared",
      icon: "check-circle",
      tone: "primary",
    },
    {
      status: "bounced",
      label: "Mark bounced",
      icon: "error-outline",
      tone: "danger",
    },
    {
      status: "cancelled",
      label: "Cancel cheque",
      icon: "cancel",
      tone: "neutral",
    },
  ];
  const directionalStatus = isReceived
    ? isPending
      ? "cleared"
      : null
    : cheque.status === "holding"
      ? "deposited"
      : null;
  const statusActions = allStatusActions.filter(
    (a) =>
      a.status === directionalStatus ||
      (isPending && (a.status === "bounced" || a.status === "cancelled")),
  );
  const primaryAction = statusActions.find((a) => a.tone === "primary");
  const secondaryActions = statusActions.filter((a) => a.tone !== "primary");

  const hasActionBar = (isPending && statusActions.length > 0) || isBounced;
  const bottomBarPad = Math.max(insets.bottom, 12);
  const actionRows =
    isPending && primaryAction && secondaryActions.length ? 2 : 1;
  const scrollBottomPad = hasActionBar
    ? Spacing.md + actionRows * 50 + (actionRows - 1) * Spacing.sm +
      bottomBarPad + 32
    : 48;

  const detailRows: ({ key: string } & DetailRowProps)[] = [
    {
      key: "bank",
      leading: bank ? <BankAvatar bank={bank} size={34} /> : undefined,
      icon: "account-balance",
      accent: Accent.blue,
      label: "Bank",
      value: bankLabel,
    },
    ...(cheque.branch
      ? [
          {
            key: "branch",
            icon: "place" as IconName,
            label: "Branch",
            value: cheque.branch,
          },
        ]
      : []),
    {
      key: "name",
      icon: "person",
      label: isReceived ? "From" : "Pay to",
      hint: "Name on cheque",
      value: cheque.issuedBy || "—",
    },
    ...(cheque.depositedDate
      ? [
          {
            key: "deposited",
            icon: "account-balance" as IconName,
            accent: Accent.blue,
            label: "Deposited",
            value: formatDate(cheque.depositedDate),
          },
        ]
      : []),
    ...(cheque.clearedDate
      ? [
          {
            key: "cleared",
            icon: "check-circle" as IconName,
            accent: Accent.emerald,
            label: "Cleared",
            value: formatDate(cheque.clearedDate),
          },
        ]
      : []),
    ...(gemTitle && cheque.gemId
      ? [
          {
            key: "gem",
            leading: (
              <GemThumb
                uri={gemPrimaryPhotoUrl(gem)}
                label={gemTitle}
                size={34}
                radius={10}
              />
            ),
            label: "Linked gem",
            value: gemTitle,
            onPress: () =>
              router.push(
                `/(marketplace)/(tabs)/workspace/gems/${cheque.gemId}` as never,
              ),
          },
        ]
      : []),
  ];

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ThemedScrollView
        contentContainerStyle={{ paddingBottom: scrollBottomPad }}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        <TintHero accent={statusAccent} height={heroHeight}>
          <View style={styles.heroCardWrap}>
            <View onLayout={handleCardLayout}>
              <ChequePreviewCard
                direction={cheque.direction}
                chequeNumber={cheque.chequeNumber}
                bankName={cheque.bankName}
                bankCode={cheque.bankCode}
                branch={cheque.branch}
                amount={String(cheque.amount)}
                amountLabel={amountLabel}
                issuedBy={cheque.issuedBy}
                maturityDateLabel={formatDate(cheque.maturityDate)}
                accent={statusAccent}
              />
            </View>
          </View>
        </TintHero>

        <TitleBand
          overlapHero
          chips={
            <>
              <StatusChip
                label={CHEQUE_STATUS_LABELS[cheque.status]}
                accent={statusAccent}
              />
              <StatusChip label={directionLabel} accent={Accent.teal} />
            </>
          }
          title={amountLabel}
          subtitle={`${isReceived ? "From" : "To"} ${contactName}`}
        >
          <KeyStats
            items={[
              {
                label: "Matures",
                value: formatDate(cheque.maturityDate),
                sub: maturityLabel(cheque),
              },
              { label: "Issued", value: formatDate(cheque.issueDate) },
              { label: "Cheque no.", value: cheque.chequeNumber || "—" },
            ]}
          />
          <Callout
            icon={callout.icon}
            accent={callout.accent}
            label={callout.label}
            value={callout.value}
            pill={callout.pill}
          />
        </TitleBand>

        <DetailBand title="Progress">
          <ChequeTimeline
            steps={steps}
            activeAccent={statusAccent}
            doneAccent={isClosed ? Accent.slate : Accent.emerald}
          />
        </DetailBand>

        <DetailBand title="Counterparty">
          <View style={styles.partyRow}>
            <Pressable
              style={({ pressed }) => [
                styles.partyMain,
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
                size={48}
              />
              <View style={styles.partyText}>
                <Text
                  style={[styles.partyName, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {contactName}
                </Text>
                <Text
                  style={[styles.partyRole, { color: colors.onSurfaceVariant }]}
                  numberOfLines={1}
                >
                  {isReceived ? "Cheque from them" : "Cheque you gave"}
                </Text>
              </View>
              {!phone && !whatsapp ? (
                <Icon name="chevron-right" size={20} color={colors.outline} />
              ) : null}
            </Pressable>
            {phone ? (
              <Pressable
                onPress={() => void Linking.openURL(openPhone(phone))}
                style={({ pressed }) => [
                  styles.roundBtn,
                  { backgroundColor: `${Accent.blue}1F` },
                  pressed && styles.pressed,
                ]}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel="Call contact"
              >
                <Icon name="call" size={20} color={Accent.blue} />
              </Pressable>
            ) : null}
            {whatsapp ? (
              <Pressable
                onPress={() => void Linking.openURL(openWhatsApp(whatsapp))}
                style={({ pressed }) => [
                  styles.roundBtn,
                  { backgroundColor: `${Palette.whatsapp}1F` },
                  pressed && styles.pressed,
                ]}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel="WhatsApp contact"
              >
                <Icon name="whatsapp" size={20} color={Palette.whatsapp} />
              </Pressable>
            ) : null}
          </View>
        </DetailBand>

        <DetailBand title="Cheque details">
          <DetailRows rows={detailRows} />
        </DetailBand>

        {cheque.photoUrl ? (
          <DetailBand title="Photo">
            <Image
              source={{ uri: cheque.photoUrl }}
              style={[
                styles.photo,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
              contentFit="contain"
              recyclingKey={cheque.photoUrl}
              accessibilityLabel="Cheque photo"
            />
          </DetailBand>
        ) : null}

        {cheque.notes ? (
          <DetailBand title="Notes">
            <Text
              style={[styles.notes, { color: colors.onSurfaceVariant }]}
              selectable={false}
            >
              {cheque.notes}
            </Text>
          </DetailBand>
        ) : null}
      </ThemedScrollView>

      <DetailHeader
        title={`${directionLabel} cheque`}
        solid={headerSolid}
      />

      {hasActionBar ? (
        <View
          style={[
            detailStyles.actionBar,
            styles.actionBarStack,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.outlineVariant,
              paddingBottom: bottomBarPad,
            },
          ]}
        >
          {isPending ? (
            <>
              {primaryAction ? (
                <Button
                  title={primaryAction.label}
                  icon={primaryAction.icon}
                  loading={pendingStatus === primaryAction.status}
                  disabled={busy}
                  onPress={() => void handleStatus(primaryAction.status)}
                  accessibilityState={{
                    disabled: busy,
                    busy: pendingStatus === primaryAction.status,
                  }}
                />
              ) : null}
              {secondaryActions.length ? (
                <View style={styles.actionRow}>
                  {secondaryActions.map((a) => {
                    const tint =
                      a.tone === "danger"
                        ? Accent.rose
                        : colors.onSurfaceVariant;
                    return (
                      <Button
                        key={a.status}
                        title={a.label}
                        icon={a.icon}
                        variant="secondary"
                        iconColor={tint}
                        textStyle={{ color: tint }}
                        loading={pendingStatus === a.status}
                        disabled={busy}
                        onPress={() => void handleStatus(a.status)}
                        style={[
                          styles.actionBtn,
                          { borderColor: colors.outlineVariant },
                        ]}
                      />
                    );
                  })}
                </View>
              ) : null}
            </>
          ) : (
            <Button
              title="Add replacement"
              icon="swap-horiz"
              onPress={handleReplace}
              accessibilityLabel="Add replacement cheque"
              accessibilityHint="Issue a new cheque for the same amount"
            />
          )}
        </View>
      ) : null}

      <BottomSheet
        visible={showBounceForm}
        onClose={() => {
          if (!busy) setShowBounceForm(false);
        }}
        title="Mark bounced"
        footer={
          <View style={styles.actionRow}>
            <Button
              title="Cancel"
              variant="ghost"
              disabled={busy}
              onPress={() => setShowBounceForm(false)}
              style={styles.actionBtn}
            />
            <Button
              title="Confirm bounce"
              icon="error-outline"
              variant="destructive"
              loading={pendingStatus === "bounced"}
              onPress={() => {
                if (!bounceReason.trim()) {
                  toast.error("Enter a reason for the bounce.");
                  return;
                }
                void applyStatus("bounced", bounceReason).then(() =>
                  setShowBounceForm(false),
                );
              }}
              style={styles.actionBtn}
            />
          </View>
        }
      >
        <Callout
          icon="error-outline"
          accent={Accent.rose}
          label={`No. ${cheque.chequeNumber || "—"} · ${bankLabel}`}
          value={amountLabel}
          style={styles.sheetCallout}
        />
        <DetailRows
          rows={[
            {
              key: "party",
              icon: "person",
              label: isReceived ? "From" : "Pay to",
              value: contactName,
            },
            {
              key: "maturity",
              icon: "event",
              label: "Matures",
              value: formatDate(cheque.maturityDate),
            },
          ]}
        />
        <Input
          label="Why did it bounce?"
          value={bounceReason}
          onChangeText={setBounceReason}
          placeholder="Insufficient funds, signature mismatch…"
          leftIcon="notes"
        />
      </BottomSheet>
    </View>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },

  heroCardWrap: {
    width: "100%",
    maxWidth: 480,
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: 40,
    paddingBottom: 48,
  },

  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  stepRail: { width: 26, alignItems: "center", alignSelf: "stretch" },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  stepPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  stepLine: { flex: 1, width: 2, marginVertical: 4, borderRadius: 1 },
  stepBody: { flex: 1, minWidth: 0, gap: 2, paddingTop: 2 },
  stepBodySpaced: { paddingBottom: Spacing.xl },
  stepLabel: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 22 },
  stepSub: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },

  partyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  partyMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
  },
  partyText: { flex: 1, minWidth: 0, gap: 2 },
  partyName: { ...text, fontFamily: FontFamily.semibold, fontSize: 16, lineHeight: 22 },
  partyRole: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  photo: {
    width: "100%",
    height: 220,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },

  notes: { ...text, fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 24 },

  actionBarStack: { flexDirection: "column" },
  actionRow: { flexDirection: "row", gap: Spacing.sm },
  actionBtn: { flex: 1 },
  sheetCallout: { marginTop: 0 },
});
