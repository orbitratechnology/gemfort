import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
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
import { gemPrimaryPhotoUrl } from '@/features/workspace/party-photo';
import { subscribeGems, subscribeTripGems } from '@/features/workspace/firestore-subscriptions';
import { addGemsToSellingTrip, fetchGems, fetchTripGems } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useFirestoreLiveQuery } from '@/hooks/use-firestore-live-query';
import { formatCurrency } from '@/lib/utils';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { withLoading } from '@/providers/loading-provider';
import { useToast } from '@/providers/toast-provider';

const PARCEL_ELIGIBLE = new Set([
  'rough',
  'cut',
  'polished',
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

  const { data: gems = [] } = useFirestoreLiveQuery({
    queryKey: ['gems', user?.uid],
    queryFn: () => fetchGems(user!.uid),
    subscribe: (onData, onError) => subscribeGems(user!.uid, onData, onError),
    enabled: !!user,
  });

  const { data: tripGems = [] } = useFirestoreLiveQuery({
    queryKey: ['trip-gems', tripId, user?.uid],
    queryFn: () => fetchTripGems(tripId!, user!.uid),
    subscribe: (onData, onError) =>
      subscribeTripGems(tripId!, user!.uid, onData, onError),
    enabled: !!tripId && !!user,
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

    try {
      await withLoading(async () => {
        await addGemsToSellingTrip(user.uid, tripId, [...selected]);
        await queryClient.invalidateQueries({ queryKey: ['trip-gems', tripId] });
        await queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
        await queryClient.invalidateQueries({ queryKey: ['trips'] });
        await queryClient.invalidateQueries({ queryKey: ['gems'] });
        toast.success(`${selected.size} gem${selected.size === 1 ? '' : 's'} added to trip parcel.`);
        router.back();
      }, 'Adding gems…');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not add gems to trip.'));
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Add Gems to Parcel" closeIcon />

      <ThemedScrollView contentContainerStyle={styles.content}>
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
            const photo = gemPrimaryPhotoUrl(g);
            return (
              <ScreenInset key={g.id}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => toggleGem(g.id)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: isSelected ? colors.primaryContainer : colors.surfaceContainerLowest,
                    borderColor: isSelected ? colors.primary : colors.outlineVariant,
                  },
                  pressed && { opacity: 0.85 },
                ]}>
                <View
                  style={[
                    styles.thumb,
                    {
                      backgroundColor: colors.surfaceContainerHigh,
                      borderColor: isSelected ? colors.primary : 'transparent',
                      borderWidth: isSelected ? 2 : 0,
                    },
                  ]}>
                  {photo ? (
                    <Image
                      source={{ uri: photo }}
                      style={styles.thumbImg}
                      contentFit="cover"
                      recyclingKey={photo}
                    />
                  ) : (
                    <Icon
                      name="diamond"
                      size={20}
                      color={isSelected ? colors.primary : colors.outlineVariant}
                    />
                  )}
                </View>
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, { color: colors.onSurface }]}>
                    {g.title?.trim() || g.sku || g.id.slice(0, 8)} · {formatGemType(g.gemType)}
                  </Text>
                  <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                    {g.currentWeight}ct · {formatCurrency(g.acquisitionCost)}
                  </Text>
                </View>
                <View style={[styles.check, { borderColor: isSelected ? colors.primary : colors.outline }]}>
                  {isSelected ? <Icon name="check" size={16} color={colors.primary} /> : null}
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
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: { width: '100%', height: '100%' },
  check: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { ...Typography.labelMd, fontWeight: '600' },
  rowSub: { ...Typography.bodySmall },
});
