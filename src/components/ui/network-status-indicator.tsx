import { useNetworkState } from "expo-network";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

/** App-wide banner; it stays quiet while network state is unknown or reachable. */
export function NetworkStatusIndicator() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const network = useNetworkState();
  const offline =
    network.isConnected === false || network.isInternetReachable === false;

  if (!offline) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLabel="No internet connection"
      style={[styles.overlay, { top: insets.top + 4 }]}
    >
      <View
        style={[
          styles.banner,
          {
            backgroundColor: colors.errorContainer,
            borderColor: colors.error,
          },
        ]}
      >
        <Icon name="wifi-off" size={17} color={colors.onErrorContainer} />
        <Text style={[styles.label, { color: colors.onErrorContainer }]}>No internet connection</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: Spacing.containerMargin,
    right: Spacing.containerMargin,
    zIndex: 1000,
    elevation: 1000,
    alignItems: "center",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  label: { ...Typography.labelMd, fontWeight: "600" },
});
