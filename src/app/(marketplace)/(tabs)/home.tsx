import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HomeBannerCarousel } from "@/components/marketplace/home-banner-carousel";
import { HomeBusinessRail } from "@/components/marketplace/home-business-rail";
import { ListingCard } from "@/components/marketplace/listing-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { ProductGrid } from "@/components/ui/product-grid";
import { ThemedScrollView } from "@/components/ui/screen";
import { SkeletonList } from "@/components/ui/skeleton-list";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { ROLE_LABELS, resolveProfileRole } from "@/constants/roles";
import {
    buildHomeUpcoming,
    popularByRole,
} from "@/features/marketplace/home-feed";
import {
    demoBusinesses,
    demoListings,
    fetchBusinessByOwnerUid,
    fetchBusinesses,
    fetchPublicListings,
    filterListings,
} from "@/features/marketplace/marketplace-service";
import {
    fetchApRecords,
    fetchCheques,
    fetchContacts,
    fetchServices,
    fetchTrips,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useUnreadNotificationCount } from "@/hooks/use-unread-notifications";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useAuth } from "@/providers/auth-provider";
import type { Business } from "@/types";

const FEATURED_LIMIT = 6;
const UPCOMING_LIMIT = 8;

type QuickAction = {
  id: string;
  label: string;
  icon: IconName;
  href: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "verify",
    label: "Verify",
    icon: "verified",
    href: "/verify-certificate",
  },
  {
    id: "add-gem",
    label: "Add gem",
    icon: "diamond",
    href: "/(marketplace)/(tabs)/workspace/gems/add",
  },
  {
    id: "ap",
    label: "Give AP",
    icon: "handshake",
    href: "/(marketplace)/(tabs)/workspace/ap/add",
  },
  {
    id: "service",
    label: "Service",
    icon: "handyman",
    href: "/(marketplace)/(tabs)/workspace/services/add",
  },
];

const KIND_ICON: Record<string, IconName> = {
  ap: "handshake",
  service: "handyman",
  trip: "flight",
  cheque: "money-check-dollar",
};

function initialsFromName(name: string) {
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const { user, profile } = useAuth();
  const unread = useUnreadNotificationCount();

  const displayName =
    profile?.displayName?.trim() || user?.displayName?.trim() || "Guest";
  const roleLabel = profile
    ? (ROLE_LABELS[resolveProfileRole(profile)] ?? "Member")
    : user
      ? "Member"
      : "Sign in";
  const initials = initialsFromName(displayName);

  const { data: myBusiness } = useQuery({
    queryKey: ["my-business", user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    enabled: !!user && isFirebaseConfigured,
  });

  const avatarUri = myBusiness?.logoUrl ?? user?.photoURL ?? null;
  // Track which URI failed so a new avatarUri retries without an effect reset.
  const [failedAvatarUri, setFailedAvatarUri] = useState<string | null>(null);
  const avatarFailed = !!avatarUri && failedAvatarUri === avatarUri;

  const {
    data: listings = [],
    isLoading: listingsLoading,
    refetch: refetchListings,
    isRefetching,
  } = useQuery({
    queryKey: ["public-listings"],
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
    queryKey: ["home-businesses"],
    queryFn: async () => {
      if (!isFirebaseConfigured) return demoBusinesses();
      return fetchBusinesses();
    },
  });

  const workspaceEnabled = !!user && isFirebaseConfigured;

  const { data: contacts = [], refetch: refetchContacts } = useQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: workspaceEnabled,
  });

  const { data: apRecords = [], refetch: refetchAp } = useQuery({
    queryKey: ["ap", user?.uid],
    queryFn: () => fetchApRecords(user!.uid),
    enabled: workspaceEnabled,
  });

  const { data: services = [], refetch: refetchServices } = useQuery({
    queryKey: ["services", user?.uid],
    queryFn: () => fetchServices(user!.uid),
    enabled: workspaceEnabled,
  });

  const { data: trips = [], refetch: refetchTrips } = useQuery({
    queryKey: ["trips", user?.uid],
    queryFn: () => fetchTrips(user!.uid),
    enabled: workspaceEnabled,
  });

  const { data: cheques = [], refetch: refetchCheques } = useQuery({
    queryKey: ["cheques", user?.uid],
    queryFn: () => fetchCheques(user!.uid),
    enabled: workspaceEnabled,
  });

  const featured = useMemo(
    () => filterListings(listings, { sort: "recent" }).slice(0, FEATURED_LIMIT),
    [listings],
  );

  const traders = useMemo(
    () => popularByRole(businesses, "traders"),
    [businesses],
  );
  const labs = useMemo(() => popularByRole(businesses, "labs"), [businesses]);
  const lapidaries = useMemo(
    () => popularByRole(businesses, "lapidaries"),
    [businesses],
  );

  const upcoming = useMemo(
    () =>
      buildHomeUpcoming({
        apRecords,
        services,
        trips,
        cheques,
        contactName: (id) =>
          contacts.find((c) => c.id === id)?.displayName ?? "Contact",
      }),
    [apRecords, services, trips, cheques, contacts],
  );

  const upcomingPreview = useMemo(
    () => upcoming.slice(0, UPCOMING_LIMIT),
    [upcoming],
  );

  function refetchAll() {
    refetchListings();
    refetchBusinesses();
    if (workspaceEnabled) {
      refetchContacts();
      refetchAp();
      refetchServices();
      refetchTrips();
      refetchCheques();
    }
  }

  function openBusiness(b: Business) {
    router.push(`/business/${b.id}`);
  }

  function browseDirectory(tab?: string) {
    router.push({
      pathname: "/(marketplace)/(tabs)/directory",
      params: tab ? { tab } : undefined,
    });
  }

  const showAvatarImage = !!avatarUri && !avatarFailed;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${displayName}, ${roleLabel}`}
          style={styles.headerLeft}
          onPress={() => router.push("/(marketplace)/(tabs)/profile")}
        >
          {showAvatarImage ? (
            <Image
              source={{ uri: avatarUri }}
              style={styles.avatar}
              contentFit="cover"
              recyclingKey={avatarUri}
              onError={() => setFailedAvatarUri(avatarUri)}
            />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <Text
                style={[
                  styles.avatarInitial,
                  { color: colors.onPrimaryContainer },
                ]}
              >
                {initials}
              </Text>
            </View>
          )}
          <View style={styles.headerCopy}>
            <Text
              style={[styles.userName, { color: colors.onSurface }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text
              style={[styles.userRole, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {roleLabel}
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
          }
          style={[
            styles.iconBtn,
            { backgroundColor: colors.surfaceContainerLowest },
          ]}
          onPress={() => router.push("/notifications")}
        >
          <Icon
            name="notifications-none"
            size={20}
            color={colors.onSurfaceVariant}
          />
          {unread > 0 ? (
            <View
              style={[styles.notifBadge, { backgroundColor: colors.error }]}
            >
              <Text style={styles.notifBadgeText}>
                {unread > 99 ? "99+" : unread}
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
        }
      >
        <HomeBannerCarousel />

        {/* Quick actions */}
        <View style={styles.section}>
          <View
            style={[
              styles.actionsCard,
              { backgroundColor: colors.surfaceContainerLowest },
            ]}
          >
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
                ]}
              >
                <View
                  style={[
                    styles.actionIcon,
                    {
                      backgroundColor:
                        index === 0
                          ? colors.primaryContainer
                          : colors.surfaceContainerHigh,
                    },
                  ]}
                >
                  <Icon
                    name={a.icon}
                    size={20}
                    color={
                      index === 0 ? colors.onPrimaryContainer : colors.primary
                    }
                  />
                </View>
                <Text
                  style={[styles.actionLabel, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Upcoming events — relative time, no calendar */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
              Upcoming
            </Text>
            {upcoming.length > 0 ? (
              <View
                style={[
                  styles.countPill,
                  { backgroundColor: colors.primaryContainer },
                ]}
              >
                <Text
                  style={[
                    styles.countPillText,
                    { color: colors.onPrimaryContainer },
                  ]}
                >
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
              ]}
            >
              <EmptyState
                icon="event"
                title="Sign in for upcoming events"
                subtitle="Cheques, AP returns, services, and trips show up here."
              />
            </View>
          ) : upcomingPreview.length === 0 ? (
            <View
              style={[
                styles.quietCard,
                { backgroundColor: colors.surfaceContainerLowest },
              ]}
            >
              <EmptyState
                icon="event-available"
                title="Nothing coming up"
                subtitle="AP stones, cheques, cutter dates, and trips appear when scheduled."
              />
            </View>
          ) : (
            <View style={styles.upcomingList}>
              {upcomingPreview.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}. ${item.subtitle}. ${item.when}`}
                  onPress={() => router.push(item.href as never)}
                  style={({ pressed }) => [
                    styles.upcomingRow,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      opacity: pressed ? 0.94 : 1,
                      borderColor: item.overdue
                        ? colors.error + "44"
                        : "transparent",
                      borderWidth: item.overdue ? 1 : 0,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.upcomingIcon,
                      {
                        backgroundColor: item.overdue
                          ? colors.errorContainer
                          : colors.primary + "14",
                      },
                    ]}
                  >
                    <Icon
                      name={KIND_ICON[item.kind] ?? "event"}
                      size={18}
                      color={item.overdue ? colors.error : colors.primary}
                    />
                  </View>
                  <View style={styles.upcomingCopy}>
                    <Text
                      style={[
                        styles.upcomingTitle,
                        { color: colors.onSurface },
                      ]}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        styles.upcomingSub,
                        { color: colors.onSurfaceVariant },
                      ]}
                      numberOfLines={1}
                    >
                      {item.subtitle}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.upcomingWhen,
                      {
                        color: item.overdue ? colors.error : colors.primary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.when}
                  </Text>
                </Pressable>
              ))}
              {upcoming.length > UPCOMING_LIMIT ? (
                <Text style={[styles.moreHint, { color: colors.textMuted }]}>
                  +{upcoming.length - UPCOMING_LIMIT} more in Workspace
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {/* Popular network */}
        {(
          [
            {
              title: "Popular traders",
              data: traders,
              tab: "traders" as const,
              role: "Trader" as const,
              empty: "Browse traders in the directory",
            },
            {
              title: "Popular labs",
              data: labs,
              tab: "labs" as const,
              role: "Gem Lab" as const,
              empty: "Find gem labs for certification",
            },
            {
              title: "Popular lapidaries",
              data: lapidaries,
              tab: "lapidaries" as const,
              role: "Lapidary" as const,
              empty: "Find cutters and polishers",
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
                hitSlop={8}
              >
                <Text style={[styles.seeAll, { color: colors.primary }]}>
                  See all
                </Text>
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
              onPress={() => router.push("/(marketplace)/(tabs)/directory")}
              hitSlop={8}
            >
              <Text style={[styles.seeAll, { color: colors.primary }]}>
                See all
              </Text>
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
              ]}
            >
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.stackMd,
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  avatar: { width: 40, height: 40, borderRadius: 14 },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    ...Typography.headlineMdMobile,
    fontSize: 15,
    fontWeight: "700",
  },
  userName: { ...Typography.headlineMdMobile },
  userRole: { fontSize: 12, fontWeight: "500", marginTop: 1 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    boxShadow: "0 2px 12px rgba(15, 118, 110, 0.06)",
  },
  notifBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
  },

  content: {
    paddingTop: Spacing.stackSm,
    paddingBottom: 120,
    gap: Spacing.sectionGap,
  },

  /** Sections own horizontal inset; screen stays full-bleed for carousel */
  section: {
    gap: Spacing.stackMd,
    paddingHorizontal: Spacing.containerMargin,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { ...Typography.headlineSmMobile },
  seeAll: { ...Typography.labelMd, color: undefined, fontWeight: "600" },
  countPill: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countPillText: { ...Typography.caption, fontWeight: "700" },

  actionsCard: {
    flexDirection: "row",
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    paddingVertical: 14,
    boxShadow: "0 2px 12px rgba(15, 118, 110, 0.06)",
  },
  actionItem: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    ...Typography.caption,
    fontWeight: "600",
    textAlign: "center",
  },

  upcomingList: { gap: Spacing.stackSm },
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.stackMd,
    padding: 14,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    boxShadow: "0 2px 12px rgba(15, 118, 110, 0.06)",
  },
  upcomingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingCopy: { flex: 1, gap: 2, minWidth: 0 },
  upcomingTitle: { ...Typography.bodyLg, fontWeight: "600" },
  upcomingSub: { ...Typography.bodyMd },
  upcomingWhen: {
    ...Typography.labelMd,
    fontWeight: "700",
    maxWidth: 88,
    textAlign: "right",
  },
  moreHint: {
    ...Typography.caption,
    textAlign: "center",
    marginTop: 4,
  },
  quietCard: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: 14,
    boxShadow: "0 2px 12px rgba(15, 118, 110, 0.06)",
  },
});
