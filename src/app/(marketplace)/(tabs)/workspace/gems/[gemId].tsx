import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { CountryLabel } from "@/components/ui/country-flag";
import { FormSection, ScreenInset } from "@/components/ui/form-section";
import { Icon, type IconName } from "@/components/ui/icon";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { MANUAL_STATUS_OPTIONS, formatGemType } from "@/constants/gem-options";
import { getGemQuickActions } from "@/features/workspace/gem-utils";
import {
    fetchGem,
    fetchGemCosts,
    fetchGemEvents,
    updateGemStatus,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { friendlyError } from "@/lib/errors";
import { shareFile, shareLink } from "@/lib/share";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type { GemStatus } from "@/types";

const SPEC_ICONS: Record<string, IconName> = {
  Weight: "scale",
  Color: "palette",
  Clarity: "visibility",
  Cut: "content-cut",
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

function statusLabelOf(status: GemStatus): string {
  return (
    MANUAL_STATUS_OPTIONS.find((o) => o.value === status)?.label ??
    status.replace(/_/g, " ")
  );
}

export default function GemDetailScreen() {
  const { gemId } = useLocalSearchParams<{ gemId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

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

  async function handleStatusChange(newStatus: GemStatus) {
    if (!user || !gem || newStatus === gem.status || statusSaving) return;
    setStatusSaving(true);
    try {
      await updateGemStatus(
        gem.id,
        user.uid,
        newStatus,
        `Status changed to ${statusLabelOf(newStatus)}`,
      );
      await queryClient.invalidateQueries({ queryKey: ["gem", gemId] });
      await queryClient.invalidateQueries({ queryKey: ["gem-events", gemId] });
      await queryClient.invalidateQueries({ queryKey: ["gems", user.uid] });
      setStatusOpen(false);
      toast.success(`Moved to ${statusLabelOf(newStatus)}`);
    } catch (e) {
      toast.error(friendlyError(e, "Could not update status."));
    } finally {
      setStatusSaving(false);
    }
  }

  if (isLoading || !gem) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <StackHeader title="Gem Details" />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>
            {isLoading ? "Loading…" : "Gem not found"}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const askCurrency = gem.askingPriceCurrency ?? gem.totalCostCurrency ?? "LKR";
  const profit =
    gem.askingPrice != null ? gem.askingPrice - gem.totalCost : null;
  const roi =
    profit != null && gem.totalCost > 0
      ? ((profit / gem.totalCost) * 100).toFixed(1)
      : null;
  const quickActions = getGemQuickActions(gem);
  const primaryAction =
    quickActions.find((a) => a.variant !== "secondary") ?? quickActions[0];
  const secondaryActions = quickActions.filter((a) => a !== primaryAction);
  const statusLabel = statusLabelOf(gem.status);
  const statusIcon = STATUS_ICONS[gem.status] ?? "flag";
  const isCertified =
    gem.status === "certified" ||
    gem.treatmentStatus?.toLowerCase().includes("cert");

  const specs = [
    { label: "Weight", value: `${gem.currentWeight} ct` },
    ...(gem.colorPrimary ? [{ label: "Color", value: gem.colorPrimary }] : []),
    ...(gem.clarity ? [{ label: "Clarity", value: gem.clarity }] : []),
    ...(gem.cutType || gem.shape
      ? [{ label: "Cut", value: gem.cutType || gem.shape || "" }]
      : []),
    { label: "Treatment", value: gem.treatmentStatus || "None" },
    { label: "Origin", value: gem.originCountry || "Unknown" },
  ];

  const photo = gem.photoUrls?.[0]?.trim() || null;
  const gemSummary = `${formatGemType(gem.gemType)} ${gem.currentWeight}ct · ${gem.sku}`;
  const gemSku = gem.sku;
  const gemIdForShare = gem.id;

  async function handleShareGem() {
    if (photo && (photo.startsWith("file:") || photo.startsWith("content:"))) {
      await shareFile({
        uri: photo,
        mimeType: "image/jpeg",
        dialogTitle: gemSku,
        UTI: "public.jpeg",
      });
      return;
    }
    await shareLink({
      message: `GemFort gem: ${gemSummary}`,
      url: `gemfort://workspace/gems/${gemIdForShare}`,
      title: gemSku,
    });
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader
        title={gem.sku}
        right={
          <Pressable
            onPress={() => void handleShareGem()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Share gem"
            style={styles.headerBtn}
          >
            <Icon name="share" size={22} color={colors.onSurface} />
          </Pressable>
        }
      />

      <ThemedScrollView contentContainerStyle={styles.content}>
        <ScreenInset style={styles.lead}>
        <View
          style={[
            styles.hero,
            { backgroundColor: colors.surfaceContainerLowest },
          ]}
        >
          <Link.AppleZoomTarget>
            {gem.photoUrls?.[0] ? (
              <Image
                source={{ uri: gem.photoUrls[0] }}
                style={styles.heroImage}
                contentFit="cover"
              />
            ) : (
              <View
                style={StyleSheet.flatten([
                  styles.heroPlaceholder,
                  { backgroundColor: colors.surfaceContainerHigh },
                ])}
              >
                <Icon name="diamond" size={48} color={colors.outlineVariant} />
              </View>
            )}
          </Link.AppleZoomTarget>
          {isCertified ? (
            <View
              style={[
                styles.certPill,
                { backgroundColor: colors.surfaceContainerLowest },
              ]}
            >
              <Icon name="verified" size={14} color={colors.primary} />
              <Text style={[styles.certPillText, { color: colors.primary }]}>
                Certified
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.identity}>
          <View style={styles.identityTitleRow}>
            <View
              style={[
                styles.identityIcon,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <Icon
                name="diamond"
                size={20}
                color={colors.onPrimaryContainer}
              />
            </View>
            <View style={styles.identityText}>
              <Text style={[styles.gemName, { color: colors.onSurface }]}>
                {formatGemType(gem.gemType)}
              </Text>
              <Text
                style={[styles.skuLine, { color: colors.onSurfaceVariant }]}
              >
                {gem.sku}
                {gem.variety ? ` · ${gem.variety}` : ""}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => setStatusOpen(true)}
            disabled={statusSaving}
            accessibilityRole="button"
            accessibilityLabel={`Status ${statusLabel}. Tap to change`}
            accessibilityHint="Opens status picker"
            style={({ pressed }) => [
              styles.statusChip,
              {
                backgroundColor: colors.primaryContainer,
                borderColor: colors.primary + "33",
                opacity: pressed || statusSaving ? 0.88 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <View
              style={[
                styles.statusChipIcon,
                { backgroundColor: colors.primary },
              ]}
            >
              {statusSaving ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Icon name={statusIcon} size={16} color={colors.onPrimary} />
              )}
            </View>
            <View style={styles.statusChipText}>
              <Text
                style={[
                  styles.statusChipLabel,
                  { color: colors.onPrimaryContainer },
                ]}
              >
                Status
              </Text>
              <Text
                style={[styles.statusChipValue, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                {statusLabel}
              </Text>
            </View>
            <Icon
              name="expand-more"
              size={22}
              color={colors.onPrimaryContainer}
            />
          </Pressable>

          {gem.askingPrice != null ? (
            <View style={styles.priceRow}>
              <Icon name="sell" size={18} color={colors.primary} />
              <Text style={[styles.askPrice, { color: colors.primary }]}>
                {formatCurrency(gem.askingPrice, askCurrency)}
              </Text>
            </View>
          ) : (
            <View style={styles.priceRow}>
              <Icon name="sell" size={18} color={colors.textMuted} />
              <Text style={[styles.askPriceMuted, { color: colors.textMuted }]}>
                No asking price
              </Text>
            </View>
          )}
        </View>

        <View style={styles.specGrid}>
          {specs.map((spec) => {
            const iconName = SPEC_ICONS[spec.label] ?? "info";
            return (
              <View
                key={spec.label}
                style={[
                  styles.specCell,
                  { backgroundColor: colors.surfaceContainerLowest },
                ]}
              >
                <View style={styles.specHeader}>
                  <View
                    style={[
                      styles.specIconWrap,
                      { backgroundColor: colors.surfaceContainerHigh },
                    ]}
                  >
                    <Icon name={iconName} size={16} color={colors.primary} />
                  </View>
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
                    textStyle={[styles.specValue, { color: colors.onSurface }]}
                    numberOfLines={2}
                  />
                ) : (
                  <Text
                    style={[styles.specValue, { color: colors.onSurface }]}
                    numberOfLines={2}
                  >
                    {spec.value}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
        </ScreenInset>

        <FormSection title="History" icon="history">
          {events.length ? (
            <View style={styles.timeline}>
              {events.map((e, i) => (
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
                        name={eventIcon(e.eventType)}
                        size={14}
                        color={
                          i === 0
                            ? colors.onPrimaryContainer
                            : colors.onSurfaceVariant
                        }
                      />
                    </View>
                    {i < events.length - 1 ? (
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
                      style={[styles.timelineDate, { color: colors.textMuted }]}
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
        </FormSection>

        <FormSection title="Financials" hint="Visible only to you" icon="lock">
          {costs.length ? (
            costs.map((c) => (
              <View key={c.id} style={styles.financeRow}>
                <View style={styles.financeLabelRow}>
                  <Icon
                    name="payments"
                    size={16}
                    color={colors.onSurfaceVariant}
                  />
                  <Text
                    style={[
                      styles.financeLabel,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    {c.costType}
                  </Text>
                </View>
                <Text
                  style={[styles.financeValue, { color: colors.onSurface }]}
                >
                  {formatCurrency(c.amount, c.currency)}
                </Text>
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
                style={[styles.financeTotalLabel, { color: colors.onSurface }]}
              >
                Total cost
              </Text>
            </View>
            <Text
              style={[styles.financeTotalValue, { color: colors.onSurface }]}
            >
              {formatCurrency(gem.totalCost, gem.totalCostCurrency)}
            </Text>
          </View>
          {profit != null ? (
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
                {formatCurrency(profit, askCurrency)}
                {roi ? ` (${roi}%)` : ""}
              </Text>
            </View>
          ) : null}
        </FormSection>

        {gem.notes ? (
          <FormSection title="Notes" icon="notes">
            <Text style={[styles.notes, { color: colors.onSurfaceVariant }]}>
              {gem.notes}
            </Text>
          </FormSection>
        ) : null}

        <ScreenInset style={styles.actions}>
          {primaryAction ? (
            <Button
              title={primaryAction.title}
              icon={actionIcon(primaryAction.title)}
              onPress={() => router.push(primaryAction.href as never)}
            />
          ) : gem.status === "ready_for_sale" || gem.status === "certified" ? (
            <Button
              title="Create Listing"
              icon="storefront"
              onPress={() =>
                router.push(
                  `/listings/create?workspaceGemId=${gem.id}` as never,
                )
              }
            />
          ) : null}
          {secondaryActions.map((action) => (
            <Button
              key={action.title}
              title={action.title}
              icon={actionIcon(action.title)}
              variant="secondary"
              onPress={() => router.push(action.href as never)}
            />
          ))}
        </ScreenInset>
      </ThemedScrollView>

      <BottomSheet
        visible={statusOpen}
        onClose={() => {
          if (!statusSaving) setStatusOpen(false);
        }}
        title="Set status"
      >
        <Text style={[styles.statusSheetHint, { color: colors.textMuted }]}>
          Tap a status to apply it right away.
        </Text>
        <View style={styles.statusList}>
          {MANUAL_STATUS_OPTIONS.map((opt) => {
            const active = gem.status === opt.value;
            const icon = STATUS_ICONS[opt.value] ?? "flag";
            return (
              <Pressable
                key={opt.value}
                disabled={statusSaving}
                accessibilityRole="button"
                accessibilityState={{
                  selected: active,
                  disabled: statusSaving,
                }}
                accessibilityLabel={opt.label}
                onPress={() => {
                  if (active) {
                    setStatusOpen(false);
                    return;
                  }
                  void handleStatusChange(opt.value);
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
                    color={active ? colors.onPrimary : colors.onSurfaceVariant}
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
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerBtn: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    paddingBottom: 48,
    gap: Spacing.sectionGap,
  },
  lead: { gap: Spacing.sectionGap },

  hero: {
    width: "100%",
    aspectRatio: 1,
    maxHeight: 360,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    overflow: "hidden",
    boxShadow: "0 4px 20px rgba(15, 118, 110, 0.1)",
  },
  heroImage: { width: "100%", height: "100%" },
  heroPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  certPill: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  certPillText: { ...Typography.labelMd, fontWeight: "600" },

  identity: { gap: Spacing.stackMd },
  identityTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  identityIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  identityText: { flex: 1, gap: 2, minWidth: 0 },
  gemName: { ...Typography.headlineMdMobile },
  skuLine: { ...Typography.bodyMd },

  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: 1.5,
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

  priceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  askPrice: {
    ...Typography.headlineSmMobile,
    fontVariant: ["tabular-nums"],
  },
  askPriceMuted: { ...Typography.bodyMd },

  specGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.stackMd,
  },
  specCell: {
    width: "47%",
    flexGrow: 1,
    minWidth: "42%",
    maxWidth: "48%",
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    gap: 8,
    boxShadow: "0 2px 12px rgba(15, 118, 110, 0.06)",
  },
  specHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  specIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  specLabel: { ...Typography.caption, flexShrink: 1 },
  specValue: { ...Typography.bodyMd, fontWeight: "600" },

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

  financeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  financeLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  financeLabel: { ...Typography.bodyMd, flexShrink: 1 },
  financeValue: {
    ...Typography.bodyMd,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  financeDivider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  financeTotalLabel: { ...Typography.labelMd, fontWeight: "600" },
  financeTotalValue: {
    ...Typography.labelMd,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  notes: { ...Typography.bodyMd, lineHeight: 22 },
  emptyHint: { ...Typography.bodyMd },

  actions: { gap: Spacing.stackMd, paddingTop: Spacing.sm },

  statusSheetHint: { ...Typography.bodyMd, marginBottom: Spacing.stackSm },
  statusList: { gap: Spacing.stackSm },
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
