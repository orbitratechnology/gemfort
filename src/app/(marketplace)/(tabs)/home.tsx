import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo } from "react";
import {
    Image,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ListingCard } from "@/components/marketplace/listing-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { ProductGrid } from "@/components/ui/product-grid";
import { ThemedScrollView } from "@/components/ui/screen";
import { SkeletonList } from "@/components/ui/skeleton-list";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { ROLE_LABELS, resolveProfileRole } from "@/constants/roles";
import {
    demoAnnouncements,
    demoListings,
    fetchAnnouncements,
    fetchPublicListings,
    filterListings,
} from "@/features/marketplace/marketplace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useUnreadNotificationCount } from "@/hooks/use-unread-notifications";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useAuth } from "@/providers/auth-provider";

const FEATURED_LIMIT = 10;

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
  const photoURL = user?.photoURL ?? null;
  const initial = displayName.charAt(0).toUpperCase() || "?";

  const {
    data: listings = [],
    isLoading: listingsLoading,
    refetch: refetchListings,
    isRefetching,
  } = useQuery({
    queryKey: ["public-listings"],
    queryFn: async () => {
      // Demo fixtures only when Firebase is not wired; never mask empty/error with mocks.
      if (!isFirebaseConfigured) return demoListings();
      return fetchPublicListings();
    },
  });

  const {
    data: announcements,
    isLoading: annLoading,
    refetch: refetchAnn,
  } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      if (!isFirebaseConfigured) return demoAnnouncements();
      return fetchAnnouncements();
    },
  });

  const featured = useMemo(
    () => filterListings(listings, { sort: "recent" }).slice(0, FEATURED_LIMIT),
    [listings],
  );

  function refetchAll() {
    refetchListings();
    refetchAnn();
  }

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
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                { backgroundColor: colors.primaryMuted },
              ]}
            >
              <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                {initial}
              </Text>
            </View>
          )}
          <View style={styles.headerCopy}>
            <Text
              style={[styles.userName, { color: colors.primary }]}
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
          style={[styles.iconBtn, { backgroundColor: colors.surfaceContainer }]}
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Verify a gem certificate"
          onPress={() => router.push("/verify-certificate")}
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.primaryContainer,
              borderColor: colors.primary + "33",
            },
          ]}
        >
          <Icon name="workspace-premium" size={20} color={colors.primary} />
          <Text style={[styles.searchText, { color: colors.primary }]}>
            Verify a gem certificate
          </Text>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            Featured Gems
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See all gems"
            onPress={() => router.push("/(marketplace)/(tabs)/directory")}
          >
            <Text style={[styles.seeAll, { color: colors.primary }]}>
              See all
            </Text>
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
            <EmptyState
              icon="diamond"
              title="No featured gems"
              subtitle="Check back soon for new listings."
            />
          </View>
        )}

        <View style={[styles.sectionHeader, { marginTop: Spacing.sectionGap }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            Nearby & Updates
          </Text>
        </View>

        {annLoading ? (
          <SkeletonList />
        ) : announcements?.length ? (
          announcements.map((item) => (
            <Card key={item.id} style={styles.announcementCard}>
              <Text style={[styles.cardType, { color: colors.accent }]}>
                {item.type === "platform" ? "Platform" : "News"}
              </Text>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {item.title}
              </Text>
              {item.content ? (
                <Text
                  style={[styles.cardBody, { color: colors.textSecondary }]}
                >
                  {item.content}
                </Text>
              ) : null}
            </Card>
          ))
        ) : (
          <EmptyState
            icon="campaign"
            title="No announcements yet"
            subtitle="Check back soon for marketplace news."
          />
        )}
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
    zIndex: 40,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginRight: 12,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    ...Typography.headlineMdMobile,
    fontSize: 16,
    fontWeight: "700",
  },
  userName: { ...Typography.headlineMdMobile },
  userRole: { fontSize: 12, fontWeight: "500", marginTop: 1 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
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

  content: { paddingBottom: 100 },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.containerMargin,
    marginBottom: Spacing.stackMd,
    marginTop: Spacing.containerMargin,
  },
  sectionTitle: { ...Typography.headlineSm },
  seeAll: { fontSize: 14, fontWeight: "500" },

  loadingWrap: { paddingHorizontal: Spacing.containerMargin },
  emptyWrap: { paddingHorizontal: Spacing.containerMargin },
  featuredGrid: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 24,
  },

  announcementCard: {
    marginHorizontal: Spacing.containerMargin,
    marginBottom: Spacing.stackMd,
  },
  cardType: {
    ...Typography.caption,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  cardTitle: { ...Typography.h3 },
  cardBody: { ...Typography.body, marginTop: 4 },
});
