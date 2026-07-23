import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Motion, Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { easeOut, useReduceMotion } from "@/hooks/use-reduce-motion";
import { haptics } from "@/lib/haptics";

export type ConfirmTone = "destructive" | "default";

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: IconName;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Centered confirmation dialog — themed to match GemFort surfaces.
 * Prefer the imperative `confirm()` / `confirmDelete()` helpers via ConfirmProvider.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  icon,
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const { colors, isDark } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const { width: windowWidth } = useWindowDimensions();
  const [presented, setPresented] = useState(visible);
  const [wasVisible, setWasVisible] = useState(visible);
  const exitingRef = useRef(false);
  const [opacity] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(0.94));

  const destructive = tone === "destructive";
  const resolvedIcon =
    icon ?? (destructive ? "delete-outline" : "help-outline");
  const iconBg = destructive ? colors.errorContainer : colors.primaryContainer;
  const iconFg = destructive ? colors.onErrorContainer : colors.onPrimaryContainer;

  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setPresented(true);
  }

  useEffect(() => {
    if (!visible) return;
    exitingRef.current = false;
    haptics.play(destructive ? "warning" : "confirm");
    if (reduceMotion) {
      opacity.setValue(1);
      scale.setValue(1);
      return;
    }
    opacity.setValue(0);
    scale.setValue(0.94);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: Motion.normal,
        easing: easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: Motion.normal,
        easing: easeOut,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, destructive, reduceMotion, opacity, scale]);

  useEffect(() => {
    if (visible || !presented || exitingRef.current) return;
    exitingRef.current = true;
    const duration = reduceMotion ? Motion.fast : Motion.normal;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration,
        easing: easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.96,
        duration,
        easing: easeOut,
        useNativeDriver: true,
      }),
    ]).start(() => {
      exitingRef.current = false;
      setPresented(false);
    });
  }, [visible, presented, reduceMotion, opacity, scale]);

  function handleCancel() {
    if (loading || exitingRef.current) return;
    haptics.play("light");
    onCancel();
  }

  const cardWidth = Math.min(windowWidth - Spacing.containerMargin * 2, 360);

  return (
    <Modal
      visible={presented}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <View style={styles.root} accessibilityViewIsModal>
        <Animated.View style={[styles.scrim, { opacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            disabled={loading}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              width: cardWidth,
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
              boxShadow: isDark
                ? "0 16px 40px rgba(0, 0, 0, 0.5)"
                : "0 16px 40px rgba(0, 0, 0, 0.16)",
              opacity,
              transform: [{ scale }],
            },
          ]}
          accessibilityRole="alert"
          accessibilityLabel={title}
        >
          <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
            <Icon name={resolvedIcon} size={28} color={iconFg} />
          </View>

          <Text style={[styles.title, { color: colors.onSurface }]} selectable>
            {title}
          </Text>

          {message ? (
            <Text
              style={[styles.message, { color: colors.onSurfaceVariant }]}
              selectable
            >
              {message}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Button
              title={cancelLabel}
              variant="secondary"
              onPress={handleCancel}
              disabled={loading}
              style={styles.actionBtn}
              haptic="light"
            />
            <Button
              title={confirmLabel}
              variant={destructive ? "destructive" : "primary"}
              onPress={onConfirm}
              loading={loading}
              disabled={loading}
              style={styles.actionBtn}
              haptic={destructive ? "warning" : "light"}
              icon={destructive ? "delete-outline" : undefined}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.containerMargin,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
  },
  card: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    alignItems: "center",
    gap: Spacing.md,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.headlineSm,
    textAlign: "center",
  },
  message: {
    ...Typography.bodyMd,
    textAlign: "center",
    lineHeight: 22,
  },
  actions: {
    width: "100%",
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});
