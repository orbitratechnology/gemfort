import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { haptics } from "@/lib/haptics";

export type ChoiceTileOption<T extends string = string> = {
  value: T;
  label: string;
  icon?: IconName;
  /** Column span in `grid` layout. Default 1. */
  span?: 1 | 2;
};

type ChoiceTileGridProps<T extends string> = {
  options: ChoiceTileOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
  /**
   * `pair` — two equal tiles side by side (Direction).
   * `grid` — 2-column wrap; use `span: 2` for a full-width tile (Trip type).
   */
  layout: "pair" | "grid";
};

/** Large-tap choice tiles for form-sheet first steps (direction / trip type). */
export function ChoiceTileGrid<T extends string>({
  options,
  value,
  onChange,
  error,
  layout,
}: ChoiceTileGridProps<T>) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      <View style={[layout === "pair" ? styles.pairRow : styles.grid]}>
        {options.map((opt) => {
          const active = value === opt.value;
          const span2 = layout === "grid" && (opt.span ?? 1) === 2;

          return (
            <Pressable
              key={opt.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={opt.label}
              onPress={haptics.wrap("selection", () => onChange(opt.value))}
              style={({ pressed }) => [
                styles.tile,
                layout === "pair" && styles.tilePair,
                layout === "grid" &&
                  (span2 ? styles.tileSpan2 : styles.tileHalf),
                {
                  backgroundColor: active
                    ? colors.primary
                    : colors.surfaceContainerLow,
                  borderColor: active
                    ? colors.primary
                    : error
                      ? colors.error
                      : colors.outlineVariant,
                },
                pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
              ]}
            >
              {opt.icon ? (
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor: active
                        ? colors.onPrimary + "22"
                        : colors.surfaceContainerHighest,
                    },
                  ]}
                >
                  <Icon
                    name={opt.icon}
                    size={28}
                    color={
                      active ? colors.onPrimary : colors.onSurfaceVariant
                    }
                  />
                </View>
              ) : null}
              <Text
                style={[
                  styles.tileLabel,
                  { color: active ? colors.onPrimary : colors.onSurface },
                ]}
                numberOfLines={2}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text
          style={[styles.error, { color: colors.error }]}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Centered selection summary card shown at the top of the form step. */
export function ChoicePreviewCard({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: IconName;
  /** Optional — e.g. tap to change selection. */
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const body = (
    <>
      {icon ? (
        <View
          style={[
            styles.previewIcon,
            { backgroundColor: colors.primaryContainer },
          ]}
        >
          <Icon name={icon} size={26} color={colors.onPrimaryContainer} />
        </View>
      ) : null}
      <Text
        style={[styles.previewLabel, { color: colors.onSurface }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. Change`}
        onPress={haptics.wrap("light", onPress)}
        style={({ pressed }) => [
          styles.previewCard,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: colors.outlineVariant,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.previewCard,
        {
          backgroundColor: colors.surfaceContainerLowest,
          borderColor: colors.outlineVariant,
        },
      ]}
      accessibilityLabel={label}
    >
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  pairRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  tile: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    minHeight: 108,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: 1.5,
  },
  tilePair: {
    flex: 1,
    minHeight: 120,
  },
  tileHalf: {
    flexGrow: 1,
    flexBasis: "40%",
    maxWidth: "48%",
    minHeight: 112,
  },
  tileSpan2: {
    flexGrow: 1,
    flexBasis: "100%",
    width: "100%",
    maxWidth: "100%",
    minHeight: 96,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    ...Typography.labelMd,
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
  error: { ...Typography.bodySmall },

  previewCard: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    minWidth: 148,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  previewIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  previewLabel: {
    ...Typography.labelMd,
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },
});
