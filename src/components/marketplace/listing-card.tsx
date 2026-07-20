import { Image } from "expo-image";
import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Radius, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatCurrency } from "@/lib/utils";
import type { MarketplaceListing } from "@/types";

type ListingCardProps = {
  listing: MarketplaceListing;
  /** Prefer href for Apple Zoom shared-element transitions (iOS 18+). */
  href?: Href;
  onPress?: () => void;
};

/**
 * Marketplace gem tile for 2-column ecommerce grids.
 * Image-led, compact meta, price-forward — full half-width of the screen.
 */
export function ListingCard({ listing, href, onPress }: ListingCardProps) {
  const { colors } = useAppTheme();
  const price =
    listing.showPrice && listing.priceMin
      ? formatCurrency(listing.priceMin, listing.currency)
      : "Inquire";

  const media = listing.photoUrls?.[0] ? (
    <Image
      source={{ uri: listing.photoUrls[0] }}
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
  );

  const body = (
    <>
      <View style={styles.media}>
        {href ? <Link.AppleZoom>{media}</Link.AppleZoom> : media}
        {listing.isCertified ? (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.badgeText, { color: colors.onPrimary }]}>
              Certified
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text
          style={[styles.title, { color: colors.onSurface }]}
          numberOfLines={2}
        >
          {listing.title}
        </Text>
        <Text
          style={[styles.meta, { color: colors.onSurfaceVariant }]}
          numberOfLines={1}
        >
          {formatGemType(listing.gemType)} · {listing.caratWeight} ct
        </Text>
        <View style={styles.originRow}>
          <Icon name="location-on" size={12} color={colors.textMuted} />
          <Text
            style={[styles.origin, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {listing.origin}
          </Text>
        </View>
        <Text
          style={[styles.price, { color: colors.primary }]}
          numberOfLines={1}
        >
          {price}
        </Text>
      </View>
    </>
  );

  const pressableStyle = ({ pressed }: { pressed: boolean }) => [
    styles.card,
    {
      backgroundColor: colors.surfaceContainerLowest,
      opacity: pressed ? 0.92 : 1,
      transform: [{ scale: pressed ? 0.985 : 1 }],
    },
  ];

  if (href) {
    return (
      <Link href={href} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${listing.title}, ${price}`}
          style={pressableStyle}
        >
          {body}
        </Pressable>
      </Link>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ${price}`}
      style={pressableStyle}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
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
    width: "100%",
    height: "100%",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  body: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 3,
  },
  title: {
    ...Typography.bodyMd,
    fontWeight: "600",
    lineHeight: 18,
  },
  meta: {
    ...Typography.caption,
  },
  originRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  origin: {
    ...Typography.caption,
    flex: 1,
  },
  price: {
    ...Typography.bodyMd,
    fontWeight: "700",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
});
