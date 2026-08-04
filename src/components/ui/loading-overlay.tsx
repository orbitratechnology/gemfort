import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { Motion, Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { easeOut, useReduceMotion } from "@/hooks/use-reduce-motion";

export type LoadingOverlayProps = {
  visible: boolean;
  message?: string;
};

/**
 * Blocking full-screen loading overlay for in-flight mutations
 * (create / upload / update / delete). Not dismissible by the user.
 */
export function LoadingOverlay({
  visible,
  message = "Please wait…",
}: LoadingOverlayProps) {
  const { colors, isDark } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const { width: windowWidth } = useWindowDimensions();
  const [presented, setPresented] = useState(visible);
  const [wasVisible, setWasVisible] = useState(visible);
  const exitingRef = useRef(false);
  const [opacity] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(0.96));

  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setPresented(true);
  }

  useEffect(() => {
    if (!visible) return;
    exitingRef.current = false;
    if (reduceMotion) {
      opacity.setValue(1);
      scale.setValue(1);
      return;
    }
    opacity.setValue(0);
    scale.setValue(0.96);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: Motion.fast,
        easing: easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: Motion.fast,
        easing: easeOut,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, reduceMotion, opacity, scale]);

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
        toValue: 0.98,
        duration,
        easing: easeOut,
        useNativeDriver: true,
      }),
    ]).start(() => {
      exitingRef.current = false;
      setPresented(false);
    });
  }, [visible, presented, reduceMotion, opacity, scale]);

  const cardWidth = Math.min(windowWidth - Spacing.containerMargin * 2, 280);

  return (
    <Modal
      visible={presented}
      transparent
      animationType="none"
      statusBarTranslucent
      // Block Android back while a mutation is in flight.
      onRequestClose={() => undefined}
    >
      <View
        style={styles.root}
        accessibilityViewIsModal
        accessibilityLabel={message}
        accessibilityLiveRegion="polite"
        pointerEvents="auto"
      >
        <Animated.View
          style={[styles.scrim, { opacity }]}
          pointerEvents="auto"
        />

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
          accessibilityRole="progressbar"
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            style={[styles.message, { color: colors.onSurface }]}
            selectable={false}
          >
            {message}
          </Text>
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
  message: {
    ...Typography.bodyMd,
    textAlign: "center",
    lineHeight: 22,
  },
});
