import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { ScreenInset } from "@/components/ui/form-section";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { haptics } from "@/lib/haptics";

type ApSide = "given" | "taken";

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

/** Given ↔ Taken switcher — matches ContactsHubTabs / Money segment. */
export function ApSideTabs({
  side,
  onChange,
  takenPendingCount = 0,
}: ApSideTabsProps) {
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
        {TABS.map((tab) => {
          const selected = side === tab.id;
          const showBadge = tab.id === "taken" && takenPendingCount > 0;
          const badgeLabel =
            takenPendingCount > 99
              ? "99+"
              : String(Math.max(0, takenPendingCount));

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
                  name={tab.icon}
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
                      backgroundColor: colors.error,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        fontVariant: ["tabular-nums"],
                        color: colors.onError,
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
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScreenInset>
  );
}
