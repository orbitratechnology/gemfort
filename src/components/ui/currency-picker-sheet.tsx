import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  POPULAR_CURRENCY_CODES,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
} from '@/constants/currencies';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

type CurrencyPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  value: CurrencyCode;
  onSelect: (code: CurrencyCode) => void;
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

export function CurrencyPickerSheet({
  visible,
  onClose,
  value,
  onSelect,
  title = 'Currency',
}: CurrencyPickerSheetProps) {
  const { colors } = useAppTheme();
  const openSession = useOpenSession(visible);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const [querySession, setQuerySession] = useState(openSession);
  if (querySession !== openSession) {
    setQuerySession(openSession);
    setQuery('');
  }

  const ordered = useMemo(() => {
    const popular = POPULAR_CURRENCY_CODES.map(
      (code) => SUPPORTED_CURRENCIES.find((c) => c.code === code)!,
    );
    const rest = SUPPORTED_CURRENCIES.filter(
      (c) => !POPULAR_CURRENCY_CODES.includes(c.code),
    );
    return [...popular, ...rest];
  }, []);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.label.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q),
    );
  }, [debouncedQuery, ordered]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} scrollable={false}>
      <View
        style={[
          styles.searchBox,
          { backgroundColor: colors.surfaceContainerLow },
        ]}
      >
        <Icon name="search" size={20} color={colors.outline} />
        <TextInput
          style={[styles.searchInput, { color: colors.onSurface }]}
          placeholder="Search currencies…"
          placeholderTextColor={colors.outline}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="characters"
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="search"
            title="No matches"
            subtitle="Try another search."
          />
        }
        renderItem={({ item }) => {
          const active = item.code === value;
          const isPopular = POPULAR_CURRENCY_CODES.includes(item.code);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                onSelect(item.code);
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
                  styles.codeBadge,
                  {
                    backgroundColor: active
                      ? colors.primary
                      : colors.surfaceContainerHighest,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.codeText,
                    { color: active ? colors.onPrimary : colors.onSurface },
                  ]}
                >
                  {item.code}
                </Text>
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
                >
                  {item.label}
                </Text>
                {isPopular && !debouncedQuery ? (
                  <Text style={[styles.popularHint, { color: colors.outline }]}>
                    Popular
                  </Text>
                ) : null}
              </View>
              {active ? (
                <Icon name="check" size={20} color={colors.primary} />
              ) : (
                <Text style={[styles.symbol, { color: colors.outline }]}>
                  {item.symbol}
                </Text>
              )}
            </Pressable>
          );
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.gutterMd,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMd,
    paddingVertical: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.gutterMd,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  codeBadge: {
    minWidth: 52,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  codeText: {
    ...Typography.labelMd,
    fontVariant: ['tabular-nums'],
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...Typography.bodyMd },
  popularHint: { ...Typography.labelSm },
  symbol: { ...Typography.labelMd },
});
