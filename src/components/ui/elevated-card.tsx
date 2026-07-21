import { Link, type Href } from "expo-router";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Radius } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

type ElevatedCardProps = {
  children: ReactNode;
  accessibilityLabel: string;
  /** When set, wraps with expo-router Link (asChild). */
  href?: Href;
  onPress?: () => void;
  /**
   * Layout extras for the elevated surface (padding, flex, width, gap).
   * Do not put overflow:"hidden" here if you need box-shadow — clip media inside children.
   */
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

/**
 * Shared elevated surface for marketplace / inventory tiles.
 * Styles live on an inner View so Link asChild / Slot never drops them.
 */
export function ElevatedCard({
  children,
  accessibilityLabel,
  href,
  onPress,
  style,
  disabled,
}: ElevatedCardProps) {
  const { colors } = useAppTheme();

  const chrome = StyleSheet.flatten([
    styles.base,
    {
      backgroundColor: colors.surfaceContainerLowest,
      boxShadow: `0 1px 2px ${colors.cardShadow}, 0 6px 16px ${colors.cardShadow}`,
    },
    style,
  ]);

  const content = ({ pressed }: { pressed: boolean }) => (
    <View
      style={StyleSheet.flatten([
        chrome,
        {
          opacity: disabled ? 0.5 : pressed ? 0.96 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        },
      ])}
    >
      {children}
    </View>
  );

  if (href) {
    return (
      <Link href={href} asChild disabled={disabled}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled: !!disabled }}
          disabled={disabled}
        >
          {content}
        </Pressable>
      </Link>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || !onPress}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
  },
});
