import { FlashList } from "@/components/ui/gesture-lists";
import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BottomSheet, SheetListSeparator } from "@/components/ui/bottom-sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import {
  TRIP_STATUS_LABELS,
  TRIP_TYPES,
} from "@/constants/trip-options";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Trip } from "@/types";

type TripPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  trips: Trip[];
  value: string;
  onSelect: (trip: Trip) => void;
  title?: string;
  emptyHint?: string;
};

function tripTypeLabel(trip: Trip) {
  return TRIP_TYPES.find((t) => t.id === trip.tripType)?.label ?? trip.tripType;
}

function tripSubtitle(trip: Trip) {
  const place = [trip.destinationCity, trip.destinationCountry]
    .filter(Boolean)
    .join(", ");
  return `${TRIP_STATUS_LABELS[trip.status]} · ${tripTypeLabel(trip)}${
    place ? ` · ${place}` : ""
  }`;
}

function matchesQuery(trip: Trip, q: string) {
  if (!q) return true;
  const hay = [
    trip.tripName,
    trip.destinationCountry,
    trip.destinationCity,
    trip.tripType,
    tripTypeLabel(trip),
    trip.status,
    TRIP_STATUS_LABELS[trip.status],
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/** Searchable bottom sheet to attach a gem to an ongoing trip. */
export function TripPickerSheet({
  visible,
  onClose,
  trips,
  value,
  onSelect,
  title = "Select trip",
  emptyHint = "Start a sourcing trip to link gems to it.",
}: TripPickerSheetProps) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setQuery("");
  }

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return trips.filter((t) => matchesQuery(t, q));
  }, [trips, debouncedQuery]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      scrollable={false}
    >
      <View
        style={[
          styles.searchWrap,
          { backgroundColor: colors.surfaceContainerHigh },
        ]}
      >
        <Icon name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search trips"
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.onSurface }]}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {filtered.length === 0 ? (
        <EmptyState icon="flight" title="No trips" subtitle={emptyHint} />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={SheetListSeparator}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const selected = item.id === value;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: selected
                      ? colors.primaryContainer
                      : colors.surfaceContainerLowest,
                    borderColor: selected
                      ? colors.primary
                      : colors.outlineVariant,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: colors.secondaryContainer },
                  ]}
                >
                  <Icon
                    name="flight-takeoff"
                    size={18}
                    color={colors.onSecondaryContainer}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={[styles.title, { color: colors.onSurface }]}
                    numberOfLines={1}
                  >
                    {item.tripName}
                  </Text>
                  <Text
                    style={[styles.sub, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {tripSubtitle(item)}
                  </Text>
                </View>
                {selected ? (
                  <Icon name="check-circle" size={22} color={colors.primary} />
                ) : (
                  <Icon
                    name="chevron-right"
                    size={20}
                    color={colors.textMuted}
                  />
                )}
              </Pressable>
            );
          }}
        />
      )}
    </BottomSheet>
  );
}

type TripSelectFieldProps = {
  label: string;
  trip: Trip | null;
  placeholder?: string;
  onPress: () => void;
  onClear?: () => void;
  error?: string;
};

/** Compact field that opens TripPickerSheet. */
export function TripSelectField({
  label,
  trip,
  placeholder = "Optional — link to a trip",
  onPress,
  onClear,
  error,
}: TripSelectFieldProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          trip ? `Selected trip ${trip.tripName}` : placeholder
        }
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
        {trip ? (
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={[styles.fieldTitle, { color: colors.onSurface }]}
              numberOfLines={1}
            >
              {trip.tripName}
            </Text>
            <Text
              style={[styles.fieldSub, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {tripSubtitle(trip)}
            </Text>
          </View>
        ) : (
          <Text style={[styles.placeholder, { color: colors.textMuted }]}>
            {placeholder}
          </Text>
        )}
        {trip && onClear ? (
          <Pressable
            onPress={onClear}
            hitSlop={8}
            accessibilityLabel="Clear trip"
          >
            <Icon name="close" size={20} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Icon name="expand-more" size={22} color={colors.textMuted} />
        )}
      </Pressable>
      {error ? (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMd,
    paddingVertical: 4,
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...Typography.bodyMd, fontWeight: "600" },
  sub: { ...Typography.caption },
  fieldWrap: { gap: Spacing.xs },
  fieldLabel: { ...Typography.labelMd, fontWeight: "600" },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 56,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  fieldTitle: { ...Typography.bodyMd, fontWeight: "600" },
  fieldSub: { ...Typography.caption },
  placeholder: { ...Typography.bodyMd, flex: 1 },
  error: { ...Typography.caption },
});
