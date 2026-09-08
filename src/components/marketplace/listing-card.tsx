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
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { resolveCountryCode } from "@/constants/gem-options";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
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
  const { formatStored } = usePreferredMoney();
  const price =
    listing.showPrice && listing.priceMin != null
      ? formatStored({
          amount: listing.priceMin,
          currency: listing.currency,
          amountBase: listing.priceMinBase,
        })
      : "Inquire";
  const hasOriginFlag = !!resolveCountryCode(listing.origin);
  const caratLabel = `${listing.caratWeight} ct`;
  const ownerName = listing.sellerBusinessName?.trim() || "Seller";
  const ownerAvatar = listing.sellerLogoUrl ?? null;

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
      accessibilityLabel={`${listing.title}, ${caratLabel}, ${price}, ${ownerName}`}
      style={[styles.card, style]}
    >
      <View style={styles.media}>
        {href ? <Link.AppleZoom>{media}</Link.AppleZoom> : media}

        {hasOriginFlag ? (
          <CountryFlag
            country={listing.origin}
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

      </View>

      <View style={styles.body}>
        <Text
          style={[styles.title, { color: colors.onSurface }]}
          numberOfLines={2}
        >
          {listing.title}
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

        <View style={styles.ownerRow}>
          <ContactAvatar name={ownerName} photoUrl={ownerAvatar} size={20} />
          <Text
            style={[styles.ownerName, { color: colors.onSurfaceVariant }]}
            numberOfLines={1}
          >
            {ownerName}
          </Text>
        </View>
      </View>
    </ElevatedCard>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
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
  body: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 6,
  },
  title: {
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
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  ownerName: {
    ...Typography.caption,
    flexShrink: 1,
  },
});
