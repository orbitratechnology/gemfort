import { Image } from "expo-image";
import { router, useNavigation, usePathname } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { Icon } from "@/components/ui/icon";
import { Spacing, TouchTarget, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { nestedTabHubForPathname } from "@/navigation/tab-stack-nav";

type StackHeaderProps = {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  left?: ReactNode;
  /** Use 'close' (x) instead of back arrow. */
  closeIcon?: boolean;
  /** Hide the back/close button (for top-level tab roots). Defaults to true. */
  showBack?: boolean;
  /** Override icon/title color (e.g. white over an edge-to-edge cover). */
  tintColor?: string;
  /** Optional borderless visual for form-sheet actions. */
  image?: number;
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
  left,
  closeIcon,
  showBack = true,
  tintColor,
  image,
}: StackHeaderProps) {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const pathname = usePathname();
  const fg = tintColor ?? colors.onSurface;
  const titleColor = tintColor ?? colors.primary;
  const chipStyle = tintColor
    ? [styles.side, styles.sideChip]
    : styles.side;
  // The title is laid over the full row and inset by the wider side, so it
  // stays optically centred when left and right hold different action counts.
  const [sideWidths, setSideWidths] = useState({
    left: TouchTarget.minWidth,
    right: TouchTarget.minWidth,
  });
  const titleInset =
    Spacing.containerMargin +
    Math.max(sideWidths.left, sideWidths.right) +
    Spacing.stackSm;
  const measureSide =
    (side: "left" | "right") => (event: LayoutChangeEvent) => {
      const width = Math.ceil(event.nativeEvent.layout.width);
      setSideWidths((prev) =>
        prev[side] === width ? prev : { ...prev, [side]: width },
      );
    };

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
      <View
        pointerEvents="none"
        style={[styles.titleWrap, { paddingHorizontal: titleInset }]}
      >
        {image ? (
          <Image
          source={image}
          style={styles.titleImage}
          contentFit="contain"
          accessibilityIgnoresInvertColors
          />
        ) : null}
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: titleColor }]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      {showBack ? (
        <Pressable
        onLayout={measureSide("left")}
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
      ) : left ? (
        <View
          onLayout={measureSide("left")}
          style={[styles.side, styles.left]}
        >
          {left}
        </View>
      ) : (
        <View onLayout={measureSide("left")} style={styles.side} />
      )}
      <View
        onLayout={measureSide("right")}
        style={[styles.side, styles.right]}
      >
        {right}
      </View>
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
    minWidth: TouchTarget.minWidth,
    minHeight: TouchTarget.minWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  sideChip: {
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  right: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  left: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  titleWrap: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.stackSm,
  },
  titleImage: { width: 32, height: 32 },
  title: { ...Typography.headlineMdMobile, flexShrink: 1 },
});
