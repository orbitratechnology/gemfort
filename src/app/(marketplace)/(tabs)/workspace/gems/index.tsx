import { FlashList } from '@/components/ui/gesture-lists';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet, FilterChipGroup } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { WorkspaceScreenBackdrop } from '@/components/workspace/workspace-screen-backdrop';
import { GemCard } from '@/components/workspace/gem-card';
import { GEM_TYPES } from '@/constants/gem-options';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { canDeleteGem } from '@/features/workspace/delete-gates';
import { filterGems } from '@/features/workspace/gem-utils';
import { subscribeGems } from '@/features/workspace/firestore-subscriptions';
import { deleteGem, fetchGems } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useFirestoreLiveQuery } from '@/hooks/use-firestore-live-query';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useUnreadOffersByListingId } from '@/hooks/use-unread-listing-offers';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { router } from 'expo-router';

const GRID_GAP = Spacing.stackSm;

export default function GemsListScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftType, setDraftType] = useState('all');

  const { data: gems = [], refetch, isRefetching } = useFirestoreLiveQuery({
    queryKey: ['gems', user?.uid],
    queryFn: () => fetchGems(user!.uid),
    subscribe: (onData, onError) => subscribeGems(user!.uid, onData, onError),
    enabled: !!user,
  });

  const unreadByListing = useUnreadOffersByListingId();

  const filtered = useMemo(
    () =>
      filterGems(gems, {
        search: debouncedSearch,
        gemType: typeFilter,
      }),
    [gems, debouncedSearch, typeFilter],
  );

  const hasActiveFilters = typeFilter !== 'all';

  function openFilter() {
    setDraftType(typeFilter);
    setFilterOpen(true);
  }

  function applyFilter() {
    setTypeFilter(draftType);
    setFilterOpen(false);
  }

  async function handleDeleteGem(gemId: string) {
    if (!user) return;
    try {
      await deleteGem(gemId, user.uid);
      await queryClient.invalidateQueries({ queryKey: ['gems', user.uid] });
      toast.success('Gem deleted');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not delete gem.'));
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <WorkspaceScreenBackdrop kind="gems" />
      <StackHeader
        title="My Gems"
        right={
          <Pressable
            onPress={() =>
              router.push('/(marketplace)/(tabs)/workspace/gems/archive' as never)
            }
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Archived gems"
            style={({ pressed }) => [
              styles.headerIconBtn,
              {
                backgroundColor: colors.surfaceContainerLowest,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Icon name="archive" size={20} color={colors.onSurfaceVariant} />
          </Pressable>
        }
      />

      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainerLow }]}>
          <View style={styles.searchIcon}>
            <Icon name="search" size={20} color={colors.outline} />
          </View>
          <TextInput
            style={[styles.searchInput, { color: colors.onSurface }]}
            placeholder="Search SKU, type, origin..."
            placeholderTextColor={colors.outline}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            accessibilityLabel="Search inventory"
          />
        </View>
        <Pressable
          onPress={openFilter}
          accessibilityRole="button"
          accessibilityLabel="Open filters"
          style={({ pressed }) => [
            styles.filterBtn,
            typeFilter !== 'all'
              ? { backgroundColor: colors.primary, borderColor: colors.primary }
              : {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                },
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}>
          <Icon
            name="tune"
            size={20}
            color={typeFilter !== 'all' ? colors.onPrimary : colors.onSurfaceVariant}
          />
        </Pressable>
      </View>

      {hasActiveFilters ? (
        <View style={styles.resultMeta}>
          <Text style={[styles.resultCount, { color: colors.onSurfaceVariant }]}>
            {filtered.length} {filtered.length === 1 ? 'gem' : 'gems'}
          </Text>
          <Pressable
            onPress={() => setTypeFilter('all')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear filters">
            <Text style={[styles.clearFilters, { color: colors.primary }]}>Clear</Text>
          </Pressable>
        </View>
      ) : null}

      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        masonry
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState
            icon="diamond"
            title={gems.length ? 'No gems match' : 'No gems yet'}
            subtitle={
              gems.length
                ? 'Try clearing filters or search'
                : 'Add your first gem to start tracking'
            }
          />
        }
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <GemCard
              gem={item}
              href={`/(marketplace)/(tabs)/workspace/gems/${item.id}`}
              offerBadge={
                item.marketplaceListingId
                  ? (unreadByListing[item.marketplaceListingId] ?? 0)
                  : 0
              }
              onEdit={() =>
                router.push({
                  pathname: '/(marketplace)/gems/edit',
                  params: { gemId: item.id },
                } as never)
              }
              onDelete={
                canDeleteGem(item)
                  ? () => handleDeleteGem(item.id)
                  : undefined
              }
            />
          </View>
        )}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add gem"
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
        ]}
        onPress={() => router.push('/(marketplace)/gems/add')}>
        <Icon name="add" size={28} color={colors.onPrimary} />
      </Pressable>

      <BottomSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter Inventory"
        footer={
          <>
            <Button title="Apply Filters" icon="filter-list" onPress={applyFilter} />
            <Button
              title="Reset"
              variant="ghost"
              onPress={() => setDraftType('all')}
            />
          </>
        }>
        <FilterChipGroup
          label="Gem Type"
          value={draftType}
          onChange={setDraftType}
          options={[
            { id: 'all', label: 'All' },
            ...GEM_TYPES.map((t) => ({ id: t.value, label: t.label })),
          ]}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.stackMd,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    height: 44,
  },
  searchIcon: { marginLeft: 12 },
  searchInput: { flex: 1, paddingHorizontal: 12, ...Typography.bodyMd },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.stackSm,
  },
  resultCount: { ...Typography.caption },
  clearFilters: { ...Typography.labelMd, fontWeight: '700' },
  list: {
    // Half-gap here + cell pad = ~8px edge inset / inter-item gaps
    paddingHorizontal: GRID_GAP / 2,
    paddingBottom: 120,
  },
  cell: {
    padding: GRID_GAP / 2,
  },
  fab: {
    position: 'absolute',
    right: Spacing.containerMargin,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
  },
});
