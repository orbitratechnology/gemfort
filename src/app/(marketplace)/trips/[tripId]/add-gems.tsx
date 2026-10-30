import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Accent, IconBubble } from '@/components/ui/detail-kit';
import { FormFooter } from '@/components/ui/form-footer';
import { FormSection } from '@/components/ui/form-section';
import { Icon } from '@/components/ui/icon';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { TripGemAvatar } from '@/components/workspace/trip-gems-sheet';
import { TripContextSummary } from '@/components/workspace/trip-money-cards';
import { formatGemType } from '@/constants/gem-options';
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design-tokens';
import { gemActionAvailability } from '@/features/workspace/gem-lifecycle';
import { subscribeGems, subscribeTripGems } from '@/features/workspace/firestore-subscriptions';
import { addGemsToSellingTrip, fetchGems, fetchTripGems } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useFirestoreLiveQuery } from '@/hooks/use-firestore-live-query';
import { usePendingAction } from '@/hooks/use-pending-action';
import { formatCurrency } from '@/lib/utils';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

export default function AddGemsToTripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
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
          gemActionAvailability(g).add_to_trip,
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

  const [submitting, handleSubmit] = usePendingAction(async () => {
    if (!user || !tripId) return;
    if (selected.size === 0) {
      toast.error('Select at least one gem for the parcel.');
      return;
    }

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
    }
  });

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <StackHeader
        title="Add Gems to Parcel"
        closeIcon
        image={require("@/assets/images/mygems-icon.png")}
      />

      <ThemedScrollView
        style={{ flex: 0, maxHeight: windowHeight * 0.72 }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <TripContextSummary tripId={tripId} />

        {available.length === 0 ? (
          <FormSection>
            <View style={styles.empty}>
              <IconBubble icon="inventory-2" accent={Accent.slate} size={52} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                No gems available
              </Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                Gems already on AP, on another trip, or sold cannot be added.
              </Text>
            </View>
          </FormSection>
        ) : (
          <FormSection
            title={selected.size > 0 ? `Parcel · ${selected.size} selected` : 'Parcel'}
            padded={false}
          >
            {available.map((g, i) => {
              const isSelected = selected.has(g.id);
              return (
                <Pressable
                  key={g.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${g.title?.trim() || formatGemType(g.gemType)}, ${g.currentWeight} carat`}
                  onPress={() => toggleGem(g.id)}
                  style={({ pressed }) => [
                    styles.row,
                    isSelected && { backgroundColor: `${colors.primary}0F` },
                    pressed && styles.pressed,
                  ]}>
                  <TripGemAvatar gem={g} selected={isSelected} size={48} />
                  <View
                    style={[
                      styles.rowBody,
                      i < available.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.outlineVariant,
                      },
                    ]}>
                    <View style={styles.rowCopy}>
                      <Text
                        style={[styles.rowTitle, { color: colors.onSurface }]}
                        numberOfLines={1}>
                        {g.title?.trim() || g.sku || g.id.slice(0, 8)}
                      </Text>
                      <Text
                        style={[styles.rowSub, { color: colors.onSurfaceVariant }]}
                        numberOfLines={1}>
                        {formatGemType(g.gemType)} · {g.currentWeight} ct ·{' '}
                        {formatCurrency(g.acquisitionCost)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.check,
                        isSelected
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { borderColor: colors.outline },
                      ]}>
                      {isSelected ? (
                        <Icon name="check" size={16} color={colors.onPrimary} />
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </FormSection>
        )}
      </ThemedScrollView>

      {available.length > 0 ? (
        <FormFooter
          title={
            selected.size > 0
              ? `Add ${selected.size} gem${selected.size === 1 ? '' : 's'}`
              : 'Select gems'
          }
          icon="add"
          disabled={selected.size === 0}
          loading={submitting}
          onPress={handleSubmit}
        />
      ) : null}
    </View>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  /** No flex:1 — required for formSheet fitToContents height measurement. */
  sheet: { gap: Spacing.sm },
  content: {
    paddingTop: Spacing.stackSm,
    paddingBottom: Spacing.md,
    gap: Spacing.lg,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  emptyTitle: { ...text, fontFamily: FontFamily.semibold, fontSize: 17, marginTop: Spacing.xs },
  emptySub: { ...text, ...Typography.bodySmall, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: Spacing.containerMargin,
  },
  pressed: { opacity: 0.85 },
  rowBody: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 72,
    paddingVertical: 12,
    paddingRight: Spacing.containerMargin,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 21 },
  rowSub: { ...text, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
  check: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
