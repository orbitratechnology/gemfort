import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { Palette, Typography } from "@/constants/design-tokens";
import type {
    BusinessReputationBadge as BusinessReputationBadgeType,
} from "@/types";

type BadgeType = "verified" | "basic" | "pending" | "revoked";

const config: Record<BadgeType, { bg: string; label: string }> = {
  verified: { bg: Palette.verifiedGreen, label: "Verified" },
  basic: { bg: Palette.basicBlue, label: "Identity Verified" },
  pending: { bg: Palette.pendingAmber, label: "Pending" },
  revoked: { bg: Palette.revokedRed, label: "Revoked" },
};

export function VerificationBadge({ type }: { type: BadgeType }) {
  const { bg, label } = config[type];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text selectable style={styles.text}>
        {label}
      </Text>
    </View>
  );
}

type ReputationStyle = {
  label: string;
};

const reputationConfig: Record<
  Exclude<BusinessReputationBadgeType, "none">,
  ReputationStyle
> = {
  member: {
    label: "Member",
  },
  identity: {
    label: "Identity Verified",
  },
  business: {
    label: "Business Verified",
  },
  gem: {
    label: "Gem Verified",
  },
  recognized: {
    label: "Recognized",
  },
};

const badgeAssets = {
  member: require("@/assets/images/verified-badges/member.webp"),
  identity: require("@/assets/images/verified-badges/identity.webp"),
  business: require("@/assets/images/verified-badges/business.webp"),
  gem: require("@/assets/images/verified-badges/gem.webp"),
  recognized: require("@/assets/images/verified-badges/recognized.webp"),
} as const;

/** Shared badge artwork for tier education and avatar badges. */
export const verificationBadgeAssets = badgeAssets;

export function AvatarVerificationBadge({
  type,
  size = "sm",
}: {
  type: BusinessReputationBadgeType;
  borderColor?: string;
  size?: "sm" | "md" | "lg";
}) {
  if (type === "none") return null;
  const { label } = reputationConfig[type];
  const dimension = size === "lg" ? 42 : size === "md" ? 30 : 22;
  return (
    <View
      pointerEvents="none"
      accessibilityLabel={`${label} verification`}
      style={[
        styles.avatarBadge,
        {
          width: dimension,
          height: dimension,
          padding: size === "lg" ? 1.5 : size === "md" ? 1 : 0.75,
        },
      ]}
    >
      <Image
        source={badgeAssets[type]}
        style={styles.badgeImage}
        contentFit="contain"
        accessibilityLabel={`${label} verification badge`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  avatarBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    zIndex: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeImage: {
    width: "100%",
    height: "100%",
  },
  text: {
    ...Typography.caption,
    color: Palette.white,
    fontWeight: '600',
  },
});
