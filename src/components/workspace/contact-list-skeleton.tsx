import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Spacing } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useReduceMotion } from "@/hooks/use-reduce-motion";

/** Varied line widths so the placeholder reads as names, not a grid. */
const NAME_WIDTHS = [148, 112, 176, 128, 160, 96, 140, 120];
const META_WIDTHS = [92, 120, 76, 104, 84, 112, 70, 96];

/** Placeholder rows shaped like `ContactListRow` while contacts load. */
export function ContactListSkeleton({ count = 8 }: { count?: number }) {
  const { colors } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 0.7;
      return;
    }
    pulse.value = withRepeat(withTiming(0.45, { duration: 750 }), -1, true);
  }, [pulse, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading contacts"
      style={animatedStyle}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: colors.skeleton }]} />
          <View
            style={[
              styles.lines,
              i < count - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.outlineVariant,
              },
            ]}
          >
            <View
              style={[
                styles.name,
                { width: NAME_WIDTHS[i % NAME_WIDTHS.length], backgroundColor: colors.skeleton },
              ]}
            />
            <View
              style={[
                styles.meta,
                { width: META_WIDTHS[i % META_WIDTHS.length], backgroundColor: colors.skeleton },
              ]}
            />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 60,
    paddingLeft: Spacing.containerMargin,
    gap: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  lines: {
    flex: 1,
    justifyContent: "center",
    gap: 8,
    minHeight: 60,
    paddingVertical: 10,
    paddingRight: Spacing.containerMargin,
  },
  name: { height: 13, borderRadius: 6 },
  meta: { height: 10, borderRadius: 5 },
});
