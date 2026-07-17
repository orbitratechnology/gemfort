import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { FormSection, ScreenInset } from '@/components/ui/form-section';
import { Icon } from '@/components/ui/icon';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { formatGemType } from '@/constants/gem-options';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { addGemsToSellingTrip, fetchGems, fetchTripGems } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatCurrency } from '@/lib/utils';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

const PARCEL_ELIGIBLE = new Set([
  'rough',
  'cut',
  'polished',
  'certified',
  'ready_for_sale',
  'listed',
  'heated',
]);

export default function AddGemsToTripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const { data: gems = [] } = useQuery({
    queryKey: ['gems', user?.uid],
    queryFn: () => fetchGems(user!.uid),
    enabled: !!user,
  });

  const { data: tripGems = [] } = useQuery({
    queryKey: ['trip-gems', tripId],
    queryFn: () => fetchTripGems(tripId!),
    enabled: !!tripId,
  });

  const onTripIds = useMemo(() => new Set(tripGems.map((tg) => tg.gemId)), [tripGems]);

  const available = useMemo(
    () =>
      gems.filter(
        (g) =>
          !onTripIds.has(g.id) &&
          g.status !== 'sold' &&
          g.status !== 'on_trip' &&
          g.status !== 'on_ap' &&
          (PARCEL_ELIGIBLE.has(g.status) || g.status === 'with_cutter' || g.status === 'with_polisher'),
      ),
    [gems, onTripIds],
  );

  function toggleGem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (!user || !tripId) return;
    if (selected.size === 0) {
      toast.error('Select at least one gem for the parcel.');
      return;
    }

    setLoading(true);
    try {
      await addGemsToSellingTrip(user.uid, tripId, [...selected]);
      await queryClient.invalidateQueries({ queryKey: ['trip-gems', tripId] });
      await queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      await queryClient.invalidateQueries({ queryKey: ['trips'] });
      await queryClient.invalidateQueries({ queryKey: ['gems'] });
      toast.success(`${selected.size} gem${selected.size === 1 ? '' : 's'} added to trip parcel.`);
      router.back();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not add gems to trip.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Add Gems to Parcel" />

      <ThemedScrollView contentContainerStyle={styles.content}>
        <ScreenInset>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Select inventory gems to take on your selling trip. They will be marked as on trip.
        </Text>
        </ScreenInset>

        {available.length === 0 ? (
          <FormSection>
          <View style={styles.empty}>
            <Icon name="inventory-2" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>No gems available</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              Gems already on AP, on another trip, or sold cannot be added.
            </Text>
          </View>
          </FormSection>
        ) : (
          available.map((g) => {
            const isSelected = selected.has(g.id);
            return (
              <ScreenInset key={g.id}>
              <Pressable
                onPress={() => toggleGem(g.id)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: isSelected ? colors.primaryContainer : colors.surfaceContainerLowest,
                    borderColor: isSelected ? colors.primary : colors.outlineVariant,
                  },
                  pressed && { opacity: 0.85 },
                ]}>
                <View style={[styles.check, { borderColor: isSelected ? colors.primary : colors.outline }]}>
                  {isSelected ? <Icon name="check" size={16} color={colors.primary} /> : null}
                </View>
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, { color: colors.onSurface }]}>
                    {g.sku ?? g.id.slice(0, 8)} · {formatGemType(g.gemType)}
                  </Text>
                  <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                    {g.currentWeight}ct · {formatCurrency(g.acquisitionCost)}
                  </Text>
                </View>
              </Pressable>
              </ScreenInset>
            );
          })
        )}

        {available.length > 0 ? (
          <ScreenInset>
          <Button
            title={selected.size > 0 ? `Add ${selected.size} gem${selected.size === 1 ? '' : 's'}` : 'Select gems'}
            loading={loading}
            disabled={selected.size === 0}
            onPress={handleSubmit}
          />
          </ScreenInset>
        ) : null}
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: Spacing.section, gap: Spacing.md },
  subtitle: { ...Typography.bodyMd, marginBottom: Spacing.sm },
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyTitle: { ...Typography.headlineMdMobile, fontWeight: '700' },
  emptySub: { ...Typography.bodySmall, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...Typography.labelMd, fontWeight: '600' },
  rowSub: { ...Typography.bodySmall },
});
