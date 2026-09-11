import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { Icon } from "@/components/ui/icon";
import { Palette, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
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
  iconColor: string;
  label: string;
  gradient: readonly [string, string, string, string, string];
};

const reputationConfig: Record<
  Exclude<BusinessReputationBadgeType, "none">,
  ReputationStyle
> = {
  member: {
    iconColor: Palette.white,
    label: "Member",
    gradient: ["#4B5563", "#6B7280", "#9CA3AF", "#B6BBC2", "#6B7280"],
  },
  identity: {
    iconColor: Palette.white,
    label: "Identity Verified",
    gradient: ["#000000", "#111827", "#374151", "#4B5563", "#111827"],
  },
  business: {
    iconColor: "#000000",
    label: "Business Verified",
    gradient: ["#4D7C0F", "#84CC16", "#BEF264", "#D9F99D", "#84CC16"],
  },
  gem: {
    iconColor: Palette.white,
    label: "Gem Verified",
    gradient: ["#1E40AF", "#1D9BF0", "#60A5FA", "#93C5FD", "#1D9BF0"],
  },
  recognized: {
    iconColor: "#000000",
    label: "Recognized",
    gradient: ["#8C6A14", "#D4AF37", "#FDE68A", "#FFF7B2", "#D4AF37"],
  },
};

export function AvatarVerificationBadge({
  type,
  borderColor,
  size = "sm",
}: {
  type: BusinessReputationBadgeType;
  borderColor?: string;
  size?: "sm" | "md";
}) {
  const { colors } = useAppTheme();
  if (type === "none") return null;
  const { iconColor, label, gradient } = reputationConfig[type];
  const [shadow, base, light, highlight, end] = gradient;
  const dimension = size === "md" ? 30 : 22;
  return (
    <View
      pointerEvents="none"
      accessibilityLabel={`${label} verification`}
      style={[
        styles.avatarBadge,
        {
          width: dimension,
          height: dimension,
        },
      ]}
    >
      <Svg
        width={dimension}
        height={dimension}
        viewBox="0 0 100 100"
        accessibilityElementsHidden
      >
        <Defs>
          <LinearGradient
            id={`verification-badge-gradient-${type}`}
            x1="0%"
            y1="100%"
            x2="100%"
            y2="0%"
          >
            <Stop offset="0%" stopColor={shadow} />
            <Stop offset="24%" stopColor={base} />
            <Stop offset="42%" stopColor={light} />
            <Stop offset="52%" stopColor={highlight} />
            <Stop offset="62%" stopColor={light} />
            <Stop offset="82%" stopColor={base} />
            <Stop offset="100%" stopColor={end} />
          </LinearGradient>
        </Defs>
        <Path
          d="M50 4 C56 4 60 8 62 14 C66 9 73 7 78 10 C83 13 85 19 84 25 C90 24 95 28 97 33 C99 39 96 45 91 48 C97 51 100 57 98 63 C96 69 91 72 85 71 C87 77 84 83 79 87 C74 90 68 89 64 85 C62 91 57 96 51 96 C45 96 40 92 38 86 C34 91 28 92 23 89 C18 86 16 80 18 74 C12 75 6 71 4 66 C2 60 5 54 10 51 C4 48 1 42 3 36 C5 30 10 27 16 28 C14 22 17 16 22 12 C27 9 33 10 37 14 C39 8 44 4 50 4 Z"
          fill={`url(#verification-badge-gradient-${type})`}
          stroke={borderColor ?? colors.background}
          strokeWidth={size === "md" ? 7 : 8}
          strokeLinejoin="round"
        />
      </Svg>
      <View style={styles.checkIcon}>
        <Icon name="check" size={size === "md" ? 16 : 12} color={iconColor} />
      </View>
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
    right: 0,
    bottom: 0,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkIcon: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    ...Typography.caption,
    color: Palette.white,
    fontWeight: '600',
  },
});
