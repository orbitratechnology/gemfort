import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Platform, Pressable, RefreshControl, StyleSheet, Text, View, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { ThemedScrollView } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { demoAnnouncements, fetchAnnouncements } from '@/features/marketplace/marketplace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { useAuth } from '@/providers/auth-provider';

const FILTERS = ['All', 'Sapphires', 'Rubies', 'Emeralds', 'Verified Only'];

const FEATURED_GEMS = [
  {
    id: '1',
    title: 'Natural Blue Sapphire',
    price: '$2300',
    origin: 'Ceylon, Sri Lanka',
    weight: '2.4ct',
    cut: 'Oval',
    treatment: 'Unheated',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC_7OK_3UypEsNQwZgFXed6mI302725BO5QYFtofpbY8PzSm0dEMgGn54C6ym8vcSee6QXTw0g8Z6QU8_OBltA7gLcCeJ4kKFCFOupuVgLA93mmVDwqpxn7RHgD51EFt_nfNONxJ8W0mD2MXxTTSfbepmKUi2HN1p34G4HIfEVddJGuuYIVj0dS-jRlotHtTEWA3B8HbOXVkWB3z1_VpTgc_qNslfs4GY3HmzQHKipxkV3v8LwmE2pD-1wjEXnKy-yn5iw',
    badge: 'New Price',
    badgeColor: 'secondary',
  },
  {
    id: '2',
    title: 'Pigeon Blood Ruby',
    price: '$5500',
    origin: 'Mogok, Myanmar',
    weight: '1.8ct',
    cut: 'Cushion',
    treatment: 'Heated',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnxTKk7Lh3v8VRIiVT16UI-WibWqYAYWYptNYrqza3yY8wTHL_v-2aw6XRG4BZHj3R-uVySUjExAGUwSOcA7QO1tFoxcJToAb-1tZh-DxfSuLUud96jxa3xaKZnzxWGxox981P5jRQ6kUIr7f10n7mpdN3aPRZ1WGiM9W6b8gxlblPu9qP5lkdoTlhcI-Yr6M7HR-QCb8-58Fs9emGEYkKhvx0oSDCOppcYSq_yRMooh1CXQ45fIUC8g',
    badge: 'Pro',
    badgeColor: 'warningAmber',
  }
];

export default function HomeScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  
  const { data, isLoading, refetch, isRefetching } = useQuery({
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* TopAppBar */}
      <View style={[styles.header, { backgroundColor: colors.surfaceGlass }]}>
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
        <Pressable style={[styles.searchBtn, { backgroundColor: colors.surfaceContainer }]}>
          <Icon name="search" size={20} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>

      <ThemedScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContent}>
          <Pressable style={[styles.filterChip, styles.filterChipRow, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
            <Icon name="tune" size={16} color={colors.onSurface} />
            <Text style={[styles.filterText, { color: colors.onSurface }]}>Filter</Text>
          </Pressable>
          {FILTERS.map((f, i) => (
            <Pressable 
              key={f} 
              style={[
                styles.filterChip, 
                i === 0 
                  ? { backgroundColor: colors.primary, borderColor: colors.primary } 
                  : { backgroundColor: colors.surface, borderColor: colors.outlineVariant }
              ]}
            >
              <Text style={[
                styles.filterText, 
                i === 0 ? { color: colors.onPrimary } : { color: colors.onSurface }
              ]}>
                {f}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Featured Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Featured Gems</Text>
          <Pressable><Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text></Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.featuredScroll} contentContainerStyle={styles.featuredContent}>
          {FEATURED_GEMS.map(gem => (
            <View key={gem.id} style={[styles.gemCard, { backgroundColor: colors.surfaceContainerLowest }]}>
              <View style={[styles.badge, { backgroundColor: gem.badgeColor === 'secondary' ? colors.accent : colors.warningAmber }]}>
                <Text style={[styles.badgeText, { color: gem.badgeColor === 'secondary' ? colors.onSecondary : colors.onPrimary }]}>{gem.badge}</Text>
              </View>
              <Pressable style={[styles.favBtn, { backgroundColor: colors.surfaceGlass }]}>
                <Icon name="favorite-border" size={18} color={colors.onSurface} />
              </Pressable>
              <Image source={{ uri: gem.image }} style={styles.gemImage} />
              <View style={styles.gemInfo}>
                <View style={styles.gemHeaderRow}>
                  <Text style={[styles.gemTitle, { color: colors.primary }]} numberOfLines={1}>{gem.title}</Text>
                  <Text style={[styles.gemPrice, { color: colors.primary }]}>{gem.price}<Text style={{ fontSize: 12, fontWeight: 'normal', color: colors.textMuted }}>/ct</Text></Text>
                </View>
                <View style={styles.gemOriginRow}>
                  <Icon name="verified" size={16} color={colors.accent} />
                  <Text style={[styles.gemOrigin, { color: colors.textMuted }]}>{gem.origin}</Text>
                </View>
                <View style={[styles.gemProps, { backgroundColor: colors.surface }]}>
                  <View style={styles.gemPropItem}>
                    <Icon name="scale" size={16} color={colors.onSurfaceVariant} />
                    <Text style={[styles.gemPropText, { color: colors.onSurfaceVariant }]}>{gem.weight}</Text>
                  </View>
                  <View style={styles.gemPropItem}>
                    <Icon name="diamond" size={16} color={colors.onSurfaceVariant} />
                    <Text style={[styles.gemPropText, { color: colors.onSurfaceVariant }]}>{gem.cut}</Text>
                  </View>
                  <View style={styles.gemPropItem}>
                    <Icon name="water-drop" size={16} color={colors.onSurfaceVariant} />
                    <Text style={[styles.gemPropText, { color: colors.onSurfaceVariant }]}>{gem.treatment}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Announcements Section */}
        <View style={[styles.sectionHeader, { marginTop: Spacing.sectionGap }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Nearby & Updates</Text>
        </View>

        {isLoading ? (
          <SkeletonList />
        ) : data?.length ? (
          data.map((item) => (
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

  featuredScroll: { paddingBottom: 24 },
  featuredContent: { paddingHorizontal: Spacing.containerMargin, gap: 16 },
  gemCard: { width: 280, borderRadius: Radius.lg, overflow: 'hidden', shadowColor: '#00162C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 3 },
  gemImage: { width: '100%', height: 180 },
  badge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, zIndex: 10 },
  badgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  favBtn: { position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  gemInfo: { padding: 16 },
  gemHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  gemTitle: { ...Typography.headlineMdMobile, flex: 1, marginRight: 8 },
  gemPrice: { fontWeight: 'bold', fontSize: 16 },
  gemOriginRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  gemOrigin: { fontSize: 14 },
  gemProps: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 8, borderRadius: Radius.sm },
  gemPropItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gemPropText: { fontSize: 14 },

  announcementCard: { marginHorizontal: Spacing.containerMargin, marginBottom: Spacing.stackMd },
  cardType: { ...Typography.caption, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  cardTitle: { ...Typography.h3 },
  cardBody: { ...Typography.body, marginTop: 4 },
});
