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
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  demoBusinesses,
  fetchBusinesses,
  searchBusinesses,
} from '@/features/marketplace/marketplace-service';
import { isFirebaseConfigured } from '@/lib/firebase/config';

type Tab = 'sellers' | 'providers';
const PAGE_SIZE = 20;

export default function DirectoryScreen() {
  const { colors } = useAppTheme();
  const [tab, setTab] = useState<Tab>('sellers');
  const [search, setSearch] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['businesses', tab, verifiedOnly],
    queryFn: async () => {
      const filters = {
        businessType: tab === 'sellers' ? ('seller' as const) : ('provider' as const),
        verifiedOnly,
      };
      if (!isFirebaseConfigured) return demoBusinesses(filters);
      try {
        return await fetchBusinesses(filters);
      } catch {
        return demoBusinesses(filters);
      }
    },
  });

  const filtered = useMemo(() => searchBusinesses(search, data ?? []), [search, data]);
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const segments: { id: Tab; label: string }[] = [
    { id: 'sellers', label: 'Sellers' },
    { id: 'providers', label: 'Service Providers' },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Transparent header */}
      <View style={[styles.header, { backgroundColor: colors.surfaceGlass }]}>
        <Pressable
          onPress={() => router.push('/(marketplace)/(tabs)/profile')}
          style={[styles.avatar, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
          <Icon name="person" size={22} color={colors.onSurfaceVariant} />
        </Pressable>
        <Text style={[styles.brand, { color: colors.primary }]}>GemFort</Text>
        <Pressable
          onPress={() => router.push('/notifications')}
          style={styles.headerBtn}>
          <Icon name="notifications-none" size={24} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.primary }]}>Directory</Text>

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
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? colors.onPrimary : colors.onSurfaceVariant },
                  ]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Filter row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}>
          <View style={[styles.filterChip, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
            <Text style={[styles.filterText, { color: colors.textMain }]}>Location</Text>
            <Icon name="expand-more" size={16} color={colors.textMain} />
          </View>
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
            <Text style={[styles.filterText, { color: verifiedOnly ? colors.onPrimary : colors.textMain }]}>
              Verified
            </Text>
            <Icon name="verified" size={16} color={verifiedOnly ? colors.onPrimary : colors.textMain} />
          </Pressable>
          <View style={[styles.filterChip, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
            <Text style={[styles.filterText, { color: colors.textMain }]}>Rating</Text>
            <Icon name="expand-more" size={16} color={colors.textMain} />
          </View>
          <View style={[styles.filterIconBtn, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
            <Icon name="tune" size={20} color={colors.textMain} />
          </View>
        </ScrollView>

        {/* Grid */}
        <View style={styles.grid}>
          {isLoading ? (
            <SkeletonList />
          ) : filtered.length ? (
            <>
              {visible.map((b) => (
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
  filterIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  grid: { gap: Spacing.sectionGap, marginTop: Spacing.stackSm },
});
