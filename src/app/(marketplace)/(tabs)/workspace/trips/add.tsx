import { router } from 'expo-router';
import { addDays } from 'date-fns';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipSelect } from '@/components/ui/chip-select';
import { FormFooter } from '@/components/ui/form-footer';
import { FormSection, ScreenInset } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { TRIP_TYPES } from '@/constants/trip-options';
import { Spacing, Typography } from '@/constants/design-tokens';
import { createTrip } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { Timestamp } from '@/lib/firebase/db';
import { friendlyError } from '@/lib/errors';
import { addTripSchema, parseForm } from '@/lib/validation/form-schemas';
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit() {
    if (!user) return;
    const result = parseForm(addTripSchema, {
      tripName,
      tripType,
      destinationCity,
      destinationCountry,
      durationDays,
      budget,
      cashCarried,
      notes: notes || undefined,
    });
    if (!result.success) {
      setErrors(result.errors);
      toast.error(Object.values(result.errors)[0] ?? 'Check the highlighted fields.');
      return;
    }

    setLoading(true);
    try {
      const data = result.data;
      const start = Timestamp.now();
      const end = Timestamp.fromDate(addDays(new Date(), data.durationDays));
      const id = await createTrip(user.uid, {
        tripName: data.tripName,
        tripType: data.tripType,
        destinationCountry: data.destinationCountry,
        destinationCity: data.destinationCity,
        startDate: start,
        expectedEndDate: end,
        budget: data.budget ?? 0,
        cashCarried: data.cashCarried ?? 0,
        notes: data.notes || null,
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
      <StackHeader title="Plan trip" />

      <ThemedScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <ScreenInset>
          <Text style={[styles.lead, { color: colors.textMuted }]}>
            Set destination and budget before you travel.
          </Text>
        </ScreenInset>

        <FormSection title="Trip type">
          <ChipSelect
            layout="stack"
            options={TRIP_TYPES.map((t) => ({
              value: t.id,
              label: t.label,
              subtitle: t.subtitle,
              icon: t.icon,
            }))}
            value={tripType}
            onChange={(v) => {
              setTripType(v);
              clearField('tripType');
            }}
            error={errors.tripType}
          />
        </FormSection>

        <FormSection title="Where & when">
          <Input
            label="Trip name"
            value={tripName}
            onChangeText={(v) => {
              setTripName(v);
              clearField('tripName');
            }}
            placeholder="e.g. Ratnapura March run"
            leftIcon="flight"
            error={errors.tripName}
          />
          <Input
            label="Destination city"
            value={destinationCity}
            onChangeText={(v) => {
              setDestinationCity(v);
              clearField('destinationCity');
            }}
            placeholder="Ratnapura"
            leftIcon="place"
            error={errors.destinationCity}
          />
          <Input
            label="Country"
            value={destinationCountry}
            onChangeText={(v) => {
              setDestinationCountry(v);
              clearField('destinationCountry');
            }}
            placeholder="Sri Lanka"
            leftIcon="public"
            error={errors.destinationCountry}
          />
          <Input
            label="Duration (days)"
            value={durationDays}
            onChangeText={(v) => {
              setDurationDays(v);
              clearField('durationDays');
            }}
            keyboardType="number-pad"
            leftIcon="schedule"
            error={errors.durationDays}
          />
        </FormSection>

        <FormSection title="Money" hint="Optional. Helps track spend on the road.">
          <Input
            label="Budget (LKR)"
            value={budget}
            onChangeText={(v) => {
              setBudget(v);
              clearField('budget');
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            leftIcon="account-balance-wallet"
            error={errors.budget}
          />
          <Input
            label="Cash carried (LKR)"
            value={cashCarried}
            onChangeText={(v) => {
              setCashCarried(v);
              clearField('cashCarried');
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            leftIcon="payments"
            error={errors.cashCarried}
          />
          <Input
            label="Notes"
            value={notes}
            onChangeText={(v) => {
              setNotes(v);
              clearField('notes');
            }}
            multiline
            style={styles.notes}
            placeholder="Optional"
            leftIcon="notes"
            error={errors.notes}
          />
        </FormSection>
      </ThemedScrollView>

      <FormFooter title="Create trip" icon="add" loading={loading} onPress={handleSubmit} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  lead: { ...Typography.bodyMd, lineHeight: 22 },
  notes: { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 },
});
