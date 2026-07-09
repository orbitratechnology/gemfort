import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingCard } from '@/components/marketplace/listing-card';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { ProductGrid } from '@/components/ui/product-grid';
import { ThemedScrollView } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  demoAnnouncements,
  demoListings,
  fetchAnnouncements,
  fetchPublicListings,
  filterListings,
} from '@/features/marketplace/marketplace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { isFirebaseConfigured } from '@/lib/firebase/config';

const FEATURED_LIMIT = 10;

export default function HomeScreen() {
  const { colors } = useAppTheme();

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
    () => filterListings(listings, { sort: 'recent' }).slice(0, FEATURED_LIMIT),
    [listings],
  );

  function refetchAll() {
    refetchListings();
    refetchAnn();
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={{
              uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA-X6vr_nAk8qoULmgdTRF3ckIOQXCfTCbwr4B92vzBtw9Ofg3odSgX6B0axInW6uC6v0PSRWSm9cMoPSZhx7v1VAc6oKYURtmW8-qyIuQnSLqqzT_Rvp64BWKk66ChZjx5vplKG6VQLTrSH9u2gmjWt6Z7f2UQZCHJysYJiaV56zl-1bIHo6dXLkx_s3bnVsQ0tbYII8m2Cy-nl3hUbmSCIO87BG5CaCX7y5NTgsJIOKlKVBKAIGrIhQ',
            }}
            style={styles.avatar}
          />
          <View>
            <Text style={[styles.userRole, { color: colors.textMuted }]}>DISCOVER</Text>
            <Text style={[styles.brandName, { color: colors.primary }]}>GemFort</Text>
          </View>
        </View>
        <Pressable
          style={[styles.iconBtn, { backgroundColor: colors.surfaceContainer }]}
          onPress={() => router.push('/notifications')}>
          <Icon name="notifications-none" size={20} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>

      <ThemedScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetchAll} />}>
        <Pressable
          style={[
            styles.searchBar,
            { backgroundColor: colors.surfaceContainerLow, borderColor: colors.surfaceVariant },
          ]}
          onPress={() => router.push('/(marketplace)/(tabs)/directory')}>
          <Icon name="search" size={20} color={colors.textMuted} />
          <Text style={[styles.searchText, { color: colors.textMuted }]}>
            Search gems, sellers, origins…
          </Text>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Featured Gems</Text>
          <Pressable onPress={() => router.push('/(marketplace)/(tabs)/directory')}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
          </Pressable>
        </View>

        {listingsLoading ? (
          <View style={styles.loadingWrap}>
            <SkeletonList />
          </View>
        ) : featured.length ? (
          <View style={styles.featuredGrid}>
            <ProductGrid>
              {featured.map((gem) => (
                <ListingCard
                  key={gem.id}
                  listing={gem}
                  onPress={() => router.push(`/listing/${gem.shareableSlug}`)}
                />
              ))}
            </ProductGrid>
          </View>
        ) : (
          <View style={styles.emptyWrap}>
            <EmptyState icon="diamond" title="No featured gems" subtitle="Check back soon for new listings." />
          </View>
        )}

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
          <EmptyState icon="campaign" title="No announcements yet" subtitle="Check back soon for marketplace news." />
        )}
      </ThemedScrollView>
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
  userRole: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.2 },
  brandName: { ...Typography.headlineMdMobile },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  content: { paddingBottom: 100 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: Spacing.containerMargin,
    marginTop: Spacing.stackSm,
    marginBottom: Spacing.stackMd,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  searchText: { ...Typography.bodyMd },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.containerMargin,
    marginBottom: Spacing.stackMd,
    marginTop: Spacing.containerMargin,
  },
  sectionTitle: { ...Typography.headlineSm },
  seeAll: { fontSize: 14, fontWeight: '500' },

  loadingWrap: { paddingHorizontal: Spacing.containerMargin },
  emptyWrap: { paddingHorizontal: Spacing.containerMargin },
  featuredGrid: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 24,
  },

  announcementCard: { marginHorizontal: Spacing.containerMargin, marginBottom: Spacing.stackMd },
  cardType: { ...Typography.caption, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  cardTitle: { ...Typography.h3 },
  cardBody: { ...Typography.body, marginTop: 4 },
});
