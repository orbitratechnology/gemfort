import { useMemo, useState } from "react";
import { Pressable, Text } from "react-native";

import { CityPickerSheet } from "@/components/ui/city-picker-sheet";
import {
  FieldLabel,
  FieldMessage,
  FieldWrap,
  fieldStyles,
  useFieldChrome,
} from "@/components/ui/field-chrome";
import { Icon } from "@/components/ui/icon";
import { findCountry } from "@/constants/countries";
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
  const display = value.trim();
  const chrome = useFieldChrome({ focused: open, error: !!error, disabled: locked });

  const emptyHelper = !hasCountry
    ? "Select a country first"
    : helperText;

  return (
    <FieldWrap>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
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
          fieldStyles.box,
          chrome.box,
          pressed && chrome.pressedBox,
        ]}
      >
        <Icon name="place" size={20} color={chrome.iconColor} />
        <Text
          style={[
            fieldStyles.value,
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
        <Icon name="expand-more" size={22} color={colors.textMuted} />
      </Pressable>
      <FieldMessage error={error} helperText={emptyHelper} />

      <CityPickerSheet
        visible={open && hasCountry}
        onClose={() => setOpen(false)}
        country={country}
        value={value}
        title={sheetTitle}
        onSelect={(city) => onChange(city.name)}
      />
    </FieldWrap>
  );
}
