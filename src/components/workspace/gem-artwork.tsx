import { Image } from "expo-image";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { Icon } from "@/components/ui/icon";
import { findColorShade, GEM_TYPES } from "@/constants/gem-options";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { WorkspaceGem } from "@/types";

/**
 * Fallback hue by gem type when no colour is recorded, so photo-less gems
 * still read as different stones.
 */
const TYPE_TINT: Record<string, string> = {
  sapphire: "#1D4ED8",
  blue_sapphire: "#1D4ED8",
  star_sapphire: "#1E3A8A",
  ruby: "#B91C1C",
  padparadscha: "#F2826A",
  emerald: "#047857",
  cat_eye: "#A16207",
  spinel: "#DB2777",
  garnet: "#B4321C",
  tourmaline: "#DB2777",
  alexandrite: "#0F766E",
  amethyst: "#7C3AED",
  ametrine: "#9333EA",
  aquamarine: "#0891B2",
  citrine: "#D97706",
  diamond: "#64748B",
  fancy_color_diamond: "#EAB308",
  iolite: "#4338CA",
  jade: "#15803D",
  kunzite: "#C084FC",
  lapis_lazuli: "#1E40AF",
  moonstone: "#94A3B8",
  morganite: "#F9A8D4",
  opal: "#38BDF8",
  pearl: "#A8A29E",
  peridot: "#65A30D",
  rose_quartz: "#F472B6",
  sunstone: "#EA580C",
  tanzanite: "#5B21B6",
  topaz: "#F59E0B",
  turquoise: "#0D9488",
  zircon: "#0EA5E9",
  amber: "#D97706",
};

/** The gem's display hue: recorded colour shade, else its type's hue. */
export function gemTint(gem: Pick<WorkspaceGem, "colorPrimary" | "gemType">): string | null {
  const hit = gem.colorPrimary ? findColorShade(gem.colorPrimary) : null;
  return hit?.shade.hex ?? hit?.family.hex ?? TYPE_TINT[gem.gemType] ?? null;
}

/**
 * Stand-in for a gem photo: the type's artwork on a soft halo of the gem's
 * own colour. Returns a single View with a flat style so it can be the
 * direct child of `Link.AppleZoom` / `Link.AppleZoomTarget`.
 */
export function GemArtwork({
  gem,
  style,
  artScale = 0.92,
}: {
  gem: Pick<WorkspaceGem, "colorPrimary" | "gemType">;
  style?: ViewStyle;
  /** Artwork size relative to the shorter side (type images carry padding). */
  artScale?: number;
}) {
  const { colors, isDark } = useAppTheme();
  const tint = gemTint(gem);
  const typeArt = GEM_TYPES.find((t) => t.value === gem.gemType)?.image;
  const artSize = `${Math.round(artScale * 100)}%` as const;

  return (
    <View
      style={StyleSheet.flatten([
        styles.root,
        {
          backgroundColor: tint
            ? `${tint}${isDark ? "26" : "14"}`
            : colors.surfaceContainerHigh,
        },
        style,
      ])}
    >
      {tint ? (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.halo,
              styles.haloOuter,
              { backgroundColor: `${tint}${isDark ? "1F" : "14"}` },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.halo,
              styles.haloInner,
              { backgroundColor: `${tint}${isDark ? "2E" : "1F"}` },
            ]}
          />
        </>
      ) : null}
      {typeArt ? (
        <Image
          source={typeArt}
          style={{ width: artSize, height: artSize }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Icon name="diamond" size={40} color={tint ?? colors.outline} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  halo: {
    position: "absolute",
    aspectRatio: 1,
    borderRadius: 9999,
  },
  haloOuter: { width: "96%", maxWidth: 520 },
  haloInner: { width: "70%", maxWidth: 380 },
});
