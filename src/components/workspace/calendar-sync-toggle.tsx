import { Host, Switch as NativeSwitch } from "@expo/ui";
import { Platform, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Spacing, Typography, type ThemeColors } from "@/constants/design-tokens";
import type { CommitmentSurface } from "@/features/calendar-sync/commitments";

export function CalendarSyncToggle({
  surface,
  value,
  onValueChange,
  colors,
}: {
  surface: CommitmentSurface;
  value: boolean;
  onValueChange: (value: boolean) => void;
  colors: ThemeColors;
}) {
  if (Platform.OS === "web" || (surface === "reminder" && Platform.OS !== "ios")) {
    return null;
  }

  const destination = surface === "calendar" ? "Calendar" : "Reminders";

  return (
    <View
      style={{
        width: "100%",
        alignSelf: "stretch",
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
        paddingVertical: Spacing.sm,
      }}
    >
      <Icon
        name={surface === "calendar" ? "calendar-month" : "notifications"}
        size={20}
        color={colors.primary}
      />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[Typography.bodyMd, { color: colors.textMain }]}>
          Add to {destination}
        </Text>
        <Text style={[Typography.bodySmall, { color: colors.textMuted }]}>
          Add this date to {destination} when saved.
        </Text>
      </View>
      <Host
        matchContents
        accessibilityLabel={`Add to ${destination}`}
        style={{ flexShrink: 0, alignSelf: "center" }}
      >
        <NativeSwitch
          label=""
          value={value}
          onValueChange={onValueChange}
        />
      </Host>
    </View>
  );
}
