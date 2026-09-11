import { useQueryClient } from "@tanstack/react-query";
import { addDays, format as formatCalendarDate } from "date-fns";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSection, ScreenInset } from "@/components/ui/form-section";
import { Icon, type IconName } from "@/components/ui/icon";
import { MaskedInput } from "@/components/ui/masked-input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
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
import { withLoading } from "@/providers/loading-bridge";
import { useToast } from "@/providers/toast-provider";
import type { ServiceRecord } from "@/types";

type StepState = "done" | "active" | "pending" | "error";

function serviceIcon(type: string): IconName {
  const normalized = type.toLowerCase();
  if (normalized.includes("heat")) return "local-fire-department";
  if (normalized.includes("polish")) return "auto-fix-high";
  if (normalized.includes("cut")) return "content-cut";
  return "handyman";
}

function statusMeta(status: ServiceRecord["status"]): {
  label: string;
  icon: IconName;
  tone: "neutral" | "warning" | "success" | "error";
} {
  switch (status) {
    case "given":
      return { label: "Queued", icon: "hourglass-top", tone: "neutral" };
    case "in_progress":
      return { label: "In progress", icon: "sync", tone: "warning" };
    case "ready":
      return { label: "Ready", icon: "check-circle", tone: "success" };
    case "received_back":
    case "completed":
      return { label: "Completed", icon: "done-all", tone: "success" };
    case "cancellation_requested":
      return { label: "Cancel requested", icon: "hourglass-top", tone: "warning" };
    case "cancelled":
      return { label: "Cancelled", icon: "cancel", tone: "neutral" };
    case "rejected":
      return { label: "Declined", icon: "block", tone: "error" };
    default:
      return { label: "Awaiting response", icon: "schedule", tone: "neutral" };
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

export default function LapidaryJobDetailScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { formatFace, preferred } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [weightAfter, setWeightAfter] = useState("");
  const [finalCost, setFinalCost] = useState("");
  const [paymentDueDays, setPaymentDueDays] = useState("7");
  const [completionErrors, setCompletionErrors] = useState<Record<string, string>>({});

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
    [businesses, service?.ownerUid, service?.traderBusinessId],
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
    try {
      await withLoading(async () => {
        await respondServiceRequest(service.id, action);
        await invalidate(service.id, service.gemId);
        toast.success(
          action === "accepted" ? "Job accepted." : "Request declined.",
        );
      }, action === "accepted" ? "Accepting…" : "Declining…");
    } catch (error) {
      toast.error(friendlyError(error, "Could not respond to request."));
    }
  }

  async function handleStatus(status: "in_progress" | "ready" | "returned") {
    if (!service) return;
    try {
      await withLoading(async () => {
        await updateLapidaryJobStatus(service.id, status);
        await invalidate(service.id, service.gemId);
        toast.success(
          status === "returned"
            ? "Gem marked returned."
            : status === "ready"
              ? "Job marked ready."
              : "Job started.",
        );
      }, "Updating…");
    } catch (error) {
      toast.error(friendlyError(error, "Could not update job."));
    }
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
    try {
      await withLoading(async () => {
        await completeLapidaryJob(service.id, {
          weightAfter: result.data.weightAfter,
          finalCost: result.data.finalCost,
          paymentDueDate: addDays(new Date(), result.data.paymentDueDays),
          currency: preferred,
        });
        await invalidate(service.id, service.gemId);
        toast.success("Completion details sent to sender.");
      }, "Sending…");
    } catch (error) {
      toast.error(friendlyError(error, "Could not send completion details."));
    }
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
    try {
      await withLoading(async () => {
        await respondServiceCancellation(service.id, action);
        await invalidate(service.id, service.gemId);
        toast.success(
          action === "accepted"
            ? "Service cancellation accepted."
            : "Cancellation declined.",
        );
      }, "Updating…");
    } catch (error) {
      toast.error(friendlyError(error, "Could not respond to cancellation."));
    }
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
          title="Job unavailable"
          subtitle="This workshop job is no longer available in your account."
        />
      </SafeAreaView>
    );
  }

  const meta = statusMeta(service.status);
  const toneColor =
    meta.tone === "success"
      ? colors.successEmerald
      : meta.tone === "warning"
        ? colors.warningAmber
        : meta.tone === "error"
          ? colors.error
          : colors.onSurfaceVariant;
  const toneBackground =
    meta.tone === "success"
      ? colors.successEmerald + "18"
      : meta.tone === "warning"
        ? colors.warningAmber + "18"
        : meta.tone === "error"
          ? colors.errorContainer
          : colors.surfaceContainerHighest;
  const steps = progressSteps(service);
  const serviceTypes = (service.serviceTypes?.length
    ? service.serviceTypes
    : [service.serviceType]
  ).filter(Boolean);
  const serviceLabels = serviceTypes.map((type) =>
    type.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
  );
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

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="Workshop job" />
      <ThemedScrollView contentContainerStyle={styles.content}>
        <ScreenInset>
          <Animated.View entering={FadeIn.duration(280)} style={styles.hero}>
            <View style={[styles.statusPill, { backgroundColor: toneBackground }]}>
              <Icon name={meta.icon} size={15} color={toneColor} />
              <Text style={[styles.statusText, { color: toneColor }]}>{meta.label}</Text>
            </View>
            <Text style={[styles.heroSub, { color: colors.textMuted }]}>
              Updated {formatRelativeTime(service.updatedAt)}
            </Text>
          </Animated.View>
        </ScreenInset>

        <ScreenInset>
          <Animated.View
            entering={FadeInDown.delay(60).duration(320)}
            style={styles.flow}
          >
            <Pressable
              style={({ pressed }) => [styles.flowSide, pressed && styles.pressed]}
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
              <ContactAvatar name={senderName} photoUrl={senderPhoto} size={84} />
              <Text style={[styles.flowName, { color: colors.onSurface }]} numberOfLines={2}>
                {senderName}
              </Text>
              <Text style={[styles.flowCaption, { color: colors.textMuted }]}>Sender</Text>
              {senderPhone || senderWhatsApp ? (
                <View style={styles.contactActions}>
                  {senderPhone ? (
                    <Pressable
                      style={[styles.roundButton, { backgroundColor: colors.primary }]}
                      onPress={() => void Linking.openURL(openPhone(senderPhone))}
                      accessibilityRole="button"
                      accessibilityLabel="Call sender"
                    >
                      <Icon name="call" size={17} color={colors.onPrimary} />
                    </Pressable>
                  ) : null}
                  {senderWhatsApp ? (
                    <Pressable
                      style={[styles.roundButton, { backgroundColor: "#25D366" }]}
                      onPress={() => void Linking.openURL(openWhatsApp(senderWhatsApp))}
                      accessibilityRole="button"
                      accessibilityLabel="WhatsApp sender"
                    >
                      <Icon name="whatsapp" size={17} color="#FFFFFF" />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </Pressable>

            <View style={styles.flowConnector} pointerEvents="none">
              <View style={[styles.connectorLine, { backgroundColor: colors.outlineVariant }]} />
              <View
                style={[
                  styles.connectorBadge,
                  { backgroundColor: colors.primaryContainer, borderColor: colors.background },
                ]}
              >
                <Icon name={serviceIcon(serviceTypes[0] ?? service.serviceType)} size={20} color={colors.onPrimaryContainer} />
              </View>
              <Icon name="arrow-forward" size={22} color={colors.outline} />
            </View>

            <View
              style={styles.flowSide}
              accessible
              accessibilityLabel={`${gemTitle}, shared service gem`}
            >
              <GemThumb uri={gemPhoto} label={gemTitle} size={96} radius={18} />
              <Text style={[styles.flowName, { color: colors.onSurface }]} numberOfLines={2}>
                {gemTitle}
              </Text>
              <Text style={[styles.flowCaption, { color: colors.textMuted }]}>Service gem</Text>
            </View>
          </Animated.View>
        </ScreenInset>

        <FormSection title="Services">
          <View style={styles.serviceList}>
            {serviceLabels.map((label, index) => (
              <View key={`${label}-${index}`} style={styles.serviceChip}>
                <Icon
                  name={serviceIcon(serviceTypes[index] ?? service.serviceType)}
                  size={18}
                  color={colors.primary}
                />
                <Text style={[styles.serviceLabel, { color: colors.onSurface }]}>{label}</Text>
              </View>
            ))}
          </View>
          {service.instructions ? (
            <Text style={[styles.notes, { color: colors.onSurfaceVariant }]}>
              {service.instructions}
            </Text>
          ) : null}
        </FormSection>

        <FormSection title="Progress">
          <View style={styles.timeline}>
            {steps.map((step, index) => {
              const filled = step.state === "done" || step.state === "active";
              const dotColor =
                step.state === "error"
                  ? colors.error
                  : filled
                    ? colors.primary
                    : colors.surfaceVariant;
              return (
                <Animated.View
                  key={step.key}
                  entering={FadeInDown.delay(80 + index * 45).duration(260)}
                  style={styles.timelineRow}
                >
                  <View style={styles.timelineRail}>
                    <View style={[styles.timelineDot, { backgroundColor: dotColor }]}>
                      {step.state === "done" ? <Icon name="check" size={12} color={colors.onPrimary} /> : null}
                      {step.state === "error" ? <Icon name="priority-high" size={12} color={colors.onError} /> : null}
                      {step.state === "active" ? <View style={[styles.pulse, { backgroundColor: colors.onPrimary }]} /> : null}
                    </View>
                    {index < steps.length - 1 ? (
                      <View
                        style={[
                          styles.timelineConnector,
                          { backgroundColor: filled ? colors.primary : colors.outlineVariant },
                        ]}
                      />
                    ) : null}
                  </View>
                  <View style={[styles.timelineCard, { backgroundColor: step.state === "error" ? toneBackground : colors.surfaceContainerLow }]}>
                    <Text style={[styles.timelineLabel, { color: step.state === "error" ? colors.error : colors.onSurface }]}>{step.label}</Text>
                    <Text style={[styles.timelineSub, { color: colors.textMuted }]}>{step.sub}</Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        </FormSection>

        <ScreenInset>
          <View style={styles.weightRow}>
            <View style={[styles.metricCard, { backgroundColor: colors.surfaceContainerLowest }]}>
              <Icon name="scale" size={22} color={colors.textMuted} />
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>BEFORE</Text>
              <Text style={[styles.metricValue, { color: colors.primary }]}>{service.weightBefore} ct</Text>
            </View>
            <Icon name="trending-flat" size={20} color={colors.outline} />
            <View style={[styles.metricCard, { backgroundColor: colors.surfaceContainerLowest }]}>
              <Icon name={service.weightAfter != null ? "auto-awesome" : "schedule"} size={22} color={service.weightAfter != null ? colors.accent : colors.warningAmber} />
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{service.weightAfter != null ? "AFTER" : "PENDING"}</Text>
              <Text style={[styles.metricValue, { color: colors.primary }]}>{service.weightAfter != null ? `${service.weightAfter} ct` : "…"}</Text>
            </View>
          </View>
        </ScreenInset>

        {service.agreedPrice != null || service.finalCost != null ? (
          <FormSection title="Cost summary">
            {service.agreedPrice != null ? (
              <View style={styles.costRow}>
                <Text style={[styles.costLabel, { color: colors.onSurfaceVariant }]}>Agreed price</Text>
                <Text style={[styles.costValue, { color: colors.onSurface }]}>
                  {formatFace(service.agreedPrice, service.agreedPriceCurrency)}
                </Text>
              </View>
            ) : null}
            {service.finalCost != null ? (
              <View style={[styles.costRow, styles.costTotalRow, { borderTopColor: colors.surfaceVariant }]}>
                <Text style={[styles.costLabel, { color: colors.primary }]}>Final cost</Text>
                <Text style={[styles.costValue, { color: colors.primary }]}>
                  {formatFace(service.finalCost, service.finalCostCurrency)}
                </Text>
              </View>
            ) : null}
          </FormSection>
        ) : null}

        {canCompleteJob ? (
          <FormSection title="Send completion details">
            <Text style={[styles.notes, { color: colors.textMuted }]}>
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
              <View style={styles.paymentRow}>
                <Text style={[styles.paymentLabel, { color: colors.textMuted }]}>Expected payment date</Text>
                <Text style={[styles.paymentValue, { color: colors.onSurface }]}>{paymentDuePreview}</Text>
              </View>
            ) : null}
            <Button
              title="Send to sender"
              icon="send"
              onPress={() => void handleComplete()}
            />
          </FormSection>
        ) : null}

        {service.finalCost != null && service.paymentDueDate ? (
          <FormSection title="Payment">
            <View style={styles.paymentRow}>
              <Text style={[styles.paymentLabel, { color: colors.textMuted }]}>Expected payment</Text>
              <Text style={[styles.paymentValue, { color: colors.onSurface }]}>
                {formatCalendarDate(service.paymentDueDate.toDate(), "d MMM yyyy")}
              </Text>
            </View>
            <Button
              title="Add as receive bill"
              icon="receipt-long"
              variant="secondary"
              onPress={openReceiveBill}
            />
          </FormSection>
        ) : null}

        {service.status === "pending" ? (
          <FormSection title="Incoming request">
            <Text style={[styles.notes, { color: colors.textMuted }]}>
              Review the gem and requested work before choosing whether to take this job.
            </Text>
            <View style={styles.actionRow}>
              <Button
                title="Accept"
                icon="check"
                onPress={() => void handleRequestDecision("accepted")}
                style={styles.flex}
              />
              <Button
                title="Reject"
                icon="close"
                variant="destructive"
                onPress={() => void handleRequestDecision("rejected")}
                style={styles.flex}
              />
            </View>
          </FormSection>
        ) : service.status === "cancellation_requested" ? (
          <FormSection title="Cancellation request">
            <Text style={[styles.notes, { color: colors.textMuted }]}>The sender asked to cancel this service.</Text>
            <View style={styles.actionRow}>
              <Button title="Accept" icon="check" onPress={() => void handleCancellation("accepted")} style={styles.flex} />
              <Button title="Decline" icon="close" variant="secondary" onPress={() => void handleCancellation("rejected")} style={styles.flex} />
            </View>
          </FormSection>
        ) : nextStatus && !(nextStatus === "ready" && canCompleteJob) ? (
          <ScreenInset>
            <Button
              title={nextStatus === "in_progress" ? "Start job" : nextStatus === "ready" ? "Mark ready" : "Mark returned"}
              icon={nextStatus === "in_progress" ? "play-arrow" : nextStatus === "ready" ? "check" : "done-all"}
              variant={nextStatus === "returned" ? "secondary" : "primary"}
              onPress={() => void handleStatus(nextStatus)}
            />
          </ScreenInset>
        ) : null}
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { padding: Spacing.containerMargin, ...Typography.bodyMd },
  content: { gap: Spacing.sectionGap, paddingBottom: 56 },
  hero: { alignItems: "center", gap: 5 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  statusText: { ...Typography.labelMd, fontWeight: "700" },
  heroTitle: { ...Typography.headlineMdMobile, fontWeight: "800" },
  heroSub: { ...Typography.caption },
  flow: { flexDirection: "row", alignItems: "center", gap: 8 },
  flowSide: { flex: 1, minWidth: 0, alignItems: "center", gap: 7 },
  flowName: { ...Typography.bodyMd, fontWeight: "700", textAlign: "center", width: "100%" },
  flowCaption: { ...Typography.caption },
  pressed: { opacity: 0.82 },
  contactActions: { flexDirection: "row", gap: 9 },
  roundButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  flowConnector: { width: 58, height: 54, alignItems: "center", justifyContent: "center", gap: 1 },
  connectorLine: { position: "absolute", left: 0, right: 0, top: 26, height: 2 },
  connectorBadge: { width: 38, height: 38, borderRadius: 19, borderWidth: 3, alignItems: "center", justifyContent: "center", zIndex: 1 },
  serviceList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  serviceChip: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, paddingVertical: 9, borderRadius: Radius.full, backgroundColor: "rgba(128,128,128,0.10)" },
  serviceLabel: { ...Typography.labelMd, fontWeight: "700" },
  notes: { ...Typography.bodyMd, lineHeight: 22 },
  paymentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  paymentLabel: { ...Typography.bodyMd, fontWeight: "600" },
  paymentValue: { ...Typography.bodyMd, fontWeight: "800" },
  timeline: { gap: 8 },
  timelineRow: { flexDirection: "row", minHeight: 64 },
  timelineRail: { width: 28, alignItems: "center" },
  timelineDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  timelineConnector: { width: 2, flex: 1, marginVertical: 3 },
  pulse: { width: 8, height: 8, borderRadius: 4 },
  timelineCard: { flex: 1, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 9, gap: 3 },
  timelineLabel: { ...Typography.labelMd, fontWeight: "700" },
  timelineSub: { ...Typography.caption },
  weightRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  metricCard: { flex: 1, minHeight: 112, borderRadius: Radius.xl, alignItems: "center", justifyContent: "center", gap: 5, padding: 10 },
  metricLabel: { ...Typography.labelSm, letterSpacing: 0.8 },
  metricValue: { ...Typography.headlineSm, fontWeight: "800" },
  costRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  costTotalRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.md, marginTop: 2 },
  costLabel: { ...Typography.bodyMd, fontWeight: "600" },
  costValue: { ...Typography.bodyMd, fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: Spacing.stackSm },
  flex: { flex: 1 },
});
