import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { Icon, type IconName } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { fetchServices } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { ServiceRecord } from '@/types';

type StatusFilter = 'all' | 'in_progress' | 'given' | 'completed' | 'overdue';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All Statuses' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'given', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'overdue', label: 'Overdue' },
];

function statusMeta(status: ServiceRecord['status']) {
  switch (status) {
    case 'in_progress':
      return { label: 'In Progress', icon: 'sync' as IconName, tone: 'warning' as const };
    case 'completed':
    case 'received_back':
      return { label: 'Completed', icon: 'check-circle' as IconName, tone: 'success' as const };
    case 'overdue':
      return { label: 'Overdue', icon: 'error-outline' as IconName, tone: 'error' as const };
    default:
      return { label: 'Pending', icon: 'schedule' as IconName, tone: 'neutral' as const };
  }
}

export default function ServicesListScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  const { data: services = [], refetch, isRefetching } = useQuery({
    queryKey: ['services', user?.uid],
    queryFn: () => fetchServices(user!.uid),
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    let list = services;
    if (filter !== 'all') {
      list = list.filter((s) =>
        filter === 'completed'
          ? s.status === 'completed' || s.status === 'received_back'
          : s.status === filter,
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.serviceType.toLowerCase().includes(q) ||
          s.providerContactId.toLowerCase().includes(q) ||
          s.gemId.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => b.dateGiven.toMillis() - a.dateGiven.toMillis());
  }, [services, filter, search]);

  const toneColor = (tone: 'warning' | 'success' | 'error' | 'neutral') =>
    tone === 'warning'
      ? colors.warningAmber
      : tone === 'success'
        ? colors.successEmerald
        : tone === 'error'
          ? colors.error
          : colors.onSurfaceVariant;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Service Records" />

      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={[styles.title, { color: colors.primary }]}>Service Records</Text>
            <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainerLow }]}>
              <Icon name="search" size={22} color={colors.outline} />
              <TextInput
                style={[styles.searchInput, { color: colors.onSurface }]}
                placeholder="Search gems, providers, or IDs..."
                placeholderTextColor={colors.outline}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}>
              {FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setFilter(f.id)}
                    style={[
                      styles.filterChip,
                      active
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.surfaceContainerHighest },
                    ]}>
                    {f.id === 'all' ? (
                      <Icon name="tune" size={16} color={active ? colors.onPrimary : colors.onSurfaceVariant} />
                    ) : null}
                    <Text
                      style={[
                        styles.filterText,
                        { color: active ? colors.onPrimary : colors.onSurfaceVariant },
                      ]}>
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No service records"
            subtitle="Send a gem to a cutter, heater, or lab to track it here."
          />
        }
        renderItem={({ item }) => {
          const meta = statusMeta(item.status);
          const tone = toneColor(meta.tone);
          return (
            <Pressable
              style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}
              onPress={() => router.push(`/(marketplace)/(tabs)/workspace/services/${item.id}`)}>
              <View style={[styles.thumb, { backgroundColor: colors.primaryMuted }]}>
                <Icon name="diamond" size={28} color={colors.primary} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <Text style={[styles.cardTitle, { color: colors.primary }]} numberOfLines={1}>
                    {item.serviceType.replace(/_/g, ' ')}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: tone + '1A' }]}>
                    <Icon name={meta.icon} size={14} color={tone} />
                    <Text style={[styles.statusText, { color: tone }]}>{meta.label}</Text>
                  </View>
                </View>
                <Text style={[styles.cardSub, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                  Gem: {item.gemId.slice(0, 8)}
                </Text>
                <View style={styles.cardMetaRow}>
                  <View style={styles.metaLeft}>
                    <Icon name="person" size={16} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.providerContactId.slice(0, 8)}
                    </Text>
                  </View>
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>
                    {formatDate(item.expectedReturnDate)}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      {/* FAB */}
      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/(marketplace)/(tabs)/workspace/services/add')}>
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
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  brand: { ...Typography.headlineMdMobile },
  brandSub: { ...Typography.labelMd, fontWeight: '400' },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  content: { padding: Spacing.containerMargin, paddingBottom: 100, gap: Spacing.gutterMd },
  listHeader: { gap: Spacing.gutterMd, marginBottom: Spacing.stackSm },
  title: { ...Typography.displayLg },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    height: 48,
  },
  searchInput: { flex: 1, ...Typography.bodyLg },
  filterRow: { flexDirection: 'row', gap: Spacing.stackSm, paddingVertical: 2 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  filterText: { ...Typography.labelMd },

  card: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  thumb: { width: 80, height: 80, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, minWidth: 0 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 8 },
  cardTitle: { ...Typography.headlineSm, flex: 1, textTransform: 'capitalize' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  statusText: { ...Typography.labelMd },
  cardSub: { ...Typography.bodyMd, marginBottom: 8 },
  cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 },
  metaText: { ...Typography.labelMd },

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
  },
});
