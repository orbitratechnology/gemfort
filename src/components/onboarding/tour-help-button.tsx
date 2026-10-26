import { useTour } from "guideway";
import { Pressable, StyleSheet } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useAppTheme } from "@/hooks/use-app-theme";

export function TourHelpButton({
  tourId,
}: {
  tourId: "home" | "workspace" | "money";
}) {
  const { start } = useTour();
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Show the ${tourId} guide`}
      accessibilityHint="Learn how this part of GemFort works"
      onPress={() => start(tourId)}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.surfaceContainerLowest },
        pressed && { opacity: 0.72 },
      ]}
    >
      <Icon name="help-outline" size={19} color={colors.onSurfaceVariant} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 64,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  label: { fontSize: 12, fontWeight: "600" },
});
