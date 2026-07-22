import { router } from 'expo-router';
import { addDays } from 'date-fns';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipSelect } from '@/components/ui/chip-select';
import { CountryFlag } from '@/components/ui/country-flag';
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from '@/components/ui/currency-amount-field';
import { FormFooter } from '@/components/ui/form-footer';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { TRIP_TYPES } from '@/constants/trip-options';
import { Spacing } from '@/constants/design-tokens';
import { resolveCountryCode } from '@/constants/gem-options';
import { createTrip } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';
import { Timestamp } from '@/lib/firebase/db';
import { friendlyError } from '@/lib/errors';
import { addTripSchema, parseForm } from '@/lib/validation/form-schemas';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import type { TripType } from '@/types';

export default function AddTripScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const toast = useToast();

  const [tripName, setTripName] = useState('');
  const [tripType, setTripType] = useState<TripType>('sourcing');
  const [destinationCountry, setDestinationCountry] = useState('Sri Lanka');
  const [destinationCity, setDestinationCity] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [budget, setBudget] = useState<CurrencyAmountValue>({
    amount: '',
    currency: preferred,
  });
  const [cashCarried, setCashCarried] = useState<CurrencyAmountValue>({
    amount: '',
    currency: preferred,
  });
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
      budget: budget.amount,
      cashCarried: cashCarried.amount,
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
        budgetCurrency: budget.currency,
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
        <FormSection title="Trip type">
          <ChipSelect
            layout="stack"
            options={TRIP_TYPES.map((t) => ({
              value: t.id,
              label: t.label,
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
            leftIcon={resolveCountryCode(destinationCountry) ? undefined : 'public'}
            leftElement={
              resolveCountryCode(destinationCountry) ? (
                <CountryFlag country={destinationCountry} size="lg" />
              ) : undefined
            }
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

        <FormSection title="Money">
          <CurrencyAmountField
            label="Budget"
            value={budget}
            onChange={(next) => {
              setBudget(next);
              clearField('budget');
            }}
            error={errors.budget}
          />
          <CurrencyAmountField
            label="Cash carried"
            value={cashCarried}
            onChange={(next) => {
              setCashCarried(next);
              clearField('cashCarried');
            }}
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
  notes: { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 },
});
