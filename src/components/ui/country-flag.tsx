import { Image } from "expo-image";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { getCurrencyCountryCode } from "@/constants/currencies";
import { flagUrl, resolveCountryCode } from "@/constants/gem-options";

type FlagSize = "xs" | "sm" | "md" | "lg";

const FLAG_DIMS: Record<FlagSize, { width: number; height: number }> = {
  xs: { width: 16, height: 11 },
  sm: { width: 20, height: 14 },
  md: { width: 28, height: 20 },
  lg: { width: 36, height: 24 },
};

type CountryFlagProps = {
  /** Slug, ISO code, display name, or free-text containing a country. */
  country: string | null | undefined;
  size?: FlagSize;
  /** Override preset size when you need an exact fit. */
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** Compact flag image from a country name/slug/code. Renders nothing if unknown. */
export function CountryFlag({
  country,
  size = "sm",
  width,
  height,
  style,
}: CountryFlagProps) {
  const code = resolveCountryCode(country);
  if (!code) return null;
  const dims =
    width != null && height != null
      ? { width, height }
      : FLAG_DIMS[size];
  return (
    <Image
      source={{ uri: flagUrl(code, dims.width >= 24 ? 80 : 40) }}
      style={[styles.flag, dims, style as object]}
      contentFit="cover"
      accessibilityLabel={`Flag for ${country}`}
    />
  );
}

type CurrencyFlagProps = {
  currency: string | null | undefined;
  size?: FlagSize;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** Flag for a currency code (LKR → LK, EUR → EU, etc.). */
export function CurrencyFlag({
  currency,
  size = "sm",
  width,
  height,
  style,
}: CurrencyFlagProps) {
  if (!currency) return null;
  const country = getCurrencyCountryCode(currency);
  if (!country) return null;
  return (
    <CountryFlag
      country={country}
      size={size}
      width={width}
      height={height}
      style={style}
    />
  );
}

type CountryLabelProps = {
  country: string;
  size?: FlagSize;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  numberOfLines?: number;
  selectable?: boolean;
};

/** Flag + country name in a row. Falls back to text-only when code is unknown. */
export function CountryLabel({
  country,
  size = "sm",
  textStyle,
  style,
  numberOfLines = 1,
  selectable,
}: CountryLabelProps) {
  return (
    <View style={[styles.row, style]}>
      <CountryFlag country={country} size={size} />
      <Text
        style={[styles.text, textStyle]}
        numberOfLines={numberOfLines}
        selectable={selectable}
      >
        {country}
      </Text>
    </View>
  );
}

type PlaceLabelProps = {
  /** City / district / other place parts shown before the country. */
  parts?: (string | null | undefined)[];
  country?: string | null;
  size?: FlagSize;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  numberOfLines?: number;
  selectable?: boolean;
  /** Extra suffix after country (e.g. " · 12y"). */
  suffix?: string;
};

/**
 * Location line with a leading flag when the country resolves.
 * Renders `parts + country` joined by commas.
 */
export function PlaceLabel({
  parts = [],
  country,
  size = "xs",
  textStyle,
  style,
  numberOfLines = 1,
  selectable,
  suffix,
}: PlaceLabelProps) {
  const line = [...parts, country]
    .filter((p): p is string => !!p?.trim())
    .join(", ");
  const display = suffix ? `${line}${suffix}` : line;
  if (!display) return null;

  return (
    <View style={[styles.row, style]}>
      <CountryFlag country={country ?? display} size={size} />
      <Text
        style={[styles.text, textStyle]}
        numberOfLines={numberOfLines}
        selectable={selectable}
      >
        {display}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flag: {
    borderRadius: 2,
    backgroundColor: "#ddd",
    flexShrink: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  text: {
    flexShrink: 1,
  },
});
