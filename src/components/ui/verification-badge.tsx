import { useId } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

import {
  BUSINESS_REPUTATION_BADGE_COLORS,
  BUSINESS_REPUTATION_BADGE_LABELS,
} from "@/constants/business-reputation";
import { Radius, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { BusinessReputationBadge as BusinessReputationBadgeType } from "@/types";

export type VerificationTier = Exclude<BusinessReputationBadgeType, "none">;

/**
 * Per-tier jewel tones: a light top stop, the tier color, and a deep base
 * stop so the seal reads as a cut stone rather than a flat disc.
 */
const SEAL_TONES: Record<VerificationTier, { light: string; base: string; deep: string; glyph: string }> = {
  member: { light: "#A3A3A3", base: BUSINESS_REPUTATION_BADGE_COLORS.member, deep: "#262626", glyph: "#FFFFFF" },
  identity: { light: "#62D69C", base: BUSINESS_REPUTATION_BADGE_COLORS.identity, deep: "#0B5E39", glyph: "#FFFFFF" },
  business: { light: "#86B2FF", base: BUSINESS_REPUTATION_BADGE_COLORS.business, deep: "#173F9A", glyph: "#FFFFFF" },
  gem: { light: "#F8DC84", base: BUSINESS_REPUTATION_BADGE_COLORS.gem, deep: "#8A5A06", glyph: "#FFFFFF" },
  recognized: { light: "#E86A82", base: BUSINESS_REPUTATION_BADGE_COLORS.recognized, deep: "#5E0A1E", glyph: "#FFFFFF" },
};

// 24×24 emerald-cut outline, its table facet, and the upper crown facets.
const STONE = "M8.1 1.5h7.8a2 2 0 0 1 1.42.59l4.6 4.6a2 2 0 0 1 .58 1.41v7.8a2 2 0 0 1-.58 1.42l-4.6 4.6a2 2 0 0 1-1.42.58H8.1a2 2 0 0 1-1.41-.58l-4.6-4.6a2 2 0 0 1-.59-1.42V8.1a2 2 0 0 1 .59-1.41l4.6-4.6A2 2 0 0 1 8.1 1.5Z";
const TABLE = "M9 5.2h6l3.8 3.8v6L15 18.8H9L5.2 15V9Z";
const CROWN = "M8.1 1.5h7.8a2 2 0 0 1 1.42.59l4.6 4.6a2 2 0 0 1 .3.39L18.8 9 15 5.2H9L5.2 9 1.8 7.09a2 2 0 0 1 .3-.4l4.6-4.6A2 2 0 0 1 8.1 1.5Z";

const GLYPHS: Record<VerificationTier, { d: string; stroke?: boolean }> = {
  // Small brilliant-cut gem: registered member, nothing checked yet.
  member: { d: "M9.4 9.3h5.2l1.9 2.2L12 16.2l-4.5-4.7Z" },
  identity: { d: "m8.3 12.2 2.5 2.5 4.9-5.2", stroke: true },
  business: { d: "m8.3 12.2 2.5 2.5 4.9-5.2", stroke: true },
  gem: { d: "m8.3 12.2 2.5 2.5 4.9-5.2", stroke: true },
  // Five-point star: manually recognized by GemFort.
  recognized: { d: "m12 7.6 1.3 2.75 3 .38-2.2 2.08.55 2.98L12 14.33l-2.65 1.46.55-2.98-2.2-2.08 3-.38Z" },
};

/** Vector GemFort verification seal — crisp at any size, no image assets. */
export function VerificationSeal({
  type,
  size = 24,
  ringColor,
  style,
}: {
  type: VerificationTier;
  size?: number;
  /** Draws a separating ring (e.g. the surface color when overlapping an avatar). */
  ringColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const id = useId().replace(/:/g, "");
  const tone = SEAL_TONES[type];
  const glyph = GLYPHS[type];
  const ring = ringColor ? 2.2 : 0;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg
        width={size}
        height={size}
        viewBox={`${-ring} ${-ring} ${24 + ring * 2} ${24 + ring * 2}`}
      >
        <Defs>
          <LinearGradient id={`fill${id}`} x1="0.15" y1="0" x2="0.85" y2="1">
            <Stop offset="0" stopColor={tone.light} />
            <Stop offset="0.45" stopColor={tone.base} />
            <Stop offset="1" stopColor={tone.deep} />
          </LinearGradient>
        </Defs>
        {ringColor ? (
          <Path
            d={STONE}
            fill={ringColor}
            stroke={ringColor}
            strokeWidth={ring * 2}
            strokeLinejoin="round"
          />
        ) : null}
        <Path d={STONE} fill={`url(#fill${id})`} />
        <Path d={CROWN} fill="#FFFFFF" fillOpacity={0.18} />
        <Path
          d={TABLE}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.28}
          strokeWidth={0.7}
          strokeLinejoin="round"
        />
        {glyph.stroke ? (
          <Path
            d={glyph.d}
            fill="none"
            stroke={tone.glyph}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <Path d={glyph.d} fill={tone.glyph} strokeLinejoin="round" />
        )}
      </Svg>
    </View>
  );
}

/** Seal + tier name, for lists, filters, and status summaries. */
export function VerificationTierBadge({
  type,
  size = "md",
  style,
}: {
  type: VerificationTier;
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const tierColor = BUSINESS_REPUTATION_BADGE_COLORS[type];
  const small = size === "sm";
  return (
    <View
      accessibilityLabel={`${BUSINESS_REPUTATION_BADGE_LABELS[type]} badge`}
      style={[
        styles.pill,
        small && styles.pillSm,
        { backgroundColor: `${tierColor}14`, borderColor: `${tierColor}33` },
        style,
      ]}
    >
      <VerificationSeal type={type} size={small ? 14 : 16} />
      <Text
        numberOfLines={1}
        style={[styles.pillText, small && styles.pillTextSm, { color: colors.onSurface }]}
      >
        {BUSINESS_REPUTATION_BADGE_LABELS[type]}
      </Text>
    </View>
  );
}

export function AvatarVerificationBadge({
  type,
  borderColor,
  size = "sm",
}: {
  type: BusinessReputationBadgeType;
  borderColor?: string;
  size?: "sm" | "md" | "lg";
}) {
  const { colors } = useAppTheme();
  if (type === "none") return null;
  const dimension = size === "lg" ? 34 : size === "md" ? 26 : 20;
  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityLabel={`${BUSINESS_REPUTATION_BADGE_LABELS[type]} verification`}
      style={styles.avatarBadge}
    >
      <VerificationSeal
        type={type}
        size={dimension}
        ringColor={borderColor ?? colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingLeft: 6,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillSm: { paddingLeft: 5, paddingRight: 8, paddingVertical: 3, gap: 5 },
  pillText: { ...Typography.labelMd, fontWeight: "600" },
  pillTextSm: { ...Typography.caption, fontWeight: "600" },
  avatarBadge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    zIndex: 5,
  },
});
