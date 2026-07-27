import { Image, type ImageSource } from "expo-image";
import { router } from "expo-router";
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
  wash: string;
  badgeBg: string;
  badgeFg: string;
};

function formatModuleCount(value: number): string {
  return value > 99 ? "99+" : String(value);
}

/** Soft pastel-adjacent washes using theme surfaces (layout inspired by reference cards). */
function tilePalette(
  index: number,
  colors: ThemeColors,
  isDark: boolean,
): TilePalette {
  if (isDark) {
    const whiteWashes = [
      `
        linear-gradient(125deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 42%, rgba(255,255,255,0.10) 100%),
        radial-gradient(ellipse 75% 95% at 100% 45%, rgba(255,255,255,0.16) 0%, transparent 58%)
      `,
      `
        linear-gradient(135deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.13) 100%),
        radial-gradient(ellipse 70% 90% at 100% 50%, rgba(255,255,255,0.14) 0%, transparent 60%)
      `,
      `
        linear-gradient(120deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.03) 48%, rgba(255,255,255,0.11) 100%),
        radial-gradient(ellipse 80% 100% at 100% 40%, rgba(255,255,255,0.15) 0%, transparent 55%)
      `,
      `
        linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.06) 55%, rgba(255,255,255,0.12) 100%),
        radial-gradient(ellipse 72% 88% at 100% 55%, rgba(255,255,255,0.13) 0%, transparent 62%)
      `,
    ];
    return {
      wash: whiteWashes[index % whiteWashes.length]!,
      badgeBg: "rgba(255,255,255,0.12)",
      badgeFg: colors.onSurfaceVariant,
    };
  }

  const palettes: TilePalette[] = [
    {
      wash: `
        linear-gradient(125deg, ${colors.surfaceContainerHigh} 0%, ${colors.surfaceContainerLowest} 48%, ${colors.primaryContainer} 100%),
        radial-gradient(ellipse 70% 90% at 100% 50%, ${colors.primary}12 0%, transparent 62%)
      `,
      badgeBg: colors.surfaceContainerLowest + "E6",
      badgeFg: colors.onSurfaceVariant,
    },
    {
      wash: `
        linear-gradient(125deg, ${colors.surfaceContainer} 0%, ${colors.surfaceContainerLowest} 52%, ${colors.secondaryContainer} 100%),
        radial-gradient(ellipse 70% 90% at 100% 50%, ${colors.secondary}14 0%, transparent 62%)
      `,
      badgeBg: colors.surfaceContainerLowest + "E6",
      badgeFg: colors.onSurfaceVariant,
    },
    {
      wash: `
        linear-gradient(125deg, ${colors.surfaceContainerLow} 0%, ${colors.surfaceContainerLowest} 50%, ${colors.tertiaryContainer} 100%),
        radial-gradient(ellipse 70% 90% at 100% 50%, ${colors.tertiary}12 0%, transparent 62%)
      `,
      badgeBg: colors.surfaceContainerLowest + "E6",
      badgeFg: colors.onSurfaceVariant,
    },
    {
      wash: `
        linear-gradient(125deg, ${colors.surfaceVariant}55 0%, ${colors.surfaceContainerLowest} 55%, ${colors.surfaceContainerHigh} 100%),
        radial-gradient(ellipse 70% 90% at 100% 50%, ${colors.outline}18 0%, transparent 62%)
      `,
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

  return (
    <Animated.View
      entering={FadeInDown.delay(40 + index * 35)
        .duration(280)
        .springify()
        .damping(18)}
      style={styles.tileShell}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.label}, ${countLabel}`}
        onPress={() => router.push(item.route as never)}
        style={({ pressed }) => [
          styles.tile,
          {
            experimental_backgroundImage: palette.wash,
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
        <View style={styles.copyCol}>
          <View style={[styles.badge]}>
            <Text style={[styles.badgeText, { color: colors.textMuted }]}>
              {countLabel}
            </Text>
          </View>

          <Text
            style={[styles.title, { color: colors.onSurface }]}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        </View>

        <View style={styles.artCol} pointerEvents="none">
          {item.image ? (
            <Image
              source={item.image}
              style={styles.artImage}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          ) : item.icon ? (
            <View
              style={[
                styles.artDisc,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <Icon
                name={item.icon}
                size={32}
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
  tile: {
    minHeight: 96,
    borderRadius: 15,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "stretch",
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
  artCol: {
    width: "42%",
    minWidth: 72,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  artImage: {
    width: 76,
    height: 76,
    marginRight: 10,
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
});
