import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Link, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { CountryLabel } from "@/components/ui/country-flag";
import { Icon, type IconName } from "@/components/ui/icon";
import { ImagePager } from "@/components/ui/image-pager";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import {
  FontFamily,
  Radius,
  Spacing,
  Typography,
} from "@/constants/design-tokens";
import {
  GEM_STATUS_GROUPS,
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
  formatLifecycleSummary,
  canListGem,
  resolveGemLifecycle,
  type GemLifecycle,
} from "@/features/workspace/gem-lifecycle";
import { getGemQuickActions } from "@/features/workspace/gem-utils";
import {
  fetchGem,
  fetchGemCosts,
  fetchGemEvents,
  updateGemLifecycle,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import { shareFile, shareLink } from "@/lib/share";
import { formatRelativeTime, shortGemId, toJsDate } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";
import type { GemStatus } from "@/types";

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
  certified: "verified",
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
  if (t.includes("cert")) return "verified";
  if (t.includes("ap") || t.includes("consign")) return "handshake";
  if (t.includes("sale") || t.includes("sold")) return "sell";
  if (t.includes("list")) return "storefront";
  if (t.includes("service")) return "build";
  if (t.includes("status")) return "swap-horiz";
  if (t.includes("cost") || t.includes("purchase")) return "payments";
  return "history";
}

function actionIcon(title: string): IconName {
  const t = title.toLowerCase();
  if (t.includes("cutting") || t.includes("cut")) return "content-cut";
  if (t.includes("ap")) return "handshake";
  if (t.includes("list") || t.includes("gemnet")) return "storefront";
  if (t.includes("service")) return "build";
  if (t.includes("sale") || t.includes("sell")) return "sell";
  return "arrow-forward";
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

export default function GemDetailScreen() {
  const { gemId } = useLocalSearchParams<{ gemId: string }>();
  const { user, profile } = useAuth();
  const { colors } = useAppTheme();
  const { formatStored, formatBase } = usePreferredMoney();
  const toast = useToast();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [axisOpen, setAxisOpen] = useState<
    "stone" | "where" | "outcome" | null
  >(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

  const { data: gem, isLoading } = useQuery({
    queryKey: ["gem", gemId],
    queryFn: () => fetchGem(gemId!),
    enabled: !!gemId,
  });

  const { data: costs = [] } = useQuery({
    queryKey: ["gem-costs", gemId],
    queryFn: () => fetchGemCosts(gemId!),
    enabled: !!gemId,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["gem-events", gemId],
    queryFn: () => fetchGemEvents(gemId!),
    enabled: !!gemId,
  });

  const ownerUid = gem?.ownerUid ?? user?.uid;
  const { data: business } = useQuery({
    queryKey: ["business-by-owner", ownerUid],
    queryFn: () => fetchBusinessByOwnerUid(ownerUid!),
    enabled: !!ownerUid,
  });

  async function handleLifecyclePatch(
    patch: {
      stoneStage?: GemLifecycle["stoneStage"];
      custody?: GemLifecycle["custody"];
      outcome?: GemLifecycle["outcome"];
    },
    label: string,
  ) {
    if (!user || !gem || statusSaving) return;
    setStatusSaving(true);
    try {
      await withLoading(async () => {
        await updateGemLifecycle(
          gem.id,
          user.uid,
          patch,
          `Updated ${label}`,
        );
        await queryClient.invalidateQueries({ queryKey: ["gem", gemId] });
        await queryClient.invalidateQueries({
          queryKey: ["gem-events", gemId],
        });
        await queryClient.invalidateQueries({ queryKey: ["gems", user.uid] });
        setAxisOpen(null);
        toast.success(`Updated ${label}`);
      }, "Updating…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not update status."));
    } finally {
      setStatusSaving(false);
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
  const quickActions = getGemQuickActions(gem);
  const primaryAction =
    quickActions.find((a) => a.variant !== "secondary") ?? quickActions[0];
  const secondaryActions = quickActions.filter((a) => a !== primaryAction);
  const lifecycle = resolveGemLifecycle(gem);
  const statusLabel = formatLifecycleSummary(lifecycle);
  const isCertified =
    gem.status === "certified" ||
    gem.treatmentStatus?.toLowerCase().includes("cert");
  const stoneLabel = formatGemStatusLabel(lifecycle.stoneStage);
  const whereLabel = lifecycle.custody
    ? formatGemStatusLabel(lifecycle.custody)
    : "With me";
  const outcomeLabel = lifecycle.outcome
    ? formatGemStatusLabel(lifecycle.outcome)
    : "None";
  const activeGroup = GEM_STATUS_GROUPS.find((g) => g.key === axisOpen);

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
  if (isCertified) tags.push("Certified");
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
          amountBase:
            askBase != null ? askBase / gem.currentWeight : null,
        })} / ct`
      : null;

  const ownerName =
    business?.businessName?.trim() ||
    profile?.displayName?.trim() ||
    "Owner";
  const ownerRole =
    business?.businessType === "gem_lab" || business?.businessType === "lab"
      ? "Gem Lab"
      : business?.businessType === "lapidary"
        ? "Lapidary"
        : ROLE_LABELS[resolveProfileRole(profile)] ?? "Trader";
  const ownerAvatar = business?.logoUrl ?? null;
  const ownerVerified = isBusinessVerified(business);
  const ownerInitials = initials(ownerName);

  const heroHeight = windowWidth;
  const bottomBarPad = Math.max(insets.bottom, 12);
  const hasBottomActions =
    !!primaryAction ||
    secondaryActions.length > 0 ||
    canListGem(gem);

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
            overlay={
              isCertified ? (
                <View
                  style={[styles.heroBadge, { top: insets.top + 56 }]}
                  pointerEvents="none"
                >
                  <Icon name="verified" size={12} color="#FFFFFF" />
                  <Text style={styles.heroBadgeText}>VERIFIED</Text>
                </View>
              ) : null
            }
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
              selectable
            >
              {gemTitle}
            </Text>
            <Text
              style={[styles.subtitle, { color: colors.onSurfaceVariant }]}
              selectable
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
              selectable
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
                selectable
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

          <View style={styles.axisStack}>
            {(
              [
                {
                  key: "stone" as const,
                  title: "Stone",
                  value: stoneLabel,
                  icon: STATUS_ICONS[lifecycle.stoneStage] ?? "spa",
                },
                {
                  key: "where" as const,
                  title: "Where",
                  value: whereLabel,
                  icon: lifecycle.custody
                    ? (STATUS_ICONS[lifecycle.custody] ?? "place")
                    : "person",
                },
                {
                  key: "outcome" as const,
                  title: "Outcome",
                  value: outcomeLabel,
                  icon: lifecycle.outcome
                    ? (STATUS_ICONS[lifecycle.outcome] ?? "flag")
                    : "block",
                },
              ] as const
            ).map((axis) => (
              <Pressable
                key={axis.key}
                onPress={() => setAxisOpen(axis.key)}
                disabled={statusSaving}
                accessibilityRole="button"
                accessibilityLabel={`${axis.title} ${axis.value}. Tap to change`}
                style={({ pressed }) => [
                  styles.statusChip,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                    opacity: pressed || statusSaving ? 0.88 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusChipIcon,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  {statusSaving && axisOpen === axis.key ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Icon
                      name={axis.icon}
                      size={16}
                      color={colors.onPrimary}
                    />
                  )}
                </View>
                <View style={styles.statusChipText}>
                  <Text
                    style={[
                      styles.statusChipLabel,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    {axis.title}
                  </Text>
                  <Text
                    style={[
                      styles.statusChipValue,
                      { color: colors.onSurface },
                    ]}
                    numberOfLines={1}
                  >
                    {axis.value}
                  </Text>
                </View>
                <Icon
                  name="expand-more"
                  size={22}
                  color={colors.onSurfaceVariant}
                />
              </Pressable>
            ))}
          </View>

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
                      size={14}
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
                      selectable
                    >
                      {spec.value}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {gem.notes ? (
            <View style={styles.descBlock}>
              <Text
                style={[styles.notes, { color: colors.onSurfaceVariant }]}
                numberOfLines={notesExpanded ? undefined : 3}
                selectable
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
            </View>
          ) : null}

          <View style={styles.section}>
            <Text
              style={[styles.sectionLabel, { color: colors.textMuted }]}
              accessibilityRole="header"
            >
              HISTORY
            </Text>
            {historyEvents.length ? (
              <View style={styles.timeline}>
                {historyEvents.map((e, i) => (
                  <View key={e.id} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <View
                        style={[
                          styles.timelineIconWrap,
                          {
                            backgroundColor:
                              i === 0
                                ? colors.primaryContainer
                                : colors.surfaceContainerHigh,
                          },
                        ]}
                      >
                        <Icon
                          name={eventIcon(e.eventType || e.description)}
                          size={14}
                          color={
                            i === 0
                              ? colors.onPrimaryContainer
                              : colors.onSurfaceVariant
                          }
                        />
                      </View>
                      {i < historyEvents.length - 1 ? (
                        <View
                          style={[
                            styles.timelineLine,
                            { backgroundColor: colors.outlineVariant },
                          ]}
                        />
                      ) : null}
                    </View>
                    <View style={styles.timelineBody}>
                      <Text
                        style={[
                          styles.timelineDate,
                          { color: colors.textMuted },
                        ]}
                      >
                        {formatRelativeTime(e.createdAt)}
                      </Text>
                      <Text
                        style={[
                          styles.timelineTitle,
                          { color: colors.onSurface },
                        ]}
                      >
                        {e.description}
                      </Text>
                      {e.weightAtEvent != null ? (
                        <View style={styles.timelineMetaRow}>
                          <Icon
                            name="scale"
                            size={12}
                            color={colors.onSurfaceVariant}
                          />
                          <Text
                            style={[
                              styles.timelineMeta,
                              { color: colors.onSurfaceVariant },
                            ]}
                          >
                            {e.weightAtEvent} ct
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                No events yet
              </Text>
            )}
          </View>

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
        <View
          style={[
            styles.actionBar,
            {
              paddingBottom: bottomBarPad,
              backgroundColor: colors.background,
              borderTopColor: colors.outlineVariant,
            },
          ]}
        >
          {primaryAction ? (
            <Pressable
              onPress={() => router.push(primaryAction.href as never)}
              accessibilityRole="button"
              accessibilityLabel={primaryAction.title}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Icon
                name={actionIcon(primaryAction.title)}
                size={18}
                color={colors.onPrimary}
              />
              <Text
                style={[styles.primaryBtnText, { color: colors.onPrimary }]}
              >
                {primaryAction.title}
              </Text>
            </Pressable>
          ) : canListGem(gem) ? (
            <Pressable
              onPress={() =>
                router.push(
                  `/listings/create?workspaceGemId=${gem.id}` as never,
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Create listing"
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Icon name="storefront" size={18} color={colors.onPrimary} />
              <Text
                style={[styles.primaryBtnText, { color: colors.onPrimary }]}
              >
                Create Listing
              </Text>
            </Pressable>
          ) : null}

          {secondaryActions.slice(0, 1).map((action) => (
            <Pressable
              key={action.title}
              onPress={() => router.push(action.href as never)}
              accessibilityRole="button"
              accessibilityLabel={action.title}
              style={({ pressed }) => [
                styles.secondaryBtn,
                {
                  borderColor: colors.onSurface,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Text
                style={[styles.secondaryBtnText, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                {action.title}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <BottomSheet
        visible={axisOpen != null}
        onClose={() => {
          if (!statusSaving) setAxisOpen(null);
        }}
        title={activeGroup ? `Set ${activeGroup.title}` : "Set status"}
      >
        {activeGroup ? (
          <>
            <Text style={[styles.statusSheetHint, { color: colors.textMuted }]}>
              {activeGroup.hint}. Other axes stay unchanged.
            </Text>
            <View style={styles.statusList}>
              {activeGroup.clearLabel ? (
                <Pressable
                  disabled={statusSaving}
                  accessibilityRole="button"
                  accessibilityLabel={activeGroup.clearLabel}
                  onPress={() => {
                    if (activeGroup.key === "where") {
                      void handleLifecyclePatch(
                        { custody: null },
                        activeGroup.clearLabel!,
                      );
                    } else if (activeGroup.key === "outcome") {
                      void handleLifecyclePatch(
                        { outcome: null },
                        activeGroup.clearLabel!,
                      );
                    }
                  }}
                  style={({ pressed }) => [
                    styles.statusOption,
                    {
                      backgroundColor:
                        (activeGroup.key === "where" && !lifecycle.custody) ||
                        (activeGroup.key === "outcome" && !lifecycle.outcome)
                          ? colors.primaryContainer
                          : colors.surfaceContainerLow,
                      borderColor:
                        (activeGroup.key === "where" && !lifecycle.custody) ||
                        (activeGroup.key === "outcome" && !lifecycle.outcome)
                          ? colors.primary
                          : colors.outlineVariant,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusOptionIcon,
                      {
                        backgroundColor:
                          (activeGroup.key === "where" && !lifecycle.custody) ||
                          (activeGroup.key === "outcome" && !lifecycle.outcome)
                            ? colors.primary
                            : colors.surfaceContainerHighest,
                      },
                    ]}
                  >
                    <Icon
                      name={activeGroup.key === "where" ? "person" : "block"}
                      size={18}
                      color={
                        (activeGroup.key === "where" && !lifecycle.custody) ||
                        (activeGroup.key === "outcome" && !lifecycle.outcome)
                          ? colors.onPrimary
                          : colors.onSurfaceVariant
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.statusOptionLabel,
                      { color: colors.onSurface },
                    ]}
                  >
                    {activeGroup.clearLabel}
                  </Text>
                </Pressable>
              ) : null}

              {activeGroup.options.map((opt) => {
                const active =
                  activeGroup.key === "stone"
                    ? lifecycle.stoneStage === opt.value
                    : activeGroup.key === "where"
                      ? lifecycle.custody === opt.value
                      : lifecycle.outcome === opt.value;
                const icon = STATUS_ICONS[opt.value] ?? opt.icon;
                return (
                  <Pressable
                    key={opt.value}
                    disabled={statusSaving}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: active,
                      disabled: statusSaving,
                    }}
                    accessibilityLabel={`${activeGroup.title}: ${opt.label}`}
                    onPress={() => {
                      if (active) {
                        setAxisOpen(null);
                        return;
                      }
                      if (activeGroup.key === "stone") {
                        void handleLifecyclePatch(
                          { stoneStage: opt.value as GemLifecycle["stoneStage"] },
                          opt.label,
                        );
                      } else if (activeGroup.key === "where") {
                        void handleLifecyclePatch(
                          { custody: opt.value as GemLifecycle["custody"] },
                          opt.label,
                        );
                      } else {
                        void handleLifecyclePatch(
                          { outcome: opt.value as GemLifecycle["outcome"] },
                          opt.label,
                        );
                      }
                    }}
                    style={({ pressed }) => [
                      styles.statusOption,
                      {
                        backgroundColor: active
                          ? colors.primaryContainer
                          : colors.surfaceContainerLow,
                        borderColor: active
                          ? colors.primary
                          : colors.outlineVariant,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusOptionIcon,
                        {
                          backgroundColor: active
                            ? colors.primary
                            : colors.surfaceContainerHighest,
                        },
                      ]}
                    >
                      <Icon
                        name={icon}
                        size={18}
                        color={
                          active ? colors.onPrimary : colors.onSurfaceVariant
                        }
                      />
                    </View>
                    <Text
                      style={[
                        styles.statusOptionLabel,
                        {
                          color: active
                            ? colors.onPrimaryContainer
                            : colors.onSurface,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {active ? (
                      <Icon name="check" size={20} color={colors.primary} />
                    ) : (
                      <View style={styles.statusOptionSpacer} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </BottomSheet>
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
  heroBadge: {
    position: "absolute",
    right: Spacing.containerMargin,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  heroBadgeText: {
    ...Typography.caption,
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 0.6,
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
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
  },

  titleBlock: { gap: 4 },
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
    marginTop: -Spacing.xs,
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
    gap: Spacing.md,
  },
  specCell: {
    width: "47%",
    flexGrow: 1,
    minWidth: "42%",
    maxWidth: "48%",
    gap: 6,
  },
  specHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  specLabel: { ...Typography.caption, flexShrink: 1 },
  specValue: {
    ...Typography.bodyMd,
    fontWeight: "600",
    fontFamily: FontFamily.semibold,
  },

  descBlock: { gap: 6 },
  notes: { ...Typography.bodyMd, lineHeight: 22 },
  readMore: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
  },
  readMoreText: { ...Typography.labelMd, fontWeight: "600" },

  section: { gap: Spacing.stackMd },
  sectionLabel: {
    ...Typography.labelMd,
    letterSpacing: 1.1,
    fontWeight: "600",
  },

  timeline: { gap: 0 },
  timelineRow: { flexDirection: "row", gap: 12, minHeight: 56 },
  timelineRail: { width: 28, alignItems: "center" },
  timelineIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: { width: 2, flex: 1, marginTop: 4, marginBottom: 0 },
  timelineBody: { flex: 1, paddingBottom: Spacing.md, gap: 2, paddingTop: 4 },
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
    padding: Spacing.md,
    gap: Spacing.stackMd,
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

  emptyHint: { ...Typography.bodyMd },

  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryBtn: {
    flex: 1.2,
    minHeight: 48,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  primaryBtnText: {
    ...Typography.button,
    fontFamily: FontFamily.semibold,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  secondaryBtnText: {
    ...Typography.button,
    fontFamily: FontFamily.semibold,
  },

  statusSheetHint: { ...Typography.bodyMd, marginBottom: Spacing.stackSm },
  statusList: { gap: Spacing.stackSm },
  axisStack: { gap: Spacing.stackSm },
  statusGroup: { gap: Spacing.stackSm },
  statusGroupHeader: { gap: 2, marginBottom: 2 },
  statusGroupTitle: { ...Typography.labelMd, fontWeight: "700" },
  statusGroupHint: { ...Typography.caption },
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
  statusOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusOptionLabel: { ...Typography.bodyMd, fontWeight: "600", flex: 1 },
  statusOptionSpacer: { width: 20 },
});
