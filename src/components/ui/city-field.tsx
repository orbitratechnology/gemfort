import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CityPickerSheet } from "@/components/ui/city-picker-sheet";
import { Icon } from "@/components/ui/icon";
import { findCountry } from "@/constants/countries";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

type CityFieldProps = {
  label?: string;
  value: string;
  onChange: (cityName: string) => void;
  /** Country common name or ISO2 — required before the picker opens. */
  country: string | null | undefined;
  error?: string;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
  sheetTitle?: string;
};

/**
 * City selector tied to a country. Disabled until a country is chosen;
 * only that country's cities appear in the sheet.
 */
export function CityField({
  label = "City",
  value,
  onChange,
  country,
  error,
  helperText,
  placeholder = "Select city",
  disabled,
  sheetTitle = "City",
}: CityFieldProps) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const countryMeta = useMemo(() => findCountry(country), [country]);
  const hasCountry = !!countryMeta;
  const locked = disabled || !hasCountry;
  const borderColor = error ? colors.error : colors.border;
  const display = value.trim();

  const emptyHelper = !hasCountry
    ? "Select a country first"
    : helperText;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          !hasCountry
            ? `${label}: select a country first`
            : display
              ? `${label}: ${display}`
              : `${label}: ${placeholder}`
        }
        accessibilityState={{ disabled: locked }}
        disabled={locked}
        onPress={() => {
          if (!hasCountry) return;
          setOpen(true);
        }}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor,
            opacity: locked ? 0.55 : pressed ? 0.92 : 1,
          },
        ]}
      >
        <Icon
          name="place"
          size={22}
          color={hasCountry ? colors.primary : colors.textMuted}
        />
        <Text
          style={[
            styles.value,
            {
              color:
                display && hasCountry ? colors.onSurface : colors.textMuted,
            },
          ]}
          numberOfLines={1}
        >
          {!hasCountry
            ? "Select country first"
            : display || placeholder}
        </Text>
        <Icon name="expand-more" size={22} color={colors.outline} />
      </Pressable>
      {error ? (
        <Text
          style={[styles.error, { color: colors.error }]}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : emptyHelper ? (
        <Text style={[styles.helper, { color: colors.textMuted }]}>
          {emptyHelper}
        </Text>
      ) : null}

      <CityPickerSheet
        visible={open && hasCountry}
        onClose={() => setOpen(false)}
        country={country}
        value={value}
        title={sheetTitle}
        onSelect={(city) => onChange(city.name)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { ...Typography.labelMd },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    paddingHorizontal: Spacing.gutterMd,
    minHeight: 52,
  },
  value: {
    ...Typography.bodyMd,
    flex: 1,
    fontSize: 16,
    minWidth: 0,
  },
  error: { ...Typography.bodySmall },
  helper: { ...Typography.bodySmall },
});
