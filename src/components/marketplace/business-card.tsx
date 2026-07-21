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
import type { Business } from "@/types";

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type BusinessCardProps = {
  business: Business;
  /** Prefer href for Apple Zoom shared-element transitions (iOS 18+). */
  href?: Href;
  onPress?: () => void;
  /** Visual cue for sellers vs providers in mixed contexts */
  roleLabel?: "Trader" | "Lapidary" | "Gem Lab" | "Seller" | "Provider";
  /** Layout extras (e.g. fixed width for horizontal rails). */
  style?: StyleProp<ViewStyle>;
};

/**
 * Directory tile — banner, logo, role, name, country flag, specialties.
 */
export function BusinessCard({
  business,
  href,
  onPress,
  roleLabel,
  style,
}: BusinessCardProps) {
  const { colors } = useAppTheme();
  const specs = (() => {
    if (business.sellerProfile?.gemSpecializations?.length) {
      return business.sellerProfile.gemSpecializations
        .slice(0, 2)
        .map((s) => formatGemType(s));
    }
    if (business.providerProfile?.gemSpecializations?.length) {
      return business.providerProfile.gemSpecializations
        .slice(0, 2)
        .map((s) => formatGemType(s));
    }
    if (business.labProfile) {
      const active = (business.labProfile.certificateOfferings ?? []).filter(
        (o) => o.isActive,
      );
      if (active.length) return active.slice(0, 2).map((o) => o.title);
      return (business.labProfile.reportTypes ?? [])
        .slice(0, 2)
        .map((s) => formatGemType(s));
    }
    return [];
  })();
  const verified = business.badges.isVerified;
  const inferredRole =
    roleLabel ??
    (business.businessType === "gem_lab" || business.labProfile
      ? "Gem Lab"
      : business.businessType === "lapidary" || business.providerProfile
        ? "Lapidary"
        : "Trader");
  const countryCode = resolveCountryCode(business.country);

  const bannerInner = business.coverPhotoUrl ? (
    <Image
      source={{ uri: business.coverPhotoUrl }}
      style={styles.bannerImg}
      contentFit="cover"
    />
  ) : (
    <View
      style={StyleSheet.flatten([
        styles.bannerImg,
        { backgroundColor: colors.surfaceContainerHigh },
      ])}
    />
  );

  // AppleZoom/Slot rejects style arrays on its direct child — keep a single style object.
  const banner = <View style={styles.bannerImg}>{bannerInner}</View>;

  const logoInner = business.logoUrl ? (
    <Image
      source={{ uri: business.logoUrl }}
      style={styles.logoImg}
      contentFit="cover"
    />
  ) : (
    <Text style={[styles.logoInitials, { color: colors.primary }]}>
      {initials(business.businessName)}
    </Text>
  );

  return (
    <ElevatedCard
      href={href}
      onPress={onPress}
      accessibilityLabel={`${business.businessName}, ${inferredRole}${business.province ? `, ${business.province}` : ""}`}
      style={[styles.card, style]}
    >
      <View style={styles.media}>
        <View style={styles.banner}>
          {href ? <Link.AppleZoom>{banner}</Link.AppleZoom> : banner}
        </View>
        {verified ? (
          <View
            style={[
              styles.verified,
              { backgroundColor: colors.primaryContainer },
            ]}
          >
            <Icon name="verified" size={14} color={colors.onPrimaryContainer} />
          </View>
        ) : null}
        <View
          style={[
            styles.logo,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.surfaceContainerLowest,
            },
          ]}
        >
          {logoInner}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={[styles.role, { color: colors.textMuted }]}>
              {inferredRole}
            </Text>
            <Text
              style={[styles.name, { color: colors.onSurface }]}
              numberOfLines={2}
            >
              {business.businessName}
            </Text>
          </View>
          {countryCode ? (
            <CountryFlag country={business.country} size="sm" />
          ) : null}
        </View>

        {business.shortDescription ? (
          <Text
            style={[styles.description, { color: colors.onSurfaceVariant }]}
            numberOfLines={2}
          >
            {business.shortDescription}
          </Text>
        ) : null}

        {business.province ? (
          <Text
            style={[styles.province, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {business.province}
          </Text>
        ) : null}

        {specs.length > 0 ? (
          <View style={styles.tags}>
            {specs.map((s) => (
              <View
                key={s}
                style={[
                  styles.tag,
                  { backgroundColor: colors.surfaceContainerLow },
                ]}
              >
                <Text
                  style={[styles.tagText, { color: colors.onSurfaceVariant }]}
                  numberOfLines={1}
                >
                  {s}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </ElevatedCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  media: {
    position: "relative",
  },
  banner: {
    width: "100%",
    aspectRatio: 16 / 9,
    overflow: "hidden",
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  bannerImg: {
    width: "100%",
    height: "100%",
  },
  logo: {
    position: "absolute",
    left: 12,
    bottom: -22,
    width: 48,
    height: 48,
    borderRadius: 14,
    borderCurve: "continuous",
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: { width: "100%", height: "100%" },
  logoInitials: { fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  verified: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 28,
    paddingBottom: 12,
    gap: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  titleCopy: {
    flex: 1,
    gap: 2,
  },
  role: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  name: {
    ...Typography.bodyLg,
    fontWeight: "700",
    lineHeight: 22,
  },
  province: {
    ...Typography.caption,
    fontWeight: "600",
  },
  description: {
    ...Typography.caption,
    lineHeight: 16,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    maxWidth: "100%",
  },
  tagText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
