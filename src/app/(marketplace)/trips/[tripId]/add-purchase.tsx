import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { CountryField } from '@/components/ui/country-field';
import {
  CurrencyAmountField,
  type CurrencyAmountValue,
} from '@/components/ui/currency-amount-field';
import { FormSection, ScreenInset } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { MaskedInput } from '@/components/ui/masked-input';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { GEM_TYPES } from '@/constants/gem-options';
import { createGemOnSourcingTrip } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { usePreferredCurrency } from '@/hooks/use-preferred-currency';
import { friendlyError } from '@/lib/errors';
import { addTripPurchaseSchema, parseForm } from '@/lib/validation/form-schemas';
import { replaceWithAnchor } from '@/navigation/tab-stack-nav';
import { useAuth } from '@/providers/auth-provider';
import { withLoading } from '@/providers/loading-provider';
import { useToast } from '@/providers/toast-provider';

export default function AddTripPurchaseScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const preferred = usePreferredCurrency();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [gemType, setGemType] = useState('blue_sapphire');
  const [originCountry, setOriginCountry] = useState('Sri Lanka');
  const [roughWeight, setRoughWeight] = useState('');
  const [acquisition, setAcquisition] = useState<CurrencyAmountValue>({
    amount: '',
    currency: preferred,
  });
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    if (!user || !tripId) return;
    const result = parseForm(addTripPurchaseSchema, {
      gemType,
      originCountry,
      roughWeight,
      acquisitionCost: acquisition.amount,
      notes: notes || undefined,
    });
    if (!result.success) {
      setErrors(result.errors);
      toast.error(Object.values(result.errors)[0]!);
      return;
    }
    setErrors({});

    try {
      await withLoading(async () => {
        const gemId = await createGemOnSourcingTrip(user.uid, tripId, {
          gemType: result.data.gemType,
          originCountry: result.data.originCountry,
          roughWeight: result.data.roughWeight,
          acquisitionCost: result.data.acquisitionCost,
          acquisitionCurrency: acquisition.currency,
          notes: result.data.notes ?? null,
        });
        await queryClient.invalidateQueries({ queryKey: ['trip-gems', tripId] });
        await queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
        await queryClient.invalidateQueries({ queryKey: ['trips'] });
        await queryClient.invalidateQueries({ queryKey: ['gems'] });
        toast.success('Gem purchased and linked to trip.');
        replaceWithAnchor(`/(marketplace)/(tabs)/workspace/gems/${gemId}` as never);
      }, 'Recording purchase…');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not record purchase.'));
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Buy Gem on Trip" closeIcon />

      <ThemedScrollView contentContainerStyle={styles.content}>
        <FormSection title="Gem type" padded={false}>
          <View style={styles.typeGrid}>
            {GEM_TYPES.map((t) => {
              const selected = gemType === t.value;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => setGemType(t.value)}
                  style={({ pressed }) => [
                    styles.typeChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.surfaceContainerLow,
                      borderColor: selected ? colors.primary : colors.outlineVariant,
                    },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <Text style={[styles.typeLabel, { color: selected ? colors.onPrimary : colors.onSurface }]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FormSection>

        <ScreenInset style={styles.fields}>
        <CountryField
          label="Origin country"
          value={originCountry}
          onChange={(name) => setOriginCountry(name)}
          sheetTitle="Origin"
        />
        <MaskedInput
          label="Rough weight (ct)"
          mode="weight"
          value={roughWeight}
          onChangeText={(v) => {
            setRoughWeight(v);
            setErrors((e) => {
              if (!e.roughWeight) return e;
              const next = { ...e };
              delete next.roughWeight;
              return next;
            });
          }}
          placeholder="0"
          leftIcon="scale"
          error={errors.roughWeight}
        />
        <CurrencyAmountField
          label="Purchase price"
          value={acquisition}
          onChange={(next) => {
            setAcquisition(next);
            setErrors((e) => {
              if (!e.acquisitionCost) return e;
              const nextErr = { ...e };
              delete nextErr.acquisitionCost;
              return nextErr;
            });
          }}
          error={errors.acquisitionCost}
        />
        <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Mine, dealer, lot…" multiline leftIcon="notes" />

        <Button title="Add to trip" icon="add" onPress={handleSubmit} />
        </ScreenInset>
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: Spacing.section, gap: Spacing.lg },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.lg,
  },
  typeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  typeLabel: { ...Typography.labelMd, fontWeight: '600' },
  fields: { gap: Spacing.lg },
});
