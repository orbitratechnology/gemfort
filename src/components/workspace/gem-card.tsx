import { Image } from "expo-image";
import { Link, router, type Href } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { CountryFlag } from "@/components/ui/country-flag";
import { Icon } from "@/components/ui/icon";
import {
  ContextActionsLink,
  type ContextMenuAction,
} from "@/components/workspace/context-actions-link";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { GemCertificateBadge } from "@/components/workspace/gem-certificate";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
  formatGemType,
  resolveCountryCode,
} from "@/constants/gem-options";
import {
  formatLifecycleSummary,
  resolveGemLifecycle,
  resolveGemSaleStatus,
} from "@/features/workspace/gem-lifecycle";
import { gemPrimaryPhotoUrl } from "@/features/workspace/party-photo";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { shortGemId } from "@/lib/utils";
import { confirmDelete } from "@/providers/confirm-bridge";
import type { WorkspaceGem } from "@/types";

/** Soft cap so tiles stay product-sized on tablets / wide layouts. */
export const GEM_CARD_MAX_WIDTH = 188;

type GemCardProps = {
  gem: WorkspaceGem;
  /** Prefer href for Apple Zoom shared-element transitions (iOS 18+). */
  href?: Href;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void | Promise<void>;
  /** Unread marketplace offer count for this gem's listing. */
  offerBadge?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Workspace inventory tile for 2-column ecommerce grids.
 */
export function GemCard({
  gem,
  href,
  onEdit,
  onDelete,
  offerBadge = 0,
  style,
}: GemCardProps) {
  const { colors } = useAppTheme();
  const { formatBase, formatStored } = usePreferredMoney();
  const photo = gemPrimaryPhotoUrl(gem);
  const saleStatus = resolveGemSaleStatus(gem);
  const price =
    saleStatus === "sold" && gem.soldPrice != null
      ? formatStored({
          amount: gem.soldPrice,
          currency: gem.soldPriceCurrency ?? gem.totalCostCurrency,
          amountBase: gem.soldPriceBase,
        })
      : gem.askingPrice != null
      ? formatStored({
          amount: gem.askingPrice,
          currency: gem.askingPriceCurrency ?? gem.totalCostCurrency,
          amountBase: gem.askingPriceBase,
        })
      : formatBase(gem.totalCost);

  const gemTitle = gem.title?.trim() || formatGemType(gem.gemType);
  const lifecycle = resolveGemLifecycle(gem);
  const statusLabel = formatLifecycleSummary(lifecycle);
  const soldTraderName =
    gem.soldToBusinessName?.split(" · ")[0]?.trim() ||
    gem.soldToName?.split(" · ")[0]?.trim() ||
    "Trader";
  const salePaymentLabel = gem.salePaymentMethod
    ? gem.salePaymentMethod.replace(/_/g, " ")
    : null;
  const hasOriginFlag = !!resolveCountryCode(gem.originCountry);
  const caratLabel = `${gem.currentWeight} ct`;

  const media = photo ? (
    <Image source={{ uri: photo }} style={styles.image} contentFit="cover" />
  ) : (
    <View
      style={StyleSheet.flatten([
        styles.image,
        styles.placeholder,
        { backgroundColor: colors.surfaceContainerHigh },
      ])}
    >
      <Icon name="diamond" size={28} color={colors.outlineVariant} />
    </View>
  );

  const body = (
    <>
      <View style={styles.media}>
        {href ? <Link.AppleZoom>{media}</Link.AppleZoom> : media}

        {gem.certificate?.url ? (
          <View style={styles.certificateBadge}>
            <GemCertificateBadge compact />
          </View>
        ) : null}

        {hasOriginFlag ? (
          <CountryFlag
            country={gem.originCountry}
            size="xs"
            style={styles.originFlag}
          />
        ) : null}

        <View
          style={[
            styles.overlayChip,
            styles.caratChip,
            { backgroundColor: colors.surfaceContainerLowest },
          ]}
        >
          <Text
            style={[styles.caratText, { color: colors.onSurface }]}
            numberOfLines={1}
          >
            {caratLabel}
          </Text>
        </View>

        <View
          style={[
            styles.statusPill,
            hasOriginFlag && styles.statusPillWithFlag,
            { backgroundColor: colors.primary },
          ]}
        >
          <Text
            style={[styles.statusText, { color: colors.onPrimary }]}
            numberOfLines={1}
          >
            {statusLabel}
          </Text>
        </View>

        {offerBadge > 0 ? (
          <View
            style={[styles.offerBadge, { backgroundColor: colors.error }]}
            accessibilityLabel={`${offerBadge} unread offers`}
          >
            <Text style={styles.offerBadgeText}>
              {offerBadge > 99 ? "99+" : String(offerBadge)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text
          style={[styles.type, { color: colors.onSurface }]}
          numberOfLines={2}
        >
          {gemTitle}
        </Text>
        <View
          style={[
            styles.priceChip,
            { backgroundColor: colors.primaryContainer },
          ]}
        >
          <Text
            style={[styles.price, { color: colors.onPrimaryContainer }]}
            numberOfLines={1}
          >
            {price}
          </Text>
        </View>

        {saleStatus === "sold" && gem.soldToBusinessId ? (
          <Pressable
            style={styles.saleMeta}
            onPress={() =>
              router.push(`/business/${gem.soldToBusinessId}` as never)
            }
            accessibilityRole="button"
            accessibilityLabel={`Open ${soldTraderName} profile`}
          >
            <ContactAvatar
              name={soldTraderName}
              photoUrl={gem.soldToBusinessLogoUrl}
              size={24}
            />
            <View style={styles.saleMetaCopy}>
              <Text
                style={[styles.saleMetaName, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                Sold to {soldTraderName}
              </Text>
              {salePaymentLabel ? (
                <Text
                  style={[styles.saleMetaDetails, { color: colors.onSurfaceVariant }]}
                  numberOfLines={1}
                >
                  {price} · {salePaymentLabel}
                </Text>
              ) : null}
            </View>
            <Icon name="chevron-right" size={16} color={colors.outline} />
          </Pressable>
        ) : null}
      </View>
    </>
  );

  const chrome = StyleSheet.flatten([
    styles.card,
    {
      backgroundColor: colors.surfaceContainerLowest,
      boxShadow: `0 1px 2px ${colors.cardShadow}, 0 6px 16px ${colors.cardShadow}`,
    },
    style,
  ]);

  const label = `${gemTitle}, ${caratLabel}, ${price}${gem.certificate?.url ? ", certified" : ""}`;

  const actions: ContextMenuAction[] = [];
  if (onEdit) {
    actions.push({
      label: "Edit",
      icon: "square.and.pencil",
      onPress: onEdit,
    });
  }
  if (onDelete) {
    actions.push({
      label: "Delete",
      icon: "trash",
      destructive: true,
      onPress: () =>
        confirmDelete(
          "Delete gem",
          `Remove ${gemTitle} (${shortGemId(gem.id)}) from inventory? This cannot be undone.`,
          onDelete,
        ),
    });
  }

  if (href) {
    return (
      <ContextActionsLink
        href={href}
        accessibilityLabel={label}
        actions={actions}
        style={chrome}
      >
        {({ pressed }) => (
          <View
            style={{
              opacity: pressed ? 0.96 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            }}
          >
            {body}
          </View>
        )}
      </ContextActionsLink>
    );
  }

  return (
    <View style={chrome} accessibilityLabel={label}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    alignSelf: "stretch",
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  media: {
    width: "100%",
    aspectRatio: 1,
    position: "relative",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  overlayChip: {
    position: "absolute",
    top: Spacing.sm,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  originFlag: {
    position: "absolute",
    bottom: Spacing.sm,
    left: Spacing.sm,
  },
  certificateBadge: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
  },
  caratChip: {
    right: Spacing.sm,
  },
  caratText: {
    fontSize: 10,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  statusPill: {
    position: "absolute",
    bottom: Spacing.sm,
    left: Spacing.sm,
    maxWidth: "78%",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "capitalize",
  },
  statusPillWithFlag: {
    bottom: 26,
  },
  offerBadge: {
    position: "absolute",
    bottom: Spacing.sm,
    right: Spacing.sm,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  offerBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  body: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 6,
  },
  type: {
    ...Typography.bodyMd,
    fontWeight: "600",
    lineHeight: 18,
  },
  priceChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  price: {
    ...Typography.bodyMd,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  saleMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    paddingTop: 2,
  },
  saleMetaCopy: { flex: 1, minWidth: 0, gap: 1 },
  saleMetaName: { ...Typography.caption, fontWeight: "700" },
  saleMetaDetails: { ...Typography.caption, textTransform: "capitalize" },
});
