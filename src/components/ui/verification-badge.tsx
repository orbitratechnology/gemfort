import { StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icon";
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

const reputationConfig: Record<
  Exclude<BusinessReputationBadgeType, "none">,
  { bg: string; icon: IconName; label: string }
> = {
  member: { bg: Palette.basicBlue, icon: "person", label: "Member" },
  identity: {
    bg: Palette.basicBlue,
    icon: "verified-user",
    label: "Identity Verified",
  },
  business: { bg: Palette.gemBlue, icon: "business", label: "Business Verified" },
  gem: {
    bg: Palette.verifiedGreen,
    icon: "workspace-premium",
    label: "Gem Verified",
  },
  recognized: { bg: Palette.gemGold, icon: "star", label: "Recognized" },
};

export function BusinessReputationBadge({
  type,
}: {
  type: BusinessReputationBadgeType;
}) {
  if (type === "none") return null;
  const { bg, icon, label } = reputationConfig[type];
  return (
    <View
      accessibilityLabel={`${label} business reputation badge`}
      style={[styles.reputationBadge, { backgroundColor: bg }]}
    >
      <Icon name={icon} size={14} color={Palette.white} />
      <Text selectable style={styles.text}>
        {label}
      </Text>
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
  reputationBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  text: {
    ...Typography.caption,
    color: Palette.white,
    fontWeight: '600',
  },
});
