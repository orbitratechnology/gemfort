import { Pressable, StyleSheet, Text, View } from "react-native";

import { Accent } from "@/components/ui/detail-kit";
import { ScreenInset } from "@/components/ui/form-section";
import { Icon, type IconName } from "@/components/ui/icon";
import { FontFamily, Radius, Spacing } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { haptics } from "@/lib/haptics";
import type { TripStatus } from "@/types";

export type TripListTab = "active" | "completed";

/**
 * One hue per trip state, shared by the list, detail hero and chips:
 * planned = blue (info), ongoing = amber (active), completed = emerald,
 * cancelled = slate (closed).
 */
export const TRIP_STATUS_ACCENT: Record<TripStatus, string> = {
  planning: Accent.blue,
  ongoing: Accent.amber,
  completed: Accent.emerald,
  cancelled: Accent.slate,
};

export const TRIP_STATUS_ICON: Record<TripStatus, IconName> = {
  planning: "event",
  ongoing: "flight-takeoff",
  completed: "check-circle",
  cancelled: "block",
};

type TripStatusTabsProps = {
  tab: TripListTab;
  onChange: (tab: TripListTab) => void;
  activeCount?: number;
  completedCount?: number;
};

const TABS: {
  id: TripListTab;
  label: string;
  icon: IconName;
  accent: string;
}[] = [
  { id: "active", label: "Active", icon: "flight-takeoff", accent: Accent.amber },
  { id: "completed", label: "Completed", icon: "check-circle", accent: Accent.emerald },
];

/** Active ↔ Completed switcher — matches the other workspace segments. */
export function TripStatusTabs({
  tab,
  onChange,
  activeCount = 0,
  completedCount = 0,
}: TripStatusTabsProps) {
  const { colors } = useAppTheme();

  return (
    <ScreenInset style={styles.wrap}>
      <View style={[styles.track, { backgroundColor: colors.surfaceContainerLow }]}>
        {TABS.map((item) => {
          const selected = tab === item.id;
          const count = item.id === "active" ? activeCount : completedCount;
          const badgeLabel = count > 99 ? "99+" : String(Math.max(0, count));
          const showBadge = count > 0;
          const tone = selected ? item.accent : colors.onSurfaceVariant;

          return (
            <Pressable
              key={item.id}
              onPress={haptics.wrap("selection", () => onChange(item.id))}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={showBadge ? `${item.label}, ${count}` : item.label}
              style={({ pressed }) => [
                styles.tab,
                selected && { backgroundColor: colors.surfaceContainerLowest },
                pressed && !selected && styles.pressed,
              ]}
            >
              <Icon name={item.icon} size={18} color={tone} />
              <Text
                style={[
                  styles.label,
                  { color: selected ? colors.onSurface : colors.onSurfaceVariant },
                  selected && styles.labelSelected,
                ]}
              >
                {item.label}
              </Text>
              {showBadge ? (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: selected ? `${item.accent}1F` : colors.surfaceContainerHigh },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: tone }]}>{badgeLabel}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </ScreenInset>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.stackMd },
  track: { flexDirection: "row", padding: 4, borderRadius: Radius.full, gap: 4 },
  tab: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  pressed: { opacity: 0.85 },
  label: { includeFontPadding: false, fontFamily: FontFamily.medium, fontSize: 14 },
  labelSelected: { fontFamily: FontFamily.semibold },
  badge: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    includeFontPadding: false,
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
});
