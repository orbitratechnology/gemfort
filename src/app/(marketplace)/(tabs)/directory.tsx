import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BusinessCard } from '@/components/marketplace/business-card';
import { BottomSheet, FilterChipGroup } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  demoBusinesses,
  fetchBusinesses,
  searchBusinesses,
} from '@/features/marketplace/marketplace-service';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import type { Business } from '@/types';

type Tab = 'sellers' | 'providers';
type SortBy = 'featured' | 'rating' | 'name';
const PAGE_SIZE = 20;

const SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: 'featured', label: 'Featured' },
  { id: 'rating', label: 'Top Rated' },
  { id: 'name', label: 'Name (A–Z)' },
];

export default function DirectoryScreen() {
  const { colors } = useAppTheme();
  const [tab, setTab] = useState<Tab>('sellers');
  const [search, setSearch] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [city, setCity] = useState('all');
  const [sortBy, setSortBy] = useState<SortBy>('featured');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<{ verified: 'all' | 'verified'; city: string; sort: SortBy }>({
    verified: 'all',
    city: 'all',
    sort: 'featured',
  });

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['businesses', tab],
    queryFn: async () => {
      const filters = { businessType: tab === 'sellers' ? ('seller' as const) : ('provider' as const) };
      if (!isFirebaseConfigured) return demoBusinesses(filters);
      try {
        return await fetchBusinesses(filters);
      } catch {
        return demoBusinesses(filters);
      }
    },
  });

  const cities = useMemo(() => {
    const set = new Set((data ?? []).map((b) => b.city).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [data]);

  const filtered = useMemo(() => {
    let result = searchBusinesses(search, data ?? []);
    if (verifiedOnly) result = result.filter((b) => b.badges.isVerified);
    if (city !== 'all') result = result.filter((b) => b.city === city);
    const sorted = [...result];
    if (sortBy === 'rating') {
      sorted.sort((a, b) => b.badges.endorsementCount - a.badges.endorsementCount);
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => a.businessName.localeCompare(b.businessName));
    } else {
      sorted.sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
        return a.businessName.localeCompare(b.businessName);
      });
    }
    return sorted;
  }, [search, data, verifiedOnly, city, sortBy]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const segments: { id: Tab; label: string }[] = [
    { id: 'sellers', label: 'Sellers' },
    { id: 'providers', label: 'Service Providers' },
  ];

  function openFilter() {
    setDraft({ verified: verifiedOnly ? 'verified' : 'all', city, sort: sortBy });
    setFilterOpen(true);
  }

  function applyFilter() {
    setVerifiedOnly(draft.verified === 'verified');
    setCity(draft.city);
    setSortBy(draft.sort);
    setVisibleCount(PAGE_SIZE);
    setFilterOpen(false);
  }

  const activeCount = (verifiedOnly ? 1 : 0) + (city !== 'all' ? 1 : 0) + (sortBy !== 'featured' ? 1 : 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Directory" showBack={false} />

      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainerLow }]}>
          <Icon name="search" size={22} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textMain }]}
            placeholder="Search sellers, providers..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={(text) => {
              setSearch(text);
              setVisibleCount(PAGE_SIZE);
            }}
          />
        </View>

        {/* Segmented tabs */}
        <View style={[styles.segment, { backgroundColor: colors.surfaceContainerLow }]}>
          {segments.map((s) => {
            const active = tab === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => {
                  setTab(s.id);
                  setVisibleCount(PAGE_SIZE);
                }}
                style={[styles.segmentBtn, active && { backgroundColor: colors.primary }]}>
                <Text style={[styles.segmentText, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Filter row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Pressable
            onPress={openFilter}
            style={[
              styles.filterChip,
              activeCount > 0
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
            ]}>
            <Icon name="tune" size={16} color={activeCount > 0 ? colors.onPrimary : colors.textMain} />
            <Text style={[styles.filterText, { color: activeCount > 0 ? colors.onPrimary : colors.textMain }]}>
              Filters{activeCount > 0 ? ` (${activeCount})` : ''}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setVerifiedOnly((v) => !v);
              setVisibleCount(PAGE_SIZE);
            }}
            style={[
              styles.filterChip,
              verifiedOnly
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
            ]}>
            <Text style={[styles.filterText, { color: verifiedOnly ? colors.onPrimary : colors.textMain }]}>Verified</Text>
            <Icon name="verified" size={16} color={verifiedOnly ? colors.onPrimary : colors.textMain} />
          </Pressable>
          {city !== 'all' ? (
            <Pressable
              onPress={() => { setCity('all'); setVisibleCount(PAGE_SIZE); }}
              style={[styles.filterChip, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              <Icon name="location-on" size={16} color={colors.onPrimary} />
              <Text style={[styles.filterText, { color: colors.onPrimary }]}>{city}</Text>
              <Icon name="close" size={14} color={colors.onPrimary} />
            </Pressable>
          ) : null}
        </ScrollView>

        {/* Grid */}
        <View style={styles.grid}>
          {isLoading ? (
            <SkeletonList />
          ) : filtered.length ? (
            <>
              {visible.map((b: Business) => (
                <BusinessCard key={b.id} business={b} onPress={() => router.push(`/business/${b.id}`)} />
              ))}
              {visibleCount < filtered.length ? (
                <Button
                  title={`Load more (${filtered.length - visibleCount} remaining)`}
                  variant="secondary"
                  onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
                />
              ) : null}
            </>
          ) : (
            <EmptyState
              title={tab === 'providers' ? 'No service providers yet' : 'No businesses match'}
              subtitle={
                tab === 'providers'
                  ? 'Verified cutters and labs will appear here soon.'
                  : 'Try clearing filters'
              }
            />
          )}
        </View>
      </ScrollView>

      {/* Filter bottom sheet */}
      <BottomSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter Directory"
        footer={
          <>
            <Button title="Apply Filters" onPress={applyFilter} />
            <Button
              title="Reset"
              variant="ghost"
              onPress={() => setDraft({ verified: 'all', city: 'all', sort: 'featured' })}
            />
          </>
        }>
        <FilterChipGroup
          label="Verification"
          value={draft.verified}
          onChange={(v) => setDraft((d) => ({ ...d, verified: v }))}
          options={[
            { id: 'all', label: 'All' },
            { id: 'verified', label: 'Verified only' },
          ]}
        />
        <FilterChipGroup
          label="Location"
          value={draft.city}
          onChange={(v) => setDraft((d) => ({ ...d, city: v }))}
          options={cities.map((c) => ({ id: c, label: c === 'all' ? 'All cities' : c }))}
        />
        <FilterChipGroup
          label="Sort By"
          value={draft.sort}
          onChange={(v) => setDraft((d) => ({ ...d, sort: v }))}
          options={SORT_OPTIONS}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.stackMd,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { ...Typography.headlineMdMobile },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.containerMargin, paddingBottom: 100, gap: Spacing.gutterMd },
  title: { ...Typography.displayLg },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    height: 48,
  },
  searchInput: { flex: 1, ...Typography.bodyMd },
  segment: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    padding: 4,
    gap: 4,
  },
  segmentBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: Radius.full },
  segmentText: { ...Typography.labelMd },
  filterRow: { flexDirection: 'row', gap: Spacing.stackSm, paddingVertical: 4 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  filterText: { ...Typography.labelMd },
  grid: { gap: Spacing.sectionGap, marginTop: Spacing.stackSm },
});
