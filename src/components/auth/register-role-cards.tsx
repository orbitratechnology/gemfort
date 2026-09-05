import { Image, type ImageSource } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Motion, Radius, Spacing, Typography } from "@/constants/design-tokens";
import { ROLE_LABELS, ROLE_SUBTITLES } from "@/constants/roles";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { haptics } from "@/lib/haptics";
import type { UserRole } from "@/types";

type RoleCardDef = {
  value: UserRole;
  label: string;
  subtitle: string;
  image: ImageSource;
};

const ROLE_CARDS: RoleCardDef[] = [
  {
    value: "trader",
    label: ROLE_LABELS.trader,
    subtitle: ROLE_SUBTITLES.trader,
    image: require("@/assets/images/trader.png"),
  },
  {
    value: "lapidary",
    label: ROLE_LABELS.lapidary,
    subtitle: ROLE_SUBTITLES.lapidary,
    image: require("@/assets/images/lapidary.png"),
  },
];

const STAGGER_MS = 45;
/** Hard cap so illustrations stay inside the art panel. */
const ILLUSTRATION_MAX_WIDTH = 108;
const ILLUSTRATION_MAX_HEIGHT = 96;
const ART_WIDTH = 120;

type RegisterRoleCardsProps = {
  value: UserRole | null;
  onChange: (value: UserRole) => void;
  error?: string;
};

/** Full-bleed role cards for the register role step (touch-first, flat color blocks). */
export function RegisterRoleCards({
  value,
  onChange,
  error,
}: RegisterRoleCardsProps) {
  const { colors, isDark } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const enterMs = reduceMotion ? Motion.fast : Motion.normal;

  return (
    <View
      style={styles.wrap}
      accessibilityRole="radiogroup"
      accessibilityLabel="Choose your role"
    >
      {ROLE_CARDS.map((card, index) => {
        const active = value === card.value;

        return (
          <Animated.View
            key={card.value}
            entering={
              reduceMotion
                ? undefined
                : FadeInDown.delay(index * STAGGER_MS)
                    .duration(enterMs)
                    .springify()
                    .damping(18)
            }
          >
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={card.label}
              accessibilityHint={card.subtitle}
              onPress={haptics.wrap("selection", () => onChange(card.value))}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: active
                    ? colors.primary
                    : colors.surfaceContainerLowest,
                  boxShadow: isDark
                    ? "0 8px 22px rgba(0, 0, 0, 0.34)"
                    : "0 8px 22px rgba(0, 0, 0, 0.10)",
                },
                pressed && styles.cardPressed,
              ]}
            >
              <View
                style={[
                  styles.art,
                  {
                    backgroundColor: active
                      ? colors.surfaceContainerHigh
                      : colors.surfaceContainerLow,
                  },
                ]}
              >
                <Image
                  source={card.image}
                  style={styles.illustration}
                  contentFit="contain"
                  contentPosition="center"
                  recyclingKey={card.value}
                  accessibilityIgnoresInvertColors
                />
              </View>

              <View style={styles.copy}>
                {active ? (
                  <Text style={[styles.selectedLabel, { color: colors.onPrimary }]}>
                    Selected
                  </Text>
                ) : null}
                <Text
                  style={[
                    styles.label,
                    { color: active ? colors.onPrimary : colors.text },
                  ]}
                >
                  {card.label}
                </Text>
                <Text
                  style={[
                    styles.subtitle,
                    { color: active ? colors.onPrimary : colors.textSecondary },
                  ]}
                >
                  {card.subtitle}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        );
      })}

      {error ? (
        <Text
          style={[styles.error, { color: colors.error }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    gap: Spacing.lg,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    paddingRight: Spacing.lg,
    minHeight: 136,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  art: {
    width: ART_WIDTH,
    maxWidth: ART_WIDTH,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderTopLeftRadius: Radius.xl,
    borderBottomLeftRadius: Radius.xl,
  },
  illustration: {
    width: "100%",
    maxWidth: ILLUSTRATION_MAX_WIDTH,
    height: ILLUSTRATION_MAX_HEIGHT,
    maxHeight: ILLUSTRATION_MAX_HEIGHT,
  },
  copy: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    minWidth: 0,
  },
  selectedLabel: {
    ...Typography.labelMd,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  label: {
    ...Typography.headlineSmMobile,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  subtitle: {
    ...Typography.bodyMd,
    lineHeight: 20,
  },
  error: {
    ...Typography.bodySmall,
  },
});
