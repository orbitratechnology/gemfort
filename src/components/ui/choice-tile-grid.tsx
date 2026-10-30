import { Image, type ImageSource } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icon";
import { FieldMessage } from "@/components/ui/field-chrome";
import { FontFamily, Radius, Spacing } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { haptics } from "@/lib/haptics";

export type ChoiceTileOption<T extends string = string> = {
  value: T;
  label: string;
  icon?: IconName;
  image?: ImageSource;
  /** Column span in `grid` layout. Default 1. */
  span?: 1 | 2;
  /** Highlight colour when selected (defaults to the theme primary). */
  accent?: string;
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
  const { colors, isDark } = useAppTheme();
  const restFill = isDark ? colors.surfaceContainerHigh : colors.surfaceContainerLow;

  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      <View style={layout === "pair" ? styles.pairRow : styles.grid}>
        {options.map((opt) => {
          const active = value === opt.value;
          const span2 = layout === "grid" && (opt.span ?? 1) === 2;
          const accent = opt.accent ?? colors.primary;

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
                active
                  ? {
                      backgroundColor: `${accent}${isDark ? "26" : "12"}`,
                      borderColor: accent,
                      boxShadow: `0 0 0 3px ${accent}${isDark ? "33" : "1F"}`,
                    }
                  : {
                      backgroundColor: restFill,
                      borderColor: error ? colors.error : "transparent",
                    },
                pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
              ]}
            >
              {opt.icon || opt.image ? (
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor: active
                        ? opt.image
                          ? `${accent}24`
                          : accent
                        : `${accent}1A`,
                    },
                  ]}
                >
                  {opt.image ? (
                    <Image
                      source={opt.image}
                      style={styles.optionImage}
                      contentFit="contain"
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <Icon
                      name={opt.icon!}
                      size={26}
                      color={active ? "#FFFFFF" : accent}
                    />
                  )}
                </View>
              ) : null}
              <Text
                style={[styles.tileLabel, { color: colors.onSurface }]}
                numberOfLines={2}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <FieldMessage error={error} />
    </View>
  );
}

/** Selected-choice summary row at the top of the form step ("Taken · Change"). */
export function ChoicePreviewCard({
  label,
  icon,
  image,
  accent,
  onPress,
}: {
  label: string;
  icon?: IconName;
  image?: ImageSource;
  accent?: string;
  /** Optional — e.g. tap to change selection. */
  onPress?: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const tone = accent ?? colors.primary;
  const body = (
    <>
      {icon || image ? (
        <View style={[styles.previewIcon, { backgroundColor: `${tone}1F` }]}>
          {image ? (
            <Image
              source={image}
              style={styles.previewImage}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Icon name={icon!} size={20} color={tone} />
          )}
        </View>
      ) : null}
      <Text style={[styles.previewLabel, { color: colors.onSurface }]} numberOfLines={1}>
        {label}
      </Text>
      {onPress ? (
        <Text style={[styles.previewChange, { color: colors.primary }]}>Change</Text>
      ) : null}
    </>
  );
  const fill = { backgroundColor: isDark ? colors.surfaceContainerHigh : colors.surfaceContainerLow };

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. Change`}
        onPress={haptics.wrap("light", onPress)}
        style={({ pressed }) => [styles.previewCard, fill, pressed && { opacity: 0.8 }]}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View style={[styles.previewCard, fill]} accessibilityLabel={label}>
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
    borderWidth: 1,
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
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  optionImage: { width: 36, height: 36 },
  tileLabel: {
    includeFontPadding: false,
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },

  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    // Sits directly in full-width form scroll content, so it insets itself.
    marginHorizontal: Spacing.containerMargin,
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  previewIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: { width: 26, height: 26 },
  previewLabel: {
    includeFontPadding: false,
    flex: 1,
    fontFamily: FontFamily.semibold,
    fontSize: 15,
  },
  previewChange: {
    includeFontPadding: false,
    paddingRight: 4,
    fontFamily: FontFamily.semibold,
    fontSize: 13,
  },
});
