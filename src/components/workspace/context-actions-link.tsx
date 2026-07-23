import { Link, type Href } from "expo-router";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

import { haptics } from "@/lib/haptics";
import { showActions } from "@/providers/confirm-provider";

export type ContextMenuAction = {
  label: string;
  /** SF Symbol — iOS context menu only. */
  icon?: SFSymbol;
  destructive?: boolean;
  hidden?: boolean;
  onPress: () => void;
};

type ContextActionsLinkProps = {
  href: Href;
  accessibilityLabel: string;
  children: ReactNode | ((state: { pressed: boolean }) => ReactNode);
  style?: StyleProp<ViewStyle>;
  actions?: ContextMenuAction[];
  disabled?: boolean;
};

/**
 * Navigating row/card with long-press actions.
 * iOS: native `Link.Menu` context menu. Android/web: themed action sheet.
 *
 * Styles are applied on an inner View — Link asChild/Slot rejects style arrays.
 */
export function ContextActionsLink({
  href,
  accessibilityLabel,
  children,
  style,
  actions = [],
  disabled,
}: ContextActionsLinkProps) {
  const visible = actions.filter((a) => !a.hidden);
  const flatStyle = style ? StyleSheet.flatten(style) : undefined;

  const renderChild = (pressed: boolean) =>
    typeof children === "function" ? children({ pressed }) : children;

  function openAndroidMenu() {
    if (visible.length === 0) return;
    haptics.play("confirm");
    showActions({
      title: accessibilityLabel,
      actions: visible.map((action) => ({
        label: action.label,
        destructive: action.destructive,
        onPress: action.onPress,
      })),
    });
  }

  const surface = (pressed: boolean) => (
    <View
      style={StyleSheet.flatten([
        flatStyle,
        pressed && !disabled ? { opacity: 0.88 } : null,
      ])}
    >
      {renderChild(pressed)}
    </View>
  );

  if (process.env.EXPO_OS === "ios" && visible.length > 0) {
    return (
      <Link href={href} disabled={disabled}>
        <Link.Trigger>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ disabled: !!disabled }}
            disabled={disabled}
          >
            {({ pressed }) => surface(pressed)}
          </Pressable>
        </Link.Trigger>
        <Link.Menu>
          {visible.map((action) => (
            <Link.MenuAction
              key={action.label}
              title={action.label}
              icon={action.icon}
              destructive={action.destructive}
              onPress={action.onPress}
            />
          ))}
        </Link.Menu>
      </Link>
    );
  }

  return (
    <Link href={href} asChild disabled={disabled}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onLongPress={visible.length > 0 ? openAndroidMenu : undefined}
        delayLongPress={400}
      >
        {({ pressed }) => surface(pressed)}
      </Pressable>
    </Link>
  );
}

/** Prefer `@/providers/confirm-provider` for new call sites. */
export { confirmDelete } from "@/providers/confirm-provider";
