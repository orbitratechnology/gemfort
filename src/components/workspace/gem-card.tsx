import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatCurrency } from "@/lib/utils";
import type { WorkspaceGem } from "@/types";

/** Soft cap so tiles stay product-sized on tablets / wide layouts. */
export const GEM_CARD_MAX_WIDTH = 188;

type GemCardProps = {
  gem: WorkspaceGem;
  onPress?: () => void;
};

/**
 * Workspace inventory tile for 2-column ecommerce grids.
 * Image-led, status pill, SKU + type, weight, asking price.
 */
export function GemCard({ gem, onPress }: GemCardProps) {
  const { colors } = useAppTheme();
  const photo = gem.photoUrls?.[0];
  const currency = gem.askingPriceCurrency ?? gem.totalCostCurrency ?? "LKR";
  const price =
    gem.askingPrice != null
      ? formatCurrency(gem.askingPrice, currency)
      : "No price set";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${gem.sku}, ${formatGemType(gem.gemType)}, ${price}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surfaceContainerLowest,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      <View style={styles.media}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <View
            style={[
              styles.image,
              styles.placeholder,
              { backgroundColor: colors.surfaceContainerHigh },
            ]}
          >
            <Icon name="diamond" size={28} color={colors.outlineVariant} />
          </View>
        )}
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
        >
          {price}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: GEM_CARD_MAX_WIDTH,
    alignSelf: "center",
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    overflow: "hidden",
    boxShadow: "0 4px 16px rgba(15, 118, 110, 0.08)",
  },
  media: {
    width: "100%",
    aspectRatio: 1,
    position: "relative",
  },
  image: {
    ...StyleSheet.absoluteFill,
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
