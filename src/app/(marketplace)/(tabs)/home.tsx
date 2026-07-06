import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet, FilterChipGroup } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { ThemedScrollView } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { GEM_TYPES, formatGemType } from '@/constants/gem-options';
import {
  demoAnnouncements,
  demoListings,
  fetchAnnouncements,
  fetchPublicListings,
  filterListings,
  type ListingFilters,
} from '@/features/marketplace/marketplace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/providers/toast-provider';

const QUICK_TYPES: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'blue_sapphire', label: 'Sapphires' },
  { id: 'ruby', label: 'Rubies' },
  { id: 'emerald', label: 'Emeralds' },
];

const SORT_OPTIONS: { id: NonNullable<ListingFilters['sort']>; label: string }[] = [
  { id: 'recent', label: 'Most Recent' },
  { id: 'price_low', label: 'Price: Low to High' },
  { id: 'price_high', label: 'Price: High to Low' },
];

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const toast = useToast();

  const [gemType, setGemType] = useState<string>('all');
  const [sort, setSort] = useState<NonNullable<ListingFilters['sort']>>('recent');
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftType, setDraftType] = useState('all');
  const [draftSort, setDraftSort] = useState<NonNullable<ListingFilters['sort']>>('recent');

  const { data: listings = [], isLoading: listingsLoading, refetch: refetchListings, isRefetching } =
    useQuery({
      queryKey: ['public-listings'],
      queryFn: async () => {
        if (!isFirebaseConfigured) return demoListings();
        try {
          const items = await fetchPublicListings();
          return items.length ? items : demoListings();
        } catch {
          return demoListings();
        }
      },
    });

  const { data: announcements, isLoading: annLoading, refetch: refetchAnn } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      if (!isFirebaseConfigured) return demoAnnouncements();
      try {
        return await fetchAnnouncements();
      } catch {
        return demoAnnouncements();
      }
    },
  });

  const featured = useMemo(
    () => filterListings(listings, { gemType, sort }),
    [listings, gemType, sort],
  );

  function openFilter() {
    setDraftType(gemType);
    setDraftSort(sort);
    setFilterOpen(true);
  }

  function applyFilter() {
    setGemType(draftType);
    setSort(draftSort);
    setFilterOpen(false);
  }

  function refetchAll() {
    refetchListings();
    refetchAnn();
  }

  const filterActive = gemType !== 'all' || sort !== 'recent';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* TopAppBar */}
      <View style={[styles.header]}>
        <View style={styles.headerLeft}>
          <Image
            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA-X6vr_nAk8qoULmgdTRF3ckIOQXCfTCbwr4B92vzBtw9Ofg3odSgX6B0axInW6uC6v0PSRWSm9cMoPSZhx7v1VAc6oKYURtmW8-qyIuQnSLqqzT_Rvp64BWKk66ChZjx5vplKG6VQLTrSH9u2gmjWt6Z7f2UQZCHJysYJiaV56zl-1bIHo6dXLkx_s3bnVsQ0tbYII8m2Cy-nl3hUbmSCIO87BG5CaCX7y5NTgsJIOKlKVBKAIGrIhQ' }}
            style={styles.avatar}
          />
          <View>
            <Text style={[styles.userRole, { color: colors.outline }]}>BUYER</Text>
            <View style={styles.brandRow}>
              <Text style={[styles.brandName, { color: colors.primary }]}>GemFort</Text>
              <Icon name="expand-more" size={18} color={colors.primary} />
            </View>
          </View>
        </View>
        <Pressable
          style={[styles.searchBtn, { backgroundColor: colors.surfaceContainer }]}
          onPress={() => router.push('/(marketplace)/(tabs)/directory')}>
          <Icon name="search" size={20} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>

      <ThemedScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetchAll} />}
      >
        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContent}>
          <Pressable
            onPress={openFilter}
            style={[
              styles.filterChip,
              styles.filterChipRow,
              filterActive
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
            ]}>
            <Icon name="tune" size={16} color={filterActive ? colors.onPrimary : colors.onSurface} />
            <Text style={[styles.filterText, { color: filterActive ? colors.onPrimary : colors.onSurface }]}>Filter</Text>
          </Pressable>
          {QUICK_TYPES.map((t) => {
            const active = gemType === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setGemType(t.id)}
                style={[
                  styles.filterChip,
                  active
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.surface, borderColor: colors.outlineVariant },
                ]}>
                <Text style={[styles.filterText, { color: active ? colors.onPrimary : colors.onSurface }]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Featured Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Featured Gems</Text>
          <Pressable onPress={() => router.push('/(marketplace)/(tabs)/directory')}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
          </Pressable>
        </View>

        {listingsLoading ? (
          <View style={styles.loadingWrap}><SkeletonList /></View>
        ) : featured.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.featuredScroll} contentContainerStyle={styles.featuredContent}>
            {featured.map((gem) => (
              <Pressable
                key={gem.id}
                style={[styles.gemCard, { backgroundColor: colors.surfaceContainerLowest }]}
                onPress={() => router.push(`/listing/${gem.shareableSlug}`)}>
                {gem.isCertified ? (
                  <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.badgeText, { color: colors.onSecondary }]}>Certified</Text>
                  </View>
                ) : null}
                <Pressable
                  style={[styles.favBtn, { backgroundColor: colors.surfaceGlass }]}
                  onPress={() => toast.success('Saved to favourites')}>
                  <Icon name="favorite-border" size={18} color={colors.onSurface} />
                </Pressable>
                {gem.photoUrls?.[0] ? (
                  <Image source={{ uri: gem.photoUrls[0] }} style={styles.gemImage} />
                ) : (
                  <View style={[styles.gemImage, styles.gemImagePlaceholder, { backgroundColor: colors.surfaceContainerHigh }]}>
                    <Icon name="diamond" size={40} color={colors.outlineVariant} />
                  </View>
                )}
                <View style={styles.gemInfo}>
                  <View style={styles.gemHeaderRow}>
                    <Text style={[styles.gemTitle, { color: colors.primary }]} numberOfLines={1}>{gem.title}</Text>
                    <Text style={[styles.gemPrice, { color: colors.primary }]}>
                      {gem.showPrice && gem.priceMin ? formatCurrency(gem.priceMin, gem.currency) : 'Inquire'}
                    </Text>
                  </View>
                  <View style={styles.gemOriginRow}>
                    <Icon name="location-on" size={16} color={colors.accent} />
                    <Text style={[styles.gemOrigin, { color: colors.textMuted }]} numberOfLines={1}>{gem.origin}</Text>
                  </View>
                  <View style={[styles.gemProps, { backgroundColor: colors.surface }]}>
                    <View style={styles.gemPropItem}>
                      <Icon name="scale" size={16} color={colors.onSurfaceVariant} />
                      <Text style={[styles.gemPropText, { color: colors.onSurfaceVariant }]}>{gem.caratWeight}ct</Text>
                    </View>
                    <View style={styles.gemPropItem}>
                      <Icon name="diamond" size={16} color={colors.onSurfaceVariant} />
                      <Text style={[styles.gemPropText, { color: colors.onSurfaceVariant }]}>{gem.shape || formatGemType(gem.gemType)}</Text>
                    </View>
                    <View style={styles.gemPropItem}>
                      <Icon name="water-drop" size={16} color={colors.onSurfaceVariant} />
                      <Text style={[styles.gemPropText, { color: colors.onSurfaceVariant }]}>{gem.treatmentStatus.replace(/_/g, ' ')}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyWrap}>
            <EmptyState
              title="No featured gems"
              subtitle={gemType === 'all' ? 'Check back soon for new listings.' : 'No gems match this filter.'}
            />
          </View>
        )}

        {/* Announcements Section */}
        <View style={[styles.sectionHeader, { marginTop: Spacing.sectionGap }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Nearby & Updates</Text>
        </View>

        {annLoading ? (
          <SkeletonList />
        ) : announcements?.length ? (
          announcements.map((item) => (
            <Card key={item.id} style={styles.announcementCard}>
              <Text style={[styles.cardType, { color: colors.accent }]}>
                {item.type === 'platform' ? 'Platform' : 'News'}
              </Text>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
              {item.content ? (
                <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{item.content}</Text>
              ) : null}
            </Card>
          ))
        ) : (
          <EmptyState title="No announcements yet" subtitle="Check back soon for marketplace news." />
        )}
      </ThemedScrollView>

      {/* Filter bottom sheet */}
      <BottomSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter Gems"
        footer={
          <>
            <Button title="Apply Filters" onPress={applyFilter} />
            <Button
              title="Reset"
              variant="ghost"
              onPress={() => {
                setDraftType('all');
                setDraftSort('recent');
              }}
            />
          </>
        }>
        <FilterChipGroup
          label="Gem Type"
          value={draftType}
          onChange={setDraftType}
          options={[{ id: 'all', label: 'All' }, ...GEM_TYPES.map((t) => ({ id: t.value, label: t.label }))]}
        />
        <FilterChipGroup
          label="Sort By"
          value={draftSort}
          onChange={setDraftSort}
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
    zIndex: 40,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  userRole: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  brandName: { ...Typography.headlineMdMobile },
  searchBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  content: { paddingBottom: 100 },

  filtersScroll: { paddingVertical: Spacing.stackMd },
  filtersContent: { paddingHorizontal: Spacing.containerMargin, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1 },
  filterChipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterText: { fontSize: 14, fontWeight: '500' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: Spacing.containerMargin, marginBottom: Spacing.stackMd, marginTop: Spacing.containerMargin },
  sectionTitle: { ...Typography.headlineSm },
  seeAll: { fontSize: 14, fontWeight: '500' },

  loadingWrap: { paddingHorizontal: Spacing.containerMargin },
  emptyWrap: { paddingHorizontal: Spacing.containerMargin },
  featuredScroll: { paddingBottom: 24 },
  featuredContent: { paddingHorizontal: Spacing.containerMargin, gap: 16 },
  gemCard: { width: 280, borderRadius: Radius.lg, overflow: 'hidden', shadowColor: '#00162C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 3 },
  gemImage: { width: '100%', height: 180 },
  gemImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, zIndex: 10 },
  badgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  favBtn: { position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  gemInfo: { padding: 16 },
  gemHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  gemTitle: { ...Typography.headlineMdMobile, flex: 1, marginRight: 8 },
  gemPrice: { fontWeight: 'bold', fontSize: 16 },
  gemOriginRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  gemOrigin: { fontSize: 14, flex: 1 },
  gemProps: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 8, borderRadius: Radius.sm },
  gemPropItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gemPropText: { fontSize: 14 },

  announcementCard: { marginHorizontal: Spacing.containerMargin, marginBottom: Spacing.stackMd },
  cardType: { ...Typography.caption, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  cardTitle: { ...Typography.h3 },
  cardBody: { ...Typography.body, marginTop: 4 },
});
