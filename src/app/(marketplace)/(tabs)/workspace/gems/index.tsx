import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { GEM_STATUS_FILTERS } from '@/constants/gem-options';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { filterGems } from '@/features/workspace/gem-utils';
import { fetchGems } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';
import type { GemStatus } from '@/types';

export default function GemsListScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ status?: string }>();
  const initialStatus = (params.status as GemStatus | undefined) ?? 'all';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<GemStatus | 'all'>(initialStatus);

  const { data: gems = [], refetch, isRefetching } = useQuery({
    queryKey: ['gems', user?.uid],
    queryFn: () => fetchGems(user!.uid),
    enabled: !!user,
  });

  const filtered = useMemo(
    () => filterGems(gems, { search, status: statusFilter, gemType: 'all' }),
    [gems, search, statusFilter],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top App Bar */}
      <View style={[styles.header, { backgroundColor: colors.surfaceGlass }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatarWrap, { borderColor: colors.outlineVariant + '4D' }]}>
            <Image 
              source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDtQQTftKfgdOMl3aaE0ZHInhg1CM0Zc-vmSFGylayhn1tnkuN9q0WIgrkAFNMGvyxRvyJsJf1WImAJK2VPzHaumHXppLuGDlHO9p1rWHsjl6Za0DooRsZxUhFlQjRbfpSGcYk2qa9NCzaivJP0iNU3lJ-4MUga215rAfgKYWTUxN-po3OIa7hfrVluHgLKjl8gQtJ17lQ70YAAC_tpmL7Ha7rMXCvPHEYlKgsMRPJngVON6G1Tomorzw' }} 
              style={styles.avatar} 
            />
          </View>
          <Text style={[styles.brandName, { color: colors.primary }]}>GemVault</Text>
        </View>
        <Pressable style={styles.bellBtn} onPress={() => router.push('/notifications')}>
          <Icon name="notifications-none" size={24} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>

      {/* Search & Filters Row */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainerLow }]}>
          <View style={{ marginLeft: 12 }}>
            <Icon name="search" size={20} color={colors.outline} />
          </View>
          <TextInput 
            style={[styles.searchInput, { color: colors.onSurface }]}
            placeholder="Search inventory..."
            placeholderTextColor={colors.outline}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <Pressable style={[styles.filterBtn, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant + '80' }]}>
          <Icon name="tune" size={20} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContent}>
        <Pressable
          style={[
            styles.chip,
            statusFilter === 'all' 
              ? { backgroundColor: colors.primary, borderColor: colors.primary }
              : { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant + '80' }
          ]}
          onPress={() => setStatusFilter('all')}
        >
          <Text style={[styles.chipText, { color: statusFilter === 'all' ? colors.onPrimary : colors.onSurfaceVariant }]}>All Gems</Text>
        </Pressable>
        {GEM_STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.value}
            style={[
              styles.chip,
              statusFilter === f.value 
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceVariant + '80' }
            ]}
            onPress={() => setStatusFilter(f.value)}
          >
            <Text style={[styles.chipText, { color: statusFilter === f.value ? colors.onPrimary : colors.onSurfaceVariant }]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Main Content - Inventory List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState
            title={gems.length ? 'No gems match' : 'No gems yet'}
            subtitle={gems.length ? 'Try clearing filters' : 'Add your first gem to start tracking'}
          />
        }
        renderItem={({ item }) => {
          let badgeColor = colors.successEmerald;
          let badgeText = 'Avail';
          if (item.status === 'with_cutter') { badgeColor = colors.warningAmber; badgeText = 'At Serv'; }
          if (item.status === 'on_ap') { badgeColor = colors.secondary; badgeText = 'On AP'; }
          if (item.status === 'sold') { badgeColor = colors.outline; badgeText = 'Sold'; }

          return (
            <Pressable 
              style={[styles.gemCard, { backgroundColor: colors.surfaceContainerLowest }]}
              onPress={() => router.push(`/(marketplace)/(tabs)/workspace/gems/${item.id}`)}
            >
              <View style={styles.gemThumbWrap}>
                <Image 
                  source={{ uri: item.photoUrls?.[0] || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDTVtc_WzmbWsboLA5KA5RICXUbZ47FjTCv0AoR6JOi0uJ_anHspCo3S0Y0wKDDlu5ZsX6dU9AFZC3DKm6LIiRLTYZvgOquxBuHcEoJFWA_aUE1P68X41-UXlaHl9uh7OFAsTD3PO5FqESTRM5TyeBtfUry_LCVlZe-nmthv_6o7AfdIUwwTBUOhmpjOAu1GTBuA37C8DzxwRJDlVyqbG2RqScO-lSsDFGHbgAVcJ757k8sRHgZI8dluw' }} 
                  style={styles.gemThumb} 
                />
                <View style={[styles.gemBadge, { backgroundColor: colors.surfaceGlass, borderColor: colors.surfaceVariant + '33' }]}>
                  <View style={[styles.badgeDot, { backgroundColor: badgeColor }]} />
                  <Text style={[styles.badgeText, { color: colors.onSurface }]}>{badgeText}</Text>
                </View>
              </View>
              <View style={styles.gemInfo}>
                <View>
                  <View style={styles.gemHeaderRow}>
                    <Text style={[styles.gemSku, { color: colors.outline }]}>{item.sku}</Text>
                    <Icon name="more-vert" size={18} color={colors.outline} />
                  </View>
                  <Text style={[styles.gemTitle, { color: colors.onSurface }]} numberOfLines={1}>{item.gemType.replace(/_/g, ' ')}</Text>
                  <Text style={[styles.gemSub, { color: colors.onSurfaceVariant }]}>{item.treatmentStatus || 'Natural'}</Text>
                </View>
                <View style={styles.gemFooterRow}>
                  <Text style={[styles.gemWeight, { color: colors.primary }]}>{item.currentWeight} ct</Text>
                  <View style={[styles.viewBtn, { borderColor: colors.surfaceVariant }]}>
                    <Icon name="visibility" size={16} color={colors.onSurfaceVariant} />
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Floating Action Button */}
      <Pressable 
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/(marketplace)/(tabs)/workspace/gems/add')}
      >
        <Icon name="add" size={28} color={colors.onPrimary} />
      </Pressable>
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
  avatarWrap: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 1 },
  avatar: { width: '100%', height: '100%' },
  brandName: { ...Typography.headlineMdMobile, letterSpacing: -0.5 },
  bellBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.stackMd },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: Radius.full, height: 44 },
  searchInput: { flex: 1, paddingHorizontal: 12, ...Typography.bodyMd },
  filterBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },

  filtersScroll: { maxHeight: 44, marginBottom: Spacing.stackMd },
  filtersContent: { paddingHorizontal: Spacing.containerMargin, gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  chipText: { ...Typography.labelMd },

  list: { padding: Spacing.containerMargin, gap: 16, paddingBottom: 100 },
  gemCard: {
    flexDirection: 'row',
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.05,
    shadowRadius: 30,
    elevation: 3,
  },
  gemThumbWrap: { width: 120, height: '100%', position: 'relative' },
  gemThumb: { width: '100%', height: '100%' },
  gemBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  
  gemInfo: { flex: 1, padding: 12, justifyContent: 'space-between' },
  gemHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  gemSku: { fontSize: 12, fontWeight: '500', letterSpacing: 0.5 },
  gemTitle: { ...Typography.headlineSm, textTransform: 'capitalize' },
  gemSub: { ...Typography.bodyMd, marginTop: 2 },
  
  gemFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  gemWeight: { fontSize: 16, fontWeight: '600' },
  viewBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 5,
    zIndex: 100,
  },
});
