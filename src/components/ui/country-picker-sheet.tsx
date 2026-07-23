import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { ICountryCca2 } from "rn-country-select";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { CountryFlag } from "@/components/ui/country-flag";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import {
  POPULAR_COUNTRY_CODES,
  findCountry,
  listCountries,
  type AppCountry,
} from "@/constants/countries";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const ALL_COUNTRIES = listCountries();

type CountryPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Common name or ISO alpha-2. */
  value?: string | null;
  onSelect: (country: AppCountry) => void;
  title?: string;
  popularCodes?: ICountryCca2[];
};

function useOpenSession(visible: boolean): number {
  const [session, setSession] = useState(0);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setSession((s) => s + 1);
  }
  return session;
}

export function CountryPickerSheet({
  visible,
  onClose,
  value,
  onSelect,
  title = "Country",
  popularCodes = POPULAR_COUNTRY_CODES,
}: CountryPickerSheetProps) {
  const { colors } = useAppTheme();
  const openSession = useOpenSession(visible);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [querySession, setQuerySession] = useState(openSession);
  if (querySession !== openSession) {
    setQuerySession(openSession);
    setQuery("");
  }

  const selected = useMemo(() => findCountry(value), [value]);

  const ordered = useMemo(() => {
    const popular = popularCodes
      .map((code) => ALL_COUNTRIES.find((c) => c.code === code))
      .filter((c): c is AppCountry => !!c);
    const popularSet = new Set(popular.map((c) => c.code));
    const rest = ALL_COUNTRIES.filter((c) => !popularSet.has(c.code));
    return [...popular, ...rest];
  }, [popularCodes]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.officialName.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [debouncedQuery, ordered]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      scrollable={false}
    >
      <View
        style={[
          styles.searchBox,
          { backgroundColor: colors.surfaceContainerLow },
        ]}
      >
        <Icon name="search" size={20} color={colors.outline} />
        <TextInput
          style={[styles.searchInput, { color: colors.onSurface }]}
          placeholder="Search countries…"
          placeholderTextColor={colors.outline}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="words"
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        initialNumToRender={20}
        windowSize={11}
        ListEmptyComponent={
          <EmptyState
            icon="public"
            title="No matches"
            subtitle="Try another search."
          />
        }
        renderItem={({ item }) => {
          const active = selected?.code === item.code;
          const isPopular = !debouncedQuery && popularCodes.includes(item.code);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                onSelect(item);
                onClose();
              }}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: active
                    ? colors.primaryContainer
                    : colors.surfaceContainerLow,
                  borderColor: active ? colors.primary : colors.outlineVariant,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <CountryFlag country={item.code} size="lg" style={styles.flag} />
              <View style={styles.rowText}>
                <Text
                  style={[
                    styles.rowLabel,
                    {
                      color: active
                        ? colors.onPrimaryContainer
                        : colors.onSurface,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  style={[
                    styles.rowMeta,
                    {
                      color: active
                        ? colors.onPrimaryContainer
                        : colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {item.code}
                  {isPopular ? " · Popular" : ""}
                </Text>
              </View>
              {active ? (
                <Icon name="check" size={20} color={colors.primary} />
              ) : null}
            </Pressable>
          );
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMd,
    paddingVertical: Spacing.sm,
  },
  listContent: {
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  flag: {
    borderRadius: 3,
  },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  rowLabel: { ...Typography.bodyMd },
  rowMeta: {
    ...Typography.caption,
    fontVariant: ["tabular-nums"],
  },
});
