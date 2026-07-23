import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet, FilterChipGroup } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { WorkspaceScreenBackdrop } from '@/components/workspace/workspace-screen-backdrop';
import { GEM_CARD_MAX_WIDTH, GemCard } from '@/components/workspace/gem-card';
import { GEM_STATUS_FILTERS, GEM_TYPES } from '@/constants/gem-options';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { canDeleteGem } from '@/features/workspace/delete-gates';
import { filterGems } from '@/features/workspace/gem-utils';
import { deleteGem, fetchGems } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import type { GemStatus } from '@/types';
import { router, useLocalSearchParams } from 'expo-router';

const GRID_GAP = Spacing.stackMd;
const CHIP_HEIGHT = 36;
const LIST_H_PAD = Spacing.containerMargin;

export default function GemsListScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ status?: string }>();
  const initialStatus = (params.status as GemStatus | undefined) ?? 'all';

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = useState<GemStatus | 'all'>(initialStatus);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<{ status: GemStatus | 'all'; type: string }>({
    status: initialStatus,
    type: 'all',
  });

  const { data: gems = [], refetch, isRefetching } = useQuery({
    queryKey: ['gems', user?.uid],
    queryFn: () => fetchGems(user!.uid),
    enabled: !!user,
  });

  const filtered = useMemo(
    () => filterGems(gems, { search: debouncedSearch, status: statusFilter, gemType: typeFilter }),
    [gems, debouncedSearch, statusFilter, typeFilter],
  );

  const cellMaxWidth = useMemo(() => {
    const contentWidth = windowWidth - LIST_H_PAD * 2;
    const half = (contentWidth - GRID_GAP) / 2;
    return Math.min(half, GEM_CARD_MAX_WIDTH);
  }, [windowWidth]);

  const hasActiveFilters = typeFilter !== 'all' || statusFilter !== 'all';

  function openFilter() {
    setDraft({ status: statusFilter, type: typeFilter });
    setFilterOpen(true);
  }

  function applyFilter() {
    setStatusFilter(draft.status);
    setTypeFilter(draft.type);
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
      <StackHeader title="My Gems" />

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

      <View style={styles.filtersWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}>
          {GEM_STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <Pressable
                key={f.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.chip,
                  active
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : {
                        backgroundColor: colors.surfaceContainerLowest,
                        borderColor: colors.outlineVariant,
                      },
                  pressed && { opacity: 0.9 },
                ]}
                onPress={() => setStatusFilter(f.value)}>
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? colors.onPrimary : colors.onSurfaceVariant },
                  ]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {hasActiveFilters ? (
        <View style={styles.resultMeta}>
          <Text style={[styles.resultCount, { color: colors.onSurfaceVariant }]}>
            {filtered.length} {filtered.length === 1 ? 'gem' : 'gems'}
          </Text>
          <Pressable
            onPress={() => {
              setStatusFilter('all');
              setTypeFilter('all');
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear filters">
            <Text style={[styles.clearFilters, { color: colors.primary }]}>Clear</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState
            icon="diamond"
            title={gems.length ? 'No gems match' : 'No gems yet'}
            subtitle={
              gems.length ? 'Try clearing filters or search' : 'Add your first gem to start tracking'
            }
          />
        }
        renderItem={({ item }) => (
          <View style={[styles.cell, { maxWidth: cellMaxWidth }]}>
            <GemCard
              gem={item}
              href={`/(marketplace)/(tabs)/workspace/gems/${item.id}`}
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
        onPress={() => router.push('/(marketplace)/(tabs)/workspace/gems/add')}>
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
              onPress={() => setDraft({ status: 'all', type: 'all' })}
            />
          </>
        }>
        <FilterChipGroup
          label="Status"
          value={draft.status}
          onChange={(v) => setDraft((d) => ({ ...d, status: v }))}
          options={GEM_STATUS_FILTERS.map((f) => ({ id: f.value, label: f.label }))}
        />
        <FilterChipGroup
          label="Gem Type"
          value={draft.type}
          onChange={(v) => setDraft((d) => ({ ...d, type: v }))}
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
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: LIST_H_PAD,
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

  filtersWrap: {
    height: CHIP_HEIGHT,
    marginBottom: Spacing.stackMd,
  },
  filtersContent: {
    paddingHorizontal: LIST_H_PAD,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    height: CHIP_HEIGHT,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    ...Typography.labelMd,
    lineHeight: 18,
    includeFontPadding: false,
  },

  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LIST_H_PAD,
    marginBottom: Spacing.stackSm,
  },
  resultCount: { ...Typography.labelMd },
  clearFilters: { ...Typography.labelMd, fontWeight: '600' },

  list: {
    paddingHorizontal: LIST_H_PAD,
    paddingBottom: 100,
    flexGrow: 1,
  },
  columnWrapper: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
    justifyContent: 'flex-start',
  },
  cell: {
    flex: 1,
    minWidth: 0,
    maxWidth: GEM_CARD_MAX_WIDTH,
    alignItems: 'center',
  },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.28)',
    zIndex: 100,
  },
});
