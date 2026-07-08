import { router } from 'expo-router';
import { addDays } from 'date-fns';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { TRIP_TYPES } from '@/constants/trip-options';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { createTrip } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { Timestamp } from '@/lib/firebase/db';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import type { TripType } from '@/types';

export default function AddTripScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();

  const [tripName, setTripName] = useState('');
  const [tripType, setTripType] = useState<TripType>('sourcing');
  const [destinationCountry, setDestinationCountry] = useState('Sri Lanka');
  const [destinationCity, setDestinationCity] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [budget, setBudget] = useState('');
  const [cashCarried, setCashCarried] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!user) return;
    if (!tripName.trim() || !destinationCity.trim()) {
      toast.error('Enter a trip name and destination city.');
      return;
    }
    setLoading(true);
    try {
      const start = Timestamp.now();
      const days = parseInt(durationDays, 10) || 7;
      const end = Timestamp.fromDate(addDays(new Date(), days));
      const id = await createTrip(user.uid, {
        tripName,
        tripType,
        destinationCountry,
        destinationCity,
        startDate: start,
        expectedEndDate: end,
        budget: budget ? parseFloat(budget) : 0,
        cashCarried: cashCarried ? parseFloat(cashCarried) : 0,
        notes: notes || null,
      });
      toast.success('Trip created.');
      router.replace(`/(marketplace)/(tabs)/workspace/trips/${id}` as never);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not create trip.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="New Trip" />

      <ThemedScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Set up a sourcing or selling trip before you travel.
        </Text>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>TRIP TYPE</Text>
          <View style={styles.typeCol}>
            {TRIP_TYPES.map((t) => {
              const active = tripType === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTripType(t.id)}
                  style={[
                    styles.typeRow,
                    {
                      backgroundColor: active ? colors.primaryContainer : colors.surfaceContainerLowest,
                      borderColor: active ? colors.primary : colors.outlineVariant,
                    },
                  ]}>
                  <View
                    style={[
                      styles.typeIcon,
                      { backgroundColor: active ? colors.primary : colors.surfaceContainerHighest },
                    ]}>
                    <Icon name={t.icon as IconName} size={20} color={active ? colors.onPrimary : colors.onSurfaceVariant} />
                  </View>
                  <View style={styles.typeText}>
                    <Text style={[styles.typeLabel, { color: active ? colors.onPrimaryContainer : colors.onSurface }]}>
                      {t.label}
                    </Text>
                    <Text style={[styles.typeSub, { color: colors.textMuted }]}>{t.subtitle}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Input label="Trip name" value={tripName} onChangeText={setTripName} placeholder="e.g. Ratnapura March run" />
          <Input label="Destination city" value={destinationCity} onChangeText={setDestinationCity} placeholder="Ratnapura" />
          <Input label="Country" value={destinationCountry} onChangeText={setDestinationCountry} placeholder="Sri Lanka" />
          <Input label="Duration (days)" value={durationDays} onChangeText={setDurationDays} keyboardType="number-pad" />
          <Input label="Budget (LKR)" value={budget} onChangeText={setBudget} keyboardType="decimal-pad" placeholder="Optional" />
          <Input label="Cash carried (LKR)" value={cashCarried} onChangeText={setCashCarried} keyboardType="decimal-pad" placeholder="Optional" />
          <Input label="Notes" value={notes} onChangeText={setNotes} multiline style={styles.notes} placeholder="Optional" />
        </View>

        <Button title="Create trip" loading={loading} onPress={handleSubmit} />
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.section, gap: Spacing.lg },
  subtitle: { ...Typography.bodySmall, lineHeight: 20 },
  section: { gap: Spacing.sm },
  sectionLabel: { ...Typography.labelMd, letterSpacing: 1 },
  typeCol: { gap: Spacing.sm },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1.5,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeText: { flex: 1, gap: 2 },
  typeLabel: { ...Typography.labelMd, fontWeight: '600' },
  typeSub: { ...Typography.bodySmall },
  card: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  notes: { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 },
});
