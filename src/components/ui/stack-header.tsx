import { router, useNavigation, usePathname } from "expo-router";
import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { nestedTabHubForPathname } from "@/navigation/tab-stack-nav";

type StackHeaderProps = {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  /** Use 'close' (x) instead of back arrow. */
  closeIcon?: boolean;
  /** Hide the back/close button (for top-level tab roots). Defaults to true. */
  showBack?: boolean;
  /** Override icon/title color (e.g. white over an edge-to-edge cover). */
  tintColor?: string;
};

function goBackInCurrentStack(
  navigation: { getState: () => unknown; goBack: () => void },
): boolean {
  const state = navigation.getState() as { index?: number } | undefined;
  if (typeof state?.index === "number" && state.index > 0) {
    navigation.goBack();
    return true;
  }
  return false;
}

/** Transparent, no-elevation stack header consistent across the app. */
export function StackHeader({
  title,
  onBack,
  right,
  closeIcon,
  showBack = true,
  tintColor,
}: StackHeaderProps) {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const pathname = usePathname();
  const fg = tintColor ?? colors.onSurface;
  const titleColor = tintColor ?? colors.primary;
  const chipStyle = tintColor
    ? [styles.side, styles.sideChip]
    : styles.side;

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    // Prefer popping within this stack so we never jump to another tab
    // (router.back() follows global history and often lands on Home).
    if (goBackInCurrentStack(navigation)) {
      return;
    }

    const hub = nestedTabHubForPathname(pathname);
    if (hub) {
      router.navigate(hub);
      return;
    }

    if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <View style={styles.header}>
      {showBack ? (
        <Pressable
          onPress={handleBack}
          style={chipStyle}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={closeIcon ? "Close" : "Go back"}
        >
          <Icon
            name={closeIcon ? "close" : "arrow-back"}
            size={24}
            color={fg}
          />
        </Pressable>
      ) : (
        <View style={styles.side} />
      )}
      <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.stackMd,
  },
  side: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  sideChip: {
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  right: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  title: { ...Typography.headlineMdMobile, flex: 1, textAlign: "center" },
});
