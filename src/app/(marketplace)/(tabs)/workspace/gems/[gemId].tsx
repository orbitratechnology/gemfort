import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Link, router, useLocalSearchParams } from "expo-router";
import { format } from "date-fns";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
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
import { CountryLabel } from "@/components/ui/country-flag";
import {
  Accent,
  Callout,
  DetailBand,
  DetailHeader,
  DetailRows,
  KeyStats,
  StatusChip,
  StatusGrid,
  TitleBand,
  useCollapsingHeader,
  type DetailRowProps,
} from "@/components/ui/detail-kit";
import { AvatarVerificationBadge } from "@/components/ui/verification-badge";
import {
  GemCertificateBadge,
  GemCertificateCard,
} from "@/components/workspace/gem-certificate";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemArtwork, gemTint } from "@/components/workspace/gem-artwork";
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from "@/components/ui/currency-amount-field";
import { FlashList } from "@/components/ui/gesture-lists";
import { Icon, type IconName } from "@/components/ui/icon";
import { ImagePager } from "@/components/ui/image-pager";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import {
  PartyPickerSheet,
  type PartySelection,
} from "@/components/workspace/contact-picker-sheet";
import {
  GemActionsSheet,
  type GemActionItem,
} from "@/components/workspace/gem-actions-sheet";
import { PaymentMethodPicker } from "@/components/workspace/payment-method-picker";
import {
  FontFamily,
  Radius,
  Spacing,
  type ThemeColors,
  Typography,
} from "@/constants/design-tokens";
import {
  findColorShade,
  formatCostTypeLabel,
  formatGemStatusLabel,
  formatGemType,
  formatOptionLabel,
  formatShapeLabel,
  formatTreatmentLabel,
  GEM_CLARITIES,
} from "@/constants/gem-options";
import { ROLE_LABELS, resolveProfileRole } from "@/constants/roles";
import { paymentMethodOptions } from "@/constants/payment-methods";
import { businessReputationBadgeForBusiness } from "@/constants/business-reputation";
import {
  fetchBusiness,
  fetchBusinessByOwnerUid,
} from "@/features/marketplace/marketplace-service";
import {
  subscribeBusiness,
  subscribeBusinessByOwnerUid,
  subscribeContacts,
  subscribeGem,
  subscribeGemCosts,
  subscribeGemEvents,
  subscribeGemServices,
} from "@/features/workspace/firestore-subscriptions";
import {
  formatLifecycleSummary,
  gemActionAvailability,
  normalizeGemTreatment,
  resolveGemLifecycle,
  resolveGemSaleStatus,
} from "@/features/workspace/gem-lifecycle";
import {
  cancelGemTransferRequest,
  createGemTransferRequest,
  recordGemSale,
} from "@/features/workspace/gem-transfer-api";
import {
  fetchContacts,
  fetchGem,
  fetchGemCosts,
  fetchGemEvents,
  fetchGemServices,
  removeGemFromMarket,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import { listingShareUrl, shareFile, shareLink } from "@/lib/share";
import { formatRelativeTime, shortGemId, toJsDate } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { confirm } from "@/providers/confirm-bridge";
import { useToast } from "@/providers/toast-provider";
import type {
  GemEvent,
  GemPaymentMethod,
  GemStatus,
  ServiceRecord,
} from "@/types";

const INITIAL_HISTORY_COUNT = 4;
const GEM_PAYMENT_METHODS = paymentMethodOptions([
  "cash",
  "bank_transfer",
  "cheque",
  "bill",
  "other",
] as const);

const STATUS_ICONS: Partial<Record<GemStatus, IconName>> = {
  rough: "spa",
  with_cutter: "content-cut",
  cut: "content-cut",
  with_heater: "local-fire-department",
  heated: "local-fire-department",
  with_polisher: "auto-awesome",
  polished: "auto-awesome",
  ready_for_sale: "sell",
  on_ap: "ap",
  on_trip: "trip",
  listed: "storefront",
  sold: "check-circle",
  returned: "undo",
};

function eventIcon(eventType: string): IconName {
  const t = eventType.toLowerCase();
  if (t.includes("cut")) return "content-cut";
  if (t.includes("heat")) return "local-fire-department";
  if (t.includes("polish")) return "auto-awesome";
  if (t.includes("ap") || t.includes("consign")) return "ap";
  if (t.includes("sale") || t.includes("sold")) return "sell";
  if (t.includes("list") || t.includes("market")) return "storefront";
  if (t.includes("service")) return "service";
  if (t.includes("status")) return "swap-horiz";
  if (t.includes("cost") || t.includes("purchase")) return "payments";
  return "history";
}

function serviceTypeLabel(serviceType: string): string {
  const labels: Record<string, string> = {
    cutting: "Cutting",
    recutting: "Recutting",
    heating: "Heating",
    reheating: "Reheating",
    heat_treatment: "Heat treatment",
    polishing: "Polishing",
    repolishing: "Repolishing",
  };
  return labels[serviceType] ?? serviceType.replace(/_/g, " ");
}

function serviceStatusLabel(status: ServiceRecord["status"]): string {
  if (status === "received_back" || status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  if (status === "overdue") return "Overdue";
  if (status === "cancelled") return "Cancelled";
  if (status === "cancellation_requested") return "Cancellation requested";
  return "Pending";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function GemHistoryRow({
  event,
  index,
  isLast,
  colors,
}: {
  event: GemEvent;
  index: number;
  isLast: boolean;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View
          style={[
            styles.timelineIconWrap,
            {
              backgroundColor:
                index === 0
                  ? colors.primaryContainer
                  : colors.surfaceContainerHigh,
            },
          ]}
        >
          <Icon
            name={eventIcon(event.eventType || event.description)}
            size={14}
            color={
              index === 0 ? colors.onPrimaryContainer : colors.onSurfaceVariant
            }
          />
        </View>
        {!isLast ? (
          <View
            style={[
              styles.timelineLine,
              { backgroundColor: colors.outlineVariant },
            ]}
          />
        ) : null}
      </View>
      <View style={styles.timelineBody}>
        <Text style={[styles.timelineDate, { color: colors.textMuted }]}>
          {formatRelativeTime(event.createdAt)}
        </Text>
        <Text style={[styles.timelineTitle, { color: colors.onSurface }]}>
          {event.description}
        </Text>
        {event.weightAtEvent != null ? (
          <View style={styles.timelineMetaRow}>
            <Icon name="scale" size={12} color={colors.onSurfaceVariant} />
            <Text
              style={[styles.timelineMeta, { color: colors.onSurfaceVariant }]}
            >
              {event.weightAtEvent} ct
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function GemHistoryTimeline({
  events,
  colors,
}: {
  events: GemEvent[];
  colors: ThemeColors;
}) {
  return (
    <View style={styles.timeline}>
      {events.map((event, index) => (
        <GemHistoryRow
          key={event.id}
          event={event}
          index={index}
          isLast={index === events.length - 1}
          colors={colors}
        />
      ))}
    </View>
  );
}

function isListedState(
  gem: { isListedOnMarketplace: boolean },
  outcome: string | null,
): boolean {
  return gem.isListedOnMarketplace || outcome === "listed";
}

export default function GemDetailScreen() {
  const { gemId, sell, tripId, tripGemId } = useLocalSearchParams<{
    gemId: string;
    sell?: string;
    tripId?: string;
    tripGemId?: string;
  }>();
  const { user, profile } = useAuth();
  const { colors } = useAppTheme();
  const { formatStored, formatBase } = usePreferredMoney();
  const preferred = usePreferredCurrency();
  const toast = useToast();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const heroHeight = Math.round(windowWidth * 0.9);
  // Floating hero controls become a solid titled bar once the hero scrolls away.
  const { solid: headerSolid, scrollProps } = useCollapsingHeader(heroHeight);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferParty, setTransferParty] = useState<PartySelection | null>(
    null,
  );
  const [transferPaymentMethod, setTransferPaymentMethod] =
    useState<GemPaymentMethod>("cash");
  const [soldAmount, setSoldAmount] = useState<CurrencyAmountValue>({
    amount: "",
    currency: preferred,
  });
  const [soldError, setSoldError] = useState<string | null>(null);

  const { data: gem, isLoading } = useFirestoreLiveQuery({
    queryKey: ["gem", gemId],
    queryFn: () => fetchGem(gemId!),
    subscribe: (onData, onError) => subscribeGem(gemId!, onData, onError),
    enabled: !!gemId,
  });
  const ownerUid = gem?.ownerUid ?? user?.uid;

  const { data: costs = [] } = useFirestoreLiveQuery({
    queryKey: ["gem-costs", ownerUid, gemId],
    queryFn: () => fetchGemCosts(ownerUid!, gemId!),
    subscribe: (onData, onError) =>
      subscribeGemCosts(ownerUid!, gemId!, onData, onError),
    enabled: !!ownerUid && !!gemId,
  });

  const { data: events = [] } = useFirestoreLiveQuery({
    queryKey: ["gem-events", ownerUid, gemId],
    queryFn: () => fetchGemEvents(ownerUid!, gemId!),
    subscribe: (onData, onError) =>
      subscribeGemEvents(ownerUid!, gemId!, onData, onError),
    enabled: !!ownerUid && !!gemId,
  });

  const { data: services = [] } = useFirestoreLiveQuery({
    queryKey: ["gem-services", ownerUid, gemId],
    queryFn: () => fetchGemServices(ownerUid!, gemId!),
    subscribe: (onData, onError) =>
      subscribeGemServices(ownerUid!, gemId!, onData, onError),
    enabled: !!ownerUid && !!gemId,
  });

  const { data: business } = useFirestoreLiveQuery({
    queryKey: ["business-by-owner", ownerUid],
    queryFn: () => fetchBusinessByOwnerUid(ownerUid!),
    subscribe: (onData, onError) =>
      subscribeBusinessByOwnerUid(ownerUid!, onData, onError),
    enabled: !!ownerUid,
  });
  const soldToBusinessId = gem?.soldToBusinessId ?? null;
  const { data: soldToBusiness } = useFirestoreLiveQuery({
    queryKey: ["gem-sold-to-business", soldToBusinessId],
    queryFn: () => fetchBusiness(soldToBusinessId!),
    subscribe: (onData, onError) =>
      subscribeBusiness(soldToBusinessId!, onData, onError),
    enabled: !!soldToBusinessId,
  });

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    subscribe: (onData, onError) =>
      subscribeContacts(user!.uid, onData, onError),
    enabled: !!user,
  });

  async function handleRemoveFromMarket() {
    if (!user || !gem) return;
    const ok = await confirm({
      title: "Remove",
      message: "This gem will no longer appear on Market.",
      confirmLabel: "Remove",
      tone: "destructive",
      onConfirm: () => removeGemFromMarket(gem.id, user.uid),
    });
    if (!ok) return;
    await queryClient.invalidateQueries({ queryKey: ["gem", gemId] });
    await queryClient.invalidateQueries({ queryKey: ["gems", user.uid] });
    toast.success("Removed from Market");
  }

  function openSoldChooser() {
    if (!user || !gem) return;
    const ask = gem.askingPrice != null ? String(gem.askingPrice) : "";
    const askCur = (gem.askingPriceCurrency as typeof preferred) || preferred;
    setSoldAmount({ amount: ask, currency: askCur });
    setSoldError(null);
    setTransferParty(null);
    setTransferPaymentMethod("cash");
    setTransferOpen(true);
  }

  async function handleSaleRequest() {
    if (!user || !gem || transferSaving) return;
    const amount = parseFloat(soldAmount.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSoldError("Enter a valid sale amount.");
      return;
    }
    setSoldError(null);
    if (!transferParty) {
      setSoldError("Select a Trader or Contact.");
      return;
    }
    setTransferSaving(true);
    await Promise.resolve()
      .then(async () => {
        if (transferParty.source === "business") {
          await createGemTransferRequest({
            gemId: gem.id,
            recipientBusinessId: transferParty.businessId,
            recipientContactId: transferParty.linkedContactId ?? null,
            recipientName: transferParty.label,
            amount,
            currency: soldAmount.currency,
            paymentMethod: transferPaymentMethod,
            sourceTripId: sell === "1" ? tripId : null,
            sourceTripGemId: sell === "1" ? tripGemId : null,
          });
        } else {
          await recordGemSale({
            gemId: gem.id,
            recipientContactId: transferParty.contactId,
            recipientName: transferParty.label,
            amount,
            currency: soldAmount.currency,
            paymentMethod: transferPaymentMethod,
            sourceTripId: sell === "1" ? tripId : null,
            sourceTripGemId: sell === "1" ? tripGemId : null,
          });
        }
        await queryClient.invalidateQueries({ queryKey: ["gem", gemId] });
        await queryClient.invalidateQueries({ queryKey: ["gems", user.uid] });
        await queryClient.invalidateQueries({ queryKey: ["transactions"] });
        setTransferOpen(false);
        toast.success(
          transferParty.source === "business"
            ? "Sale request sent — waiting for the trader to accept"
            : `Sale recorded to ${transferParty.label}.`,
        );
      })
      .catch((e) => {
        setSoldError(
          friendlyError(
            e,
            transferParty.source === "business"
              ? "Could not send the sale request."
              : "Could not record the sale.",
          ),
        );
      })
      .finally(() => {
        setTransferSaving(false);
      });
  }

  async function handleMarkUnsold() {
    if (!user || !gem?.saleTransferRequestId || transferSaving) return;
    const ok = await confirm({
      title: "Mark unsold?",
      message:
        "Cancel the pending trader request and return the gem to active inventory.",
      confirmLabel: "Mark unsold",
      tone: "destructive",
      onConfirm: async () => {
        await cancelGemTransferRequest(gem.saleTransferRequestId!);
      },
    });
    if (!ok) return;
    setTransferSaving(true);
    await Promise.resolve()
      .then(async () => {
        await queryClient.invalidateQueries({ queryKey: ["gem", gemId] });
        await queryClient.invalidateQueries({ queryKey: ["gems", user.uid] });
        toast.success("Gem marked unsold");
      })
      .catch((e) => {
        toast.error(friendlyError(e, "Could not mark the gem unsold."));
      })
      .finally(() => {
        setTransferSaving(false);
      });
  }

  if (isLoading || !gem) {
    return (
      <View
        style={[
          styles.safe,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <StackHeader title="Gem Details" />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>
            {isLoading ? "Loading…" : "Gem not found"}
          </Text>
        </View>
      </View>
    );
  }

  const askCurrency = gem.askingPriceCurrency ?? gem.totalCostCurrency ?? "LKR";
  const askBase =
    gem.askingPriceBase ??
    (gem.askingPrice != null && askCurrency === "LKR" ? gem.askingPrice : null);
  const costBase = gem.totalCost;
  const profitBase = askBase != null ? askBase - costBase : null;
  const roi =
    profitBase != null && costBase > 0
      ? ((profitBase / costBase) * 100).toFixed(1)
      : null;
  const lifecycle = resolveGemLifecycle(gem);
  const statusLabel = formatLifecycleSummary(lifecycle);
  const stoneLabel = formatGemStatusLabel(lifecycle.stoneStage);
  const locationLabel =
    gem.currentLocation?.trim() ||
    (lifecycle.custody
      ? lifecycle.custody === "with_cutter" ||
        lifecycle.custody === "with_heater" ||
        lifecycle.custody === "with_polisher"
        ? "Lapidary"
        : formatGemStatusLabel(lifecycle.custody)
      : "With me");
  const saleStatus = resolveGemSaleStatus(gem);
  const saleLabel =
    saleStatus === "pending"
      ? "Awaiting trader"
      : saleStatus === "sold"
        ? "Sold"
        : "Unsold";
  const soldTraderName =
    gem.soldToBusinessName?.split(" · ")[0]?.trim() ||
    soldToBusiness?.businessName?.trim() ||
    gem.soldToName?.split(" · ")[0]?.trim() ||
    "Trader";
  const soldTraderAvatar =
    gem.soldToBusinessLogoUrl ?? soldToBusiness?.logoUrl ?? null;
  const shapeLabel = formatShapeLabel(gem.shape || gem.cutType);
  const treatmentLabel = formatTreatmentLabel(
    normalizeGemTreatment(
      gem.treatmentStatus,
      lifecycle.stoneStage,
      gem.isNatural,
    ).treatmentStatus,
  );

  const photos = (gem.photoUrls ?? []).filter(
    (u): u is string => typeof u === "string" && u.trim().length > 0,
  );
  const photo = photos[0] ?? null;
  const certificate = gem.certificate?.url ? gem.certificate : null;
  const gemTitle = gem.title?.trim() || formatGemType(gem.gemType);
  const gemDisplayId = shortGemId(gem.id);
  const gemSummary = `${gemTitle} · ${formatGemType(gem.gemType)} ${gem.currentWeight}ct`;
  const gemIdForShare = gem.id;
  const listingIdForShare = gem.marketplaceListingId;
  const historyEvents = [...events].reverse();
  const visibleHistoryEvents = historyEvents.slice(0, INITIAL_HISTORY_COUNT);
  const costLines = [...costs].sort((a, b) => {
    const aMs = toJsDate(a.date ?? a.createdAt)?.getTime() ?? 0;
    const bMs = toJsDate(b.date ?? b.createdAt)?.getTime() ?? 0;
    return bMs - aMs;
  });
  const serviceHistory = [...services].sort((a, b) => {
    const aMs =
      toJsDate(a.dateReturned ?? a.dateGiven ?? a.createdAt)?.getTime() ?? 0;
    const bMs =
      toJsDate(b.dateReturned ?? b.dateGiven ?? b.createdAt)?.getTime() ?? 0;
    return bMs - aMs;
  });

  const hasAsk = gem.askingPrice != null;
  const marketPriceLabel = hasAsk
    ? formatStored({
        amount: gem.askingPrice!,
        currency: askCurrency,
        amountBase: gem.askingPriceBase,
      })
    : "Not listed";
  const costLabel = formatBase(costBase);
  const perCaratLabel =
    hasAsk && gem.currentWeight > 0
      ? `${formatStored({
          amount: gem.askingPrice! / gem.currentWeight,
          currency: askCurrency,
          amountBase: askBase != null ? askBase / gem.currentWeight : null,
        })} / ct`
      : null;

  const businessDisplayName = business?.businessName?.trim() || "Your Business";
  const ownerRole =
    business?.businessType === "lapidary"
      ? "Lapidary"
      : (ROLE_LABELS[resolveProfileRole(profile)] ?? "Trader");
  const ownerAvatar = business?.logoUrl ?? null;
  const ownerReputationBadge = businessReputationBadgeForBusiness(business);
  const ownerInitials = initials(businessDisplayName);
  const tint = gemTint(gem);
  const colorHit = gem.colorPrimary ? findColorShade(gem.colorPrimary) : null;
  const colorLabel = colorHit
    ? colorHit.shade.label.replace(/\s*\(.*\)$/, "")
    : gem.colorPrimary;
  const clarityLabel = gem.clarity
    ? formatOptionLabel(GEM_CLARITIES, gem.clarity) ||
      gem.clarity.replace(/_/g, " ")
    : null;
  const acquiredOn = toJsDate(gem.acquisitionDate);
  const acquiredLabel = acquiredOn ? format(acquiredOn, "d MMM yyyy") : null;
  const acquisitionLabel = gem.acquisitionType
    ? gem.acquisitionType.charAt(0).toUpperCase() +
      gem.acquisitionType.slice(1).replace(/_/g, " ")
    : null;
  const hasRoughWeight =
    gem.roughWeight > 0 && gem.roughWeight !== gem.currentWeight;
  const yieldPct = hasRoughWeight
    ? Math.round((gem.currentWeight / gem.roughWeight) * 100)
    : null;
  const statusAccent =
    saleStatus === "sold" ||
    lifecycle.outcome === "sold" ||
    lifecycle.outcome === "returned"
      ? Accent.slate
      : isListedState(gem, lifecycle.outcome)
        ? Accent.blue
        : lifecycle.custody
          ? Accent.amber
          : Accent.emerald;
  const saleAccent =
    saleStatus === "sold"
      ? Accent.emerald
      : saleStatus === "pending"
        ? Accent.amber
        : Accent.slate;
  const profitAccent =
    profitBase != null && profitBase < 0 ? Accent.rose : Accent.emerald;
  const specRows: ({ key: string } & DetailRowProps)[] = [
    {
      key: "weight",
      icon: "scale",
      accent: colors.onSurfaceVariant,
      label: "Weight",
      value:
        yieldPct != null
          ? `${gem.currentWeight} ct · ${yieldPct}% yield`
          : `${gem.currentWeight} ct`,
    },
    ...(shapeLabel
      ? [
          {
            key: "shape",
            icon: "category" as IconName,
            accent: Accent.violet,
            label: "Shape",
            value: shapeLabel,
          },
        ]
      : []),
    ...(colorLabel
      ? [
          {
            key: "color",
            leading: (
              <View
                style={[
                  styles.swatch,
                  {
                    backgroundColor:
                      colorHit?.shade.hex ?? tint ?? colors.outline,
                  },
                ]}
              />
            ),
            accent: colorHit?.shade.hex ?? tint ?? undefined,
            label: "Colour",
            value: colorLabel,
          },
        ]
      : []),
    ...(clarityLabel
      ? [
          {
            key: "clarity",
            icon: "visibility" as IconName,
            accent: Accent.blue,
            label: "Clarity",
            value: clarityLabel,
          },
        ]
      : []),
    {
      key: "treatment",
      icon: "science",
      accent: Accent.amber,
      label: "Treatment",
      value: treatmentLabel || "None",
    },
    {
      key: "origin",
      icon: "public",
      accent: Accent.emerald,
      label: "Origin",
      value: gem.originCountry ? (
        <CountryLabel
          country={gem.originCountry}
          size="sm"
          textStyle={[styles.specValue, { color: colors.onSurface }]}
          numberOfLines={1}
        />
      ) : (
        "Unknown"
      ),
    },
    ...(acquiredLabel
      ? [
          {
            key: "acquired",
            icon: "event" as IconName,
            accent: colors.onSurfaceVariant,
            label: "Acquired",
            value: acquisitionLabel
              ? `${acquiredLabel} · ${acquisitionLabel}`
              : acquiredLabel,
          },
        ]
      : []),
  ];

  const bottomBarPad = Math.max(insets.bottom, 12);
  const isOwnGem = !!user && user.uid === gem.ownerUid;
  const actionAvailability = gemActionAvailability(gem);
  const cuttingServiceType =
    lifecycle.stoneStage === "cut" ? "recutting" : "cutting";
  const heatingServiceType =
    lifecycle.stoneStage === "heated" ? "reheating" : "heating";
  const polishingServiceType =
    lifecycle.stoneStage === "polished" ? "repolishing" : "polishing";
  const canSellFromTrip =
    sell === "1" &&
    typeof tripId === "string" &&
    typeof tripGemId === "string" &&
    (lifecycle.custody === "on_trip" || gem.status === "on_trip");
  const canMarkSold = actionAvailability.mark_sold || canSellFromTrip;
  const isListed =
    isOwnGem && (gem.isListedOnMarketplace || lifecycle.outcome === "listed");
  const primaryAction: {
    title: string;
    icon: IconName;
    onPress: () => void;
  } | null = canMarkSold
    ? { title: "Sold", icon: "price-check", onPress: openSoldChooser }
    : actionAvailability.mark_unsold
      ? {
          title: "Mark unsold",
          icon: "undo",
          onPress: () => void handleMarkUnsold(),
        }
      : null;
  const openRoute = (href: string) => () => router.push(href as never);
  const sheetActions: GemActionItem[] = [
    ...(actionAvailability.send_for_cutting
      ? [
          {
            id: "cut",
            group: "work" as const,
            title: cuttingServiceType === "recutting" ? "Recut" : "Cut",
            description: "Send to a cutter and track the job",
            icon: "content-cut" as IconName,
            onPress: openRoute(
              `/(marketplace)/services/add?gemId=${gem.id}&serviceType=${cuttingServiceType}`,
            ),
          },
        ]
      : []),
    ...(actionAvailability.send_for_heating
      ? [
          {
            id: "heat",
            group: "work" as const,
            title: heatingServiceType === "reheating" ? "Reheat" : "Heat",
            description: "Send for heat treatment",
            icon: "local-fire-department" as IconName,
            image: require("@/assets/images/lapidary-icon.png"),
            onPress: openRoute(
              `/(marketplace)/services/add?gemId=${gem.id}&serviceType=${heatingServiceType}`,
            ),
          },
        ]
      : []),
    ...(actionAvailability.send_for_polishing
      ? [
          {
            id: "polish",
            group: "work" as const,
            title:
              polishingServiceType === "repolishing" ? "Repolish" : "Polish",
            description: "Send for polishing",
            icon: "auto-awesome" as IconName,
            onPress: openRoute(
              `/(marketplace)/services/add?gemId=${gem.id}&serviceType=${polishingServiceType}`,
            ),
          },
        ]
      : []),
    ...(actionAvailability.give_on_ap
      ? [
          {
            id: "ap",
            group: "trade" as const,
            title: "Give on AP",
            description: "Hand it to a trader on approval",
            icon: "ap" as IconName,
            image: require("@/assets/images/ap-icon.png"),
            onPress: openRoute(`/(marketplace)/ap/add?gemId=${gem.id}`),
          },
        ]
      : []),
    ...(actionAvailability.list_on_market
      ? [
          {
            id: "list",
            group: "trade" as const,
            title: "Sell on Market",
            description: "List it for buyers on GemFort Market",
            icon: "storefront" as IconName,
            onPress: openRoute(`/listings/create?workspaceGemId=${gem.id}`),
          },
        ]
      : []),
    ...(actionAvailability.remove_from_market
      ? [
          {
            id: "unlist",
            group: "trade" as const,
            title: "Remove from Market",
            description: "Take the listing down",
            icon: "remove-shopping-cart" as IconName,
            destructive: true,
            onPress: () => void handleRemoveFromMarket(),
          },
        ]
      : []),
  ];
  const hasBottomActions =
    isOwnGem && (primaryAction != null || sheetActions.length > 0);

  async function handleShareGem() {
    if (photo && (photo.startsWith("file:") || photo.startsWith("content:"))) {
      await shareFile({
        uri: photo,
        mimeType: "image/jpeg",
        dialogTitle: gemTitle,
        UTI: "public.jpeg",
      });
      return;
    }
    await shareLink({
      message: `GemFort gem: ${gemSummary}`,
      url: listingIdForShare
        ? listingShareUrl(listingIdForShare)
        : `gemfort://workspace/gems/${gemIdForShare}`,
      title: gemTitle,
    });
  }

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar style={photos.length && !headerSolid ? "light" : "auto"} />

      <ThemedScrollView
        contentContainerStyle={{
          paddingBottom: hasBottomActions ? 96 + bottomBarPad : 48,
        }}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        <View style={{ height: heroHeight }}>
          {photos.length ? (
            <ImagePager
              urls={photos}
              aspectRatio={windowWidth / heroHeight}
              edgeToEdge
              style={{ height: heroHeight }}
              accessibilityLabel={`${formatGemType(gem.gemType)} photos`}
              wrapFirstPage={(node) => (
                <Link.AppleZoomTarget>{node}</Link.AppleZoomTarget>
              )}
              overlay={null}
            />
          ) : (
            <Link.AppleZoomTarget>
              <GemArtwork
                gem={gem}
                artScale={0.78}
                style={{
                  width: windowWidth,
                  height: heroHeight,
                  paddingTop: insets.top,
                }}
              />
            </Link.AppleZoomTarget>
          )}
        </View>

        <TitleBand
          overlapHero
          chips={
            <>
              <StatusChip label={statusLabel} accent={statusAccent} />
              {certificate ? <GemCertificateBadge /> : null}
            </>
          }
          title={gemTitle}
          subtitle={[
            formatGemType(gem.gemType),
            gem.variety,
            gemDisplayId,
          ]
            .filter(Boolean)
            .join(" · ")}
          subtitleDot={tint}
        >
          <KeyStats
            items={[
              {
                label: "Weight",
                value: `${gem.currentWeight} ct`,
                sub: hasRoughWeight ? `${gem.roughWeight} ct rough` : null,
              },
              {
                label: "Asking",
                value: hasAsk ? marketPriceLabel : "Not listed",
                sub: hasAsk ? perCaratLabel : null,
                color: hasAsk ? Accent.emerald : colors.textMuted,
              },
              { label: "Cost", value: costLabel },
            ]}
          />
          {profitBase != null ? (
            <Callout
              icon={profitBase < 0 ? "trending-down" : "trending-up"}
              accent={profitAccent}
              label={profitBase < 0 ? "Estimated loss" : "Estimated profit"}
              value={formatBase(profitBase)}
              pill={roi ? `${profitBase < 0 ? "" : "+"}${roi}%` : null}
            />
          ) : null}
        </TitleBand>

        <DetailBand title="Status">
          <StatusGrid
            tiles={[
              {
                icon: STATUS_ICONS[lifecycle.stoneStage] ?? "spa",
                label: "State",
                value: stoneLabel,
                accent: Accent.violet,
              },
              {
                icon: lifecycle.custody
                  ? (STATUS_ICONS[lifecycle.custody] ?? "place")
                  : "person",
                label: "Location",
                value: locationLabel,
                accent: Accent.amber,
              },
              {
                icon: "storefront",
                label: "Market",
                value: isListed ? "On market" : "Not listed",
                accent: isListed ? Accent.blue : Accent.slate,
              },
              {
                icon:
                  saleStatus === "pending"
                    ? "schedule"
                    : saleStatus === "sold"
                      ? "check-circle"
                      : "sell",
                label: "Sale",
                value: saleLabel,
                accent: saleAccent,
              },
            ]}
          />

          {saleStatus !== "unsold" ? (
            <View
              style={[
                styles.partyCard,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Text
                style={[
                  styles.partyCardTitle,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                {saleStatus === "pending"
                  ? "Sale awaiting acceptance"
                  : "Sold to"}
              </Text>
              {soldToBusinessId ? (
                <Pressable
                  style={styles.partyRow}
                  onPress={() =>
                    router.push(`/business/${soldToBusinessId}` as never)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${soldTraderName} profile`}
                >
                  <ContactAvatar
                    name={soldTraderName}
                    photoUrl={soldTraderAvatar}
                    size={40}
                  />
                  <Text
                    style={[styles.partyName, { color: colors.onSurface }]}
                    numberOfLines={1}
                  >
                    {soldTraderName}
                  </Text>
                  <Icon name="chevron-right" size={20} color={colors.outline} />
                </Pressable>
              ) : (
                <Text style={[styles.partyName, { color: colors.onSurface }]}>
                  {gem.soldToName || "Trader"}
                </Text>
              )}
              <View style={styles.partyMeta}>
                {gem.soldPrice != null ? (
                  <Text
                    style={[styles.partyMetaText, { color: colors.onSurface }]}
                  >
                    {formatStored({
                      amount: gem.soldPrice,
                      currency: gem.soldPriceCurrency || askCurrency,
                      amountBase: gem.soldPriceBase,
                    })}
                  </Text>
                ) : null}
                {gem.salePaymentMethod ? (
                  <Text
                    style={[
                      styles.partyMetaMuted,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    {gem.salePaymentMethod.replace(/_/g, " ")}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : gem.acquiredFromUid ? (
            <View
              style={[
                styles.partyCard,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Text
                style={[
                  styles.partyCardTitle,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                Acquired from
              </Text>
              <Text style={[styles.partyName, { color: colors.onSurface }]}>
                {gem.acquiredFromName || "Previous owner"}
              </Text>
              <View style={styles.partyMeta}>
                {gem.lastSoldPrice != null ? (
                  <Text
                    style={[styles.partyMetaText, { color: colors.onSurface }]}
                  >
                    {formatStored({
                      amount: gem.lastSoldPrice,
                      currency: gem.lastSoldPriceCurrency || askCurrency,
                    })}
                  </Text>
                ) : null}
                {gem.lastSalePaymentMethod ? (
                  <Text
                    style={[
                      styles.partyMetaMuted,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    {gem.lastSalePaymentMethod.replace(/_/g, " ")}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </DetailBand>

        <DetailBand title="Specifications">
          <DetailRows rows={specRows} />
        </DetailBand>

        <DetailBand title="Owner">
          <View style={styles.ownerRow}>
            <View style={styles.ownerAvatarWrap}>
              <View
                style={[
                  styles.ownerAvatar,
                  { backgroundColor: colors.primaryContainer },
                ]}
              >
                {ownerAvatar ? (
                  <Image
                    source={{ uri: ownerAvatar }}
                    style={styles.ownerAvatarImg}
                    contentFit="cover"
                  />
                ) : (
                  <Text
                    style={[
                      styles.ownerInitials,
                      { color: colors.onPrimaryContainer },
                    ]}
                  >
                    {ownerInitials || "?"}
                  </Text>
                )}
              </View>
              <AvatarVerificationBadge
                type={ownerReputationBadge}
                borderColor={colors.surfaceContainerLowest}
              />
            </View>
            <View style={styles.ownerText}>
              <Text
                style={[styles.ownerName, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                {businessDisplayName}
              </Text>
              <Text
                style={[styles.ownerRole, { color: colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {ownerRole}
              </Text>
            </View>
          </View>
        </DetailBand>

        {certificate ? (
          <DetailBand title="Certificate">
            <GemCertificateCard certificate={certificate} />
          </DetailBand>
        ) : null}

        {gem.notes ? (
          <DetailBand title="Private note">
            <Text
              style={[styles.notes, { color: colors.onSurfaceVariant }]}
              numberOfLines={notesExpanded ? undefined : 4}
              selectable={false}
            >
              {gem.notes}
            </Text>
            {gem.notes.length > 160 ? (
              <Pressable
                onPress={() => setNotesExpanded((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={notesExpanded ? "Show less" : "Read more"}
                style={styles.readMore}
              >
                <Text style={[styles.readMoreText, { color: colors.primary }]}>
                  {notesExpanded ? "Show less" : "Read more"}
                </Text>
                <Icon
                  name={notesExpanded ? "expand-less" : "expand-more"}
                  size={18}
                  color={colors.primary}
                />
              </Pressable>
            ) : null}
          </DetailBand>
        ) : null}

        <DetailBand title="Costs">
          <View>
            {serviceHistory.map((service, serviceIndex) => {
              const amount = service.finalCost ?? service.agreedPrice;
              const currency =
                service.finalCost != null
                  ? service.finalCostCurrency
                  : service.agreedPriceCurrency;
              return (
                <View
                  key={`service-${service.id}`}
                  style={[
                    styles.costRow,
                    serviceIndex > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.outlineVariant,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.specIcon,
                      { backgroundColor: `${Accent.violet}1A` },
                    ]}
                  >
                    <Icon
                      name={eventIcon(service.serviceType)}
                      size={17}
                      color={Accent.violet}
                    />
                  </View>
                  <View style={styles.costCopy}>
                    <Text
                      style={[styles.costTitle, { color: colors.onSurface }]}
                    >
                      {serviceTypeLabel(service.serviceType)}
                    </Text>
                    <Text
                      style={[
                        styles.costDesc,
                        { color: colors.onSurfaceVariant },
                      ]}
                      numberOfLines={2}
                    >
                      {serviceStatusLabel(service.status)}
                      {service.providerName?.trim()
                        ? ` · ${service.providerName.trim()}`
                        : ""}
                      {` · ${formatRelativeTime(service.dateReturned ?? service.dateGiven)}`}
                    </Text>
                  </View>
                  {amount != null && currency ? (
                    <Text
                      style={[styles.costValue, { color: colors.onSurface }]}
                    >
                      {formatStored({ amount, currency })}
                    </Text>
                  ) : null}
                </View>
              );
            })}
            {costLines.map((c, costIndex) => (
              <View
                key={c.id}
                style={[
                  styles.costRow,
                  serviceHistory.length + costIndex > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.outlineVariant,
                  },
                ]}
              >
                <View
                  style={[
                    styles.specIcon,
                    { backgroundColor: `${colors.onSurfaceVariant}1A` },
                  ]}
                >
                  <Icon
                    name="payments"
                    size={17}
                    color={colors.onSurfaceVariant}
                  />
                </View>
                <View style={styles.costCopy}>
                  <Text style={[styles.costTitle, { color: colors.onSurface }]}>
                    {formatCostTypeLabel(c.costType)}
                  </Text>
                  {c.description ? (
                    <Text
                      style={[
                        styles.costDesc,
                        { color: colors.onSurfaceVariant },
                      ]}
                      numberOfLines={2}
                    >
                      {c.description}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.costValue, { color: colors.onSurface }]}>
                  {formatStored({
                    amount: c.amount,
                    currency: c.currency,
                    amountBase: c.amountBase,
                  })}
                </Text>
              </View>
            ))}
            {!costLines.length && !serviceHistory.length ? (
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                No cost lines yet
              </Text>
            ) : null}
            <View
              style={[
                styles.totalRow,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Text style={[styles.totalLabel, { color: colors.onSurface }]}>
                Total cost
              </Text>
              <Text style={[styles.totalValue, { color: colors.onSurface }]}>
                {formatBase(gem.totalCost)}
              </Text>
            </View>
          </View>
        </DetailBand>

        <DetailBand
          title="History"
          trailing={
            historyEvents.length > INITIAL_HISTORY_COUNT ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Show all ${historyEvents.length} history events`}
                accessibilityHint="Opens the complete history in a scrollable sheet"
                onPress={() => setHistoryOpen(true)}
                hitSlop={8}
                style={styles.seeAll}
              >
                <Text style={[styles.seeAllText, { color: colors.primary }]}>
                  See all {historyEvents.length}
                </Text>
                <Icon name="chevron-right" size={18} color={colors.primary} />
              </Pressable>
            ) : null
          }
        >
          {historyEvents.length ? (
            <GemHistoryTimeline events={visibleHistoryEvents} colors={colors} />
          ) : (
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              No events yet
            </Text>
          )}
        </DetailBand>
      </ThemedScrollView>

      <DetailHeader
        title={gemTitle}
        solid={headerSolid}
        actions={[
          ...(isOwnGem
            ? [
                {
                  icon: "edit" as IconName,
                  label: "Edit gem",
                  onPress: () =>
                    router.push({
                      pathname: "/(marketplace)/gems/edit",
                      params: { gemId: gem.id },
                    } as never),
                },
              ]
            : []),
          { icon: "share", label: "Share gem", onPress: () => void handleShareGem() },
        ]}
      />

      {hasBottomActions ? (
        <View
          style={[
            styles.actionBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.outlineVariant,
              paddingBottom: bottomBarPad,
            },
          ]}
        >
          {primaryAction ? (
            <Button
              title={primaryAction.title}
              icon={primaryAction.icon}
              disabled={transferSaving}
              onPress={primaryAction.onPress}
              style={styles.actionBarBtn}
            />
          ) : null}
          {sheetActions.length > 0 ? (
            <Button
              title={primaryAction ? "More actions" : "Gem actions"}
              icon="more-horiz"
              variant={primaryAction ? "secondary" : "primary"}
              disabled={transferSaving}
              onPress={() => setActionsOpen(true)}
              style={styles.actionBarBtn}
            />
          ) : null}
        </View>
      ) : null}

      <GemActionsSheet
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        actions={sheetActions}
      />

      <BottomSheet
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`History · ${historyEvents.length}`}
        scrollable={false}
      >
        <FlashList
          data={historyEvents}
          keyExtractor={(event) => event.id}
          style={styles.historyList}
          contentContainerStyle={styles.historyListContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <GemHistoryRow
              event={item}
              index={index}
              isLast={index === historyEvents.length - 1}
              colors={colors}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              No events yet
            </Text>
          }
        />
      </BottomSheet>

      <BottomSheet
        visible={transferOpen}
        onClose={() => {
          if (!transferSaving) setTransferOpen(false);
        }}
        title="Sell gem"
        footer={
          <Button
            title={
              transferSaving
                ? transferParty?.source === "business"
                  ? "Sending…"
                  : "Recording…"
                : transferParty?.source === "business"
                  ? "Send sale request"
                  : "Record sale"
            }
            icon={transferParty?.source === "business" ? "send" : "price-check"}
            loading={transferSaving}
            disabled={transferSaving}
            onPress={() => void handleSaleRequest()}
          />
        }
      >
        <Text style={[styles.statusSheetHint, { color: colors.textMuted }]}>
          {transferParty?.source === "business"
            ? "The trader must accept before ownership moves. Until then, the gem stays in your account and can be marked unsold."
            : "A contact sale is recorded immediately. The gem will appear in your Archive as sold; no transfer request is created."}
        </Text>
        <Pressable
          onPress={() => setPartyPickerOpen(true)}
          style={[
            styles.statusOption,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <Icon name="contacts" size={19} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.statusOptionLabel, { color: colors.onSurface }]}
            >
              {transferParty?.label ?? "Select trader or contact"}
            </Text>
            <Text style={[styles.statusSheetHint, { color: colors.textMuted }]}>
              {transferParty
                ? transferParty.source === "business"
                  ? "Trader acceptance required"
                  : "Recorded directly to Contacts"
                : "Select a Trader or Contact"}
            </Text>
          </View>
          <Icon
            name="chevron-right"
            size={20}
            color={colors.onSurfaceVariant}
          />
        </Pressable>
        <CurrencyAmountField
          label="Sale amount"
          value={soldAmount}
          onChange={(next) => {
            setSoldAmount(next);
            setSoldError(null);
          }}
          error={soldError ?? undefined}
        />
        <PaymentMethodPicker
          label="Payment method"
          options={GEM_PAYMENT_METHODS}
          value={transferPaymentMethod}
          onChange={setTransferPaymentMethod}
        />
      </BottomSheet>

      <PartyPickerSheet
        visible={partyPickerOpen}
        onClose={() => setPartyPickerOpen(false)}
        contacts={contacts}
        value={transferParty}
        onSelect={(selection) => {
          setTransferParty(selection);
          setPartyPickerOpen(false);
          setSoldError(null);
        }}
        title="Sold to"
        allowedBusinessKinds={["traders"]}
        preferBusinesses
      />
    </View>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  seeAll: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 32 },
  seeAllText: { ...text, fontFamily: FontFamily.semibold, fontSize: 13 },

  partyCard: {
    padding: 14,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    gap: 8,
  },
  partyCardTitle: {
    ...text,
    fontFamily: FontFamily.medium,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  partyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },
  partyName: {
    ...text,
    flex: 1,
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    lineHeight: 22,
  },
  partyMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  partyMetaText: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  partyMetaMuted: {
    ...text,
    fontFamily: FontFamily.regular,
    fontSize: 13,
    textTransform: "capitalize",
  },

  specIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  specValue: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "right",
    flexShrink: 1,
    maxWidth: "60%",
  },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.85)",
  },

  ownerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  ownerAvatarWrap: { width: 52, height: 52, position: "relative" },
  ownerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ownerAvatarImg: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderCurve: "continuous",
  },
  ownerInitials: { ...text, fontFamily: FontFamily.semibold, fontSize: 15 },
  ownerText: { flex: 1, gap: 2, minWidth: 0 },
  ownerName: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 16,
    lineHeight: 22,
  },
  ownerRole: { ...text, fontFamily: FontFamily.regular, fontSize: 13 },

  notes: { ...text, ...Typography.bodyMd, fontSize: 15, lineHeight: 24 },
  readMore: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
  },
  readMoreText: { ...text, fontFamily: FontFamily.semibold, fontSize: 13 },

  costRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    paddingVertical: 8,
  },
  costCopy: { flex: 1, minWidth: 0, gap: 2 },
  costTitle: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
  },
  costDesc: {
    ...text,
    fontFamily: FontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  costValue: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingHorizontal: 14,
    minHeight: 52,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  totalLabel: { ...text, fontFamily: FontFamily.semibold, fontSize: 15 },
  totalValue: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 17,
    fontVariant: ["tabular-nums"],
  },

  timeline: { gap: 0 },
  timelineRow: { flexDirection: "row", gap: 12, minHeight: 60 },
  timelineRail: { width: 28, alignItems: "center" },
  timelineIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: { width: 2, flex: 1, marginTop: 4, marginBottom: 0 },
  timelineBody: {
    flex: 1,
    paddingBottom: Spacing.gutterMd,
    gap: 3,
    paddingTop: 4,
  },
  timelineDate: { ...text, ...Typography.caption },
  timelineTitle: {
    ...text,
    fontFamily: FontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  timelineMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  timelineMeta: { ...text, ...Typography.bodySmall },

  historyList: { flex: 1, minHeight: 0 },
  historyListContent: { paddingBottom: Spacing.md },

  emptyHint: { ...text, ...Typography.bodyMd },

  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBarBtn: { flex: 1 },

  statusSheetHint: { ...Typography.bodyMd, marginBottom: Spacing.stackSm },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  statusOptionLabel: { ...Typography.bodyMd, fontWeight: "600", flex: 1 },
});
