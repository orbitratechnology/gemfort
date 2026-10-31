import { useEffect, useRef, useState } from "react";
import type { ICountryCca2 } from "rn-country-select";
import PhoneInput, {
    getCountryByCca2,
    getCountryByPhoneNumber,
    getNationalPhoneNumber,
    type ICountry,
} from "rn-international-phone-number";

import {
  FieldLabel,
  FieldMessage,
  FieldWrap,
  FIELD_HEIGHT,
  fieldText,
  useFieldChrome,
  useFieldFocus,
} from "@/components/ui/field-chrome";
import { FontFamily, Radius, Spacing } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { normalizePhoneNumber } from "@/lib/firebase/phone-utils";

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
  /** Pill fill (auth screens) vs bordered default. */
  appearance?: 'default' | 'pill';
};

function toE164(
  national: string,
  country: ICountry | null | undefined,
): string {
  let digits = national.replace(/\D/g, "");
  if (!digits) return "";
  // Drop national trunk prefix (e.g. Sri Lanka leading 0) before dial code.
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (!digits) return "";
  const root = country?.idd?.root?.trim();
  if (!root) {
    return normalizePhoneNumber(digits.startsWith("+") ? digits : `+${digits}`);
  }
  return normalizePhoneNumber(`${root}${digits}`);
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
  appearance = 'default',
}: PhoneNumberFieldProps) {
  const { colors, isDark } = useAppTheme();
  const [national, setNational] = useState(
    () => splitE164(value, defaultCountry).national,
  );
  const [country, setCountry] = useState<ICountry | null>(
    () => splitE164(value, defaultCountry).country,
  );
  const lastEmitted = useRef(value);
  const pill = appearance === 'pill';
  const radius = pill ? Radius.full : Radius.lg;
  const { focused, focusProps } = useFieldFocus({});
  const chrome = useFieldChrome({ focused, error: !!error, disabled });

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

  return (
    <FieldWrap style={pill ? { width: '100%' } : undefined}>
      {label && !pill ? <FieldLabel>{label}</FieldLabel> : null}
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
        placeholder={placeholder ?? (pill ? label : undefined)}
        placeholderType={placeholder || pill ? "text" : "number"}
        {...focusProps}
        phoneInputPlaceholderTextColor={chrome.placeholderColor}
        phoneInputSelectionColor={colors.primary}
        modalType="popup"
        phoneInputStyles={{
          container: {
            ...chrome.box,
            backgroundColor:
              pill && !focused && !error
                ? colors.surfaceContainerHigh
                : chrome.box.backgroundColor,
            borderWidth: 1,
            borderRadius: radius,
            borderCurve: "continuous",
            minHeight: pill ? 56 : FIELD_HEIGHT,
            paddingHorizontal: pill ? Spacing.md : Spacing.xs,
          },
          flagContainer: {
            backgroundColor: "transparent",
            borderTopLeftRadius: radius,
            borderBottomLeftRadius: radius,
            paddingHorizontal: Spacing.sm,
          },
          flag: { fontSize: 22 },
          caret: { color: colors.textMuted, fontSize: 14 },
          divider: { backgroundColor: colors.outlineVariant },
          callingCode: {
            ...fieldText,
            fontFamily: FontFamily.medium,
            color: colors.onSurface,
          },
          input: {
            ...fieldText,
            color: colors.onSurface,
            paddingVertical: 0,
          },
        }}
        modalStyles={{
          searchInput: { ...fieldText, height: 48, borderColor: colors.outlineVariant },
          countryName: { color: colors.onSurface },
          callingCode: { color: colors.textMuted },
          sectionTitle: { color: colors.textMuted },
          countryItem: { borderWidth: 0 },
        }}
      />
      <FieldMessage error={error} helperText={helperText} align={pill ? 'center' : 'left'} />
    </FieldWrap>
  );
}
