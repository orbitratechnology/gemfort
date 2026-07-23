import { Image } from "expo-image";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  BASE_CURRENCY,
  getCurrencyCountryCode,
  getCurrencySymbol,
  type CurrencyCode,
} from "@/constants/currencies";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { flagUrl } from "@/constants/gem-options";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useExchangeRates } from "@/hooks/use-exchange-rates";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { lkrPerUnit } from "@/lib/exchange-rates";
import { formatRelativeTime } from "@/lib/utils";

const HOME_RATE_CODES: CurrencyCode[] = [
  "USD",
  "RMB",
  "THB",
  "TZS",
  "MGA",
  "IDR",
  "EUR",
  "GBP",
];

/** Flag fits text block height; 3:2 so the full flag shows with contain. */
const CHIP_FLAG_HEIGHT =
  Typography.labelMd.lineHeight + 2 + Typography.bodyMd.lineHeight;
const CHIP_FLAG_WIDTH = Math.round(CHIP_FLAG_HEIGHT * (3 / 2));

type HomeCurrencyRatesProps = {
  onRefreshRequest?: () => void;
};

export function HomeCurrencyRates({
  onRefreshRequest,
}: HomeCurrencyRatesProps) {
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const { data, isLoading, isError, isFetching, refetch } = useExchangeRates();

  const codes = useMemo(() => {
    const list = [...HOME_RATE_CODES];
    if (preferred !== BASE_CURRENCY && !list.includes(preferred)) {
      list.push(preferred);
    }
    return list;
  }, [preferred]);

  const updatedLabel = useMemo(() => {
    if (!data?.updatedAt) return null;
    try {
      return formatRelativeTime(new Date(data.updatedAt));
    } catch {
      return null;
    }
  }, [data?.updatedAt]);

  if (isError && !data) {
    return (
      <Pressable
        onPress={() => {
          void refetch();
          onRefreshRequest?.();
        }}
        style={[styles.wrap, { backgroundColor: colors.surfaceContainerLow }]}
      >
        <Text style={[styles.muted, { color: colors.textMuted }]}>
          Rates unavailable — tap to retry
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface }]}>
          Exchange rates
        </Text>
        {isLoading || isFetching ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : updatedLabel ? (
          <Text style={[styles.muted, { color: colors.textMuted }]}>
            Updated {updatedLabel}
          </Text>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {isLoading && !data
          ? HOME_RATE_CODES.map((code) => (
              <View
                key={code}
                style={[
                  styles.chip,
                  { backgroundColor: colors.surfaceContainerLow },
                ]}
              >
                <View
                  style={[
                    styles.flag,
                    { backgroundColor: colors.surfaceContainerHighest },
                  ]}
                />
                <View style={styles.chipBody}>
                  <View
                    style={[
                      styles.skel,
                      { backgroundColor: colors.surfaceContainerHighest },
                    ]}
                  />
                </View>
              </View>
            ))
          : codes.map((code) => {
              let perUnit = 0;
              try {
                perUnit = data ? lkrPerUnit(code, data.rates) : 0;
              } catch {
                return null;
              }
              const country = getCurrencyCountryCode(code);
              return (
                <View
                  key={code}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: colors.surfaceContainerLow,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                >
                  {country ? (
                    <Image
                      source={{ uri: flagUrl(country, 80) }}
                      style={styles.flag}
                      contentFit="contain"
                      accessibilityLabel={`${code} flag`}
                    />
                  ) : null}
                  <View style={styles.chipBody}>
                    <Text
                      style={[styles.chipCode, { color: colors.primary }]}
                    >
                      1 {getCurrencySymbol(code)} {code}
                    </Text>
                    <Text
                      style={[styles.chipValue, { color: colors.onSurface }]}
                    >
                      {getCurrencySymbol(BASE_CURRENCY)}{" "}
                      {perUnit.toLocaleString("en-LK", {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                      })}
                    </Text>
                  </View>
                </View>
              );
            })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  wrap: {
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    padding: Spacing.md,
    marginHorizontal: Spacing.containerMargin,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.containerMargin,
  },
  title: { ...Typography.headlineSmMobile },
  muted: { ...Typography.label },
  row: {
    gap: Spacing.sm,
    paddingLeft: Spacing.containerMargin,
    paddingRight: Spacing.containerMargin,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 128,
  },
  flag: {
    width: CHIP_FLAG_WIDTH,
    height: CHIP_FLAG_HEIGHT,
    borderRadius: 3,
  },
  chipBody: {
    gap: 2,
    justifyContent: "center",
  },
  chipCode: { ...Typography.labelMd },
  chipValue: {
    ...Typography.bodyMd,
    fontVariant: ["tabular-nums"],
  },
  skel: {
    width: 72,
    height: 28,
    borderRadius: Radius.sm,
    borderCurve: "continuous",
  },
});
