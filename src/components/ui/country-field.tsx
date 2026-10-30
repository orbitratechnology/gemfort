import { useMemo, useState } from "react";
import { Pressable, Text } from "react-native";
import type { ICountryCca2 } from "rn-country-select";

import { CountryFlag } from "@/components/ui/country-flag";
import { CountryPickerSheet } from "@/components/ui/country-picker-sheet";
import {
  FieldLabel,
  FieldMessage,
  FieldWrap,
  fieldStyles,
  useFieldChrome,
} from "@/components/ui/field-chrome";
import { Icon } from "@/components/ui/icon";
import { findCountry, type AppCountry } from "@/constants/countries";
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
  const display = selected?.name || value.trim();
  const chrome = useFieldChrome({ focused: open, error: !!error, disabled });

  return (
    <FieldWrap>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          display ? `${label}: ${display}` : `${label}: ${placeholder}`
        }
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          fieldStyles.box,
          chrome.box,
          pressed && chrome.pressedBox,
        ]}
      >
        {selected ? (
          <CountryFlag country={selected.code} size="lg" />
        ) : (
          <Icon name="public" size={20} color={chrome.iconColor} />
        )}
        <Text
          style={[
            fieldStyles.value,
            {
              color: display ? colors.onSurface : colors.textMuted,
            },
          ]}
          numberOfLines={1}
        >
          {display || placeholder}
        </Text>
        <Icon name="expand-more" size={22} color={colors.textMuted} />
      </Pressable>
      <FieldMessage error={error} helperText={helperText} />

      <CountryPickerSheet
        visible={open}
        onClose={() => setOpen(false)}
        value={value}
        title={sheetTitle}
        popularCodes={popularCodes}
        onSelect={(country) => onChange(country.name, country)}
      />
    </FieldWrap>
  );
}
