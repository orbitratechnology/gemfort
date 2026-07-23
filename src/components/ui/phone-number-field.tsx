import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import type { ICountryCca2 } from "rn-country-select";
import PhoneInput, {
    getCountryByCca2,
    getCountryByPhoneNumber,
    getNationalPhoneNumber,
    type ICountry,
} from "rn-international-phone-number";

import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

const DEFAULT_COUNTRY: ICountryCca2 = "LK";
const POPULAR: ICountryCca2[] = ["LK", "IN", "AE", "TH", "HK", "US", "GB"];

type PhoneNumberFieldProps = {
  label?: string;
  error?: string;
  helperText?: string;
  /** E.164 value (`+9477…`) or empty string. */
  value: string;
  onChangeText: (e164: string) => void;
  defaultCountry?: ICountryCca2;
  disabled?: boolean;
  placeholder?: string;
};

function toE164(
  national: string,
  country: ICountry | null | undefined,
): string {
  const digits = national.replace(/\D/g, "");
  if (!digits) return "";
  const root = country?.idd?.root?.trim();
  if (!root) return digits.startsWith("+") ? digits : `+${digits}`;
  return `${root}${digits}`;
}

function splitE164(
  e164: string,
  fallback: ICountryCca2,
): { national: string; country: ICountry | null } {
  const trimmed = e164.trim();
  if (!trimmed) {
    return {
      national: "",
      country: getCountryByCca2(fallback) ?? null,
    };
  }
  const country =
    getCountryByPhoneNumber(trimmed) ?? getCountryByCca2(fallback) ?? null;
  const national = getNationalPhoneNumber(trimmed);
  return { national, country };
}

/**
 * International phone field (country + mask + validation UX).
 * Always emits / accepts E.164 strings for storage and Firebase Phone Auth.
 * @see https://github.com/AstrOOnauta/react-native-international-phone-number
 */
export function PhoneNumberField({
  label,
  error,
  helperText,
  value,
  onChangeText,
  defaultCountry = DEFAULT_COUNTRY,
  disabled,
  placeholder,
}: PhoneNumberFieldProps) {
  const { colors, isDark } = useAppTheme();
  const [national, setNational] = useState(
    () => splitE164(value, defaultCountry).national,
  );
  const [country, setCountry] = useState<ICountry | null>(
    () => splitE164(value, defaultCountry).country,
  );
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const next = splitE164(value, defaultCountry);
    setNational(next.national);
    setCountry(next.country);
  }, [value, defaultCountry]);

  function emit(nextNational: string, nextCountry: ICountry | null) {
    const e164 = toE164(nextNational, nextCountry);
    lastEmitted.current = e164;
    onChangeText(e164);
  }

  const borderColor = error ? colors.error : colors.border;

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text style={{ ...Typography.labelMd, color: colors.textSecondary }}>
          {label}
        </Text>
      ) : null}
      <PhoneInput
        theme={isDark ? "dark" : "light"}
        defaultCountry={defaultCountry}
        popularCountries={POPULAR}
        value={national}
        onChangePhoneNumber={(phoneNumber) => {
          setNational(phoneNumber);
          emit(phoneNumber, country);
        }}
        country={country}
        onChangeCountry={(next) => {
          setCountry(next);
          emit(national, next);
        }}
        disabled={disabled}
        placeholder={placeholder}
        placeholderType={placeholder ? "text" : "number"}
        phoneInputPlaceholderTextColor={colors.textMuted}
        phoneInputSelectionColor={colors.primary}
        modalType="popup"
        phoneInputStyles={{
          container: {
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1.5,
            borderColor,
            borderRadius: Radius.lg,
            borderCurve: "continuous",
            minHeight: 52,
            paddingHorizontal: Spacing.sm,
          },
          flagContainer: {
            backgroundColor: "transparent",
            borderTopLeftRadius: Radius.lg,
            borderBottomLeftRadius: Radius.lg,
            paddingHorizontal: Spacing.sm,
          },
          flag: { fontSize: 22 },
          caret: { color: colors.textMuted, fontSize: 14 },
          divider: { backgroundColor: colors.outlineVariant },
          callingCode: {
            ...Typography.bodyMd,
            color: colors.onSurface,
            fontWeight: "600",
          },
          input: {
            ...Typography.bodyMd,
            color: colors.onSurface,
            fontSize: 16,
          },
        }}
        modalStyles={{
          searchInput: { borderColor: colors.outlineVariant },
          countryName: { color: colors.onSurface },
          callingCode: { color: colors.textMuted },
          sectionTitle: { color: colors.textMuted },
          countryItem: { borderWidth: 0 },
        }}
      />
      {error ? (
        <Text
          style={{ ...Typography.bodySmall, color: colors.error }}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : helperText ? (
        <Text style={{ ...Typography.bodySmall, color: colors.textMuted }}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}
