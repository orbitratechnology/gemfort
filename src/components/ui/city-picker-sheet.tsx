import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { listCitiesForCountry, type AppCity } from "@/constants/cities";
import { findCountry } from "@/constants/countries";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type CityPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Country common name or ISO2 — required to list cities. */
  country: string | null | undefined;
  value?: string | null;
  onSelect: (city: AppCity) => void;
  title?: string;
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

export function CityPickerSheet({
  visible,
  onClose,
  country,
  value,
  onSelect,
  title = "City",
}: CityPickerSheetProps) {
  const { colors } = useAppTheme();
  const openSession = useOpenSession(visible);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [querySession, setQuerySession] = useState(openSession);
  if (querySession !== openSession) {
    setQuerySession(openSession);
    setQuery("");
  }

  const countryMeta = useMemo(() => findCountry(country), [country]);
  const cities = useMemo(() => listCitiesForCountry(country), [country]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.stateCode.toLowerCase().includes(q),
    );
  }, [cities, debouncedQuery]);

  const selectedLower = value?.trim().toLowerCase() ?? "";

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      scrollable={false}
    >
      {countryMeta ? (
        <Text
          style={[styles.context, { color: colors.textMuted }]}
          numberOfLines={1}
        >
          Cities in {countryMeta.name}
        </Text>
      ) : null}
      <View
        style={[
          styles.searchBox,
          { backgroundColor: colors.surfaceContainerLow },
        ]}
      >
        <Icon name="search" size={20} color={colors.outline} />
        <TextInput
          style={[styles.searchInput, { color: colors.onSurface }]}
          placeholder="Search cities…"
          placeholderTextColor={colors.outline}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="words"
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item, index) =>
          `${item.countryCode}-${item.stateCode}-${item.name}-${index}`
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        initialNumToRender={24}
        windowSize={11}
        ListEmptyComponent={
          <EmptyState
            icon="place"
            title={country ? "No cities found" : "Select a country first"}
            subtitle={
              country
                ? "Try another search."
                : "Choose a country to browse its cities."
            }
          />
        }
        renderItem={({ item }) => {
          const active = selectedLower === item.name.toLowerCase();
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
              <View
                style={[
                  styles.iconDisc,
                  { backgroundColor: colors.surfaceContainerHighest },
                ]}
              >
                <Icon name="place" size={18} color={colors.primary} />
              </View>
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
                {item.stateCode ? (
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
                    {item.stateCode}
                  </Text>
                ) : null}
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
  context: {
    ...Typography.labelMd,
    marginHorizontal: Spacing.gutterMd,
    marginBottom: Spacing.sm,
  },
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
  iconDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  rowLabel: { ...Typography.bodyMd },
  rowMeta: {
    ...Typography.caption,
    fontVariant: ["tabular-nums"],
  },
});
