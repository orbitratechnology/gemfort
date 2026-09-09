import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Link, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { CountryLabel } from "@/components/ui/country-flag";
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
    FontFamily,
    Radius,
    Spacing,
    type ThemeColors,
    Typography,
} from "@/constants/design-tokens";
import {
    formatCostTypeLabel,
    formatGemStatusLabel,
    formatGemType,
    formatShapeLabel,
    formatTreatmentLabel,
} from "@/constants/gem-options";
import { ROLE_LABELS, resolveProfileRole } from "@/constants/roles";
import {
    fetchBusinessByOwnerUid,
    isBusinessVerified,
} from "@/features/marketplace/marketplace-service";
import {
    subscribeBusinessByOwnerUid,
    subscribeContacts,
    subscribeGem,
    subscribeGemCosts,
    subscribeGemEvents,
} from "@/features/workspace/firestore-subscriptions";
import {
    formatLifecycleSummary,
    gemActionAvailability,
    resolveGemLifecycle,
    resolveGemSaleStatus,
} from "@/features/workspace/gem-lifecycle";
import {
    cancelGemTransferRequest,
    createGemTransferRequest,
} from "@/features/workspace/gem-transfer-api";
import {
    fetchContacts,
    fetchGem,
    fetchGemCosts,
    fetchGemEvents,
    removeGemFromMarket,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import { shareFile, shareLink } from "@/lib/share";
import { formatRelativeTime, shortGemId, toJsDate } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { confirm } from "@/providers/confirm-provider";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";
import type { GemEvent, GemPaymentMethod, GemStatus } from "@/types";

const INITIAL_HISTORY_COUNT = 4;

const SPEC_ICONS: Record<string, IconName> = {
  Weight: "scale",
  Color: "palette",
  Clarity: "visibility",
  Shape: "category",
  Treatment: "science",
  Origin: "location-on",
};

const STATUS_ICONS: Partial<Record<GemStatus, IconName>> = {
  rough: "spa",
  with_cutter: "content-cut",
  cut: "content-cut",
  with_heater: "local-fire-department",
  heated: "local-fire-department",
  with_polisher: "auto-awesome",
  polished: "auto-awesome",
  ready_for_sale: "sell",
  on_ap: "handshake",
  on_trip: "flight",
  listed: "storefront",
  sold: "check-circle",
  returned: "undo",
};

function eventIcon(eventType: string): IconName {
  const t = eventType.toLowerCase();
  if (t.includes("cut")) return "content-cut";
  if (t.includes("heat")) return "local-fire-department";
  if (t.includes("polish")) return "auto-awesome";
  if (t.includes("ap") || t.includes("consign")) return "handshake";
  if (t.includes("sale") || t.includes("sold")) return "sell";
  if (t.includes("list") || t.includes("market")) return "storefront";
  if (t.includes("service")) return "build";
  if (t.includes("status")) return "swap-horiz";
  if (t.includes("cost") || t.includes("purchase")) return "payments";
  return "history";
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
              index === 0
                ? colors.onPrimaryContainer
                : colors.onSurfaceVariant
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
            <Icon
              name="scale"
              size={12}
              color={colors.onSurfaceVariant}
            />
            <Text style={[styles.timelineMeta, { color: colors.onSurfaceVariant }]}>
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
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferParty, setTransferParty] = useState<PartySelection | null>(null);
  const [transferPaymentMethod, setTransferPaymentMethod] = useState<GemPaymentMethod>("cash");
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

  const { data: costs = [] } = useFirestoreLiveQuery({
    queryKey: ["gem-costs", gemId],
    queryFn: () => fetchGemCosts(gemId!),
    subscribe: (onData, onError) => subscribeGemCosts(gemId!, onData, onError),
    enabled: !!gemId,
  });

  const { data: events = [] } = useFirestoreLiveQuery({
    queryKey: ["gem-events", gemId],
    queryFn: () => fetchGemEvents(gemId!),
    subscribe: (onData, onError) => subscribeGemEvents(gemId!, onData, onError),
    enabled: !!gemId,
  });

  const ownerUid = gem?.ownerUid ?? user?.uid;
  const { data: business } = useFirestoreLiveQuery({
    queryKey: ["business-by-owner", ownerUid],
    queryFn: () => fetchBusinessByOwnerUid(ownerUid!),
    subscribe: (onData, onError) =>
      subscribeBusinessByOwnerUid(ownerUid!, onData, onError),
    enabled: !!ownerUid,
  });

  const { data: contacts = [] } = useFirestoreLiveQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    subscribe: (onData, onError) => subscribeContacts(user!.uid, onData, onError),
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
      setSoldError("Select a linked trader or contact.");
      return;
    }
    const recipientBusinessId = transferParty.source === "business"
      ? transferParty.businessId
      : transferParty.linkedBusinessId;
    if (!recipientBusinessId) {
      setSoldError("This contact is not linked to a verified GemFort trader.");
      return;
    }
    setTransferSaving(true);
    try {
      await withLoading(async () => {
        await createGemTransferRequest({
          gemId: gem.id,
          recipientBusinessId,
          recipientContactId: transferParty.source === "contact" ? transferParty.contactId : null,
          recipientName: transferParty.label,
          amount,
          currency: soldAmount.currency,
          paymentMethod: transferPaymentMethod,
          sourceTripId: sell === "1" ? tripId : null,
          sourceTripGemId: sell === "1" ? tripGemId : null,
        });
        await queryClient.invalidateQueries({ queryKey: ["gem", gemId] });
        await queryClient.invalidateQueries({ queryKey: ["gems", user.uid] });
        setTransferOpen(false);
        toast.success("Sale request sent — waiting for the trader to accept");
      }, "Sending sale request…");
    } catch (e) {
      setSoldError(friendlyError(e, "Could not send the sale request."));
    } finally {
      setTransferSaving(false);
    }
  }

  async function handleMarkUnsold() {
    if (!user || !gem?.saleTransferRequestId || transferSaving) return;
    const ok = await confirm({
      title: "Mark unsold?",
      message: "Cancel the pending trader request and return the gem to active inventory.",
      confirmLabel: "Mark unsold",
      tone: "destructive",
      onConfirm: () => cancelGemTransferRequest(gem.saleTransferRequestId!),
    });
    if (!ok) return;
    try {
      setTransferSaving(true);
      await queryClient.invalidateQueries({ queryKey: ["gem", gemId] });
      await queryClient.invalidateQueries({ queryKey: ["gems", user.uid] });
      toast.success("Gem marked unsold");
    } catch (e) {
      toast.error(friendlyError(e, "Could not mark the gem unsold."));
    } finally {
      setTransferSaving(false);
    }
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
  const locationLabel = gem.currentLocation?.trim() || (lifecycle.custody
    ? lifecycle.custody === "with_cutter" || lifecycle.custody === "with_heater" || lifecycle.custody === "with_polisher"
      ? "Lapidary"
      : formatGemStatusLabel(lifecycle.custody)
    : "With me");
  const saleStatus = resolveGemSaleStatus(gem);
  const saleLabel = saleStatus === "pending" ? "Awaiting trader" : saleStatus === "sold" ? "Sold" : "Unsold";
  const shapeLabel = formatShapeLabel(gem.shape || gem.cutType);
  const treatmentLabel = formatTreatmentLabel(gem.treatmentStatus);
  const specs = [
    { label: "Weight", value: `${gem.currentWeight} ct` },
    ...(shapeLabel ? [{ label: "Shape", value: shapeLabel }] : []),
    ...(gem.colorPrimary ? [{ label: "Color", value: gem.colorPrimary }] : []),
    ...(gem.clarity ? [{ label: "Clarity", value: gem.clarity }] : []),
    { label: "Treatment", value: treatmentLabel || "None" },
    { label: "Origin", value: gem.originCountry || "Unknown" },
  ];

  const tags: string[] = [];
  if (treatmentLabel && treatmentLabel !== "None") tags.push(treatmentLabel);
  if (gem.clarity) tags.push(gem.clarity);
  tags.push(statusLabel);

  const photos = (gem.photoUrls ?? []).filter(
    (u): u is string => typeof u === "string" && u.trim().length > 0,
  );
  const photo = photos[0] ?? null;
  const gemTitle = gem.title?.trim() || formatGemType(gem.gemType);
  const gemDisplayId = shortGemId(gem.id);
  const gemSummary = `${gemTitle} · ${formatGemType(gem.gemType)} ${gem.currentWeight}ct`;
  const gemIdForShare = gem.id;
  const historyEvents = [...events].reverse();
  const visibleHistoryEvents = historyEvents.slice(0, INITIAL_HISTORY_COUNT);
  const costLines = [...costs].sort((a, b) => {
    const aMs = toJsDate(a.date ?? a.createdAt)?.getTime() ?? 0;
    const bMs = toJsDate(b.date ?? b.createdAt)?.getTime() ?? 0;
    return bMs - aMs;
  });

  const hasAsk = gem.askingPrice != null;
  const askLabel = hasAsk
    ? formatStored({
        amount: gem.askingPrice!,
        currency: askCurrency,
        amountBase: gem.askingPriceBase,
      })
    : "No asking price";
  const perCaratLabel =
    hasAsk && gem.currentWeight > 0
      ? `${formatStored({
          amount: gem.askingPrice! / gem.currentWeight,
          currency: askCurrency,
          amountBase: askBase != null ? askBase / gem.currentWeight : null,
        })} / ct`
      : null;

  const ownerName =
    business?.businessName?.trim() || profile?.displayName?.trim() || "Owner";
  const ownerRole =
    business?.businessType === "lapidary"
      ? "Lapidary"
      : (ROLE_LABELS[resolveProfileRole(profile)] ?? "Trader");
  const ownerAvatar = business?.logoUrl ?? null;
  const ownerVerified = isBusinessVerified(business);
  const ownerInitials = initials(ownerName);

  const heroHeight = windowWidth;
  const bottomBarPad = Math.max(insets.bottom, 12);
  const isOwnGem = !!user && user.uid === gem.ownerUid;
  const actionAvailability = gemActionAvailability(gem);
  const canSellFromTrip =
    sell === "1" &&
    typeof tripId === "string" &&
    typeof tripGemId === "string" &&
    (lifecycle.custody === "on_trip" || gem.status === "on_trip");
  const canMarkSold = actionAvailability.mark_sold || canSellFromTrip;
  const isListed =
    isOwnGem && (gem.isListedOnMarketplace || lifecycle.outcome === "listed");
  const actionButtons = [
    ...(canMarkSold ? [{ title: "Sold", icon: "price-check" as IconName, onPress: openSoldChooser, primary: true }] : []),
    ...(actionAvailability.mark_unsold ? [{ title: "Mark unsold", icon: "undo" as IconName, onPress: () => void handleMarkUnsold(), primary: true }] : []),
    ...(actionAvailability.send_for_cutting ? [{ title: "Send for Cutting", icon: "content-cut" as IconName, href: `/(marketplace)/services/add?gemId=${gem.id}&serviceType=cutting` }] : []),
    ...(actionAvailability.send_for_heating ? [{ title: "Service", icon: "build" as IconName, image: require("@/assets/images/lapidary-icon.png"), href: `/(marketplace)/services/add?gemId=${gem.id}&serviceType=heating` }] : []),
    ...(actionAvailability.send_for_polishing ? [{ title: "Send for Polishing", icon: "auto-awesome" as IconName, href: `/(marketplace)/services/add?gemId=${gem.id}&serviceType=polishing` }] : []),
    ...(actionAvailability.give_on_ap ? [{ title: "Give on AP", icon: "handshake" as IconName, image: require("@/assets/images/ap-icon.png"), href: `/(marketplace)/ap/add?gemId=${gem.id}` }] : []),
    ...(actionAvailability.list_on_market ? [{ title: "Sell on Market", icon: "storefront" as IconName, href: `/listings/create?workspaceGemId=${gem.id}` }] : []),
    ...(actionAvailability.remove_from_market ? [{ title: "Remove from Market", icon: "remove-shopping-cart" as IconName, onPress: () => void handleRemoveFromMarket() }] : []),
  ];
  const hasBottomActions = isOwnGem && actionButtons.length > 0;

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
      url: `gemfort://workspace/gems/${gemIdForShare}`,
      title: gemTitle,
    });
  }

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar style={photos.length ? "light" : "auto"} />

      <ThemedScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: hasBottomActions ? 96 + bottomBarPad : 48 },
        ]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroBlock}>
          <ImagePager
            urls={photos}
            aspectRatio={1}
            edgeToEdge
            style={{ height: heroHeight }}
            accessibilityLabel={`${formatGemType(gem.gemType)} photos`}
            wrapFirstPage={(node) => (
              <Link.AppleZoomTarget>{node}</Link.AppleZoomTarget>
            )}
            overlay={null}
          />
        </View>

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <View style={styles.titleBlock}>
            <Text
              style={[styles.gemName, { color: colors.onSurface }]}
              selectable={false}
            >
              {gemTitle}
            </Text>
            <Text
              style={[styles.subtitle, { color: colors.onSurfaceVariant }]}
              selectable={false}
            >
              {formatGemType(gem.gemType)}
              {gem.variety ? ` · ${gem.variety}` : ""}
              {gemDisplayId ? ` · ${gemDisplayId}` : ""}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text
              style={[
                styles.priceHero,
                {
                  color: hasAsk ? colors.successEmerald : colors.textMuted,
                  fontFamily: FontFamily.bold,
                },
              ]}
              selectable={false}
            >
              {askLabel}
            </Text>
            {perCaratLabel ? (
              <Text
                style={[
                  styles.perCarat,
                  {
                    color: hasAsk
                      ? colors.successEmerald
                      : colors.onSurfaceVariant,
                  },
                ]}
                selectable={false}
              >
                {perCaratLabel}
              </Text>
            ) : null}
          </View>

          {/* Elevated owner profile */}
          <View
            style={[
              styles.ownerCard,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
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
              {ownerVerified ? (
                <View
                  style={[
                    styles.ownerVerifiedDot,
                    {
                      backgroundColor: colors.primary,
                      borderColor: colors.surfaceContainerLowest,
                    },
                  ]}
                >
                  <Icon name="verified" size={10} color={colors.onPrimary} />
                </View>
              ) : null}
            </View>
            <View style={styles.ownerText}>
              <Text
                style={[styles.ownerName, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                {ownerName}
              </Text>
              {ownerVerified ? (
                <View
                  style={[
                    styles.verifiedPill,
                    { backgroundColor: colors.primaryContainer },
                  ]}
                >
                  <Text
                    style={[
                      styles.verifiedPillText,
                      { color: colors.onPrimaryContainer },
                    ]}
                  >
                    VERIFIED
                  </Text>
                </View>
              ) : null}
              <Text
                style={[styles.ownerRole, { color: colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {ownerRole} · Owner
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text
              style={[styles.sectionLabel, { color: colors.textMuted }]}
              accessibilityRole="header"
            >
              OVERVIEW
            </Text>
            <View style={styles.lifecycleGrid} accessible accessibilityLabel={`Gem state ${stoneLabel}, location ${locationLabel}, market ${isListed ? "On market" : "Not on market"}, sale ${saleLabel}`}>
              {[
                ["State", stoneLabel, STATUS_ICONS[lifecycle.stoneStage] ?? "spa"],
                ["Location", locationLabel, lifecycle.custody ? (STATUS_ICONS[lifecycle.custody] ?? "place") : "person"],
                ["Market", isListed ? "On market" : "Not on market", "storefront"],
                ["Sale", saleLabel, saleStatus === "pending" ? "schedule" : saleStatus === "sold" ? "check-circle" : "sell"],
              ].map(([label, value, icon]) => (
                <View key={label} style={[styles.lifecycleCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
                  <View style={[styles.lifecycleIconWrap, { backgroundColor: colors.primaryContainer }]}>
                    <Icon name={icon as IconName} size={18} color={colors.primary} />
                  </View>
                  <Text style={[styles.lifecycleLabel, { color: colors.onSurfaceVariant }]}>{label}</Text>
                  <Text style={[styles.lifecycleValue, { color: colors.onSurface }]} numberOfLines={2}>{value}</Text>
                </View>
              ))}
            </View>

            {saleStatus !== "unsold" ? (
              <View style={[styles.saleInfo, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
                <Text style={[styles.saleInfoTitle, { color: colors.onSurface }]}>
                  {saleStatus === "pending" ? "Sale awaiting acceptance" : "Sale details"}
                </Text>
                <Text style={[styles.saleInfoText, { color: colors.onSurfaceVariant }]}>To: {gem.soldToName || "Trader"}</Text>
                {gem.soldPrice != null ? <Text style={[styles.saleInfoText, { color: colors.onSurfaceVariant }]}>Amount: {formatStored({ amount: gem.soldPrice, currency: gem.soldPriceCurrency || askCurrency, amountBase: gem.soldPriceBase })}</Text> : null}
                {gem.salePaymentMethod ? <Text style={[styles.saleInfoText, { color: colors.onSurfaceVariant }]}>Payment: {gem.salePaymentMethod.replace("_", " ")}</Text> : null}
              </View>
            ) : gem.acquiredFromUid ? (
              <View style={[styles.saleInfo, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
                <Text style={[styles.saleInfoTitle, { color: colors.onSurface }]}>Acquisition details</Text>
                <Text style={[styles.saleInfoText, { color: colors.onSurfaceVariant }]}>From: {gem.acquiredFromName || "Previous owner"}</Text>
                {gem.lastSoldPrice != null ? <Text style={[styles.saleInfoText, { color: colors.onSurfaceVariant }]}>Amount: {formatStored({ amount: gem.lastSoldPrice, currency: gem.lastSoldPriceCurrency || askCurrency })}</Text> : null}
                {gem.lastSalePaymentMethod ? <Text style={[styles.saleInfoText, { color: colors.onSurfaceVariant }]}>Payment: {gem.lastSalePaymentMethod.replace("_", " ")}</Text> : null}
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text
              style={[styles.sectionLabel, { color: colors.textMuted }]}
              accessibilityRole="header"
            >
              DETAILS
            </Text>
            <View style={[styles.detailsCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
              {tags.length ? (
                <View style={styles.tags}>
                  {tags.slice(0, 4).map((tag, tagIndex) => (
                    <View
                      key={`${tag}-${tagIndex}`}
                      style={[
                        styles.tag,
                        {
                          backgroundColor: colors.surfaceContainerHigh,
                          borderColor: colors.outlineVariant,
                        },
                      ]}
                    >
                      <Text style={[styles.tagText, { color: colors.onSurface }]}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.specGrid}>
                {specs.map((spec) => {
                  const iconName = SPEC_ICONS[spec.label] ?? "info";
                  return (
                    <View key={spec.label} style={styles.specCell}>
                      <View style={styles.specHeader}>
                        <Icon
                          name={iconName}
                          size={15}
                          color={colors.onSurfaceVariant}
                        />
                        <Text
                          style={[
                            styles.specLabel,
                            { color: colors.onSurfaceVariant },
                          ]}
                        >
                          {spec.label}
                        </Text>
                      </View>
                      {spec.label === "Origin" ? (
                        <CountryLabel
                          country={spec.value}
                          size="sm"
                          textStyle={[
                            styles.specValue,
                            { color: colors.onSurface },
                          ]}
                          numberOfLines={2}
                        />
                      ) : (
                        <Text
                          style={[styles.specValue, { color: colors.onSurface }]}
                          numberOfLines={2}
                          selectable={false}
                        >
                          {spec.value}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          {gem.notes ? (
            <View style={styles.section}>
              <Text
                style={[styles.sectionLabel, { color: colors.textMuted }]}
                accessibilityRole="header"
              >
                NOTES
              </Text>
              <View style={[styles.notesCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
                <View style={styles.notesHeader}>
                  <Icon name="notes" size={18} color={colors.primary} />
                  <Text style={[styles.notesLabel, { color: colors.onSurface }]}>Private note</Text>
                </View>
                <View style={styles.descBlock}>
                  <Text
                    style={[styles.notes, { color: colors.onSurfaceVariant }]}
                    numberOfLines={notesExpanded ? undefined : 3}
                    selectable={false}
                  >
                    {gem.notes}
                  </Text>
                  {gem.notes.length > 120 ? (
                    <Pressable
                      onPress={() => setNotesExpanded((v) => !v)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={notesExpanded ? "Show less" : "Read more"}
                      style={styles.readMore}
                    >
                      <Text
                        style={[styles.readMoreText, { color: colors.primary }]}
                      >
                        {notesExpanded ? "Show less" : "Read more"}
                      </Text>
                      <Icon
                        name={notesExpanded ? "expand-less" : "expand-more"}
                        size={18}
                        color={colors.primary}
                      />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text
              style={[styles.sectionLabel, { color: colors.textMuted }]}
              accessibilityRole="header"
            >
              FINANCIALS
            </Text>
            <View
              style={[
                styles.financeCard,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              {costLines.length ? (
                costLines.map((c) => (
                  <View key={c.id} style={styles.financeItem}>
                    <View style={styles.financeRow}>
                      <View style={styles.financeLabelRow}>
                        <Icon
                          name="payments"
                          size={16}
                          color={colors.onSurfaceVariant}
                        />
                        <View style={styles.financeLabelCol}>
                          <Text
                            style={[
                              styles.financeLabel,
                              { color: colors.onSurface },
                            ]}
                          >
                            {formatCostTypeLabel(c.costType)}
                          </Text>
                          {c.description ? (
                            <Text
                              style={[
                                styles.financeDesc,
                                { color: colors.onSurfaceVariant },
                              ]}
                              numberOfLines={2}
                            >
                              {c.description}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.financeValue,
                          { color: colors.onSurface },
                        ]}
                      >
                        {formatStored({
                          amount: c.amount,
                          currency: c.currency,
                          amountBase: c.amountBase,
                        })}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                  No cost lines yet
                </Text>
              )}
              <View
                style={[
                  styles.financeDivider,
                  { backgroundColor: colors.outlineVariant },
                ]}
              />
              <View style={styles.financeRow}>
                <View style={styles.financeLabelRow}>
                  <Icon
                    name="account-balance-wallet"
                    size={16}
                    color={colors.onSurface}
                  />
                  <Text
                    style={[
                      styles.financeTotalLabel,
                      { color: colors.onSurface },
                    ]}
                  >
                    Total cost
                  </Text>
                </View>
                <Text
                  style={[
                    styles.financeTotalValue,
                    { color: colors.onSurface },
                  ]}
                >
                  {formatBase(gem.totalCost)}
                </Text>
              </View>
              {profitBase != null ? (
                <View style={styles.financeRow}>
                  <View style={styles.financeLabelRow}>
                    <Icon
                      name="trending-up"
                      size={16}
                      color={colors.successEmerald}
                    />
                    <Text
                      style={[
                        styles.financeTotalLabel,
                        { color: colors.successEmerald },
                      ]}
                    >
                      Est. profit
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.financeTotalValue,
                      { color: colors.successEmerald },
                    ]}
                  >
                    {formatBase(profitBase)}
                    {roi ? ` (${roi}%)` : ""}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <Text
              style={[styles.sectionLabel, { color: colors.textMuted }]}
              accessibilityRole="header"
            >
              HISTORY
            </Text>
            {historyEvents.length ? (
              <View
                style={[
                  styles.timelineCard,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <GemHistoryTimeline
                  events={visibleHistoryEvents}
                  colors={colors}
                />
                {historyEvents.length > INITIAL_HISTORY_COUNT ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Show all ${historyEvents.length} history events`}
                    accessibilityHint="Opens the complete history in a scrollable sheet"
                    onPress={() => setHistoryOpen(true)}
                    style={[
                      styles.showMore,
                      { borderTopColor: colors.outlineVariant },
                    ]}
                  >
                    <Text style={[styles.showMoreText, { color: colors.primary }]}>
                      Show more
                    </Text>
                    <Icon name="chevron-right" size={20} color={colors.primary} />
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View
                style={[
                  styles.timelineCard,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                  No events yet
                </Text>
              </View>
            )}
          </View>
        </View>
      </ThemedScrollView>

      <View
        pointerEvents="box-none"
        style={[styles.headerOverlay, { paddingTop: insets.top }]}
      >
        <StackHeader
          title=""
          tintColor="#FFFFFF"
          right={
            <Pressable
              onPress={() => void handleShareGem()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Share gem"
              style={[styles.headerBtn, styles.headerChip]}
            >
              <Icon name="share" size={20} color="#FFFFFF" />
            </Pressable>
          }
        />
      </View>

      {hasBottomActions ? (
          <View style={styles.actionBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.actionScrollContent}
          >
            {actionButtons.map((action) => (
              <Pressable
                key={action.title}
                onPress={() => action.onPress ? void action.onPress() : router.push(action.href as never)}
                accessibilityRole="button"
                accessibilityLabel={action.title}
                style={({ pressed }) => [
                  styles.actionBtn,
                  !action.primary && styles.secondaryBtn,
                  {
                    backgroundColor: action.primary ? colors.primary : colors.surfaceContainerLowest,
                    borderColor: action.primary ? colors.primary : colors.outlineVariant,
                    opacity: pressed || transferSaving ? 0.82 : 1,
                  },
                ]}
              >
                {action.image ? (
                  <Image
                    source={action.image}
                    style={styles.actionImage}
                    contentFit="contain"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <Icon name={action.icon} size={22} color={action.primary ? colors.onPrimary : colors.onSurface} />
                )}
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: action.primary ? colors.onPrimary : colors.onSurface },
                  ]}
                  numberOfLines={1}
                >
                  {action.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

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
          estimatedItemSize={72}
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
            title={transferSaving ? "Sending…" : "Send sale request"}
            icon="send"
            loading={transferSaving}
            disabled={transferSaving}
            onPress={() => void handleSaleRequest()}
          />
        }
      >
        <Text style={[styles.statusSheetHint, { color: colors.textMuted }]}>The trader must accept before ownership moves. Until then, the gem stays in your account and can be marked unsold.</Text>
        <Pressable
          onPress={() => setPartyPickerOpen(true)}
          style={[styles.statusOption, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}
        >
          <Icon name="contacts" size={19} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusOptionLabel, { color: colors.onSurface }]}>{transferParty?.label ?? "Select trader or contact"}</Text>
            <Text style={[styles.statusSheetHint, { color: colors.textMuted }]}>{transferParty ? "Linked recipient selected" : "A verified linked trader is required"}</Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.onSurfaceVariant} />
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
        <Text style={[styles.statusOptionLabel, { color: colors.onSurface }]}>Payment method</Text>
        <View style={styles.paymentMethodRow}>
          {([
            ["cash", "Cash"],
            ["bank_transfer", "Bank"],
            ["cheque", "Cheque"],
            ["bill", "Bill"],
            ["other", "Other"],
          ] as const).map(([value, label]) => {
            const active = transferPaymentMethod === value;
            return (
              <Pressable
                key={value}
                onPress={() => setTransferPaymentMethod(value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.paymentMethod, { backgroundColor: active ? colors.primaryContainer : colors.surfaceContainerLow, borderColor: active ? colors.primary : colors.outlineVariant }]}
              >
                <Text style={[styles.paymentMethodText, { color: active ? colors.onPrimaryContainer : colors.onSurface }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { gap: 0 },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  headerBtn: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerChip: {
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },

  heroBlock: {
    width: "100%",
  },
  sheet: {
    // Sit below the film strip — negative margin was clipping thumb bottoms
    // and exposing the old black heroBlock as a thick bar under the carousel.
    marginTop: 0,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderCurve: "continuous",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xxl,
  },

  titleBlock: { gap: 6 },
  gemName: {
    ...Typography.headlineMdMobile,
    fontFamily: FontFamily.bold,
    fontWeight: "700",
  },
  subtitle: { ...Typography.bodyMd },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: 2,
  },
  priceHero: {
    ...Typography.headlineSm,
    fontVariant: ["tabular-nums"],
  },
  perCarat: {
    ...Typography.labelMd,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },

  ownerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  ownerAvatarWrap: {
    width: 52,
    height: 52,
    position: "relative",
  },
  ownerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ownerAvatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  ownerInitials: { ...Typography.labelMd, fontWeight: "700" },
  ownerVerifiedDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerText: { flex: 1, gap: 4, minWidth: 0 },
  ownerName: { ...Typography.bodyLg, fontWeight: "700", flexShrink: 1 },
  ownerRole: { ...Typography.caption },
  verifiedPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  verifiedPillText: {
    ...Typography.caption,
    fontWeight: "700",
    letterSpacing: 0.4,
    fontSize: 9,
  },

  lifecycleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  lifecycleCard: {
    width: "48%",
    minHeight: 96,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  lifecycleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  lifecycleLabel: { ...Typography.caption, textTransform: "uppercase", letterSpacing: 0.4 },
  lifecycleValue: { ...Typography.bodyMd, fontWeight: "700" },
  saleInfo: { padding: Spacing.gutterMd, borderRadius: Radius.lg, borderCurve: "continuous", borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  saleInfoTitle: { ...Typography.bodyLg, fontWeight: "700" },
  saleInfoText: { ...Typography.bodyMd },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  statusChipIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusChipText: { flex: 1, gap: 1, minWidth: 0 },
  statusChipLabel: {
    ...Typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statusChipValue: { ...Typography.bodyMd, fontWeight: "700" },

  detailsCard: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.gutterMd,
    gap: Spacing.lg,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  tagText: { ...Typography.caption, fontWeight: "600" },

  specGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.lg,
  },
  specCell: {
    width: "47%",
    flexGrow: 1,
    minWidth: "42%",
    maxWidth: "48%",
    minHeight: 52,
    gap: 6,
  },
  specHeader: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 18 },
  specLabel: { ...Typography.caption, flexShrink: 1 },
  specValue: {
    ...Typography.bodyMd,
    fontWeight: "600",
    fontFamily: FontFamily.semibold,
  },

  notesCard: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.gutterMd,
    gap: Spacing.md,
  },
  notesHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  notesLabel: { ...Typography.labelMd, fontWeight: "700" },
  descBlock: { gap: 8 },
  notes: { ...Typography.bodyMd, lineHeight: 22 },
  readMore: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
  },
  readMoreText: { ...Typography.labelMd, fontWeight: "600" },

  section: { gap: Spacing.md },
  sectionLabel: {
    ...Typography.labelMd,
    letterSpacing: 1.1,
    fontWeight: "600",
  },

  timelineCard: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.gutterMd,
  },
  showMore: {
    minHeight: 48,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  showMoreText: { ...Typography.button, fontFamily: FontFamily.semibold },
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
  timelineBody: { flex: 1, paddingBottom: Spacing.gutterMd, gap: 3, paddingTop: 4 },
  timelineDate: { ...Typography.caption },
  timelineTitle: { ...Typography.bodyMd, fontWeight: "600" },
  timelineMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  timelineMeta: { ...Typography.bodySmall },

  financeCard: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.gutterMd,
    gap: Spacing.md,
  },
  financeItem: { gap: 2 },
  financeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  financeLabelRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  financeLabelCol: { flex: 1, gap: 2, minWidth: 0 },
  financeLabel: { ...Typography.bodyMd, fontWeight: "600", flexShrink: 1 },
  financeDesc: { ...Typography.caption },
  financeValue: {
    ...Typography.bodyMd,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  financeDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  financeTotalLabel: { ...Typography.labelMd, fontWeight: "600" },
  financeTotalValue: {
    ...Typography.labelMd,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  historyList: { flex: 1, minHeight: 0 },
  historyListContent: { paddingBottom: Spacing.md },

  emptyHint: { ...Typography.bodyMd },

  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: Spacing.xs,
  },
  actionScrollContent: {
    gap: 10,
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: 10,
  },
  actionBtn: {
    minWidth: 96,
    height: 56,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    boxShadow: "0 5px 10px rgba(0, 0, 0, 0.18)",
  },
  actionImage: { width: 28, height: 28 },
  actionBtnText: { ...Typography.labelMd, fontWeight: "700", flexShrink: 0 },
  secondaryBtn: {
    borderWidth: 1.5,
  },

  statusSheetHint: { ...Typography.bodyMd, marginBottom: Spacing.stackSm },
  paymentMethodRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  paymentMethod: { minHeight: 40, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1 },
  paymentMethodText: { ...Typography.labelMd, fontWeight: "600" },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1.5,
  },
  statusOptionLabel: { ...Typography.bodyMd, fontWeight: "600", flex: 1 },
});
