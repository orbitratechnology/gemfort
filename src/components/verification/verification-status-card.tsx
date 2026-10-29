import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { VerificationSeal, type VerificationTier } from "@/components/ui/verification-badge";
import {
  BUSINESS_REPUTATION_BADGE_COLORS,
  BUSINESS_REPUTATION_BADGE_LABELS,
} from "@/constants/business-reputation";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { VerificationStatus } from "@/types";

/** Document tiers a user can climb by submitting proof (Recognized is admin-only). */
const LADDER: VerificationTier[] = ["member", "identity", "business", "gem"];

const NEXT_STEP: Record<VerificationTier, string> = {
  member: "Verify your NIC to earn Identity Verified.",
  identity: "Add TIN and BR to reach Business Verified.",
  business: "Add your Gem Licence to reach Gem Verified.",
  gem: "You hold the highest document tier.",
  recognized: "Recognized by GemFort as an established partner.",
};

type StatusTone = "success" | "warning" | "danger" | "neutral";

function describeStatus(
  status: VerificationStatus | null | undefined,
  tier: VerificationTier,
): { label: string; tone: StatusTone; detail: string } {
  switch (status) {
    case "pending":
    case "under_review":
      return {
        label: "In review",
        tone: "warning",
        detail: "GemFort is checking your documents. Your current badge stays active.",
      };
    case "info_requested":
      return {
        label: "Action needed",
        tone: "warning",
        detail: "GemFort needs more information to finish your review.",
      };
    case "rejected":
      return {
        label: "Not approved",
        tone: "danger",
        detail: "Check your documents and submit again.",
      };
    case "revoked":
      return {
        label: "Revoked",
        tone: "danger",
        detail: "Your badge was removed. Contact support or reapply.",
      };
    case "verified":
    case "basic":
      return { label: "Verified", tone: "success", detail: NEXT_STEP[tier] };
    default:
      return tier === "member"
        ? { label: "Not verified", tone: "neutral", detail: NEXT_STEP.member }
        : { label: "Verified", tone: "success", detail: NEXT_STEP[tier] };
  }
}

/**
 * Compact verification summary: current seal, tier, review status, progress
 * through the document tiers, and the one next step. Pressable when `onPress`
 * is set (profile row), static otherwise (verify screen header).
 */
export function VerificationStatusCard({
  tier,
  status,
  onPress,
}: {
  tier: VerificationTier;
  status: VerificationStatus | null | undefined;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const { label, tone, detail } = describeStatus(status, tier);
  const tierColor = BUSINESS_REPUTATION_BADGE_COLORS[tier];
  const reached = tier === "recognized" ? LADDER.length - 1 : LADDER.indexOf(tier);
  const toneColor = {
    success: colors.successEmerald,
    warning: colors.warningAmber,
    danger: colors.error,
    neutral: colors.textMuted,
  }[tone];

  const body = (
    <>
      <View style={styles.top}>
        <VerificationSeal type={tier} size={44} />
        <View style={styles.copy}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>
            {BUSINESS_REPUTATION_BADGE_LABELS[tier]}
          </Text>
        </View>
        <View style={[styles.status, { backgroundColor: `${toneColor}1A` }]}>
          <View style={[styles.statusDot, { backgroundColor: toneColor }]} />
          <Text style={[styles.statusText, { color: toneColor }]}>{label}</Text>
        </View>
      </View>

      <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {LADDER.map((step, i) => (
          <View
            key={step}
            style={[
              styles.segment,
              {
                backgroundColor:
                  i <= reached ? tierColor : colors.surfaceContainerHighest,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.detail, { color: colors.textSecondary }]}>{detail}</Text>
        {onPress ? <Icon name="chevron-right" size={20} color={colors.outline} /> : null}
      </View>
    </>
  );

  const cardStyle = [
    styles.card,
    { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
  ];

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={`${BUSINESS_REPUTATION_BADGE_LABELS[tier]}. ${label}. ${detail}`}
        style={cardStyle}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Verification: ${BUSINESS_REPUTATION_BADGE_LABELS[tier]}. ${label}. ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  pressed: { opacity: 0.85 },
  top: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  copy: { flex: 1, minWidth: 0 },
  title: { ...Typography.headlineSmMobile, fontWeight: "700" },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...Typography.caption, fontWeight: "700" },
  track: { flexDirection: "row", gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  footer: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  detail: { ...Typography.bodySmall, lineHeight: 18, flex: 1 },
});
