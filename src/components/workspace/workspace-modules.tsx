import { BlurTargetView, BlurView } from "expo-blur";
import { Image, type ImageSource } from "expo-image";
import { router } from "expo-router";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Icon, type IconName } from "@/components/ui/icon";
import {
    Spacing,
    Typography,
    type ThemeColors,
} from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

export type ModuleGroupId = "inventory" | "money" | "people";

export type WorkspaceModuleItem = {
  label: string;
  value: number;
  /** Vector icon fallback when `image` is not set. */
  icon?: IconName;
  /** Custom PNG/illustration shown instead of the vector icon. */
  image?: ImageSource;
  route: string;
  group: ModuleGroupId;
  /** Full-width hero tile — renders the module as the workspace's main card. */
  featured?: boolean;
  /** Secondary line under the label on a featured tile. */
  featuredHint?: string;
};

export type WorkspaceModuleGroup = {
  id: ModuleGroupId;
  title: string;
  items: WorkspaceModuleItem[];
};

type WorkspaceModulesProps = {
  groups: WorkspaceModuleGroup[];
  colors: ThemeColors;
};

type TilePalette = {
  meshColors: [string, string, string];
  badgeBg: string;
  badgeFg: string;
};

function formatModuleCount(value: number): string {
  return value > 99 ? "99+" : String(value);
}

/** Soft monochrome mesh colors using the app's semantic surface family. */
function tilePalette(
  index: number,
  colors: ThemeColors,
  isDark: boolean,
): TilePalette {
  if (isDark) {
    const meshPalettes: TilePalette[] = [
      {
        meshColors: [colors.primary + "20", colors.secondary + "18", colors.tertiary + "16"],
        badgeBg: colors.surfaceContainerHigh + "E6",
        badgeFg: colors.onSurfaceVariant,
      },
    ];
    return meshPalettes[index % meshPalettes.length]!;
  }

  const palettes: TilePalette[] = [
    {
      meshColors: [colors.primary + "14", colors.secondary + "12", colors.tertiary + "10"],
      badgeBg: colors.surfaceContainerLowest + "E6",
      badgeFg: colors.onSurfaceVariant,
    },
    {
      meshColors: [colors.secondary + "15", colors.tertiary + "12", colors.primary + "0E"],
      badgeBg: colors.surfaceContainerLowest + "E6",
      badgeFg: colors.onSurfaceVariant,
    },
    {
      meshColors: [colors.tertiary + "13", colors.primary + "10", colors.secondary + "12"],
      badgeBg: colors.surfaceContainerLowest + "E6",
      badgeFg: colors.onSurfaceVariant,
    },
    {
      meshColors: [colors.outline + "14", colors.primary + "0D", colors.surfaceVariant + "18"],
      badgeBg: colors.surfaceContainerLowest + "E6",
      badgeFg: colors.onSurfaceVariant,
    },
  ];
  return palettes[index % palettes.length]!;
}

function ModuleTile({
  item,
  colors,
  index,
  isDark,
}: {
  item: WorkspaceModuleItem;
  colors: ThemeColors;
  index: number;
  isDark: boolean;
}) {
  const countLabel = formatModuleCount(item.value);
  const palette = tilePalette(index, colors, isDark);
  const featured = item.featured === true;
  const meshTargetRef = useRef<View | null>(null);

  return (
    <Animated.View
      entering={FadeInDown.delay(40 + index * 35)
        .duration(280)
        .springify()
        .damping(18)}
      style={[styles.tileShell, featured && styles.tileShellFeatured]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.label}, ${countLabel}`}
        onPress={() => router.push(item.route as never)}
        style={({ pressed }) => [
          styles.tile,
          featured && styles.tileFeatured,
          {
            backgroundColor: isDark
              ? colors.surfaceContainer
              : colors.surfaceContainerLowest,
            borderColor: isDark
              ? "rgba(255,255,255,0.12)"
              : colors.outlineVariant + "55",
            transform: [{ scale: pressed ? 0.978 : 1 }],
            opacity: pressed ? 0.96 : 1,
            boxShadow: pressed
              ? "0 1px 4px rgba(0, 0, 0, 0.04)"
              : isDark
                ? "0 6px 18px rgba(0, 0, 0, 0.35)"
                : "0 6px 18px rgba(0, 0, 0, 0.07)",
          },
        ]}
      >
        <View pointerEvents="none" style={styles.mesh}>
          <BlurTargetView ref={meshTargetRef} style={styles.meshTarget}>
            <View
              style={[styles.meshBlob, styles.meshBlobTop, { backgroundColor: palette.meshColors[0] }]}
            />
            <View
              style={[styles.meshBlob, styles.meshBlobBottom, { backgroundColor: palette.meshColors[1] }]}
            />
            <View
              style={[styles.meshBlob, styles.meshBlobSide, { backgroundColor: palette.meshColors[2] }]}
            />
          </BlurTargetView>
          <BlurView
            blurMethod="dimezisBlurViewSdk31Plus"
            blurTarget={meshTargetRef}
            intensity={isDark ? 42 : 52}
            tint={isDark ? "dark" : "light"}
            style={styles.meshBlur}
          />
          <View
            style={[styles.meshSheen, { backgroundColor: colors.white + "24" }]}
          />
        </View>

        <View style={styles.copyCol}>
          <View style={[styles.badge, { backgroundColor: palette.badgeBg }]}>
            <Text style={[styles.badgeText, { color: palette.badgeFg }]}>
              {countLabel}
            </Text>
          </View>

          <Text
            style={[styles.title, { color: colors.onSurface }]}
            numberOfLines={1}
          >
            {item.label}
          </Text>

          {featured && item.featuredHint ? (
            <Text
              style={[styles.featuredHint, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {item.featuredHint}
            </Text>
          ) : null}
        </View>

        <View
          style={[styles.artCol, featured && styles.artColFeatured]}
          pointerEvents="none"
        >
          {item.image ? (
            <Image
              source={item.image}
              style={[styles.artImage, featured && styles.artImageFeatured]}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          ) : item.icon ? (
            <View
              style={[
                styles.artDisc,
                featured && styles.artDiscFeatured,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <Icon
                name={item.icon}
                size={featured ? 44 : 32}
                color={colors.onPrimaryContainer}
              />
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Grouped workspace module launcher — landscape cards with oversized art. */
export function WorkspaceModules({ groups, colors }: WorkspaceModulesProps) {
  const { isDark } = useAppTheme();
  const visible = groups.filter((g) => g.items.length > 0);
  if (visible.length === 0) return null;

  let tileIndex = 0;

  return (
    <View style={styles.section}>
      {visible.map((group, groupIndex) => (
        <Animated.View
          key={group.id}
          entering={FadeInDown.delay(groupIndex * 60)
            .duration(320)
            .springify()
            .damping(20)}
          style={styles.groupBlock}
        >
          <View style={styles.groupHeader}>
            <View
              style={[styles.groupAccent, { backgroundColor: colors.primary }]}
            />
            <Text
              style={[styles.groupTitle, { color: colors.onSurfaceVariant }]}
            >
              {group.title}
            </Text>
          </View>

          <View style={styles.grid}>
            {group.items.map((item) => {
              const i = tileIndex++;
              return (
                <ModuleTile
                  key={item.label}
                  item={item}
                  colors={colors}
                  index={i}
                  isDark={isDark}
                />
              );
            })}
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.lg,
  },
  groupBlock: {
    gap: Spacing.sm,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 2,
  },
  groupAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  groupTitle: {
    ...Typography.labelMd,
    fontWeight: "700",
    letterSpacing: 0.35,
    textTransform: "uppercase",
    flex: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  tileShell: {
    width: "48%",
    flexGrow: 1,
    minWidth: "46%",
  },
  tileShellFeatured: {
    width: "100%",
    minWidth: "100%",
    flexGrow: 1,
  },
  tile: {
    minHeight: 96,
    borderRadius: 15,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "stretch",
  },
  mesh: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  meshTarget: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  meshBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  meshBlob: {
    position: "absolute",
    borderRadius: 999,
  },
  meshBlobTop: {
    width: 188,
    height: 118,
    top: -70,
    right: -58,
    transform: [{ rotate: "-12deg" }],
  },
  meshBlobBottom: {
    width: 196,
    height: 132,
    bottom: -88,
    left: -66,
    transform: [{ rotate: "14deg" }],
  },
  meshBlobSide: {
    width: 112,
    height: 168,
    top: 14,
    right: -54,
    transform: [{ rotate: "22deg" }],
  },
  meshSheen: {
    position: "absolute",
    width: "140%",
    height: 46,
    top: -28,
    left: -34,
    borderRadius: 999,
    opacity: 0.55,
    transform: [{ rotate: "-8deg" }],
  },
  tileFeatured: {
    minHeight: 128,
  },
  copyCol: {
    flex: 1,
    minWidth: 0,
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.md,
    paddingRight: 4,
    gap: 6,
    justifyContent: "center",
    zIndex: 1,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderCurve: "continuous",
  },
  badgeText: {
    ...Typography.bodySmall,
    fontSize: 16,
    lineHeight: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontVariant: ["tabular-nums"],
  },
  title: {
    ...Typography.headlineSmMobile,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  featuredHint: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
  artCol: {
    width: "42%",
    minWidth: 72,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  artColFeatured: {
    width: "36%",
    minWidth: 84,
  },
  artImage: {
    width: 76,
    height: 76,
    marginRight: 10,
  },
  artImageFeatured: {
    width: 96,
    height: 96,
    marginRight: 14,
  },
  artDisc: {
    width: 56,
    height: 56,
    marginRight: 12,
    borderRadius: 16,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  artDiscFeatured: {
    width: 72,
    height: 72,
    marginRight: 14,
    borderRadius: 20,
  },
});
