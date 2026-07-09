import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { ThemedScrollView } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { formatGemType } from '@/constants/gem-options';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  type ApFilterTab,
  filterApRecords,
  findGemForAp,
  getApSummary,
  groupApByHolder,
  isApOverdue,
} from '@/features/workspace/ap-utils';
import { fetchApRecords, fetchContacts, fetchGems } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatCurrency, formatDate, openPhone } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

export default function ApListScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();

  const { data: records = [], refetch, isRefetching } = useQuery({
    queryKey: ['ap', user?.uid],
    queryFn: () => fetchApRecords(user!.uid),
    enabled: !!user,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: !!user,
  });

  const { data: gems = [] } = useQuery({
    queryKey: ['gems', user?.uid],
    queryFn: () => fetchGems(user!.uid),
    enabled: !!user,
  });

  const summary = useMemo(() => getApSummary(records), [records]);
  const groups = useMemo(
    () => groupApByHolder(records, contacts),
    [records, contacts],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="AP Stones" />

      <ThemedScrollView contentContainerStyle={styles.content}>
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: colors.primary }]}>AP Stones</Text>
          <Text style={[styles.pageSubtitle, { color: colors.textMuted }]}>Currently out on approval.</Text>
        </View>

        {/* Summary Stats (Bento style) */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={styles.statHeader}>
              <Icon name="diamond" size={20} color={colors.textMuted} />
              <View style={[styles.statBadge, { backgroundColor: colors.primary + '1A' }]}>
                <Text style={[styles.statBadgeText, { color: colors.primary }]}>Total Stones</Text>
              </View>
            </View>
            <View>
              <Text style={[styles.statValue, { color: colors.primary }]}>{summary.totalOut}</Text>
              <Text style={[styles.statSub, { color: colors.textMuted }]}>Across {groups.length} contacts</Text>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.primary }]}>
            <View style={styles.statHeader}>
              <Icon name="account-balance-wallet" size={20} color={colors.onPrimary + 'B3'} />
              <View style={[styles.statBadge, { backgroundColor: colors.white + '33' }]}>
                <Text style={[styles.statBadgeText, { color: colors.onPrimary }]}>Total Value</Text>
              </View>
            </View>
            <View>
              <Text style={[styles.statValue, { color: colors.onPrimary }]}>{formatCurrency(summary.totalValue)}</Text>
              <Text style={[styles.statSub, { color: colors.onPrimary + 'B3' }]}>Estimated market</Text>
            </View>
          </View>
        </View>

        <FlatList
          data={groups}
          keyExtractor={(group) => group.holderId}
          scrollEnabled={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="handshake"
              title="No AP stones"
              subtitle="Give a gem on AP to track it here"
              action={<Button title="Give on AP" icon="add" onPress={() => router.push('/(marketplace)/(tabs)/workspace/ap/add')} />}
            />
          }
          renderItem={({ item: group }) => (
            <View style={styles.groupSection}>
              {/* Contact Header */}
              <View style={[styles.contactHeader, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant + '33' }]}>
                <View style={styles.contactLeft}>
                  <View style={[styles.contactAvatar, { backgroundColor: colors.surfaceContainer }]}>
                    <Text style={[styles.contactInitials, { color: colors.primary }]}>
                      {group.holderName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.contactName, { color: colors.primary }]}>{group.holderName}</Text>
                    <Text style={[styles.contactMeta, { color: colors.textMuted }]}>
                      {group.records.length} gem{group.records.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>
                <View style={styles.contactRight}>
                  <Text style={[styles.contactValue, { color: colors.primary }]}>{formatCurrency(group.totalMinimumValue)}</Text>
                  {group.overdueCount > 0 && (
                    <View style={styles.overdueRow}>
                      <Icon name="warning" size={14} color={colors.error} />
                      <Text style={[styles.overdueText, { color: colors.error }]}>Overdue</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Stones List */}
              <View style={styles.stonesGrid}>
                {group.records.map((record) => {
                  const gem = findGemForAp(gems, record.gemId);
                  const overdue = isApOverdue(record);
                  return (
                    <Pressable
                      key={record.id}
                      style={[
                        styles.stoneCard, 
                        { backgroundColor: colors.surfaceContainerLowest, borderColor: overdue ? colors.error + '4D' : colors.outlineVariant + '1A' }
                      ]}
                      onPress={() => router.push(`/(marketplace)/(tabs)/workspace/ap/${record.id}`)}>
                      {overdue && <View style={[styles.overdueStrip, { backgroundColor: colors.error }]} />}
                      <View style={styles.stoneRow}>
                        <View style={[styles.stoneThumbWrap, { backgroundColor: colors.surfaceContainer }]}>
                          <Image 
                            source={{ uri: gem?.photoUrls?.[0] || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbzZNGiaJrIrVkt-IB2KExcNRyOhcrVx65zdHmegr_srJUaA4YGkkS6LjBed8QjFXUcdZtNm7m8VegyOxjgPkfqQdu-3Rur_s92xUXDgDYhiR7a4UHkwEY8MmPD4c9ua435frb5Qme6Ixgtp2mUNLTwbtWrw9BJwm2Z_6kFITbBdWp3w8NMMdnE2eBeS_vu5DK80_DnrAryWVOYGCxl-LsWMYl65Hue5wEC_6yZSyoT2tQVr04JIv3Hg' }} 
                            style={styles.stoneThumb} 
                          />
                        </View>
                        <View style={styles.stoneInfo}>
                          <View>
                            <View style={styles.stoneHeaderRow}>
                              <Text style={[styles.stoneTitle, { color: colors.primary }]} numberOfLines={1}>
                                {gem ? formatGemType(gem.gemType) : 'Gem'}
                              </Text>
                              <View style={[styles.stoneBadge, { backgroundColor: colors.surfaceContainer }]}>
                                <Text style={[styles.stoneBadgeText, { color: colors.textMuted }]}>#{record.id.slice(0,4)}</Text>
                              </View>
                            </View>
                            <Text style={[styles.stoneDesc, { color: colors.textMuted }]}>
                              {gem ? `${gem.currentWeight} ct • ${gem.originCountry || 'Unknown'}` : record.gemId}
                            </Text>
                          </View>
                          <View style={styles.stoneFooterRow}>
                            <Text style={[styles.stonePrice, { color: colors.primary }]}>{formatCurrency(record.ownerMinimumPrice)}</Text>
                            <View style={styles.timeRow}>
                              <Icon name="schedule" size={14} color={overdue ? colors.error : colors.warningAmber} />
                              <Text style={[styles.timeText, { color: overdue ? colors.error : colors.warningAmber }]}>
                                {overdue ? 'Overdue' : formatDate(record.expectedReturnDate)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        />
      </ThemedScrollView>
      
      {/* Floating Action Button */}
      <Pressable 
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/(marketplace)/(tabs)/workspace/ap/add')}
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
  
  content: { padding: Spacing.containerMargin, gap: Spacing.sectionGap, paddingBottom: 100 },
  
  pageHeader: { gap: 4 },
  pageTitle: { ...Typography.headlineSm },
  pageSubtitle: { ...Typography.bodyMd },

  statsGrid: { flexDirection: 'row', gap: Spacing.gutterMd },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    justifyContent: 'space-between',
    height: 140,
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.05,
    shadowRadius: 30,
    elevation: 3,
  },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  statBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  statBadgeText: { ...Typography.labelMd },
  statValue: { ...Typography.displayLg, marginBottom: 2 },
  statSub: { ...Typography.bodyMd },

  list: { gap: Spacing.sectionGap },
  groupSection: { gap: Spacing.stackMd },
  
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  contactLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contactAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  contactInitials: { ...Typography.headlineSm },
  contactName: { ...Typography.headlineSm, lineHeight: 24 },
  contactMeta: { ...Typography.labelMd, marginTop: 4 },
  contactRight: { alignItems: 'flex-end' },
  contactValue: { ...Typography.headlineSm },
  overdueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  overdueText: { ...Typography.labelMd },

  stonesGrid: { gap: Spacing.gutterMd },
  stoneCard: {
    padding: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.05,
    shadowRadius: 30,
    elevation: 3,
  },
  overdueStrip: { position: 'absolute', top: 0, right: 0, width: 4, height: '100%', zIndex: 10 },
  stoneRow: { flexDirection: 'row', gap: 16 },
  stoneThumbWrap: { width: 80, height: 80, borderRadius: Radius.md, overflow: 'hidden' },
  stoneThumb: { width: '100%', height: '100%' },
  stoneInfo: { flex: 1, justifyContent: 'space-between' },
  stoneHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  stoneTitle: { ...Typography.headlineMdMobile, flex: 1 },
  stoneBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm },
  stoneBadgeText: { ...Typography.labelMd },
  stoneDesc: { ...Typography.bodyMd },
  stoneFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 },
  stonePrice: { ...Typography.headlineSm },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { ...Typography.labelMd, fontWeight: 'bold' },

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
