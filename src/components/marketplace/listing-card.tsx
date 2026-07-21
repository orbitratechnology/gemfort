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
import { ElevatedCard } from "@/components/ui/elevated-card";
import { Icon } from "@/components/ui/icon";
import { Radius, Typography } from "@/constants/design-tokens";
import { formatGemType, resolveCountryCode } from "@/constants/gem-options";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatCurrency } from "@/lib/utils";
import type { MarketplaceListing } from "@/types";

type ListingCardProps = {
  listing: MarketplaceListing;
  /** Prefer href for Apple Zoom shared-element transitions (iOS 18+). */
  href?: Href;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Marketplace gem tile for 2-column ecommerce grids.
 * Uses ElevatedCard so chrome (border + shadow) works with Link asChild.
 */
export function ListingCard({
  listing,
  href,
  onPress,
  style,
}: ListingCardProps) {
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
      accessibilityLabel={`${listing.title}, ${price}`}
      style={[styles.card, style]}
    >
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
          {resolveCountryCode(listing.origin) ? (
            <CountryFlag country={listing.origin} size="xs" />
          ) : (
            <Icon name="location-on" size={12} color={colors.textMuted} />
          )}
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
    flex: 1,
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
    gap: 4,
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
