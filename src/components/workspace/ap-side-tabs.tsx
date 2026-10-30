import { Pressable, StyleSheet, Text, View } from "react-native";

import { Accent } from "@/components/ui/detail-kit";
import { Icon } from "@/components/ui/icon";
import { FontFamily, Radius, Spacing } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { haptics } from "@/lib/haptics";

export type ApSide = "given" | "taken";

type ApSideTabsProps = {
  side: ApSide;
  onChange: (side: ApSide) => void;
  takenPendingCount?: number;
};

const TABS: {
  id: ApSide;
  label: string;
  icon: "call-made" | "call-received";
}[] = [
  { id: "given", label: "Given", icon: "call-made" },
  { id: "taken", label: "Taken", icon: "call-received" },
];

/** Given ↔ Taken switcher — pill segment, pending count in amber on Taken. */
export function ApSideTabs({
  side,
  onChange,
  takenPendingCount = 0,
}: ApSideTabsProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.track, { backgroundColor: colors.surfaceContainerLow }]}
        accessibilityRole="tablist"
      >
        {TABS.map((tab) => {
          const selected = side === tab.id;
          const showBadge = tab.id === "taken" && takenPendingCount > 0;
          const badgeLabel =
            takenPendingCount > 99
              ? "99+"
              : String(Math.max(0, takenPendingCount));
          const tone = selected ? colors.primary : colors.onSurfaceVariant;

          return (
            <Pressable
              key={tab.id}
              onPress={haptics.wrap("selection", () => onChange(tab.id))}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={
                showBadge
                  ? `${tab.label}, ${takenPendingCount} pending`
                  : tab.label
              }
              style={({ pressed }) => [
                styles.tab,
                selected && {
                  backgroundColor: colors.surfaceContainerLowest,
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
                },
                pressed && !selected && styles.pressed,
              ]}
            >
              <Icon name={tab.icon} size={18} color={tone} />
              <Text style={[styles.label, { color: tone }]}>{tab.label}</Text>
              {showBadge ? (
                <View style={[styles.badge, { backgroundColor: Accent.amber }]}>
                  <Text style={styles.badgeText}>{badgeLabel}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.containerMargin,
    marginBottom: Spacing.stackMd,
  },
  track: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: Radius.full,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pressed: { opacity: 0.85 },
  label: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
});
