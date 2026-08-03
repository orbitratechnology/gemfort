import { Image } from "expo-image";
import { Link, type Href } from "expo-router";
import {
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
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
  formatGemType,
  resolveCountryCode,
} from "@/constants/gem-options";
import {
  formatLifecycleSummary,
  resolveGemLifecycle,
} from "@/features/workspace/gem-lifecycle";
import { gemPrimaryPhotoUrl } from "@/features/workspace/party-photo";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { shortGemId } from "@/lib/utils";
import { confirmDelete } from "@/providers/confirm-provider";
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
  const { formatStored } = usePreferredMoney();
  const photo = gemPrimaryPhotoUrl(gem);
  const price =
    gem.askingPrice != null
      ? formatStored({
          amount: gem.askingPrice,
          currency: gem.askingPriceCurrency ?? gem.totalCostCurrency,
          amountBase: gem.askingPriceBase,
        })
      : "No price set";

  const gemTitle = gem.title?.trim() || formatGemType(gem.gemType);
  const lifecycle = resolveGemLifecycle(gem);
  const statusLabel = formatLifecycleSummary(lifecycle);
  const hasOriginFlag = !!resolveCountryCode(gem.originCountry);
  const caratLabel = `${gem.currentWeight} ct`;
  const isCertified = Boolean(gem.certificateUrl);

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

        {isCertified ? (
          <View style={[styles.certifiedPill, { backgroundColor: colors.successEmerald }]}>
            <Icon name="verified" size={11} color="#FFFFFF" />
            <Text style={styles.certifiedText}>CERTIFIED</Text>
          </View>
        ) : null}

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

  const label = `${gemTitle}, ${caratLabel}, ${price}`;

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
  certifiedPill: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusPillWithFlag: {
    bottom: 26,
  },
  certifiedText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800", letterSpacing: 0.35 },
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
});
