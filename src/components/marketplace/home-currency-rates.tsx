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
    getCurrencySymbol,
    type CurrencyCode,
} from "@/constants/currencies";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
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
        <Text style={[styles.muted, { color: colors.textMuted }]} selectable>
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
          <Text style={[styles.muted, { color: colors.textMuted }]} selectable>
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
                    styles.skel,
                    { backgroundColor: colors.surfaceContainerHighest },
                  ]}
                />
              </View>
            ))
          : codes.map((code) => {
              let perUnit = 0;
              try {
                perUnit = data ? lkrPerUnit(code, data.rates) : 0;
              } catch {
                return null;
              }
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
                  <Text
                    style={[styles.chipCode, { color: colors.primary }]}
                    selectable
                  >
                    1 {getCurrencySymbol(code)} {code}
                  </Text>
                  <Text
                    style={[styles.chipValue, { color: colors.onSurface }]}
                    selectable
                  >
                    {getCurrencySymbol(BASE_CURRENCY)}{" "}
                    {perUnit.toLocaleString("en-LK", {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2,
                    })}
                  </Text>
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { ...Typography.headlineSmMobile },
  muted: { ...Typography.label },
  row: {
    gap: Spacing.sm,
    paddingRight: Spacing.containerMargin,
  },
  chip: {
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 2,
    minWidth: 110,
  },
  chipCode: { ...Typography.labelMd },
  chipValue: {
    ...Typography.bodyMd,
    fontVariant: ["tabular-nums"],
  },
  skel: {
    width: 88,
    height: 28,
    borderRadius: Radius.sm,
    borderCurve: "continuous",
  },
});
