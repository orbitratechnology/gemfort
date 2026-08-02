import { addDays } from 'date-fns';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoicePreviewCard, ChoiceTileGrid } from '@/components/ui/choice-tile-grid';
import { CityField } from '@/components/ui/city-field';
import { CountryField } from '@/components/ui/country-field';
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from '@/components/ui/currency-amount-field';
import { FormFooter } from '@/components/ui/form-footer';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { MaskedInput } from '@/components/ui/masked-input';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { cityBelongsToCountry } from '@/constants/cities';
import { Spacing } from '@/constants/design-tokens';
import { TRIP_TYPES } from '@/constants/trip-options';
import { createTrip } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';
import { friendlyError } from '@/lib/errors';
import { Timestamp } from '@/lib/firebase/db';
import { addTripSchema, parseForm } from '@/lib/validation/form-schemas';
import { replaceWithAnchor } from '@/navigation/tab-stack-nav';
import { useAuth } from '@/providers/auth-provider';
import { withLoading } from '@/providers/loading-provider';
import { useToast } from '@/providers/toast-provider';
import type { TripType } from '@/types';

export default function AddTripScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const [step, setStep] = useState(0);
  const [tripName, setTripName] = useState('');
  const [tripType, setTripType] = useState<TripType | null>(null);
  const [destinationCountry, setDestinationCountry] = useState('Sri Lanka');
  const [destinationCity, setDestinationCity] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [budget, setBudget] = useState<CurrencyAmountValue>({
    amount: '',
    currency: preferred,
  });
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const typeMeta = TRIP_TYPES.find((t) => t.id === tripType);

  function clearField(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleSelectType(next: TripType) {
    setTripType(next);
    clearField('tripType');
    setStep(1);
  }

  async function handleSubmit() {
    if (!user) {
      toast.error('Sign in to create a trip.');
      return;
    }
    if (!tripType) {
      toast.error('Select a trip type.');
      setStep(0);
      return;
    }
    const result = parseForm(addTripSchema, {
      tripName,
      tripType,
      destinationCity,
      destinationCountry,
      durationDays,
      budget: budget.amount,
      notes: notes || undefined,
    });
    if (!result.success) {
      setErrors(result.errors);
      toast.error(Object.values(result.errors)[0] ?? 'Check the highlighted fields.');
      return;
    }

    try {
      await withLoading(async () => {
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
          cashCarried: 0,
          cashCarriedCurrency: budget.currency,
          notes: data.notes || null,
        });
        toast.success('Trip created.');
        replaceWithAnchor(`/(marketplace)/(tabs)/workspace/trips/${id}` as never);
      }, 'Creating trip…');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not create trip.'));
    }
  }

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <StackHeader
        title={step === 0 ? 'Trip type' : 'Plan trip'}
        closeIcon
      />

      {step === 0 ? (
        <View
          style={[
            styles.typeStep,
            { paddingBottom: Math.max(insets.bottom, Spacing.xl) },
          ]}
        >
          <ChoiceTileGrid
            layout="grid"
            options={TRIP_TYPES.map((t) => ({
              value: t.id,
              label: t.label,
              icon: t.icon,
              span: t.id === 'both' ? 2 : 1,
            }))}
            value={tripType}
            onChange={handleSelectType}
            error={errors.tripType}
          />
        </View>
      ) : (
        <>
          <ThemedScrollView
            style={{ flex: 0, maxHeight: windowHeight * 0.72 }}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {typeMeta ? (
              <ChoicePreviewCard
                label={typeMeta.label}
                icon={typeMeta.icon}
                onPress={() => setStep(0)}
              />
            ) : null}

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
              <CountryField
                label="Country"
                value={destinationCountry}
                onChange={(name) => {
                  setDestinationCountry(name);
                  clearField('destinationCountry');
                  if (!destinationCity) return;
                  void cityBelongsToCountry(destinationCity, name).then((ok) => {
                    if (!ok) {
                      setDestinationCity('');
                      clearField('destinationCity');
                    }
                  });
                }}
                placeholder="Select country"
                error={errors.destinationCountry}
              />
              <CityField
                label="Destination city"
                value={destinationCity}
                country={destinationCountry}
                onChange={(name) => {
                  setDestinationCity(name);
                  clearField('destinationCity');
                }}
                placeholder="Select city"
                sheetTitle="Destination city"
                error={errors.destinationCity}
              />
              <MaskedInput
                label="Duration (days)"
                mode="custom"
                mask="999"
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

            <FormSection title="Budget">
              <CurrencyAmountField
                label="Total budget"
                value={budget}
                onChange={(next) => {
                  setBudget(next);
                  clearField('budget');
                }}
                error={errors.budget}
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

          <FormFooter
            title="Create trip"
            icon="add"
            onPress={handleSubmit}
            secondaryTitle="Back"
            onSecondaryPress={() => setStep(0)}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /** No flex:1 — required for formSheet fitToContents height measurement. */
  sheet: { gap: Spacing.sm },
  typeStep: {
    paddingHorizontal: Spacing.containerMargin,
    gap: Spacing.md,
  },
  content: {
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.md,
    gap: Spacing.lg,
  },
  notes: { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 },
});
