import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ICountryCca2 } from "rn-country-select";

import { CountryFlag } from "@/components/ui/country-flag";
import { CountryPickerSheet } from "@/components/ui/country-picker-sheet";
import { Icon } from "@/components/ui/icon";
import { findCountry, type AppCountry } from "@/constants/countries";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

type CountryFieldProps = {
  label?: string;
  /** Common country name (stored on documents) or ISO alpha-2. */
  value: string;
  onChange: (countryName: string, country: AppCountry) => void;
  error?: string;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
  sheetTitle?: string;
  popularCodes?: ICountryCca2[];
};

/**
 * Country selector field — pressable row + searchable bottom sheet with flags.
 * Emits the common English name (e.g. "Sri Lanka") for storage compatibility.
 */
export function CountryField({
  label = "Country",
  value,
  onChange,
  error,
  helperText,
  placeholder = "Select country",
  disabled,
  sheetTitle = "Country",
  popularCodes,
}: CountryFieldProps) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => findCountry(value), [value]);
  const borderColor = error ? colors.error : colors.border;
  const display = selected?.name || value.trim();

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
          display ? `${label}: ${display}` : `${label}: ${placeholder}`
        }
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor,
            opacity: disabled ? 0.6 : pressed ? 0.92 : 1,
          },
        ]}
      >
        {selected ? (
          <CountryFlag country={selected.code} size="lg" />
        ) : (
          <Icon name="public" size={22} color={colors.textMuted} />
        )}
        <Text
          style={[
            styles.value,
            {
              color: display ? colors.onSurface : colors.textMuted,
            },
          ]}
          numberOfLines={1}
        >
          {display || placeholder}
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
      ) : helperText ? (
        <Text style={[styles.helper, { color: colors.textMuted }]}>
          {helperText}
        </Text>
      ) : null}

      <CountryPickerSheet
        visible={open}
        onClose={() => setOpen(false)}
        value={value}
        title={sheetTitle}
        popularCodes={popularCodes}
        onSelect={(country) => onChange(country.name, country)}
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
