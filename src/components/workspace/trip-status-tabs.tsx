import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { ScreenInset } from "@/components/ui/form-section";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { haptics } from "@/lib/haptics";

export type TripListTab = "active" | "completed";

type TripStatusTabsProps = {
  tab: TripListTab;
  onChange: (tab: TripListTab) => void;
  activeCount?: number;
  completedCount?: number;
};

const TABS: {
  id: TripListTab;
  label: string;
  icon: "flight-takeoff" | "check-circle";
}[] = [
  { id: "active", label: "Active", icon: "flight-takeoff" },
  { id: "completed", label: "Completed", icon: "check-circle" },
];

/** Active ↔ Completed switcher — matches ApSideTabs / ContactsHubTabs. */
export function TripStatusTabs({
  tab,
  onChange,
  activeCount = 0,
  completedCount = 0,
}: TripStatusTabsProps) {
  const { colors } = useAppTheme();

  return (
    <ScreenInset style={{ marginBottom: Spacing.stackMd }}>
      <View
        style={{
          flexDirection: "row",
          padding: 4,
          borderRadius: Radius.full,
          gap: 4,
          backgroundColor: colors.surfaceContainerLow,
        }}
      >
        {TABS.map((item) => {
          const selected = tab === item.id;
          const count = item.id === "active" ? activeCount : completedCount;
          const badgeLabel = count > 99 ? "99+" : String(Math.max(0, count));
          const showBadge = count > 0;

          return (
            <Pressable
              key={item.id}
              onPress={haptics.wrap("selection", () => onChange(item.id))}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={
                showBadge ? `${item.label}, ${count}` : item.label
              }
              style={({ pressed }) => [
                {
                  flex: 1,
                  minHeight: 48,
                  paddingVertical: 12,
                  paddingHorizontal: 10,
                  borderRadius: Radius.full,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                },
                selected && {
                  backgroundColor: colors.surfaceContainerLowest,
                },
                pressed && !selected && { opacity: 0.85 },
              ]}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name={item.icon}
                  size={20}
                  color={selected ? colors.primary : colors.onSurfaceVariant}
                />
                {showBadge ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -10,
                      minWidth: 18,
                      height: 18,
                      paddingHorizontal: 4,
                      borderRadius: 9,
                      backgroundColor: selected
                        ? colors.primary
                        : colors.onSurfaceVariant,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        fontVariant: ["tabular-nums"],
                        color: selected
                          ? colors.onPrimary
                          : colors.surfaceContainerLowest,
                      }}
                    >
                      {badgeLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={{
                  ...Typography.labelMd,
                  fontSize: 15,
                  color: selected ? colors.primary : colors.onSurfaceVariant,
                  fontWeight: selected ? "700" : "500",
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScreenInset>
  );
}
