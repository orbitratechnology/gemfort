import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  autocompletePlaces,
  type FlightPlace,
} from '@/features/flights/flights-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { haptics } from '@/lib/haptics';

export function PlaceField({
  label,
  value,
  error,
  onSelect,
}: {
  label: string;
  value: FlightPlace | null;
  error?: boolean;
  onSelect: (place: FlightPlace | null) => void;
}) {
  const { colors } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const inputRef = useRef<TextInput>(null);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term, 250);
  const {
    data = [],
    isFetching,
    error: queryError,
  } = useQuery({
    queryKey: ['flight-places', debounced],
    queryFn: () => autocompletePlaces(debounced),
    enabled: open && debounced.trim().length >= 2,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 260);
    return () => clearTimeout(id);
  }, [open]);

  function choose(place: FlightPlace) {
    haptics.selection();
    onSelect(place);
    setTerm('');
    setOpen(false);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? `${value.name}, ${value.code}` : 'not selected'}`}
        onPress={haptics.wrap('light', () => setOpen(true))}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.surfaceContainerLow,
            borderColor: error ? colors.error : 'transparent',
          },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text selectable={false} style={[styles.label, { color: error ? colors.error : colors.textMuted }]}>
          {label}
        </Text>
        <View style={styles.valueRow}>
          <Text
            selectable={false}
            numberOfLines={1}
            style={[
              styles.value,
              { color: value ? colors.onSurfaceVariant : colors.textMuted },
            ]}
          >
            {value ? value.name : 'Select place'}
          </Text>
          {value ? (
            <Text selectable={false} style={[styles.code, { color: colors.primary }]}>
              {value.code}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <BottomSheet
        visible={open}
        onClose={() => {
          setOpen(false);
          setTerm('');
        }}
        title={`Choose ${label.toLowerCase()}`}
      >
        <View style={styles.sheetContent}>
          <View
            style={[
              styles.search,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <Icon name="search" size={20} color={colors.textMuted} />
            <TextInput
              ref={inputRef}
              value={term}
              onChangeText={setTerm}
              placeholder="City or airport"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="search"
              style={[styles.input, { color: colors.onSurface }]}
            />
            {isFetching ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : term ? (
              <Pressable
                accessibilityLabel="Clear search"
                hitSlop={8}
                onPress={() => setTerm('')}
              >
                <Icon name="cancel" size={19} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {queryError ? (
            <View style={[styles.message, { backgroundColor: colors.errorContainer }]}>
              <Icon name="cloud-off" size={18} color={colors.error} />
              <Text selectable={false} style={[styles.messageText, { color: colors.onErrorContainer }]}>
                Airport search is temporarily unavailable.
              </Text>
            </View>
          ) : term.trim().length < 2 ? (
            <View style={styles.empty}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.surfaceContainerLow },
                ]}
              >
                <Icon name="travel-explore" size={26} color={colors.primary} />
              </View>
              <Text selectable={false} style={[styles.emptyTitle, { color: colors.onSurface }]}>
                Search worldwide
              </Text>
              <Text selectable={false} style={[styles.emptyCopy, { color: colors.textMuted }]}>
                Type at least two letters to find airports and cities.
              </Text>
            </View>
          ) : !isFetching && data.length === 0 ? (
            <View style={styles.empty}>
              <Text selectable={false} style={[styles.emptyTitle, { color: colors.onSurface }]}>
                No places found
              </Text>
              <Text selectable={false} style={[styles.emptyCopy, { color: colors.textMuted }]}>
                Try a city name, airport name, or IATA code.
              </Text>
            </View>
          ) : (
            <View style={styles.results}>
              {data.map((place, index) => (
                <Animated.View
                  key={`${place.type}-${place.code}`}
                  entering={
                    reduceMotion
                      ? undefined
                      : FadeInUp.delay(index * 35).duration(180)
                  }
                >
                  <Pressable
                    onPress={() => choose(place)}
                    style={({ pressed }) => [
                      styles.result,
                      pressed && {
                        backgroundColor: colors.surfaceContainerLow,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.resultIcon,
                        { backgroundColor: colors.surfaceContainerLow },
                      ]}
                    >
                      <Icon
                        name={place.type === 'airport' ? 'flight' : 'location-city'}
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.resultCopy}>
                      <Text
                        selectable={false}
                        numberOfLines={1}
                        style={[styles.resultTitle, { color: colors.onSurface }]}
                      >
                        {place.name}
                      </Text>
                      <Text
                        selectable={false}
                        numberOfLines={1}
                        style={[styles.resultSub, { color: colors.textMuted }]}
                      >
                        {[place.cityName, place.countryName]
                          .filter(Boolean)
                          .join(', ') || place.type}
                      </Text>
                    </View>
                    <Text selectable={false} style={[styles.resultCode, { color: colors.primary }]}>
                      {place.code}
                    </Text>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          )}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    minHeight: 58,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    justifyContent: 'center',
    gap: 3,
  },
  label: { ...Typography.caption, fontSize: 9 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  value: { ...Typography.bodySmall, fontFamily: FontFamily.medium, flex: 1 },
  code: { ...Typography.caption, fontFamily: FontFamily.bold },
  sheetContent: { minHeight: 320, gap: Spacing.md },
  search: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  input: { ...Typography.bodyMd, flex: 1, minHeight: 48 },
  message: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  messageText: { ...Typography.bodySmall, flex: 1 },
  empty: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...Typography.bodyLg, fontFamily: FontFamily.semibold, textAlign: 'center' },
  emptyCopy: { ...Typography.bodySmall, textAlign: 'center', lineHeight: 18 },
  results: { gap: 2 },
  result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.sm, borderRadius: Radius.lg },
  resultIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  resultCopy: { flex: 1, minWidth: 0, gap: 2 },
  resultTitle: { ...Typography.bodyMd, fontFamily: FontFamily.semibold },
  resultSub: { ...Typography.caption },
  resultCode: { ...Typography.bodyMd, fontFamily: FontFamily.bold },
});
