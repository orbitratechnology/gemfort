import { useQuery } from '@tanstack/react-query';
import { isSameDay, startOfDay } from 'date-fns';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeBusinessRail } from '@/components/marketplace/home-business-rail';
import { ListingCard } from '@/components/marketplace/listing-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon, type IconName } from '@/components/ui/icon';
import { ProductGrid } from '@/components/ui/product-grid';
import { ThemedScrollView } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { ROLE_LABELS, resolveProfileRole } from '@/constants/roles';
import {
  buildHomeUpcoming,
  buildWeekCells,
  popularByRole,
} from '@/features/marketplace/home-feed';
import {
  demoBusinesses,
  demoListings,
  fetchBusinesses,
  fetchPublicListings,
  filterListings,
} from '@/features/marketplace/marketplace-service';
import {
  fetchApRecords,
  fetchContacts,
  fetchServices,
  fetchTrips,
} from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useUnreadNotificationCount } from '@/hooks/use-unread-notifications';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { useAuth } from '@/providers/auth-provider';
import type { Business } from '@/types';

const FEATURED_LIMIT = 6;

type QuickAction = {
  id: string;
  label: string;
  icon: IconName;
  href: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'directory',
    label: 'Directory',
    icon: 'storefront',
    href: '/(marketplace)/(tabs)/directory',
  },
  {
    id: 'add-gem',
    label: 'Add gem',
    icon: 'diamond',
    href: '/(marketplace)/(tabs)/workspace/gems/add',
  },
  {
    id: 'ap',
    label: 'Give AP',
    icon: 'handshake',
    href: '/(marketplace)/(tabs)/workspace/ap/add',
  },
  {
    id: 'service',
    label: 'Service',
    icon: 'handyman',
    href: '/(marketplace)/(tabs)/workspace/services/add',
  },
];

const KIND_ICON: Record<string, IconName> = {
  ap: 'handshake',
  service: 'handyman',
  trip: 'flight',
};

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const { user, profile } = useAuth();
  const unread = useUnreadNotificationCount();
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));

  const displayName =
    profile?.displayName?.trim() || user?.displayName?.trim() || 'Guest';
  const roleLabel = profile
    ? (ROLE_LABELS[resolveProfileRole(profile)] ?? 'Member')
    : user
      ? 'Member'
      : 'Sign in';
  const photoURL = user?.photoURL ?? null;
  const initial = displayName.charAt(0).toUpperCase() || '?';

  const {
    data: listings = [],
    isLoading: listingsLoading,
    refetch: refetchListings,
    isRefetching,
  } = useQuery({
    queryKey: ['public-listings'],
    queryFn: async () => {
      if (!isFirebaseConfigured) return demoListings();
      return fetchPublicListings();
    },
  });

  const {
    data: businesses = [],
    isLoading: businessesLoading,
    refetch: refetchBusinesses,
  } = useQuery({
    queryKey: ['home-businesses'],
    queryFn: async () => {
      if (!isFirebaseConfigured) return demoBusinesses();
      return fetchBusinesses();
    },
  });

  const workspaceEnabled = !!user && isFirebaseConfigured;

  const { data: contacts = [], refetch: refetchContacts } = useQuery({
    queryKey: ['contacts', user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: workspaceEnabled,
  });

  const { data: apRecords = [], refetch: refetchAp } = useQuery({
    queryKey: ['ap', user?.uid],
    queryFn: () => fetchApRecords(user!.uid),
    enabled: workspaceEnabled,
  });

  const { data: services = [], refetch: refetchServices } = useQuery({
    queryKey: ['services', user?.uid],
    queryFn: () => fetchServices(user!.uid),
    enabled: workspaceEnabled,
  });

  const { data: trips = [], refetch: refetchTrips } = useQuery({
    queryKey: ['trips', user?.uid],
    queryFn: () => fetchTrips(user!.uid),
    enabled: workspaceEnabled,
  });

  const featured = useMemo(
    () => filterListings(listings, { sort: 'recent' }).slice(0, FEATURED_LIMIT),
    [listings],
  );

  const traders = useMemo(() => popularByRole(businesses, 'traders'), [businesses]);
  const labs = useMemo(() => popularByRole(businesses, 'labs'), [businesses]);
  const lapidaries = useMemo(
    () => popularByRole(businesses, 'lapidaries'),
    [businesses],
  );

  const upcoming = useMemo(
    () =>
      buildHomeUpcoming({
        apRecords,
        services,
        trips,
        contactName: (id) =>
          contacts.find((c) => c.id === id)?.displayName ?? 'Contact',
      }),
    [apRecords, services, trips, contacts],
  );

  const weekCells = useMemo(() => buildWeekCells(upcoming), [upcoming]);

  const dayItems = useMemo(
    () => upcoming.filter((u) => isSameDay(u.date, selectedDay)),
    [upcoming, selectedDay],
  );

  function refetchAll() {
    refetchListings();
    refetchBusinesses();
    if (workspaceEnabled) {
      refetchContacts();
      refetchAp();
      refetchServices();
      refetchTrips();
    }
  }

  function openBusiness(b: Business) {
    router.push(`/business/${b.id}`);
  }

  function browseDirectory(tab?: string) {
    router.push({
      pathname: '/(marketplace)/(tabs)/directory',
      params: tab ? { tab } : undefined,
    });
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${displayName}, ${roleLabel}`}
          style={styles.headerLeft}
          onPress={() => router.push('/(marketplace)/(tabs)/profile')}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                { backgroundColor: colors.primaryContainer },
              ]}>
              <Text style={[styles.avatarInitial, { color: colors.onPrimaryContainer }]}>
                {initial}
              </Text>
            </View>
          )}
          <View style={styles.headerCopy}>
            <Text
              style={[styles.userName, { color: colors.onSurface }]}
              numberOfLines={1}>
              {displayName}
            </Text>
            <Text
              style={[styles.userRole, { color: colors.textMuted }]}
              numberOfLines={1}>
              {roleLabel}
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
          }
          style={[styles.iconBtn, { backgroundColor: colors.surfaceContainerLowest }]}
          onPress={() => router.push('/notifications')}>
          <Icon name="notifications-none" size={20} color={colors.onSurfaceVariant} />
          {unread > 0 ? (
            <View style={[styles.notifBadge, { backgroundColor: colors.error }]}>
              <Text style={styles.notifBadgeText}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ThemedScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetchAll} />
        }>
        {/* Verify — Workspace hero language */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Verify a gem certificate"
          onPress={() => router.push('/verify-certificate')}
          style={({ pressed }) => [
            styles.verifyHero,
            { backgroundColor: colors.primary, opacity: pressed ? 0.96 : 1 },
          ]}>
          <View style={styles.verifyTop}>
            <View style={styles.verifyCopy}>
              <Text style={[styles.verifyLabel, { color: colors.onPrimary + 'B3' }]}>
                Trust check
              </Text>
              <Text style={[styles.verifyTitle, { color: colors.onPrimary }]}>
                Verify certificate
              </Text>
              <Text style={[styles.verifySub, { color: colors.onPrimary + 'CC' }]}>
                Confirm a GemFort lab report number before you buy or sell.
              </Text>
            </View>
            <View style={[styles.verifyBadge, { backgroundColor: colors.onPrimary + '1F' }]}>
              <Icon name="verified" size={22} color={colors.onPrimary} />
            </View>
          </View>
          <View style={styles.verifyFooter}>
            <Text style={[styles.verifyLink, { color: colors.onPrimary + 'CC' }]}>
              Enter report number
            </Text>
            <Icon name="chevron-right" size={18} color={colors.onPrimary + 'CC'} />
          </View>
        </Pressable>

        {/* Quick actions — Workspace actionsCard */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
            Quick actions
          </Text>
          <View
            style={[
              styles.actionsCard,
              { backgroundColor: colors.surfaceContainerLowest },
            ]}>
            {QUICK_ACTIONS.map((a, index) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                onPress={() => router.push(a.href as never)}
                style={({ pressed }) => [
                  styles.actionItem,
                  index < QUICK_ACTIONS.length - 1 && {
                    borderRightWidth: StyleSheet.hairlineWidth,
                    borderRightColor: colors.outlineVariant,
                  },
                  { opacity: pressed ? 0.88 : 1 },
                ]}>
                <View
                  style={[
                    styles.actionIcon,
                    {
                      backgroundColor:
                        index === 0 ? colors.primaryContainer : colors.surfaceContainerHigh,
                    },
                  ]}>
                  <Icon
                    name={a.icon}
                    size={20}
                    color={index === 0 ? colors.onPrimaryContainer : colors.primary}
                  />
                </View>
                <Text
                  style={[styles.actionLabel, { color: colors.onSurface }]}
                  numberOfLines={1}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Upcoming */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
              Upcoming
            </Text>
            {upcoming.length > 0 ? (
              <View style={[styles.countPill, { backgroundColor: colors.primaryContainer }]}>
                <Text style={[styles.countPillText, { color: colors.onPrimaryContainer }]}>
                  {upcoming.length}
                </Text>
              </View>
            ) : null}
          </View>

          {!user ? (
            <View
              style={[
                styles.quietCard,
                { backgroundColor: colors.surfaceContainerLowest },
              ]}>
              <EmptyState
                icon="event"
                title="Sign in for your calendar"
                subtitle="AP returns, cutter dates, and trips show up here."
              />
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.weekRail}>
                {weekCells.map((cell) => {
                  const active = isSameDay(cell.date, selectedDay);
                  return (
                    <Pressable
                      key={cell.dayNum + cell.label}
                      accessibilityRole="button"
                      accessibilityLabel={`${cell.label} ${cell.dayNum}${cell.count ? `, ${cell.count} events` : ''}`}
                      onPress={() => setSelectedDay(cell.date)}
                      style={({ pressed }) => [
                        styles.dayCell,
                        {
                          backgroundColor: active
                            ? colors.primary
                            : colors.surfaceContainerLowest,
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.dayLabel,
                          { color: active ? colors.onPrimary + 'B3' : colors.textMuted },
                        ]}>
                        {cell.label}
                      </Text>
                      <Text
                        style={[
                          styles.dayNum,
                          {
                            color: active ? colors.onPrimary : colors.onSurface,
                            fontVariant: ['tabular-nums'],
                          },
                        ]}>
                        {cell.dayNum}
                      </Text>
                      {cell.count > 0 ? (
                        <View
                          style={[
                            styles.dayDot,
                            {
                              backgroundColor: active
                                ? colors.onPrimary
                                : colors.primary,
                            },
                          ]}
                        />
                      ) : (
                        <View style={styles.dayDotSpacer} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.upcomingList}>
                {dayItems.length === 0 ? (
                  <View
                    style={[
                      styles.quietCard,
                      { backgroundColor: colors.surfaceContainerLowest },
                    ]}>
                    <Text style={[styles.quietText, { color: colors.onSurfaceVariant }]}>
                      Nothing due this day. AP stones, services, and trips appear when scheduled.
                    </Text>
                  </View>
                ) : (
                  dayItems.map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.title}. ${item.subtitle}`}
                      onPress={() => router.push(item.href as never)}
                      style={({ pressed }) => [
                        styles.upcomingRow,
                        {
                          backgroundColor: colors.surfaceContainerLowest,
                          opacity: pressed ? 0.94 : 1,
                        },
                      ]}>
                      <View
                        style={[
                          styles.upcomingIcon,
                          { backgroundColor: colors.primary + '14' },
                        ]}>
                        <Icon
                          name={KIND_ICON[item.kind] ?? 'event'}
                          size={18}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.upcomingCopy}>
                        <Text style={[styles.upcomingTitle, { color: colors.onSurface }]}>
                          {item.title}
                        </Text>
                        <Text
                          style={[styles.upcomingSub, { color: colors.onSurfaceVariant }]}
                          numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      </View>
                      <Icon name="chevron-right" size={18} color={colors.outline} />
                    </Pressable>
                  ))
                )}
              </View>
            </>
          )}
        </View>

        {/* Popular network */}
        {(
          [
            {
              title: 'Popular traders',
              data: traders,
              tab: 'traders' as const,
              role: 'Trader' as const,
              empty: 'Browse traders in the directory',
            },
            {
              title: 'Popular labs',
              data: labs,
              tab: 'labs' as const,
              role: 'Gem Lab' as const,
              empty: 'Find gem labs for certification',
            },
            {
              title: 'Popular lapidaries',
              data: lapidaries,
              tab: 'lapidaries' as const,
              role: 'Lapidary' as const,
              empty: 'Find cutters and polishers',
            },
          ] as const
        ).map((block) => (
          <View key={block.tab} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                {block.title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`See all ${block.tab}`}
                onPress={() => browseDirectory(block.tab)}
                hitSlop={8}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
              </Pressable>
            </View>
            {businessesLoading ? (
              <SkeletonList />
            ) : (
              <HomeBusinessRail
                businesses={block.data}
                onPress={openBusiness}
                emptyLabel={block.empty}
                onBrowse={() => browseDirectory(block.tab)}
                roleHint={block.role}
              />
            )}
          </View>
        ))}

        {/* New listings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
              New listings
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all gems"
              onPress={() => router.push('/(marketplace)/(tabs)/directory')}
              hitSlop={8}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </Pressable>
          </View>

          {listingsLoading ? (
            <SkeletonList />
          ) : featured.length ? (
            <ProductGrid>
              {featured.map((gem) => (
                <ListingCard
                  key={gem.id}
                  listing={gem}
                  onPress={() => router.push(`/listing/${gem.shareableSlug}`)}
                />
              ))}
            </ProductGrid>
          ) : (
            <View
              style={[
                styles.quietCard,
                { backgroundColor: colors.surfaceContainerLowest },
              ]}>
              <EmptyState
                icon="diamond"
                title="No listings yet"
                subtitle="When traders publish stones, they show up here."
              />
            </View>
          )}
        </View>
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
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  avatar: { width: 40, height: 40, borderRadius: 14 },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...Typography.headlineMdMobile,
    fontSize: 16,
    fontWeight: '700',
  },
  userName: { ...Typography.headlineMdMobile },
  userRole: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    boxShadow: '0 2px 12px rgba(15, 118, 110, 0.06)',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },

  content: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.stackSm,
    paddingBottom: 120,
    gap: Spacing.sectionGap,
  },

  section: { gap: Spacing.stackMd },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { ...Typography.headlineSmMobile },
  seeAll: { ...Typography.labelMd, color: undefined, fontWeight: '600' },
  countPill: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countPillText: { ...Typography.caption, fontWeight: '700' },

  verifyHero: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    padding: Spacing.containerMargin,
    gap: 14,
    boxShadow: '0 10px 28px rgba(12, 67, 60, 0.22)',
  },
  verifyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  verifyCopy: { flex: 1, gap: 4 },
  verifyLabel: { ...Typography.labelMd, letterSpacing: 0.4 },
  verifyTitle: { ...Typography.headlineSm, fontWeight: '700' },
  verifySub: { ...Typography.bodyMd, lineHeight: 20 },
  verifyBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  verifyLink: { ...Typography.labelMd },

  actionsCard: {
    flexDirection: 'row',
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    paddingVertical: 14,
    boxShadow: '0 2px 12px rgba(15, 118, 110, 0.06)',
  },
  actionItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { ...Typography.caption, fontWeight: '600', textAlign: 'center' },

  weekRail: { gap: 8 },
  dayCell: {
    width: 48,
    minHeight: 68,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
    boxShadow: '0 2px 12px rgba(15, 118, 110, 0.06)',
  },
  dayLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  dayNum: { fontSize: 16, fontWeight: '700' },
  dayDot: { width: 5, height: 5, borderRadius: 2.5 },
  dayDotSpacer: { width: 5, height: 5 },

  upcomingList: { gap: Spacing.stackSm },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.stackMd,
    padding: 14,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    boxShadow: '0 2px 12px rgba(15, 118, 110, 0.06)',
  },
  upcomingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingCopy: { flex: 1, gap: 2, minWidth: 0 },
  upcomingTitle: { ...Typography.bodyLg, fontWeight: '600' },
  upcomingSub: { ...Typography.bodyMd },
  quietCard: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    padding: 14,
    boxShadow: '0 2px 12px rgba(15, 118, 110, 0.06)',
  },
  quietText: { ...Typography.bodyMd, lineHeight: 20 },
});
