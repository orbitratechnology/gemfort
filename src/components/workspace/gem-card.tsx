import { Image } from "expo-image";
import { Link, type Href } from "expo-router";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { ElevatedCard } from "@/components/ui/elevated-card";
import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import { gemPrimaryPhotoUrl } from "@/features/workspace/party-photo";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatCurrency } from "@/lib/utils";
import type { WorkspaceGem } from "@/types";

/** Soft cap so tiles stay product-sized on tablets / wide layouts. */
export const GEM_CARD_MAX_WIDTH = 188;

type GemCardProps = {
  gem: WorkspaceGem;
  /** Prefer href for Apple Zoom shared-element transitions (iOS 18+). */
  href?: Href;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Workspace inventory tile for 2-column ecommerce grids.
 * Uses ElevatedCard so chrome (border + shadow) works with Link asChild.
 */
export function GemCard({ gem, href, onPress, style }: GemCardProps) {
  const { colors } = useAppTheme();
  const photo = gemPrimaryPhotoUrl(gem);
  const currency = gem.askingPriceCurrency ?? gem.totalCostCurrency ?? "LKR";
  const price =
    gem.askingPrice != null
      ? formatCurrency(gem.askingPrice, currency)
      : "No price set";

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

  return (
    <ElevatedCard
      href={href}
      onPress={onPress}
      accessibilityLabel={`${gem.sku}, ${formatGemType(gem.gemType)}, ${price}`}
      style={[styles.card, style]}
    >
      <View style={styles.media}>
        {href ? <Link.AppleZoom>{media}</Link.AppleZoom> : media}
        <View style={[styles.statusPill, { backgroundColor: colors.primary }]}>
          <Text
            style={[styles.statusText, { color: colors.onPrimary }]}
            numberOfLines={1}
          >
            {gem.status.replace(/_/g, " ")}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text
          style={[styles.sku, { color: colors.onSurfaceVariant }]}
          numberOfLines={1}
          selectable
        >
          {gem.sku}
        </Text>
        <Text
          style={[styles.type, { color: colors.onSurface }]}
          numberOfLines={2}
        >
          {formatGemType(gem.gemType)}
        </Text>
        <Text
          style={[styles.meta, { color: colors.onSurfaceVariant }]}
          numberOfLines={1}
        >
          {gem.currentWeight} ct
          {gem.cutType ? ` · ${gem.cutType}` : ""}
        </Text>
        <Text
          style={[styles.price, { color: colors.primary }]}
          numberOfLines={1}
          selectable
        >
          {price}
        </Text>
      </View>
    </ElevatedCard>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: GEM_CARD_MAX_WIDTH,
    alignSelf: "center",
  },
  media: {
    width: "100%",
    aspectRatio: 1,
    position: "relative",
    overflow: "hidden",
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  statusPill: {
    position: "absolute",
    top: Spacing.sm,
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
  body: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 3,
  },
  sku: {
    ...Typography.caption,
    letterSpacing: 0.3,
  },
  type: {
    ...Typography.bodyMd,
    fontWeight: "600",
    lineHeight: 18,
  },
  meta: {
    ...Typography.caption,
  },
  price: {
    ...Typography.bodyMd,
    fontWeight: "700",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
});
