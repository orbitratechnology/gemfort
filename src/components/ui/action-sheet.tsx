import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Motion, Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { easeOut, useReduceMotion } from "@/hooks/use-reduce-motion";
import { haptics } from "@/lib/haptics";

export type ActionSheetItem = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

type ActionSheetProps = {
  visible: boolean;
  title?: string;
  message?: string;
  actions: ActionSheetItem[];
  cancelLabel?: string;
  onClose: () => void;
};

/**
 * Themed action sheet (replaces native Alert multi-button menus).
 */
export function ActionSheet({
  visible,
  title,
  message,
  actions,
  cancelLabel = "Cancel",
  onClose,
}: ActionSheetProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [presented, setPresented] = useState(visible);
  const [wasVisible, setWasVisible] = useState(visible);
  const exitingRef = useRef(false);
  const [backdrop] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(320));

  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setPresented(true);
  }

  useEffect(() => {
    if (!visible) return;
    exitingRef.current = false;
    haptics.play("confirm");
    if (reduceMotion) {
      backdrop.setValue(1);
      translateY.setValue(0);
      return;
    }
    backdrop.setValue(0);
    translateY.setValue(280);
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: Motion.normal,
        easing: easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: Motion.normal,
        easing: easeOut,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, reduceMotion, backdrop, translateY]);

  useEffect(() => {
    if (visible || !presented || exitingRef.current) return;
    exitingRef.current = true;
    const duration = reduceMotion ? Motion.fast : Motion.normal;
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 0,
        duration,
        easing: easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 280,
        duration,
        easing: easeOut,
        useNativeDriver: true,
      }),
    ]).start(() => {
      exitingRef.current = false;
      setPresented(false);
    });
  }, [visible, presented, reduceMotion, backdrop, translateY]);

  function handleClose() {
    if (exitingRef.current) return;
    haptics.play("light");
    onClose();
  }

  function handleAction(action: ActionSheetItem) {
    if (exitingRef.current) return;
    if (action.destructive) haptics.play("warning");
    else haptics.play("light");
    onClose();
    // Defer so the sheet can dismiss before the next dialog opens.
    requestAnimationFrame(() => action.onPress());
  }

  return (
    <Modal
      visible={presented}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.scrim, { opacity: backdrop }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
              paddingBottom: insets.bottom + Spacing.md,
              boxShadow: isDark
                ? "0 -8px 28px rgba(0, 0, 0, 0.45)"
                : "0 -8px 28px rgba(0, 0, 0, 0.12)",
              transform: [{ translateY }],
            },
          ]}
        >
          <View
            style={[styles.grabber, { backgroundColor: colors.outlineVariant }]}
          />
          {title ? (
            <Text style={[styles.title, { color: colors.onSurface }]} selectable>
              {title}
            </Text>
          ) : null}
          {message ? (
            <Text
              style={[styles.message, { color: colors.onSurfaceVariant }]}
              selectable
            >
              {message}
            </Text>
          ) : null}

          <View style={styles.list}>
            {actions.map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={() => handleAction(action)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: pressed
                      ? colors.surfaceContainerLow
                      : "transparent",
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.rowLabel,
                    {
                      color: action.destructive
                        ? colors.error
                        : colors.onSurface,
                    },
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            onPress={handleClose}
            style={({ pressed }) => [
              styles.cancel,
              {
                backgroundColor: pressed
                  ? colors.surfaceContainerHigh
                  : colors.surfaceContainerLow,
              },
            ]}
          >
            <Text style={[styles.cancelLabel, { color: colors.primary }]}>
              {cancelLabel}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderCurve: "continuous",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.headlineSm,
    textAlign: "center",
  },
  message: {
    ...Typography.bodyMd,
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  list: {
    gap: Spacing.xs,
  },
  row: {
    minHeight: 52,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  rowLabel: {
    ...Typography.headlineMdMobile,
  },
  cancel: {
    minHeight: 52,
    borderRadius: Radius.full,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xs,
  },
  cancelLabel: {
    ...Typography.headlineMdMobile,
  },
});
