import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { GEM_TYPES } from '@/constants/gem-options';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { createGemOnSourcingTrip } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

export default function AddTripPurchaseScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [gemType, setGemType] = useState('blue_sapphire');
  const [originCountry, setOriginCountry] = useState('Sri Lanka');
  const [roughWeight, setRoughWeight] = useState('');
  const [acquisitionCost, setAcquisitionCost] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!user || !tripId) return;
    const weight = parseFloat(roughWeight);
    const cost = parseFloat(acquisitionCost);
    if (!weight || weight <= 0 || !cost || cost <= 0) {
      toast.error('Enter valid weight and purchase price.');
      return;
    }

    setLoading(true);
    try {
      const gemId = await createGemOnSourcingTrip(user.uid, tripId, {
        gemType,
        originCountry: originCountry.trim() || 'Unknown',
        roughWeight: weight,
        acquisitionCost: cost,
        notes: notes || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['trip-gems', tripId] });
      await queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      await queryClient.invalidateQueries({ queryKey: ['trips'] });
      await queryClient.invalidateQueries({ queryKey: ['gems'] });
      toast.success('Gem purchased and linked to trip.');
      router.replace(`/(marketplace)/(tabs)/workspace/gems/${gemId}` as never);
    } catch (e) {
      toast.error(friendlyError(e, 'Could not record purchase.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Buy Gem on Trip" />

      <ThemedScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Quick-add a rough purchase at the mine or market. Overhead can be distributed later.
        </Text>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>GEM TYPE</Text>
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
        </View>

        <Input label="Origin country" value={originCountry} onChangeText={setOriginCountry} leftIcon="public" />
        <Input
          label="Rough weight (ct)"
          value={roughWeight}
          onChangeText={setRoughWeight}
          keyboardType="decimal-pad"
          placeholder="0.00"
          leftIcon="scale"
        />
        <Input
          label="Purchase price (LKR)"
          value={acquisitionCost}
          onChangeText={setAcquisitionCost}
          keyboardType="decimal-pad"
          placeholder="0.00"
          leftIcon="payments"
        />
        <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Mine, dealer, lot…" multiline leftIcon="notes" />

        <Button title="Add to trip" icon="add" loading={loading} onPress={handleSubmit} />
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.section, gap: Spacing.lg },
  subtitle: { ...Typography.bodyMd },
  section: { gap: Spacing.sm },
  sectionLabel: { ...Typography.labelMd, letterSpacing: 0.8 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  typeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  typeLabel: { ...Typography.labelMd, fontWeight: '600' },
});
