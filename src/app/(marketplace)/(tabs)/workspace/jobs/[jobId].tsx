import { useQueryClient } from "@tanstack/react-query";
import { addDays, format as formatCalendarDate } from "date-fns";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useRef, useState } from "react";
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

import { Button } from "@/components/ui/button";
import {
  Accent,
  Callout,
  DetailBand,
  DetailHeader,
  DetailRow,
  DetailRows,
  KeyStats,
  StatusChip,
  TintHero,
  TitleBand,
  TotalRow,
  detailStyles,
  useCollapsingHeader,
  type DetailRowProps,
} from "@/components/ui/detail-kit";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { MaskedInput } from "@/components/ui/masked-input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemArtwork, gemTint } from "@/components/workspace/gem-artwork";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { FontFamily, Radius, Spacing, Typography } from "@/constants/design-tokens";
import { WORKSPACE_ENTITY_IMAGES } from "@/constants/workspace-entity-images";
import { formatGemType } from "@/constants/gem-options";
import { fetchBusinesses } from "@/features/marketplace/marketplace-service";
import {
    completeLapidaryJob,
    respondServiceRequest,
    updateLapidaryJobStatus,
} from "@/features/marketplace/request-service";
import {
    subscribeGem,
    subscribeService,
    subscribeVerifiedBusinesses,
} from "@/features/workspace/firestore-subscriptions";
import {
  businessLogoUrl,
  gemPrimaryPhotoUrl,
  resolveBusinessPhotoById,
} from "@/features/workspace/party-photo";
import { respondServiceCancellation } from "@/features/workspace/service-lifecycle-service";
import { fetchGem, fetchService } from "@/features/workspace/workspace-service";
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
  shortGemId,
} from "@/lib/utils";
import {
    completeLapidaryJobSchema,
    parseForm,
} from "@/lib/validation/form-schemas";
import { pushWithAnchor } from "@/navigation/tab-stack-nav";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type { ServiceRecord } from "@/types";

type StepState = "done" | "active" | "pending" | "error";

const WHATSAPP_GREEN = "#25D366";

function serviceIcon(type: string): IconName {
  const normalized = type.toLowerCase();
  if (normalized.includes("heat")) return "local-fire-department";
  if (normalized.includes("polish")) return "auto-fix-high";
  if (normalized.includes("cut")) return "content-cut";
  return "handyman";
}

function titleCase(type: string) {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/** Status label + semantic accent (see `Accent` in the detail kit). */
function statusMeta(status: ServiceRecord["status"]): {
  label: string;
  accent: string;
} {
  switch (status) {
    case "given":
      return { label: "Queued", accent: Accent.amber };
    case "in_progress":
      return { label: "In progress", accent: Accent.blue };
    case "ready":
      return { label: "Ready", accent: Accent.emerald };
    case "received_back":
    case "completed":
      return { label: "Completed", accent: Accent.emerald };
    case "cancellation_requested":
      return { label: "Cancel requested", accent: Accent.amber };
    case "cancelled":
      return { label: "Cancelled", accent: Accent.slate };
    case "rejected":
      return { label: "Declined", accent: Accent.rose };
    default:
      return { label: "Awaiting response", accent: Accent.amber };
  }
}

function progressSteps(service: ServiceRecord): {
  key: string;
  label: string;
  sub: string;
  state: StepState;
}[] {
  const terminal =
    service.status === "received_back" || service.status === "completed";
  const cancelled =
    service.status === "cancelled" || service.status === "rejected";
  const workshopActive =
    service.status === "in_progress" || service.status === "ready";

  return [
    {
      key: "received",
      label: "Received from sender",
      sub: formatDate(service.dateGiven),
      state: service.status === "pending" ? "active" : "done",
    },
    {
      key: "workshop",
      label: cancelled ? "Job cancelled" : "Workshop work",
      sub: cancelled
        ? "No further work is required"
        : workshopActive || terminal
          ? formatRelativeDue(service.expectedReturnDate)
          : "Waiting for workshop acceptance",
      state: cancelled
        ? "error"
        : service.status === "pending"
          ? "pending"
          : workshopActive
            ? "active"
            : "done",
    },
    {
      key: "returned",
      label: "Returned to sender",
      sub: service.dateReturned
        ? formatDate(service.dateReturned)
        : terminal
          ? "Completed"
          : "Awaiting return",
      state: cancelled ? "pending" : terminal ? "done" : "pending",
    },
  ];
}

const STEP_ACCENT: Record<StepState, string> = {
  done: Accent.emerald,
  active: Accent.blue,
  error: Accent.rose,
  pending: Accent.slate,
};

/** Vertical stepper: tinted dots on a hairline rail, label + date beside. */
function ProgressSteps({
  steps,
}: {
  steps: ReturnType<typeof progressSteps>;
}) {
  const { colors } = useAppTheme();
  return (
    <View>
      {steps.map((step, i) => {
        const accent = STEP_ACCENT[step.state];
        const pending = step.state === "pending";
        const next = steps[i + 1];
        const lineColor =
          next && next.state !== "pending"
            ? `${STEP_ACCENT[next.state]}66`
            : colors.outlineVariant;
        return (
          <View key={step.key} style={styles.stepRow}>
            <View style={styles.stepRail}>
              <View
                style={[
                  styles.stepDot,
                  pending
                    ? { borderWidth: 2, borderColor: colors.outlineVariant }
                    : { backgroundColor: accent },
                ]}
              >
                {step.state === "done" ? (
                  <Icon name="check" size={14} color="#FFFFFF" />
                ) : step.state === "error" ? (
                  <Icon name="priority-high" size={14} color="#FFFFFF" />
                ) : step.state === "active" ? (
                  <View style={styles.stepPulse} />
                ) : null}
              </View>
              {next ? (
                <View style={[styles.stepLine, { backgroundColor: lineColor }]} />
              ) : null}
            </View>
            <View style={[styles.stepCopy, !next && styles.stepCopyLast]}>
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color:
                      step.state === "error"
                        ? Accent.rose
                        : pending
                          ? colors.onSurfaceVariant
                          : colors.onSurface,
                  },
                ]}
              >
                {step.label}
              </Text>
              <Text style={[styles.stepSub, { color: colors.textMuted }]}>
                {step.sub}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function LapidaryJobDetailScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { formatFace, preferred } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const heroHeight = Math.round(windowWidth * 0.78);
  const { solid: headerSolid, scrollProps } = useCollapsingHeader(heroHeight);
  const [weightAfter, setWeightAfter] = useState("");
  const [finalCost, setFinalCost] = useState("");
  const [paymentDueDays, setPaymentDueDays] = useState("7");
  const [completionErrors, setCompletionErrors] = useState<Record<string, string>>({});
  // Action in flight, so only the tapped button spins.
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const busy = pendingKey !== null;

  async function track(key: string, work: () => Promise<void>) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPendingKey(key);
    try {
      await work();
    } finally {
      pendingRef.current = false;
      setPendingKey(null);
    }
  }

  const { data: service, isLoading } = useFirestoreLiveQuery({
    queryKey: ["service", jobId],
    queryFn: () => fetchService(jobId!),
    subscribe: (onData, onError) => subscribeService(jobId!, onData, onError),
    enabled: !!jobId,
  });

  const { data: gem } = useFirestoreLiveQuery({
    queryKey: ["gem", service?.gemId],
    queryFn: () => fetchGem(service!.gemId),
    subscribe: (onData, onError) => subscribeGem(service!.gemId, onData, onError),
    enabled: !!service?.gemId,
  });

  const { data: businesses = [] } = useFirestoreLiveQuery({
    queryKey: ["home-businesses"],
    queryFn: () => fetchBusinesses(),
    subscribe: (onData, onError) => subscribeVerifiedBusinesses(onData, onError),
    enabled: !!service,
  });

  const senderBusiness = useMemo(
    () => {
      if (!service) return null;
      return (
        (service.traderBusinessId
          ? businesses.find((business) => business.id === service.traderBusinessId)
          : null)
      );
    },
    [businesses, service],
  );
  const senderBusinessId = senderBusiness?.id ?? service?.traderBusinessId ?? null;
  const senderName =
    service?.traderBusinessName?.trim() ||
    senderBusiness?.businessName?.trim() ||
    (service ? `Trader · ${service.ownerUid.slice(0, 8)}` : "Sender");
  const senderPhoto =
    service?.traderBusinessLogoUrl?.trim() ||
    resolveBusinessPhotoById(service?.traderBusinessId, businesses) ||
    businessLogoUrl(senderBusiness);
  const senderPhone = senderBusiness?.contacts?.phone?.value?.trim() || null;
  const senderWhatsApp =
    senderBusiness?.contacts?.whatsapp?.value?.trim() || senderPhone;
  const gemTitle =
    gem?.title?.trim() ||
    (gem ? formatGemType(gem.gemType) : null) ||
    service?.gemName?.trim() ||
    (service ? `Gem · ${shortGemId(service.gemId)}` : "Gem");
  const gemPhoto =
    gemPrimaryPhotoUrl(gem) ||
    service?.gemPhotoUrl ||
    service?.photoBeforeUrls?.[0] ||
    null;

  async function invalidate(serviceId: string, gemId: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["lapidary-jobs"] }),
      queryClient.invalidateQueries({ queryKey: ["incoming-service-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["service", serviceId] }),
      queryClient.invalidateQueries({ queryKey: ["gem", gemId] }),
      queryClient.invalidateQueries({ queryKey: ["provider-services"] }),
    ]);
  }

  async function handleRequestDecision(action: "accepted" | "rejected") {
    if (!service) return;
    await track(`request-${action}`, async () => {
      try {
        await respondServiceRequest(service.id, action);
        await invalidate(service.id, service.gemId);
        toast.success(
          action === "accepted" ? "Job accepted." : "Request declined.",
        );
      } catch (error) {
        toast.error(friendlyError(error, "Could not respond to request."));
      }
    });
  }

  async function handleStatus(status: "in_progress" | "ready" | "returned") {
    if (!service) return;
    await track("status", async () => {
      try {
        await updateLapidaryJobStatus(service.id, status);
        await invalidate(service.id, service.gemId);
        toast.success(
          status === "returned"
            ? "Gem marked returned."
            : status === "ready"
              ? "Job marked ready."
              : "Job started.",
        );
      } catch (error) {
        toast.error(friendlyError(error, "Could not update job."));
      }
    });
  }

  async function handleComplete() {
    if (!service) return;
    const result = parseForm(completeLapidaryJobSchema, {
      weightAfter,
      finalCost,
      paymentDueDays,
    });
    if (!result.success) {
      setCompletionErrors(result.errors);
      toast.error(Object.values(result.errors)[0]!);
      return;
    }
    setCompletionErrors({});
    await track("complete", async () => {
      try {
        await completeLapidaryJob(service.id, {
          weightAfter: result.data.weightAfter,
          finalCost: result.data.finalCost,
          paymentDueDate: addDays(new Date(), result.data.paymentDueDays),
          currency: preferred,
        });
        await invalidate(service.id, service.gemId);
        toast.success("Completion details sent to sender.");
      } catch (error) {
        toast.error(friendlyError(error, "Could not send completion details."));
      }
    });
  }

  function openReceiveBill() {
    if (!service || service.finalCost == null || !service.paymentDueDate) return;
    pushWithAnchor({
      pathname: "/(marketplace)/bills/add",
      params: {
        direction: "receivable",
        amount: String(service.finalCost),
        currency: service.finalCostCurrency ?? preferred,
        dueDate: service.paymentDueDate.toDate().toISOString(),
        jobId: service.id,
        gemId: service.gemId,
        counterpartyBusinessId: service.traderBusinessId ?? "",
      },
    } as never);
  }

  async function handleCancellation(action: "accepted" | "rejected") {
    if (!service) return;
    await track(`cancel-${action}`, async () => {
      try {
        await respondServiceCancellation(service.id, action);
        await invalidate(service.id, service.gemId);
        toast.success(
          action === "accepted"
            ? "Service cancellation accepted."
            : "Cancellation declined.",
        );
      } catch (error) {
        toast.error(friendlyError(error, "Could not respond to cancellation."));
      }
    });
  }

  if (!service) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <StackHeader title="Job details" />
        {isLoading ? (
          <Text style={[styles.loading, { color: colors.textMuted }]}>Loading…</Text>
        ) : (
          <EmptyState
            icon="construction"
            image={WORKSPACE_ENTITY_IMAGES.service}
            title="Job unavailable"
            subtitle="This workshop job was removed or is no longer available to your account."
          />
        )}
      </SafeAreaView>
    );
  }

  if (
    !user ||
    service.serviceKind !== "lapidary_request" ||
    service.providerUid !== user.uid ||
    service.providerDeletedAt != null
  ) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <StackHeader title="Job details" />
        <EmptyState
          icon="construction"
          image={WORKSPACE_ENTITY_IMAGES.service}
          title="Job unavailable"
          subtitle="This workshop job is no longer available in your account."
        />
      </SafeAreaView>
    );
  }

  const meta = statusMeta(service.status);
  const steps = progressSteps(service);
  const serviceTypes = [
    ...new Set(
      (service.serviceTypes?.length
        ? service.serviceTypes
        : [service.serviceType]
      ).filter(Boolean),
    ),
  ];
  const nextStatus =
    service.status === "given"
      ? "in_progress"
      : service.status === "in_progress"
        ? "ready"
        : service.status === "ready"
          ? "returned"
          : null;
  const canCompleteJob =
    (service.status === "in_progress" || service.status === "ready") &&
    service.finalCost == null;
  const paymentDuePreview = (() => {
    const days = Number(paymentDueDays);
    return Number.isInteger(days) && days >= 0
      ? formatCalendarDate(addDays(new Date(), days), "d MMM yyyy")
      : null;
  })();

  const tint = gem ? gemTint(gem) : null;
  const hasAfterWeight = service.weightAfter != null;
  const typesLabel = serviceTypes.map(titleCase).join(", ");
  const workshopActive =
    service.status === "given" ||
    service.status === "in_progress" ||
    service.status === "ready";
  const showStatusAction =
    service.status !== "pending" &&
    service.status !== "cancellation_requested" &&
    nextStatus != null &&
    !(nextStatus === "ready" && canCompleteJob);
  const hasActionBar =
    service.status === "pending" ||
    service.status === "cancellation_requested" ||
    showStatusAction;
  const bottomBarPad = Math.max(insets.bottom, 12);
  const feeValue =
    service.finalCost != null
      ? formatFace(service.finalCost, service.finalCostCurrency)
      : service.agreedPrice != null
        ? formatFace(service.agreedPrice, service.agreedPriceCurrency)
        : null;

  const detailRows: ({ key: string } & DetailRowProps)[] = [
    {
      key: "gem",
      leading: gemPhoto ? (
        <GemThumb uri={gemPhoto} label={gemTitle} size={34} radius={10} />
      ) : gem ? (
        <GemArtwork gem={gem} style={styles.gemArtSmall} />
      ) : (
        <GemThumb uri={null} label={gemTitle} size={34} radius={10} />
      ),
      label: "Service gem",
      value: gemTitle,
    },
    {
      key: "before",
      icon: "scale",
      label: "Weight before",
      value: `${service.weightBefore} ct`,
    },
    {
      key: "after",
      icon: hasAfterWeight ? "auto-awesome" : "schedule",
      accent: hasAfterWeight ? Accent.emerald : Accent.amber,
      label: "Weight after",
      value: hasAfterWeight ? `${service.weightAfter} ct` : "Pending",
    },
    {
      key: "updated",
      icon: "history",
      label: "Last update",
      value: formatRelativeTime(service.updatedAt),
    },
  ];

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar style={gemPhoto && !headerSolid ? "light" : "auto"} />

      <ThemedScrollView
        contentContainerStyle={{
          paddingBottom: hasActionBar ? 96 + bottomBarPad : 56,
        }}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        {gemPhoto ? (
          <Image
            source={{ uri: gemPhoto }}
            style={{ width: windowWidth, height: heroHeight }}
            contentFit="cover"
            accessibilityLabel={`${gemTitle} photo`}
          />
        ) : gem ? (
          <GemArtwork
            gem={gem}
            artScale={0.7}
            style={{
              width: windowWidth,
              height: heroHeight,
              paddingTop: insets.top,
            }}
          />
        ) : (
          <TintHero
            accent={Accent.violet}
            icon={serviceIcon(serviceTypes[0] ?? service.serviceType)}
            height={heroHeight}
          />
        )}

        <TitleBand
          overlapHero
          chips={<StatusChip label={meta.label} accent={meta.accent} />}
          title={gemTitle}
          subtitle={`${typesLabel} · From ${senderName}`}
          subtitleDot={tint}
        >
          <KeyStats
            items={[
              { label: "Before", value: `${service.weightBefore} ct` },
              {
                label: "After",
                value: hasAfterWeight ? `${service.weightAfter} ct` : "Pending",
                color: hasAfterWeight ? Accent.emerald : colors.textMuted,
              },
              {
                label: service.finalCost != null ? "Final cost" : "Fee",
                value: feeValue ?? "—",
                sub:
                  service.finalCost == null && service.agreedPrice != null
                    ? "Agreed"
                    : null,
                color: feeValue ? undefined : colors.textMuted,
              },
            ]}
          />
          {service.status === "pending" ? (
            <Callout
              icon="inbox"
              accent={Accent.amber}
              label="Review the gem and requested work before choosing whether to take this job."
              value="Incoming request"
            />
          ) : service.status === "cancellation_requested" ? (
            <Callout
              icon="hourglass-top"
              accent={Accent.amber}
              label="The sender asked to cancel this service."
              value="Cancellation request"
            />
          ) : service.finalCost != null && service.paymentDueDate ? (
            <Callout
              icon="payments"
              accent={Accent.amber}
              label="Expected payment"
              value={formatCalendarDate(service.paymentDueDate.toDate(), "d MMM yyyy")}
            />
          ) : workshopActive ? (
            <Callout
              icon="event"
              accent={Accent.blue}
              label={`Return to sender · ${formatDate(service.expectedReturnDate)}`}
              value={formatRelativeDue(service.expectedReturnDate)}
            />
          ) : null}
        </TitleBand>

        <DetailBand title="Services">
          <View style={styles.workTags}>
            {serviceTypes.map((type) => (
              <View
                key={type}
                style={[styles.workTag, { backgroundColor: `${Accent.violet}14` }]}
              >
                <Icon name={serviceIcon(type)} size={16} color={Accent.violet} />
                <Text style={[styles.workTagText, { color: colors.onSurface }]}>
                  {titleCase(type)}
                </Text>
              </View>
            ))}
          </View>
          {service.instructions ? (
            <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>
              {service.instructions}
            </Text>
          ) : null}
        </DetailBand>

        <DetailBand title="Progress">
          <ProgressSteps steps={steps} />
        </DetailBand>

        <DetailBand title="Sender">
          <View style={styles.partyRow}>
            <Pressable
              style={({ pressed }) => [
                styles.partyMain,
                pressed && senderBusinessId ? styles.pressed : null,
              ]}
              onPress={
                senderBusinessId
                  ? () => router.push(`/business/${senderBusinessId}` as never)
                  : undefined
              }
              accessibilityRole={senderBusinessId ? "button" : undefined}
              accessibilityLabel={
                senderBusinessId
                  ? `Open sender ${senderName}`
                  : `Sender ${senderName}`
              }
            >
              <ContactAvatar name={senderName} photoUrl={senderPhoto} size={48} />
              <View style={styles.partyCopy}>
                <Text
                  style={[styles.partyName, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {senderName}
                </Text>
                <Text
                  style={[styles.partyCaption, { color: colors.onSurfaceVariant }]}
                >
                  Sender
                </Text>
              </View>
            </Pressable>
            {senderPhone ? (
              <Pressable
                style={({ pressed }) => [
                  styles.roundBtn,
                  { backgroundColor: `${Accent.blue}1F` },
                  pressed && styles.pressed,
                ]}
                onPress={() => void Linking.openURL(openPhone(senderPhone))}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel="Call sender"
              >
                <Icon name="call" size={20} color={Accent.blue} />
              </Pressable>
            ) : null}
            {senderWhatsApp ? (
              <Pressable
                style={({ pressed }) => [
                  styles.roundBtn,
                  { backgroundColor: `${WHATSAPP_GREEN}1F` },
                  pressed && styles.pressed,
                ]}
                onPress={() => void Linking.openURL(openWhatsApp(senderWhatsApp))}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel="WhatsApp sender"
              >
                <Icon name="whatsapp" size={20} color={WHATSAPP_GREEN} />
              </Pressable>
            ) : null}
          </View>
        </DetailBand>

        <DetailBand title="Details">
          <DetailRows rows={detailRows} />
        </DetailBand>

        {service.agreedPrice != null || service.finalCost != null ? (
          <DetailBand title="Cost summary">
            {service.agreedPrice != null ? (
              <DetailRow
                icon="handshake"
                accent={Accent.blue}
                label="Agreed price"
                value={formatFace(service.agreedPrice, service.agreedPriceCurrency)}
                isLast
              />
            ) : null}
            {service.finalCost != null ? (
              <TotalRow
                label="Final cost"
                value={formatFace(service.finalCost, service.finalCostCurrency)}
                accent={Accent.emerald}
              />
            ) : null}
          </DetailBand>
        ) : null}

        {service.finalCost != null && service.paymentDueDate ? (
          <DetailBand title="Payment">
            <DetailRow
              icon="event"
              accent={Accent.amber}
              label="Expected payment"
              value={formatCalendarDate(service.paymentDueDate.toDate(), "d MMM yyyy")}
              isLast
            />
            <Button
              title="Add as receive bill"
              icon="bill"
              variant="secondary"
              onPress={openReceiveBill}
            />
          </DetailBand>
        ) : null}

        {canCompleteJob ? (
          <DetailBand title="Send completion details">
            <Text style={[styles.bandHint, { color: colors.textMuted }]}>
              Send the final weight, service fee, and expected payment date to the sender.
            </Text>
            <MaskedInput
              label="After/End Weight (ct)"
              mode="weight"
              value={weightAfter}
              onChangeText={(value) => setWeightAfter(value)}
              leftIcon="scale"
              error={completionErrors.weightAfter}
            />
            <MaskedInput
              label="Service fee / amount"
              mode="currency"
              value={finalCost}
              onChangeText={(value) => setFinalCost(value)}
              leftIcon="payments"
              error={completionErrors.finalCost}
            />
            <MaskedInput
              label="Payment due in (days)"
              mode="custom"
              mask="999"
              value={paymentDueDays}
              onChangeText={(value) => setPaymentDueDays(value)}
              keyboardType="number-pad"
              leftIcon="event"
              error={completionErrors.paymentDueDays}
            />
            {paymentDuePreview ? (
              <DetailRow
                icon="event-available"
                accent={Accent.amber}
                label="Expected payment date"
                value={paymentDuePreview}
                isLast
              />
            ) : null}
            <Button
              title="Send to sender"
              icon="send"
              loading={pendingKey === "complete"}
              onPress={() => void handleComplete()}
            />
          </DetailBand>
        ) : null}
      </ThemedScrollView>

      <DetailHeader title="Workshop job" solid={headerSolid} />

      {hasActionBar ? (
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
          {service.status === "pending" ? (
            <>
              <Button
                title="Accept"
                icon="check"
                loading={pendingKey === "request-accepted"}
                disabled={busy}
                onPress={() => void handleRequestDecision("accepted")}
                style={styles.flex}
              />
              <Button
                title="Reject"
                icon="close"
                variant="destructive"
                loading={pendingKey === "request-rejected"}
                disabled={busy}
                onPress={() => void handleRequestDecision("rejected")}
                style={styles.flex}
              />
            </>
          ) : service.status === "cancellation_requested" ? (
            <>
              <Button
                title="Accept"
                icon="check"
                loading={pendingKey === "cancel-accepted"}
                disabled={busy}
                onPress={() => void handleCancellation("accepted")}
                style={styles.flex}
              />
              <Button
                title="Decline"
                icon="close"
                variant="secondary"
                loading={pendingKey === "cancel-rejected"}
                disabled={busy}
                onPress={() => void handleCancellation("rejected")}
                style={styles.flex}
              />
            </>
          ) : showStatusAction && nextStatus ? (
            <Button
              title={nextStatus === "in_progress" ? "Start job" : nextStatus === "ready" ? "Mark ready" : "Mark returned"}
              icon={nextStatus === "in_progress" ? "play-arrow" : nextStatus === "ready" ? "check" : "done-all"}
              variant={nextStatus === "returned" ? "secondary" : "primary"}
              loading={pendingKey === "status"}
              onPress={() => void handleStatus(nextStatus)}
              style={styles.flex}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { padding: Spacing.containerMargin, ...Typography.bodyMd },
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },

  gemArtSmall: { width: 34, height: 34, borderRadius: 10 },

  workTags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  workTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
  },
  workTagText: { ...text, fontFamily: FontFamily.semibold, fontSize: 14 },
  body: { ...text, fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 23 },
  bandHint: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 19, marginTop: -4 },

  stepRow: { flexDirection: "row", gap: 14 },
  stepRail: { width: 26, alignItems: "center" },
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
  stepCopy: { flex: 1, minWidth: 0, paddingTop: 2, paddingBottom: 20, gap: 2 },
  stepCopyLast: { paddingBottom: 0 },
  stepLabel: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 21 },
  stepSub: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },

  partyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  partyMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  partyCopy: { flex: 1, minWidth: 0, gap: 1 },
  partyName: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 21 },
  partyCaption: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
