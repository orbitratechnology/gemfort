import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { autocompletePlaces, type FlightPlace } from '@/features/flights/flights-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

export function PlaceField({ label, value, onSelect }: { label: string; value: FlightPlace | null; onSelect: (place: FlightPlace | null) => void }) {
  const { colors } = useAppTheme();
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term, 250);
  const { data = [], isFetching } = useQuery({ queryKey: ['flight-places', debounced], queryFn: () => autocompletePlaces(debounced), enabled: debounced.trim().length >= 2, staleTime: 5 * 60_000 });
  const display = value && !term ? `${value.name} (${value.code})` : term;
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Text selectable style={{ ...Typography.labelMd, color: colors.onSurfaceVariant }}>{label}</Text>
      <View style={{ borderRadius: Radius.lg, borderCurve: 'continuous', backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, gap: Spacing.sm }}>
          <Icon name="flight" size={19} color={colors.primary} />
          <TextInput value={display} onChangeText={(next) => { setTerm(next); if (value) onSelect(null); }} placeholder={`Search ${label.toLowerCase()}`} placeholderTextColor={colors.textMuted} autoCapitalize="words" style={{ flex: 1, minHeight: 48, color: colors.onSurface, ...Typography.bodyMd }} />
          {isFetching ? <Icon name="refresh" size={16} color={colors.textMuted} /> : null}
        </View>
        {term.trim().length >= 2 && data.length > 0 ? <View style={{ borderTopWidth: 1, borderColor: colors.outlineVariant }}>
          {data.map((place) => <Pressable key={`${place.type}-${place.code}`} onPress={() => { onSelect(place); setTerm(''); }} style={{ padding: Spacing.md, gap: 2 }}>
            <Text selectable style={{ ...Typography.labelMd, color: colors.onSurface }}>{place.name} · {place.code}</Text>
            <Text selectable style={{ ...Typography.bodySmall, color: colors.textMuted }}>{[place.cityName, place.countryName].filter(Boolean).join(', ') || place.type}</Text>
          </Pressable>)}
        </View> : null}
      </View>
    </View>
  );
}
