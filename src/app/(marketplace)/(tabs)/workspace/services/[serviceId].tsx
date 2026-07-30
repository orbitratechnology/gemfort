import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
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
    canDeleteService,
    canRequestServiceCancellation,
    canRespondServiceCancellation,
} from "@/features/workspace/delete-gates";
import {
    subscribeContacts,
    subscribeGem,
    subscribeService,
    subscribeServices,
    subscribeVerifiedBusinesses,
} from "@/features/workspace/firestore-subscriptions";
import {
    businessLogoUrl,
    gemPrimaryPhotoUrl,
    resolveBusinessPhotoById,
    resolvePartyPhotoUrl,
} from "@/features/workspace/party-photo";
import {
    requestServiceCancellation,
    respondServiceCancellation,
} from "@/features/workspace/service-lifecycle-service";
import {
    completeService,
    deleteService,
    fetchContacts,
    fetchGem,
    fetchService,
    fetchServices,
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
    shortGemId,
} from "@/lib/utils";
import {
    completeServiceSchema,
    parseForm,
} from "@/lib/validation/form-schemas";
import { useAuth } from "@/providers/auth-provider";
import { confirmDelete } from "@/providers/confirm-provider";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";
import type { ServiceRecord } from "@/types";

type StepState = "done" | "active" | "pending" | "overdue";

function serviceTypeIcon(type: string): IconName {
  const t = type.toLowerCase();
  if (t.includes("heat")) return "local-fire-department";
  if (t.includes("polish")) return "auto-fix-high";
  if (t.includes("recut") || t.includes("cut")) return "content-cut";
  if (t.includes("shap")) return "category";
  if (t.includes("chem") || t.includes("treat")) return "science";
  return "handyman";
}

function statusMeta(status: ServiceRecord["status"]): {
  label: string;
  icon: IconName;
  tone: "neutral" | "warning" | "success" | "error";
} {
  switch (status) {
    case "in_progress":
      return { label: "In Progress", icon: "sync", tone: "warning" };
    case "completed":
    case "received_back":
      return { label: "Completed", icon: "check-circle", tone: "success" };
    case "overdue":
      return { label: "Overdue", icon: "error-outline", tone: "error" };
    case "cancellation_requested":
      return {
        label: "Cancel requested",
        icon: "hourglass-top",
        tone: "warning",
      };
    case "cancelled":
      return { label: "Cancelled", icon: "cancel", tone: "neutral" };
    default:
      return { label: "Pending", icon: "schedule", tone: "neutral" };
  }
}

function timelineSteps(service: ServiceRecord): {
  key: string;
  label: string;
  sub: string;
  state: StepState;
}[] {
  const status = service.status;
  const order = ["given", "in_progress", "completed"] as const;
  const normalized =
    status === "received_back"
      ? "completed"
      : status === "overdue"
        ? "in_progress"
        : status === "cancellation_requested" || status === "cancelled"
          ? status === "cancelled"
            ? "given"
            : "in_progress"
          : status;
  const idx = order.indexOf(normalized as (typeof order)[number]);

  const done = (s: (typeof order)[number]) => idx >= order.indexOf(s);

  return [
    {
      key: "given",
      label: "Handed over",
      sub: formatDate(service.dateGiven),
      state: done("given")
        ? idx === 0 && status === "given"
          ? "active"
          : "done"
        : "pending",
    },
    {
      key: "in_progress",
      label: status === "overdue" ? "Overdue" : "In progress",
      sub: `Due ${formatRelativeDue(service.expectedReturnDate)}`,
      state:
        status === "overdue"
          ? "overdue"
          : status === "in_progress"
            ? "active"
            : done("in_progress")
              ? "done"
              : "pending",
    },
    {
      key: "completed",
      label: "Returned",
      sub: service.dateReturned
        ? formatDate(service.dateReturned)
        : "Awaiting return",
      state: done("completed") ? "done" : "pending",
    },
  ];
}

export default function ServiceDetailScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { formatFace } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [weightAfter, setWeightAfter] = useState("");
  const [finalCost, setFinalCost] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: services = [] } = useFirestoreLiveQuery({
    queryKey: ["services", user?.uid],
    queryFn: () => fetchServices(user!.uid),
    subscribe: (onData, onError) =>
      subscribeServices(user!.uid, onData, onError),
    enabled: !!user,
  });

  const ownedService = services.find((s) => s.id === serviceId);

  const { data: fetchedService } = useFirestoreLiveQuery({
    queryKey: ["service", serviceId],
    queryFn: () => fetchService(serviceId!),
    subscribe: (onData, onError) =>
      subscribeService(serviceId!, onData, onError),
    enabled: !!serviceId && !ownedService,
  });

  const service = ownedService ?? fetchedService ?? null;
  const ownerUid = service?.ownerUid;

  const { data: gem } = useFirestoreLiveQuery({
    queryKey: ["gem", service?.gemId],
    queryFn: () => fetchGem(service!.gemId),
    subscribe: (onData, onError) =>
      subscribeGem(service!.gemId, onData, onError),
    enabled: !!service?.gemId,
  });

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ["contacts", ownerUid],
    queryFn: () => fetchContacts(ownerUid!),
    subscribe: (onData, onError) =>
      subscribeContacts(ownerUid!, onData, onError),
    enabled: !!ownerUid,
  });

  const { data: businesses = [] } = useFirestoreLiveQuery({
    queryKey: ["home-businesses"],
    queryFn: () => fetchBusinesses(),
    subscribe: (onData, onError) =>
      subscribeVerifiedBusinesses(onData, onError),
    enabled: !!service,
  });

  const providerContact =
    contacts.find((c) => c.id === service?.providerContactId) ?? null;
  const providerBusiness = service?.providerBusinessId
    ? (businesses.find((b) => b.id === service.providerBusinessId) ?? null)
    : null;

  const providerName =
    service?.providerName?.trim() ||
    providerContact?.displayName ||
    providerBusiness?.businessName ||
    (service?.providerContactId
      ? `Contact · ${service.providerContactId.slice(0, 8)}`
      : "Provider");

  const providerPhoto =
    resolvePartyPhotoUrl(providerContact, businesses) ||
    resolveBusinessPhotoById(service?.providerBusinessId, businesses) ||
    businessLogoUrl(providerBusiness);

  const providerPhone =
    providerContact?.phone?.trim() ||
    providerBusiness?.contacts?.phone?.value?.trim() ||
    null;
  const providerWhatsApp =
    providerContact?.whatsapp?.trim() ||
    providerContact?.phone?.trim() ||
    providerBusiness?.contacts?.whatsapp?.value?.trim() ||
    providerBusiness?.contacts?.phone?.value?.trim() ||
    null;

  const gemTitle =
    gem?.title?.trim() ||
    (gem ? formatGemType(gem.gemType) : null) ||
    (service ? `Gem · ${shortGemId(service.gemId)}` : "Gem");
  const gemPhoto = gemPrimaryPhotoUrl(gem);

  if (!service) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
      >
        <StackHeader title="Service Detail" />
        <Text style={[styles.loading, { color: colors.textMuted }]}>
          Loading...
        </Text>
      </SafeAreaView>
    );
  }

  const isOwner = service.ownerUid === user?.uid;
  const isProvider = !!user && service.providerUid === user.uid;
  const actionable =
    service.status === "given" ||
    service.status === "overdue" ||
    service.status === "in_progress";
  const meta = statusMeta(service.status);
  const steps = timelineSteps(service);
  const serviceTypeLabel = service.serviceType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

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

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["services"] });
    await queryClient.invalidateQueries({ queryKey: ["service", serviceId] });
  }

  async function handleComplete() {
    if (!user) return;
    const result = parseForm(completeServiceSchema, { weightAfter, finalCost });
    if (!result.success) {
      setErrors(result.errors);
      toast.error(Object.values(result.errors)[0]!);
      return;
    }
    setErrors({});
    try {
      await withLoading(async () => {
        await completeService(serviceId!, user.uid, {
          weightAfter: result.data.weightAfter,
          finalCost: result.data.finalCost,
        });
        await queryClient.invalidateQueries({ queryKey: ["gems"] });
        await invalidate();
        toast.success("Service marked complete");
        router.back();
      }, "Saving…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not update service."));
    }
  }

  async function handleRequestCancel() {
    try {
      await withLoading(async () => {
        await requestServiceCancellation(service!.id);
        await invalidate();
        toast.success("Cancellation requested");
      }, "Updating…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not request cancellation."));
    }
  }

  async function handleRespondCancel(action: "accepted" | "rejected") {
    try {
      await withLoading(async () => {
        await respondServiceCancellation(service!.id, action);
        await invalidate();
        toast.success(
          action === "accepted"
            ? "Cancellation accepted"
            : "Cancellation declined",
        );
      }, "Updating…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not respond to cancellation."));
    }
  }

  function handleDelete() {
    if (!user) return;
    void confirmDelete(
      "Delete service",
      `Remove this ${serviceTypeLabel} record? This cannot be undone.`,
      async () => {
        try {
          await deleteService(service!.id, user.uid);
          toast.success("Service deleted");
          router.back();
        } catch (e) {
          toast.error(friendlyError(e, "Could not delete service."));
          throw e;
        }
      },
    );
  }

  const showOwnerActions =
    isOwner &&
    (canRequestServiceCancellation(service) || canDeleteService(service));

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title={serviceTypeLabel} />

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
            {service.instructions ? (
              <Text
                style={[styles.desc, { color: colors.onSurfaceVariant }]}
                selectable
              >
                {service.instructions}
              </Text>
            ) : null}
          </Animated.View>
        </ScreenInset>

        {/* Provider → Gem (bottom-to-top connection) */}
        <ScreenInset>
          <Animated.View
            entering={FadeInDown.delay(60).duration(320)}
            style={styles.relation}
          >
            <Pressable
              style={({ pressed }) => [
                styles.providerBlock,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                if (service.providerContactId) {
                  router.push(
                    `/(marketplace)/(tabs)/workspace/contacts/${service.providerContactId}` as never,
                  );
                } else if (service.providerBusinessId) {
                  router.push(
                    `/business/${service.providerBusinessId}` as never,
                  );
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`Open provider ${providerName}`}
            >
              <View style={styles.providerAvatarWrap}>
                <ContactAvatar
                  name={providerName}
                  photoUrl={providerPhoto}
                  size={88}
                />
                {service.providerBusinessId ? (
                  <View
                    style={[
                      styles.verifiedDot,
                      {
                        backgroundColor: colors.primary,
                        borderColor: colors.background,
                      },
                    ]}
                  >
                    <Icon name="verified" size={12} color={colors.onPrimary} />
                  </View>
                ) : null}
              </View>
              <Text
                style={[styles.providerName, { color: colors.onSurface }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {providerName}
              </Text>
            </Pressable>

            {providerPhone || providerWhatsApp ? (
              <View style={styles.providerActions}>
                {providerPhone ? (
                  <Pressable
                    onPress={() =>
                      void Linking.openURL(openPhone(providerPhone))
                    }
                    style={[
                      styles.roundBtn,
                      { backgroundColor: colors.primary },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Call provider"
                  >
                    <Icon name="call" size={18} color={colors.onPrimary} />
                  </Pressable>
                ) : null}
                {providerWhatsApp ? (
                  <Pressable
                    onPress={() =>
                      void Linking.openURL(openWhatsApp(providerWhatsApp))
                    }
                    style={[styles.roundBtn, { backgroundColor: "#25D366" }]}
                    accessibilityRole="button"
                    accessibilityLabel="WhatsApp provider"
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
              <Icon name="keyboard-arrow-up" size={22} color={colors.outline} />
              <View
                style={[
                  styles.relationBadge,
                  {
                    backgroundColor: colors.primaryContainer,
                    borderColor: colors.background,
                  },
                ]}
              >
                <Icon
                  name={serviceTypeIcon(service.serviceType)}
                  size={20}
                  color={colors.onPrimaryContainer}
                />
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.gemBlock,
                pressed && styles.pressed,
              ]}
              onPress={() =>
                router.push(
                  `/(marketplace)/(tabs)/workspace/gems/${service.gemId}` as never,
                )
              }
              accessibilityRole="link"
              accessibilityLabel={`Open gem ${gemTitle}`}
            >
              <GemThumb
                uri={gemPhoto}
                label={gemTitle}
                size={64}
                radius={14}
              />
              <Text
                style={[styles.gemName, { color: colors.onSurface }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {gemTitle}
              </Text>
            </Pressable>
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

        {/* Weight */}
        <ScreenInset>
          <View style={styles.weightRow}>
            <View
              style={[
                styles.weightCard,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                },
              ]}
            >
              <Icon name="scale" size={22} color={colors.textMuted} />
              <Text style={[styles.weightLabel, { color: colors.textMuted }]}>
                BEFORE
              </Text>
              <Text
                style={[styles.weightValue, { color: colors.primary }]}
                selectable
              >
                {service.weightBefore} ct
              </Text>
            </View>
            <View style={styles.weightArrow}>
              <Icon name="trending-flat" size={20} color={colors.outline} />
            </View>
            <View
              style={[
                styles.weightCard,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                },
              ]}
            >
              <Icon
                name="auto-awesome"
                size={22}
                color={
                  service.weightAfter != null ? colors.accent : colors.textMuted
                }
              />
              <Text style={[styles.weightLabel, { color: colors.textMuted }]}>
                {service.weightAfter != null ? "AFTER" : "EXPECTED"}
              </Text>
              <Text
                style={[styles.weightValue, { color: colors.primary }]}
                selectable
              >
                {service.weightAfter != null
                  ? `${service.weightAfter} ct`
                  : "—"}
              </Text>
              {service.weightLossPercent != null ? (
                <Text style={[styles.weightNote, { color: colors.textMuted }]}>
                  Loss ~{service.weightLossPercent}%
                </Text>
              ) : null}
            </View>
          </View>
        </ScreenInset>

        {service.agreedPrice != null || service.finalCost != null ? (
          <FormSection title="Cost summary">
            <View style={styles.costList}>
              {service.agreedPrice != null ? (
                <View style={styles.costRow}>
                  <Text
                    style={[
                      styles.costLabel,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    Agreed Price
                  </Text>
                  <Text
                    style={[styles.costValue, { color: colors.onSurface }]}
                    selectable
                  >
                    {formatFace(
                      service.agreedPrice,
                      service.agreedPriceCurrency,
                    )}
                  </Text>
                </View>
              ) : null}
              {service.advancePaid > 0 ? (
                <View style={styles.costRow}>
                  <Text
                    style={[
                      styles.costLabel,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    Advance Paid
                  </Text>
                  <Text
                    style={[styles.costValue, { color: colors.onSurface }]}
                    selectable
                  >
                    {formatFace(
                      service.advancePaid,
                      service.agreedPriceCurrency ?? service.finalCostCurrency,
                    )}
                  </Text>
                </View>
              ) : null}
              <View
                style={[
                  styles.costTotalRow,
                  { borderTopColor: colors.surfaceVariant },
                ]}
              >
                <Text
                  style={[styles.costTotalLabel, { color: colors.primary }]}
                >
                  {service.finalCost != null ? "Final Cost" : "Total Estimate"}
                </Text>
                <Text
                  style={[styles.costTotalValue, { color: colors.primary }]}
                  selectable
                >
                  {formatFace(
                    service.finalCost ?? service.agreedPrice ?? 0,
                    service.finalCostCurrency ?? service.agreedPriceCurrency,
                  )}
                </Text>
              </View>
            </View>
          </FormSection>
        ) : null}

        {actionable ? (
          <FormSection title="Mark as received">
            <MaskedInput
              label="Weight After (ct)"
              mode="weight"
              value={weightAfter}
              onChangeText={(v) => {
                setWeightAfter(v);
                setErrors((e) => {
                  if (!e.weightAfter) return e;
                  const next = { ...e };
                  delete next.weightAfter;
                  return next;
                });
              }}
              leftIcon="scale"
              error={errors.weightAfter}
            />
            <MaskedInput
              label="Final Cost"
              mode="currency"
              value={finalCost}
              onChangeText={(v) => {
                setFinalCost(v);
                setErrors((e) => {
                  if (!e.finalCost) return e;
                  const next = { ...e };
                  delete next.finalCost;
                  return next;
                });
              }}
              leftIcon="payments"
              error={errors.finalCost}
            />
            <Button
              title="Mark Received & Complete"
              icon="check-circle"
              onPress={handleComplete}
            />
          </FormSection>
        ) : null}

        {isProvider && canRespondServiceCancellation(service, user!.uid) ? (
          <FormSection title="Cancellation request">
            <Text style={{ color: colors.textMuted }}>
              The trader asked to cancel this service.
            </Text>
            <View style={styles.row}>
              <Button
                title="Accept"
                icon="check"
                onPress={() => handleRespondCancel("accepted")}
                style={styles.flex}
              />
              <Button
                title="Decline"
                variant="secondary"
                icon="close"
                onPress={() => handleRespondCancel("rejected")}
                style={styles.flex}
              />
            </View>
          </FormSection>
        ) : null}

        {showOwnerActions ? (
          <ScreenInset style={styles.bottomActions}>
            {isOwner && canRequestServiceCancellation(service) ? (
              <Pressable
                onPress={handleRequestCancel}
                style={({ pressed }) => [
                  styles.actionBtn,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.warningAmber,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Request cancellation"
              >
                <View
                  style={[
                    styles.actionIconWrap,
                    { backgroundColor: colors.warningAmber + "22" },
                  ]}
                >
                  <Icon name="cancel" size={20} color={colors.warningAmber} />
                </View>
                <View style={styles.actionTextCol}>
                  <Text
                    style={[styles.actionTitle, { color: colors.onSurface }]}
                  >
                    Request cancel
                  </Text>
                  <Text style={[styles.actionSub, { color: colors.textMuted }]}>
                    Ask provider to stop
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {isOwner && canDeleteService(service) ? (
              <Pressable
                onPress={handleDelete}
                style={({ pressed }) => [
                  styles.actionBtn,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.error,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Delete service"
              >
                <View
                  style={[
                    styles.actionIconWrap,
                    { backgroundColor: colors.errorContainer },
                  ]}
                >
                  <Icon name="delete-outline" size={20} color={colors.error} />
                </View>
                <View style={styles.actionTextCol}>
                  <Text style={[styles.actionTitle, { color: colors.error }]}>
                    Delete
                  </Text>
                  <Text style={[styles.actionSub, { color: colors.textMuted }]}>
                    Remove this record
                  </Text>
                </View>
              </Pressable>
            ) : null}
          </ScreenInset>
        ) : null}
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { padding: Spacing.containerMargin, ...Typography.bodyMd },
  content: { gap: Spacing.sectionGap, paddingBottom: 48 },

  hero: { gap: Spacing.stackMd, alignItems: "center" },
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
  desc: { ...Typography.bodyMd, lineHeight: 22, textAlign: "center" },

  relation: {
    width: "100%",
    alignItems: "center",
    gap: 10,
  },
  providerBlock: {
    alignItems: "center",
    gap: 10,
    maxWidth: "80%",
  },
  providerName: {
    ...Typography.headlineSm,
    fontWeight: "700",
    textAlign: "center",
    width: "100%",
  },
  providerAvatarWrap: { position: "relative" },
  verifiedDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  providerActions: {
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
    gap: 2,
    height: 64,
    width: 48,
  },
  relationLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    alignSelf: "center",
  },
  relationBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  gemBlock: {
    width: "100%",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  gemName: {
    ...Typography.labelMd,
    fontWeight: "700",
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

  weightRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  weightCard: {
    flex: 1,
    padding: 16,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  weightArrow: { paddingTop: 8 },
  weightLabel: {
    ...Typography.labelMd,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 4,
  },
  weightValue: { ...Typography.headlineSm },
  weightNote: { fontSize: 10, marginTop: 4 },

  costList: { gap: 8 },
  costRow: { flexDirection: "row", justifyContent: "space-between" },
  costLabel: { ...Typography.bodyMd },
  costValue: { ...Typography.bodyMd },
  costTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    marginTop: 2,
    borderTopWidth: 1,
  },
  costTotalLabel: { ...Typography.headlineSm },
  costTotalValue: { ...Typography.headlineSm },

  row: { flexDirection: "row", gap: Spacing.sm, paddingHorizontal: 0 },
  flex: { flex: 1 },

  bottomActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1.5,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTextCol: { flex: 1, minWidth: 0, gap: 2 },
  actionTitle: { ...Typography.labelMd, fontWeight: "700" },
  actionSub: { ...Typography.bodyMd, fontSize: 12 },
});
