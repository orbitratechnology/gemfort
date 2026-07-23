import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Icon, type IconName } from "@/components/ui/icon";
import {
  Radius,
  Spacing,
  TouchTarget,
  Typography,
  type ThemeColors,
} from "@/constants/design-tokens";

export type ModuleGroupId = "inventory" | "money" | "people";

export type WorkspaceModuleItem = {
  label: string;
  value: number;
  icon: IconName;
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

type GroupVisual = {
  accent: string;
  iconFg: string;
  iconBg: string;
  panelWash: string;
  tileWash: string;
  orb: string;
};

function formatModuleCount(value: number): string {
  return value > 99 ? "99+" : String(value);
}

function groupVisual(id: ModuleGroupId, colors: ThemeColors): GroupVisual {
  if (id === "people") {
    const accent = colors.primary;
    return {
      accent,
      iconFg: colors.onPrimary,
      iconBg: colors.primary,
      panelWash: `
        linear-gradient(195deg, ${colors.primary}10 0%, ${colors.surfaceContainerLow} 40%, ${colors.surfaceContainerLowest} 100%),
        radial-gradient(ellipse 70% 55% at 0% 0%, ${colors.primaryContainer}99 0%, transparent 58%)
      `,
      tileWash: `
        linear-gradient(155deg, ${colors.surfaceContainerLowest} 0%, ${colors.primary}0F 100%),
        radial-gradient(circle at 0% 100%, ${colors.primary}16 0%, transparent 50%)
      `,
      orb: colors.primary + "1A",
    };
  }

  const accent = colors.primary;
  return {
    accent,
    iconFg: colors.onPrimaryContainer,
    iconBg: colors.primaryContainer,
    panelWash: `
      linear-gradient(160deg, ${colors.primary}14 0%, ${colors.surfaceContainerLow} 45%, ${colors.surfaceContainerLowest} 100%),
      radial-gradient(ellipse 85% 65% at 100% 0%, ${colors.primaryContainer} 0%, transparent 58%)
    `,
    tileWash: `
      linear-gradient(140deg, ${colors.surfaceContainerLowest} 0%, ${colors.primary}0D 100%),
      radial-gradient(circle at 100% 0%, ${colors.primary}14 0%, transparent 52%)
    `,
    orb: colors.primary + "1A",
  };
}

function ModuleTile({
  item,
  visual,
  colors,
  index,
}: {
  item: WorkspaceModuleItem;
  visual: GroupVisual;
  colors: ThemeColors;
  index: number;
}) {
  const countLabel = formatModuleCount(item.value);

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
            experimental_backgroundImage: visual.tileWash,
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: colors.outlineVariant + "66",
            transform: [{ scale: pressed ? 0.975 : 1 }],
            opacity: pressed ? 0.96 : 1,
            boxShadow: pressed
              ? "0 1px 4px rgba(0, 0, 0, 0.05)"
              : "0 4px 16px rgba(0, 0, 0, 0.08)",
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[styles.tileOrb, { backgroundColor: visual.orb }]}
        />

        <View style={styles.tileTop}>
          <View style={styles.iconWrap}>
            <View style={[styles.iconDisc]}>
              <Icon name={item.icon} size={32} color={visual.iconFg} />
            </View>
          </View>

          <View style={styles.valueCol}>
            <Text
              style={[styles.value, { color: colors.onSurface }]}
              numberOfLines={1}
            >
              {countLabel}
            </Text>
            <Icon name="chevron-right" size={18} color={colors.outline} />
          </View>
        </View>

        <View style={styles.tileBottom}>
          <Text
            style={[styles.label, { color: colors.onSurface }]}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Grouped workspace module launcher with gradient panels and tiles. */
export function WorkspaceModules({ groups, colors }: WorkspaceModulesProps) {
  const visible = groups.filter((g) => g.items.length > 0);
  if (visible.length === 0) return null;

  let tileIndex = 0;

  return (
    <View style={styles.section}>
      {visible.map((group, groupIndex) => {
        const visual = groupVisual(group.id, colors);
        return (
          <Animated.View
            key={group.id}
            entering={FadeInDown.delay(groupIndex * 60)
              .duration(320)
              .springify()
              .damping(20)}
            style={[
              styles.groupPanel,
              {
                experimental_backgroundImage: visual.panelWash,
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant + "55",
              },
            ]}
          >
            <View style={styles.groupHeader}>
              <View
                style={[styles.groupAccent, { backgroundColor: visual.accent }]}
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
                    visual={visual}
                    colors={colors}
                    index={i}
                  />
                );
              })}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.md,
  },
  groupPanel: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    gap: Spacing.md,
    overflow: "hidden",
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    minHeight: Math.max(120, TouchTarget.minHeight + 72),
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "space-between",
    gap: Spacing.sm,
    overflow: "hidden",
  },
  tileOrb: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    top: -28,
    right: -24,
  },
  tileTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  iconWrap: {
    position: "relative",
  },
  iconDisc: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  valueCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 1,
  },
  value: {
    ...Typography.headlineMdMobile,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    fontSize: 26,
    lineHeight: 30,
  },
  tileBottom: {
    gap: 6,
  },
  label: {
    ...Typography.bodyLg,
    fontWeight: "700",
  },
});
