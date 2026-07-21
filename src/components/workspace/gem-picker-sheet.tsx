import { Image } from "expo-image";
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
import { CountryFlag } from "@/components/ui/country-flag";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType, formatOriginLabel } from "@/constants/gem-options";
import { gemPrimaryPhotoUrl } from "@/features/workspace/party-photo";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { WorkspaceGem } from "@/types";

type GemPickerTab = "on_sale" | "private";

type GemPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  gems: WorkspaceGem[];
  value: string;
  onSelect: (gem: WorkspaceGem) => void;
  title?: string;
  emptyHint?: string;
  /** Initial tab when the sheet opens. Default: private */
  initialTab?: GemPickerTab;
};

function isOnSaleGem(gem: WorkspaceGem): boolean {
  return gem.isListedOnMarketplace === true || gem.status === "listed";
}

function matchesQuery(gem: WorkspaceGem, q: string) {
  if (!q) return true;
  const hay = [
    gem.sku,
    gem.gemType,
    formatGemType(gem.gemType),
    gem.variety,
    gem.originCountry,
    gem.originMine,
    gem.status,
    gem.cutType,
    gem.shape,
    String(gem.currentWeight),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/** Universal searchable gem picker — photo + SKU, type, weight. Tabs: On sale | Private. */
export function GemPickerSheet({
  visible,
  onClose,
  gems,
  value,
  onSelect,
  title = "Select gem",
  emptyHint = "Add a gem to your inventory first.",
  initialTab = "private",
}: GemPickerSheetProps) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [tab, setTab] = useState<GemPickerTab>(initialTab);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setTab(initialTab);
      setQuery("");
    }
  }

  const counts = useMemo(() => {
    let onSale = 0;
    let priv = 0;
    for (const g of gems) {
      if (isOnSaleGem(g)) onSale += 1;
      else priv += 1;
    }
    return { onSale, private: priv };
  }, [gems]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return gems.filter((g) => {
      const onSale = isOnSaleGem(g);
      if (tab === "on_sale" ? !onSale : onSale) return false;
      return matchesQuery(g, q);
    });
  }, [gems, debouncedQuery, tab]);

  function handleClose() {
    setQuery("");
    setTab(initialTab);
    onClose();
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={title}
      scrollable={false}
    >
      <View
        style={[styles.tabs, { backgroundColor: colors.surfaceContainerLow }]}
      >
        {(
          [
            { id: "on_sale" as const, label: "On sale", count: counts.onSale },
            { id: "private" as const, label: "Private", count: counts.private },
          ] as const
        ).map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(t.id)}
              style={[
                styles.tab,
                active
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: "transparent" },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: active ? colors.onPrimary : colors.onSurfaceVariant,
                  },
                ]}
              >
                {t.label}
              </Text>
              <Text
                style={[
                  styles.tabCount,
                  { color: active ? colors.onPrimary : colors.textMuted },
                ]}
              >
                {t.count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.searchBox,
          { backgroundColor: colors.surfaceContainerLow },
        ]}
      >
        <Icon name="search" size={20} color={colors.outline} />
        <TextInput
          style={[styles.searchInput, { color: colors.onSurface }]}
          placeholder="Search SKU, type, weight…"
          placeholderTextColor={colors.outline}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="diamond"
            title={
              gems.length === 0
                ? "No gems yet"
                : query.trim()
                  ? "No matches"
                  : tab === "on_sale"
                    ? "No gems on sale"
                    : "No private gems"
            }
            subtitle={
              gems.length === 0
                ? emptyHint
                : query.trim()
                  ? "Try a different search."
                  : tab === "on_sale"
                    ? "List a gem on GemNet to see it here."
                    : "Private inventory gems will show here."
            }
          />
        }
        renderItem={({ item }) => {
          const selected = value === item.id;
          const photo = gemPrimaryPhotoUrl(item);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${item.sku}, ${formatGemType(item.gemType)}, ${item.currentWeight} carat`}
              onPress={() => {
                onSelect(item);
                setQuery("");
                setTab(initialTab);
                onClose();
              }}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: selected
                    ? colors.primaryContainer
                    : colors.surfaceContainerLow,
                  borderColor: selected
                    ? colors.primary
                    : colors.outlineVariant,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.thumb,
                  { backgroundColor: colors.surfaceContainerHigh },
                ]}
              >
                {photo ? (
                  <Image
                    source={{ uri: photo }}
                    style={styles.thumbImg}
                    contentFit="cover"
                  />
                ) : (
                  <Icon
                    name="diamond"
                    size={22}
                    color={colors.outlineVariant}
                  />
                )}
              </View>
              <View style={styles.rowBody}>
                <Text
                  style={[styles.sku, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {item.sku}
                </Text>
                <Text
                  style={[styles.type, { color: colors.onSurfaceVariant }]}
                  numberOfLines={1}
                >
                  {formatGemType(item.gemType)}
                  {item.cutType ? ` · ${item.cutType}` : ""}
                </Text>
                <View style={styles.metaRow}>
                  <Text
                    style={[styles.meta, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {item.currentWeight} ct
                  </Text>
                  {item.originCountry ? (
                    <>
                      <Text
                        style={[styles.meta, { color: colors.textMuted }]}
                      >
                        {" · "}
                      </Text>
                      <CountryFlag country={item.originCountry} size="xs" />
                      <Text
                        style={[styles.meta, { color: colors.textMuted }]}
                        numberOfLines={1}
                      >
                        {" "}
                        {formatOriginLabel(item.originCountry)}
                      </Text>
                    </>
                  ) : null}
                  <Text
                    style={[styles.meta, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {` · ${item.status.replace(/_/g, " ")}`}
                  </Text>
                </View>
              </View>
              {selected ? (
                <Icon name="check-circle" size={22} color={colors.primary} />
              ) : null}
            </Pressable>
          );
        }}
      />
    </BottomSheet>
  );
}

type GemSelectFieldProps = {
  label: string;
  gem: WorkspaceGem | null;
  placeholder?: string;
  onPress: () => void;
  error?: string;
};

/** Compact field that opens GemPickerSheet. */
export function GemSelectField({
  label,
  gem,
  placeholder = "Select a gem",
  onPress,
  error,
}: GemSelectFieldProps) {
  const { colors } = useAppTheme();
  const photo = gemPrimaryPhotoUrl(gem);

  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={gem ? `Selected gem ${gem.sku}` : placeholder}
        onPress={onPress}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: error ? colors.error : colors.outlineVariant,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        {gem ? (
          <>
            <View
              style={[
                styles.fieldThumb,
                { backgroundColor: colors.surfaceContainerHigh },
              ]}
            >
              {photo ? (
                <Image
                  source={{ uri: photo }}
                  style={styles.thumbImg}
                  contentFit="cover"
                />
              ) : (
                <Icon name="diamond" size={18} color={colors.outlineVariant} />
              )}
            </View>
            <View style={styles.fieldBody}>
              <Text
                style={[styles.sku, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                {gem.sku}
              </Text>
              <Text
                style={[styles.meta, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {formatGemType(gem.gemType)} · {gem.currentWeight} ct
                {isOnSaleGem(gem) ? " · On sale" : " · Private"}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View
              style={[
                styles.fieldThumb,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <Icon name="diamond" size={18} color={colors.onPrimaryContainer} />
            </View>
            <Text style={[styles.placeholder, { color: colors.outline }]}>
              {placeholder}
            </Text>
          </>
        )}
        <Icon name="expand-more" size={22} color={colors.onSurfaceVariant} />
      </Pressable>
      {error ? (
        <Text
          style={[styles.error, { color: colors.error }]}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.stackMd,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
  },
  tabText: { ...Typography.labelMd, fontWeight: "700" },
  tabCount: { ...Typography.caption, fontVariant: ["tabular-nums"] },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 48,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    marginBottom: Spacing.stackMd,
  },
  searchInput: { flex: 1, ...Typography.bodyMd, paddingVertical: 0 },
  list: { flex: 1 },
  listContent: { gap: Spacing.sm, paddingBottom: Spacing.md, flexGrow: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1,
    minHeight: 72,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    borderCurve: "continuous",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImg: { width: "100%", height: "100%" },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  sku: { ...Typography.labelMd, fontWeight: "700" },
  type: { ...Typography.bodySmall },
  meta: { ...Typography.caption, textTransform: "capitalize" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },

  fieldWrap: { gap: Spacing.stackSm },
  fieldLabel: {
    ...Typography.labelMd,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    minHeight: 64,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  fieldThumb: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldBody: { flex: 1, minWidth: 0, gap: 2 },
  placeholder: { ...Typography.bodyMd, flex: 1 },
  error: { ...Typography.bodySmall },
});
