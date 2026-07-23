import { Image } from "expo-image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
    Animated,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
    type LayoutChangeEvent,
} from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { CountryFlag } from "@/components/ui/country-flag";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { Motion, Radius, Spacing, Typography } from "@/constants/design-tokens";
import { easeOut, useReduceMotion } from "@/hooks/use-reduce-motion";
import {
    GEM_CLARITIES,
    GEM_COLOR_FAMILIES,
    GEM_CUTS,
    GEM_ORIGINS,
    GEM_SHAPES,
    GEM_TREATMENTS,
    GEM_TYPES,
    MANUAL_STATUS_OPTIONS,
    formatColorLabel,
    formatOptionLabel,
    formatOriginLabel,
    type GemColorFamily,
    type GemColorShade,
    type GemOrigin,
} from "@/constants/gem-options";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

/** Reset local UI state when a sheet opens (render-phase, avoids set-state-in-effect). */
function useOpenSession(visible: boolean): number {
  const [session, setSession] = useState(0);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setSession((s) => s + 1);
  }
  return session;
}

type PickerFieldProps = {
  label: string;
  valueLabel: string;
  placeholder?: string;
  onPress: () => void;
  error?: string;
  leading?: ReactNode;
};

export function AttributePickerField({
  label,
  valueLabel,
  placeholder = "Select",
  onPress,
  error,
  leading,
}: PickerFieldProps) {
  const { colors } = useAppTheme();
  const hasValue = Boolean(valueLabel);

  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasValue ? `${label}: ${valueLabel}` : placeholder}
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
        {leading ?? (
          <View
            style={[
              styles.fieldIcon,
              { backgroundColor: colors.surfaceContainerHigh },
            ]}
          >
            <Icon name="tune" size={18} color={colors.outline} />
          </View>
        )}
        <Text
          style={[
            styles.fieldValue,
            { color: hasValue ? colors.onSurface : colors.outline },
          ]}
          numberOfLines={1}
        >
          {hasValue ? valueLabel : placeholder}
        </Text>
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

export function ColorSwatch({
  hex,
  size = 28,
  border,
}: {
  hex: string;
  size?: number;
  border?: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: hex,
        borderWidth: 1,
        borderColor: border ?? "rgba(0,0,0,0.12)",
      }}
    />
  );
}

type SearchableOption = {
  value: string;
  label: string;
  searchText?: string;
  icon?: IconName;
};

type OptionPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: readonly SearchableOption[];
  value: string;
  onSelect: (value: string) => void;
  searchable?: boolean;
};

export function OptionPickerSheet({
  visible,
  onClose,
  title,
  options,
  value,
  onSelect,
  searchable = true,
}: OptionPickerSheetProps) {
  const { colors } = useAppTheme();
  const openSession = useOpenSession(visible);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [querySession, setQuerySession] = useState(openSession);
  if (querySession !== openSession) {
    setQuerySession(openSession);
    setQuery("");
  }

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.searchText?.toLowerCase().includes(q) ?? false),
    );
  }, [options, debouncedQuery]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      scrollable={false}
    >
      {searchable ? (
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.surfaceContainerLow },
          ]}
        >
          <Icon name="search" size={20} color={colors.outline} />
          <TextInput
            style={[styles.searchInput, { color: colors.onSurface }]}
            placeholder="Search…"
            placeholderTextColor={colors.outline}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
        </View>
      ) : null}
      <FlatList
        data={filtered as SearchableOption[]}
        keyExtractor={(item) => item.value}
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
          const active = item.value === value;
          return (
            <Pressable
              onPress={() => {
                onSelect(item.value);
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
              {item.icon ? (
                <View
                  style={[
                    styles.optionIcon,
                    {
                      backgroundColor: active
                        ? colors.primary
                        : colors.surfaceContainerHighest,
                    },
                  ]}
                >
                  <Icon
                    name={item.icon}
                    size={18}
                    color={active ? colors.onPrimary : colors.onSurfaceVariant}
                  />
                </View>
              ) : null}
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

type GemTypePickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  value: string;
  onSelect: (value: string) => void;
};

export function GemTypePickerSheet({
  visible,
  onClose,
  value,
  onSelect,
}: GemTypePickerSheetProps) {
  const { colors } = useAppTheme();
  const openSession = useOpenSession(visible);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [querySession, setQuerySession] = useState(openSession);
  if (querySession !== openSession) {
    setQuerySession(openSession);
    setQuery("");
  }

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return GEM_TYPES;
    return GEM_TYPES.filter(
      (t) => t.label.toLowerCase().includes(q) || t.value.includes(q),
    );
  }, [debouncedQuery]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Gem type"
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
          placeholder="Search gem types…"
          placeholderTextColor={colors.outline}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={[...filtered]}
        keyExtractor={(item) => item.value}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const active = item.value === value;
          return (
            <Pressable
              onPress={() => {
                onSelect(item.value);
                onClose();
              }}
              style={({ pressed }) => [
                styles.typeRow,
                {
                  backgroundColor: active
                    ? colors.primaryContainer
                    : colors.surfaceContainerLow,
                  borderColor: active ? colors.primary : colors.outlineVariant,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Image
                source={item.image}
                style={styles.typePhoto}
                contentFit="cover"
              />
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

type ColorPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  value: string;
  onSelect: (shadeValue: string) => void;
};

export function ColorPickerSheet({
  visible,
  onClose,
  value,
  onSelect,
}: ColorPickerSheetProps) {
  const { colors } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const openSession = useOpenSession(visible);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [family, setFamily] = useState<GemColorFamily | null>(null);
  const [panelWidth, setPanelWidth] = useState(0);
  const [translateX] = useState(() => new Animated.Value(0));
  const [session, setSession] = useState(openSession);
  if (session !== openSession) {
    setSession(openSession);
    setQuery("");
    setFamily(null);
  }

  const filteredFamilies = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return GEM_COLOR_FAMILIES;
    return GEM_COLOR_FAMILIES.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.shades.some(
          (s) => s.label.toLowerCase().includes(q) || s.value.includes(q),
        ),
    );
  }, [debouncedQuery]);

  const filteredShades = useMemo(() => {
    if (!family) return [] as GemColorShade[];
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return family.shades;
    return family.shades.filter(
      (s) => s.label.toLowerCase().includes(q) || s.value.includes(q),
    );
  }, [family, debouncedQuery]);

  useEffect(() => {
    if (panelWidth <= 0) return;
    const toValue = family ? -panelWidth : 0;
    if (reduceMotion) {
      translateX.setValue(toValue);
      return;
    }
    Animated.timing(translateX, {
      toValue,
      duration: Motion.normal,
      easing: easeOut,
      useNativeDriver: true,
    }).start();
  }, [family, panelWidth, reduceMotion, translateX]);

  useEffect(() => {
    if (!visible) {
      translateX.setValue(0);
    }
  }, [visible, translateX]);

  function onTrackLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== panelWidth) setPanelWidth(w);
  }

  function handleSheetClose() {
    if (family) {
      setFamily(null);
      return;
    }
    onClose();
  }

  const width = panelWidth > 0 ? panelWidth : 1;

  return (
    <BottomSheet
      visible={visible}
      onClose={handleSheetClose}
      title={family ? `${family.label} shades` : "Color"}
      scrollable={false}
    >
      <View style={styles.colorTrack} onLayout={onTrackLayout}>
        <Animated.View
          style={[
            styles.colorPanels,
            {
              width: width * 2,
              transform: [{ translateX }],
            },
          ]}
        >
          <View style={[styles.colorPanel, { width }]}>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Choose a color family, then a shade.
            </Text>
            <View
              style={[
                styles.searchBox,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Icon name="search" size={20} color={colors.outline} />
              <TextInput
                style={[styles.searchInput, { color: colors.onSurface }]}
                placeholder="Search colors…"
                placeholderTextColor={colors.outline}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={filteredFamilies}
              keyExtractor={(item) => item.value}
              style={styles.colorList}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setQuery("");
                    setFamily(item);
                  }}
                  style={({ pressed }) => [
                    styles.colorRow,
                    {
                      backgroundColor: colors.surfaceContainerLow,
                      borderColor: colors.outlineVariant,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <ColorSwatch
                    hex={item.hex}
                    size={32}
                    border={colors.outlineVariant}
                  />
                  <View style={styles.colorText}>
                    <Text style={[styles.rowLabel, { color: colors.onSurface }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {item.shades.length} shades
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={colors.outline} />
                </Pressable>
              )}
            />
          </View>
          <View style={[styles.colorPanel, { width }]}>
            <View
              style={[
                styles.searchBox,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Icon name="search" size={20} color={colors.outline} />
              <TextInput
                style={[styles.searchInput, { color: colors.onSurface }]}
                placeholder="Search shades…"
                placeholderTextColor={colors.outline}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={filteredShades}
              keyExtractor={(item) => item.value}
              style={styles.colorList}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <EmptyState
                  icon="search"
                  title="No shades"
                  subtitle="Try another search."
                />
              }
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onSelect(item.value);
                      setFamily(null);
                      onClose();
                    }}
                    style={({ pressed }) => [
                      styles.colorRow,
                      {
                        backgroundColor: active
                          ? colors.primaryContainer
                          : colors.surfaceContainerLow,
                        borderColor: active
                          ? colors.primary
                          : colors.outlineVariant,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <ColorSwatch
                      hex={item.hex}
                      size={32}
                      border={colors.outlineVariant}
                    />
                    <View style={styles.colorText}>
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
                      <Text style={[styles.meta, { color: colors.textMuted }]}>
                        {item.hex}
                      </Text>
                    </View>
                    {active ? (
                      <Icon name="check" size={20} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </Animated.View>
      </View>
    </BottomSheet>
  );
}

type OriginPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  value: string;
  onSelect: (originValue: string) => void;
};

export function OriginPickerSheet({
  visible,
  onClose,
  value,
  onSelect,
}: OriginPickerSheetProps) {
  const { colors } = useAppTheme();
  const openSession = useOpenSession(visible);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [querySession, setQuerySession] = useState(openSession);
  if (querySession !== openSession) {
    setQuerySession(openSession);
    setQuery("");
  }

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return GEM_ORIGINS;
    return GEM_ORIGINS.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.includes(q) ||
        (o.note?.toLowerCase().includes(q) ?? false),
    );
  }, [debouncedQuery]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Origin"
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
          placeholder="Search origins…"
          placeholderTextColor={colors.outline}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={filtered as GemOrigin[]}
        keyExtractor={(item) => item.value}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            icon="public"
            title="No origins"
            subtitle="Try another search."
          />
        }
        renderItem={({ item }) => {
          const active = item.value === value;
          return (
            <Pressable
              onPress={() => {
                onSelect(item.value);
                onClose();
              }}
              style={({ pressed }) => [
                styles.originRow,
                {
                  backgroundColor: active
                    ? colors.primaryContainer
                    : colors.surfaceContainerLow,
                  borderColor: active ? colors.primary : colors.outlineVariant,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <CountryFlag country={item.countryCode} size="lg" />
              <View style={styles.colorText}>
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
                {item.note ? (
                  <Text
                    style={[styles.meta, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {item.note}
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

export function ShapePickerSheet(
  props: Omit<OptionPickerSheetProps, "title" | "options">,
) {
  return <OptionPickerSheet {...props} title="Shape" options={GEM_SHAPES} />;
}

export function ClarityPickerSheet(
  props: Omit<OptionPickerSheetProps, "title" | "options">,
) {
  return (
    <OptionPickerSheet {...props} title="Clarity" options={GEM_CLARITIES} />
  );
}

export function CutPickerSheet(
  props: Omit<OptionPickerSheetProps, "title" | "options">,
) {
  return <OptionPickerSheet {...props} title="Cut" options={GEM_CUTS} />;
}

export function TreatmentPickerSheet(
  props: Omit<OptionPickerSheetProps, "title" | "options">,
) {
  return (
    <OptionPickerSheet {...props} title="Treatment" options={GEM_TREATMENTS} />
  );
}

export function StatusPickerSheet(
  props: Omit<OptionPickerSheetProps, "title" | "options">,
) {
  return (
    <OptionPickerSheet
      {...props}
      title="Status"
      options={MANUAL_STATUS_OPTIONS}
    />
  );
}

const LISTING_VISIBILITY_OPTIONS = [
  {
    value: "public",
    label: "Public",
    icon: "public" as IconName,
    searchText: "Anyone can view this listing",
  },
  {
    value: "contacts",
    label: "Contacts",
    icon: "contacts" as IconName,
    searchText: "Only your contacts can view",
  },
] as const;

export function ListingVisibilityPickerSheet(
  props: Omit<OptionPickerSheetProps, "title" | "options" | "searchable">,
) {
  return (
    <OptionPickerSheet
      {...props}
      title="Visibility"
      options={LISTING_VISIBILITY_OPTIONS}
      searchable={false}
    />
  );
}

export { LISTING_VISIBILITY_OPTIONS };

export {
    GEM_CLARITIES,
    GEM_CUTS,
    GEM_SHAPES,
    GEM_TREATMENTS,
    formatColorLabel,
    formatOptionLabel,
    formatOriginLabel
};

const styles = StyleSheet.create({
  fieldWrap: { gap: 8 },
  fieldLabel: { ...Typography.labelMd },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: 1.5,
  },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldValue: { ...Typography.bodyMd, fontWeight: "600", flex: 1 },
  error: { ...Typography.bodySmall },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    marginBottom: Spacing.stackMd,
  },
  searchInput: { flex: 1, ...Typography.bodyMd, paddingVertical: 0 },
  listContent: { gap: Spacing.stackSm, paddingBottom: Spacing.lg },
  colorTrack: { flex: 1, minHeight: 0, overflow: "hidden" },
  colorPanels: { flexDirection: "row", height: "100%" },
  colorPanel: { height: "100%" },
  colorList: { flex: 1 },
  hint: { ...Typography.bodyMd, marginBottom: Spacing.stackSm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { ...Typography.bodyMd, fontWeight: "600", flex: 1 },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.lg,
  },
  typePhoto: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  colorText: { flex: 1, gap: 2 },
  meta: { ...Typography.caption },
  originRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
});
