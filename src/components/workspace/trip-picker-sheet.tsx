import { FlashList } from "@/components/ui/gesture-lists";
import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BottomSheet, SheetListSeparator } from "@/components/ui/bottom-sheet";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FieldLabel,
  FieldMessage,
  FieldWrap,
  fieldStyles,
  useFieldChrome,
} from "@/components/ui/field-chrome";
import { Icon } from "@/components/ui/icon";
import { SearchField } from "@/components/ui/search-field";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { WORKSPACE_ENTITY_IMAGES } from "@/constants/workspace-entity-images";
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
      <SearchField
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search trips"
        autoCapitalize="none"
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon="trip"
          image={WORKSPACE_ENTITY_IMAGES.trip}
          title="No trips"
          subtitle={emptyHint}
        />
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
                    name="trip"
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
  const chrome = useFieldChrome({ error: !!error });

  return (
    <FieldWrap>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          trip ? `Selected trip ${trip.tripName}` : placeholder
        }
        onPress={onPress}
        style={({ pressed }) => [
          fieldStyles.box,
          styles.field,
          chrome.box,
          pressed && chrome.pressedBox,
        ]}
      >
        {trip ? (
          <>
            <View
              style={[
                styles.fieldIcon,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <Icon name="trip" size={22} color={colors.primary} />
            </View>
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
          </>
        ) : (
          <Text
            style={[fieldStyles.value, { color: chrome.placeholderColor }]}
            numberOfLines={1}
          >
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
      <FieldMessage error={error} />
    </FieldWrap>
  );
}

const styles = StyleSheet.create({
  search: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
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
  /** Taller trigger for the icon tile + two-line layout. */
  field: { minHeight: 64, paddingVertical: Spacing.sm, gap: Spacing.sm },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldTitle: { ...Typography.bodyMd, fontWeight: "600" },
  fieldSub: { ...Typography.caption },
});
