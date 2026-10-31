import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
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
import { ReceiptField } from "@/components/ui/receipt-field";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { AvatarVerificationBadge } from "@/components/ui/verification-badge";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemArtwork, gemTint } from "@/components/workspace/gem-artwork";
import { GemThumb } from "@/components/workspace/gem-thumb";
import { FontFamily, Spacing, Typography } from "@/constants/design-tokens";
import { WORKSPACE_ENTITY_IMAGES } from "@/constants/workspace-entity-images";
import { businessReputationBadgeForBusiness } from "@/constants/business-reputation";
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
import { uploadReceipt } from "@/lib/firebase/receipt-service";
import type { LocalMedia } from "@/lib/firebase/storage-service";
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
import { confirmDelete } from "@/providers/confirm-bridge";
import { useToast } from "@/providers/toast-provider";
import type { ServiceRecord } from "@/types";

type StepState = "done" | "active" | "pending" | "overdue";

const WHATSAPP_GREEN = "#25D366";

function serviceTypeIcon(type: string): IconName {
  const t = type.toLowerCase();
  if (t.includes("heat")) return "local-fire-department";
  if (t.includes("polish")) return "auto-fix-high";
  if (t.includes("recut") || t.includes("cut")) return "content-cut";
  if (t.includes("shap")) return "category";
  if (t.includes("chem") || t.includes("treat")) return "science";
  return "handyman";
}

/** Status label + semantic accent (see `Accent` in the detail kit). */
function statusMeta(status: ServiceRecord["status"]): {
  label: string;
  icon: IconName;
  accent: string;
} {
  switch (status) {
    case "ready":
      return { label: "Ready", icon: "check-circle", accent: Accent.emerald };
    case "in_progress":
      return { label: "In Progress", icon: "sync", accent: Accent.blue };
    case "completed":
    case "received_back":
      return { label: "Completed", icon: "check-circle", accent: Accent.emerald };
    case "overdue":
      return { label: "Overdue", icon: "error-outline", accent: Accent.rose };
    case "cancellation_requested":
      return {
        label: "Cancel requested",
        icon: "hourglass-top",
        accent: Accent.amber,
      };
    case "cancelled":
      return { label: "Cancelled", icon: "cancel", accent: Accent.slate };
    case "rejected":
      return { label: "Declined", icon: "block", accent: Accent.rose };
    case "pending":
      return {
        label: "Awaiting response",
        icon: "schedule",
        accent: Accent.amber,
      };
    default:
      return { label: "Pending", icon: "schedule", accent: Accent.amber };
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
        : status === "ready"
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

const STEP_ACCENT: Record<StepState, string> = {
  done: Accent.emerald,
  active: Accent.blue,
  overdue: Accent.rose,
  pending: Accent.slate,
};

/** Vertical stepper: tinted dots on a hairline rail, label + date beside. */
function ProgressSteps({
  steps,
}: {
  steps: ReturnType<typeof timelineSteps>;
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
                ) : step.state === "overdue" ? (
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
                      step.state === "overdue"
                        ? Accent.rose
                        : pending
                          ? colors.onSurfaceVariant
                          : colors.onSurface,
                  },
                ]}
              >
                {step.label}
              </Text>
              <Text
                style={[styles.stepSub, { color: colors.textMuted }]}
                selectable={false}
              >
                {step.sub}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function ServiceDetailScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { formatFace } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const heroHeight = Math.round(windowWidth * 0.78);
  const { solid: headerSolid, scrollProps } = useCollapsingHeader(heroHeight);
  const [weightAfter, setWeightAfter] = useState("");
  const [finalCost, setFinalCost] = useState("");
  const [receipt, setReceipt] = useState<LocalMedia | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Action in flight, so only the tapped control spins.
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const { data: services = [], isLoading: servicesLoading } = useFirestoreLiveQuery({
    queryKey: ["services", user?.uid],
    queryFn: () => fetchServices(user!.uid),
    subscribe: (onData, onError) =>
      subscribeServices(user!.uid, onData, onError),
    enabled: !!user,
  });

  const ownedService = services.find((s) => s.id === serviceId);

  const {
    data: fetchedService,
    isLoading: fetchedServiceLoading,
  } = useFirestoreLiveQuery({
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
  const providerReputationBadge =
    businessReputationBadgeForBusiness(providerBusiness);

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
    service?.gemName?.trim() ||
    (service ? `Gem · ${shortGemId(service.gemId)}` : "Gem");
  const gemPhoto =
    gemPrimaryPhotoUrl(gem) || service?.gemPhotoUrl || service?.photoBeforeUrls?.[0] || null;

  if (!service) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
      >
        <StackHeader title="Service Detail" />
        {servicesLoading || fetchedServiceLoading ? (
          <Text style={[styles.loading, { color: colors.textMuted }]}>Loading…</Text>
        ) : (
          <EmptyState
            icon="service"
            image={WORKSPACE_ENTITY_IMAGES.service}
            title="Service unavailable"
            subtitle="This service record was removed or is no longer available to your account."
          />
        )}
      </SafeAreaView>
    );
  }
  const currentService = service;

  const isOwner = service.ownerUid === user?.uid;
  const isProvider = !!user && service.providerUid === user.uid;
  const actionable =
    service.serviceKind !== "lapidary_request" &&
    (service.status === "given" ||
      service.status === "overdue" ||
      service.status === "in_progress");
  const meta = statusMeta(service.status);
  const steps = timelineSteps(service);
  const serviceTypeLabel = service.serviceType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const hasAfterWeight = service.weightAfter != null;
  const isDone =
    service.status === "completed" || service.status === "received_back";
  const isClosed =
    service.status === "cancelled" || service.status === "rejected";
  const tint = gem ? gemTint(gem) : null;

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["services"] }),
      queryClient.invalidateQueries({ queryKey: ["service", serviceId] }),
      queryClient.invalidateQueries({ queryKey: ["gem", currentService.gemId] }),
      queryClient.invalidateQueries({
        queryKey: ["gem-events", currentService.ownerUid, currentService.gemId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["gem-costs", currentService.ownerUid, currentService.gemId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["gem-services", currentService.ownerUid, currentService.gemId],
      }),
    ]);
  }

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

  async function handleComplete() {
    if (!user) return;
    const result = parseForm(completeServiceSchema, { weightAfter, finalCost });
    if (!result.success) {
      setErrors(result.errors);
      toast.error(Object.values(result.errors)[0]!);
      return;
    }
    setErrors({});
    await track("complete", async () => {
      try {
        await completeService(serviceId!, user.uid, {
          weightAfter: result.data.weightAfter,
          finalCost: result.data.finalCost,
          receiptUrl: await uploadReceipt(user.uid, receipt),
        });
        await queryClient.invalidateQueries({ queryKey: ["gems"] });
        await invalidate();
        toast.success("Service marked complete");
        router.back();
      } catch (e) {
        toast.error(friendlyError(e, "Could not update service."));
      }
    });
  }

  async function handleRequestCancel() {
    await track("request-cancel", async () => {
      try {
        await requestServiceCancellation(service!.id);
        await invalidate();
        toast.success("Cancellation requested");
      } catch (e) {
        toast.error(friendlyError(e, "Could not request cancellation."));
      }
    });
  }

  async function handleRespondCancel(action: "accepted" | "rejected") {
    await track(`cancel-${action}`, async () => {
      try {
        await respondServiceCancellation(service!.id, action);
        await invalidate();
        toast.success(
          action === "accepted"
            ? "Cancellation accepted"
            : "Cancellation declined",
        );
      } catch (e) {
        toast.error(friendlyError(e, "Could not respond to cancellation."));
      }
    });
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

  function openProvider() {
    if (service!.providerContactId) {
      router.push(
        `/(marketplace)/(tabs)/workspace/contacts/${service!.providerContactId}` as never,
      );
    } else if (service!.providerBusinessId) {
      router.push(`/business/${service!.providerBusinessId}` as never);
    }
  }

  const canRequestCancel = isOwner && canRequestServiceCancellation(service);
  const canDelete = isOwner && canDeleteService(service);
  const showOwnerActions = canRequestCancel || canDelete;
  const bottomBarPad = Math.max(insets.bottom, 12);

  const costValue =
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
      label: isOwner ? "Gem" : "Service gem",
      value: gemTitle,
      onPress: isOwner
        ? () =>
            router.push(
              `/(marketplace)/(tabs)/workspace/gems/${service.gemId}` as never,
            )
        : undefined,
    },
    {
      key: "type",
      icon: serviceTypeIcon(service.serviceType),
      accent: Accent.violet,
      label: "Service",
      value: serviceTypeLabel,
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
      hint:
        service.weightLossPercent != null
          ? `Loss ~${service.weightLossPercent}%`
          : null,
      value: hasAfterWeight ? `${service.weightAfter} ct` : "Pending",
    },
    ...(service.paymentDueDate
      ? [
          {
            key: "payment",
            icon: "event" as IconName,
            accent: Accent.amber,
            label: "Expected payment",
            value: formatDate(service.paymentDueDate),
          },
        ]
      : []),
  ];

  const costRows: ({ key: string } & DetailRowProps)[] = [
    ...(service.agreedPrice != null
      ? [
          {
            key: "agreed",
            icon: "handshake" as IconName,
            accent: Accent.blue,
            label: "Agreed Price",
            value: formatFace(service.agreedPrice, service.agreedPriceCurrency),
          },
        ]
      : []),
    ...(service.advancePaid > 0
      ? [
          {
            key: "advance",
            icon: "payments" as IconName,
            accent: Accent.emerald,
            label: "Advance Paid",
            value: formatFace(
              service.advancePaid,
              service.agreedPriceCurrency ?? service.finalCostCurrency,
            ),
          },
        ]
      : []),
  ];

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar style={gemPhoto && !headerSolid ? "light" : "auto"} />

      <ThemedScrollView
        contentContainerStyle={{
          paddingBottom: showOwnerActions ? 96 + bottomBarPad : 48,
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
            icon={serviceTypeIcon(service.serviceType)}
            height={heroHeight}
          />
        )}

        <TitleBand
          overlapHero
          chips={
            <>
              <StatusChip label={meta.label} accent={meta.accent} />
              <StatusChip label={serviceTypeLabel} accent={Accent.violet} />
            </>
          }
          title={gemTitle}
          subtitle={`${serviceTypeLabel} · ${providerName}`}
          subtitleDot={tint}
        >
          <KeyStats
            items={[
              { label: "Before", value: `${service.weightBefore} ct` },
              {
                label: "After",
                value: hasAfterWeight ? `${service.weightAfter} ct` : "Pending",
                sub:
                  service.weightLossPercent != null
                    ? `Loss ~${service.weightLossPercent}%`
                    : null,
                color: hasAfterWeight ? Accent.emerald : colors.textMuted,
              },
              {
                label: service.finalCost != null ? "Final cost" : "Cost",
                value: costValue ?? "—",
                sub:
                  service.finalCost == null && service.agreedPrice != null
                    ? "Agreed"
                    : null,
                color: costValue ? undefined : colors.textMuted,
              },
            ]}
          />
          {service.status === "overdue" ? (
            <Callout
              icon="error-outline"
              accent={Accent.rose}
              label={`Was due ${formatDate(service.expectedReturnDate)}`}
              value={formatRelativeDue(service.expectedReturnDate)}
              pill="Overdue"
            />
          ) : isDone ? (
            <Callout
              icon="check-circle"
              accent={Accent.emerald}
              label="Returned"
              value={
                service.dateReturned
                  ? formatDate(service.dateReturned)
                  : "Completed"
              }
              pill={
                service.weightLossPercent != null
                  ? `Loss ~${service.weightLossPercent}%`
                  : null
              }
            />
          ) : !isClosed ? (
            <Callout
              icon="event"
              accent={Accent.amber}
              label={`Expected back · ${formatDate(service.expectedReturnDate)}`}
              value={formatRelativeDue(service.expectedReturnDate)}
            />
          ) : null}
        </TitleBand>

        <DetailBand title="Progress">
          <ProgressSteps steps={steps} />
        </DetailBand>

        <DetailBand title="Provider">
          <View style={styles.partyRow}>
            <Pressable
              style={({ pressed }) => [styles.partyMain, pressed && styles.pressed]}
              onPress={openProvider}
              accessibilityRole="button"
              accessibilityLabel={`Open provider ${providerName}`}
            >
              <View>
                <ContactAvatar
                  name={providerName}
                  photoUrl={providerPhoto}
                  size={48}
                />
                <AvatarVerificationBadge
                  type={providerReputationBadge}
                  borderColor={colors.surfaceContainerLowest}
                />
              </View>
              <View style={styles.partyCopy}>
                <Text
                  style={[styles.partyName, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {providerName}
                </Text>
                <Text
                  style={[styles.partyCaption, { color: colors.onSurfaceVariant }]}
                  numberOfLines={1}
                >
                  {service.providerBusinessId ? "Lapidary" : "Contact"}
                </Text>
              </View>
            </Pressable>
            {providerPhone ? (
              <Pressable
                onPress={() => void Linking.openURL(openPhone(providerPhone))}
                style={({ pressed }) => [
                  styles.roundBtn,
                  { backgroundColor: `${Accent.blue}1F` },
                  pressed && styles.pressed,
                ]}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel="Call provider"
              >
                <Icon name="call" size={20} color={Accent.blue} />
              </Pressable>
            ) : null}
            {providerWhatsApp ? (
              <Pressable
                onPress={() =>
                  void Linking.openURL(openWhatsApp(providerWhatsApp))
                }
                style={({ pressed }) => [
                  styles.roundBtn,
                  { backgroundColor: `${WHATSAPP_GREEN}1F` },
                  pressed && styles.pressed,
                ]}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel="WhatsApp provider"
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
            {costRows.length ? <DetailRows rows={costRows} /> : null}
            <TotalRow
              label={service.finalCost != null ? "Final Cost" : "Total Estimate"}
              value={formatFace(
                service.finalCost ?? service.agreedPrice ?? 0,
                service.finalCostCurrency ?? service.agreedPriceCurrency,
              )}
              accent={service.finalCost != null ? Accent.emerald : undefined}
            />
          </DetailBand>
        ) : null}

        {service.instructions ? (
          <DetailBand title="Instructions">
            <Text
              style={[styles.body, { color: colors.onSurfaceVariant }]}
              selectable={false}
            >
              {service.instructions}
            </Text>
          </DetailBand>
        ) : null}

        {actionable ? (
          <DetailBand title="Mark as received">
            <Text style={[styles.bandHint, { color: colors.textMuted }]}>
              Record the returned weight and final cost to close this service.
            </Text>
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
            <ReceiptField value={receipt} onChange={setReceipt} />
            <Button
              title="Mark Received & Complete"
              icon="check-circle"
              loading={pendingKey === "complete"}
              disabled={busy && pendingKey !== "complete"}
              onPress={handleComplete}
            />
          </DetailBand>
        ) : null}

        {isProvider && canRespondServiceCancellation(service, user!.uid) ? (
          <DetailBand title="Cancellation request">
            <Callout
              icon="hourglass-top"
              accent={Accent.amber}
              label="The trader asked to cancel this service."
              value="Awaiting your response"
              style={styles.calloutFlush}
            />
            <View style={styles.buttonRow}>
              <Button
                title="Accept"
                icon="check"
                loading={pendingKey === "cancel-accepted"}
                disabled={busy}
                onPress={() => handleRespondCancel("accepted")}
                style={styles.flex}
              />
              <Button
                title="Decline"
                variant="secondary"
                icon="close"
                loading={pendingKey === "cancel-rejected"}
                disabled={busy}
                onPress={() => handleRespondCancel("rejected")}
                style={styles.flex}
              />
            </View>
          </DetailBand>
        ) : null}
      </ThemedScrollView>

      <DetailHeader title={serviceTypeLabel} solid={headerSolid} />

      {showOwnerActions ? (
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
          {canRequestCancel ? (
            <Button
              title="Request cancel"
              icon="cancel"
              variant="secondary"
              loading={pendingKey === "request-cancel"}
              disabled={busy}
              onPress={handleRequestCancel}
              accessibilityLabel="Request cancellation"
              style={styles.flex}
            />
          ) : null}
          {canDelete ? (
            <Button
              title="Delete"
              icon="delete-outline"
              variant="destructive"
              disabled={busy}
              onPress={handleDelete}
              accessibilityLabel="Delete service"
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

  body: { ...text, fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 23 },
  bandHint: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 19, marginTop: -4 },
  calloutFlush: { marginTop: 0 },
  buttonRow: { flexDirection: "row", gap: Spacing.sm },
});
