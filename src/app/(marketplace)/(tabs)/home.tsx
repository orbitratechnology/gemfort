import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
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
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";

import { HomeBannerCarousel } from "@/components/marketplace/home-banner-carousel";
import { HomeBusinessRail } from "@/components/marketplace/home-business-rail";
import { HomeCurrencyRates } from "@/components/marketplace/home-currency-rates";
import { ListingCard } from "@/components/marketplace/listing-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { ProductGrid } from "@/components/ui/product-grid";
import { ThemedScrollView } from "@/components/ui/screen";
import { SkeletonList } from "@/components/ui/skeleton-list";
import { ActiveProgressStrip } from "@/components/workspace/active-progress-strip";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import {
    ROLE_LABELS,
    canAccessModule,
    resolveProfileRole,
} from "@/constants/roles";
import { popularByRole } from "@/features/marketplace/home-feed";
import {
    demoBusinesses,
    demoListings,
    fetchBusinessByOwnerUid,
    fetchBusinesses,
    fetchPublicListings,
    filterListings,
} from "@/features/marketplace/marketplace-service";
import {
  subscribeApRecordsForUser,
  subscribeBills,
  subscribeBusinessByOwnerUid,
  subscribeCheques,
  subscribeContacts,
  subscribeGems,
  subscribePublicListings,
  subscribeServices,
  subscribeTrips,
  subscribeVerifiedBusinesses,
} from "@/features/workspace/firestore-subscriptions";
import {
    resolveBusinessPhotoById,
    resolveBusinessPhotoByOwnerUid,
    resolvePartyPhotoUrl,
} from "@/features/workspace/party-photo";
import {
    fetchApRecords,
    fetchBills,
    fetchCheques,
    fetchContacts,
    fetchGems,
    fetchServices,
    fetchTrips,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useInvalidateExchangeRates } from "@/hooks/use-exchange-rates";
import { useUnreadNotificationCount } from "@/hooks/use-unread-notifications";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
    isNestedWorkspaceHref,
    pushWithAnchor,
} from "@/navigation/tab-stack-nav";
import { useAuth } from "@/providers/auth-provider";

function pushFromHome(href: string) {
  if (isNestedWorkspaceHref(href) || href.includes("/money/")) {
    pushWithAnchor(href as never);
    return;
  }
  router.push(href as never);
}

const FEATURED_LIMIT = 6;

type QuickAction = {
  id: string;
  label: string;
  icon: IconName;
  image?: number;
  href: string;
};

const VERIFY_ACTION: QuickAction = {
  id: "verify",
  label: "Verify",
  icon: "verified",
  image: require("@/assets/images/certificate-icon.png"),
  href: "/verify-certificate",
};

function quickActionsForRole(
  role: ReturnType<typeof resolveProfileRole>,
  signedIn: boolean,
): QuickAction[] {
  if (!signedIn) return [VERIFY_ACTION];

  if (role === "lapidary") {
    return [
      VERIFY_ACTION,
      {
        id: "jobs",
        label: "Jobs",
        icon: "construction",
        image: require("@/assets/images/lapidary-icon.png"),
        href: "/(marketplace)/(tabs)/workspace/jobs",
      },
      {
        id: "contacts",
        label: "Contacts",
        icon: "group",
        href: "/(marketplace)/(tabs)/workspace/contacts",
      },
      {
        id: "bill",
        label: "Bill",
        icon: "receipt-long",
        image: require("@/assets/images/bill-icon.png"),
        href: "/(marketplace)/bills/add",
      },
    ];
  }

  if (role === "gem_lab") {
    return [
      VERIFY_ACTION,
      {
        id: "certificates",
        label: "Certificates",
        icon: "workspace-premium",
        image: require("@/assets/images/certificate-icon.png"),
        href: "/(marketplace)/(tabs)/workspace/certificates",
      },
    ];
  }

  // Trader (and admin treated as full trader tools on home)
  return [
    VERIFY_ACTION,
    {
      id: "add-gem",
      label: "Gem",
      icon: "diamond",
      image: require("@/assets/images/mygems-icon.png"),
      href: "/(marketplace)/gems/add",
    },
    {
      id: "ap",
      label: "Give AP",
      icon: "handshake",
      image: require("@/assets/images/ap-icon.png"),
      href: "/(marketplace)/ap/add",
    },
    {
      id: "service",
      label: "Service",
      icon: "handyman",
      image: require("@/assets/images/lapidary-icon.png"),
      href: "/(marketplace)/services/add",
    },
  ];
}

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
  const insets = useSafeAreaInsets();
  const invalidateRates = useInvalidateExchangeRates();
  const { user, profile } = useAuth();
  const unread = useUnreadNotificationCount();
  const [chromeHeight, setChromeHeight] = useState(0);

  const role = resolveProfileRole(profile);
  const quickActions = useMemo(
    () => quickActionsForRole(role, !!user),
    [role, user],
  );
  const displayName =
    profile?.displayName?.trim() || user?.displayName?.trim() || "Guest";
  const roleLabel = profile
    ? (ROLE_LABELS[role] ?? "Member")
    : user
      ? "Member"
      : "Sign in";
  const initials = initialsFromName(displayName);
  const { data: myBusiness } = useFirestoreLiveQuery({
    queryKey: ["my-business", user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    subscribe: (onData, onError) =>
      subscribeBusinessByOwnerUid(user!.uid, onData, onError),
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
  } = useFirestoreLiveQuery({
    queryKey: ["public-listings"],
    queryFn: async () => {
      if (!isFirebaseConfigured) return demoListings();
      return fetchPublicListings();
    },
    subscribe: (onData, onError) => {
      if (!isFirebaseConfigured) {
        onData(demoListings());
        return () => undefined;
      }
      return subscribePublicListings(onData, onError);
    },
  });

  const {
    data: businesses = [],
    isLoading: businessesLoading,
    refetch: refetchBusinesses,
  } = useFirestoreLiveQuery({
    queryKey: ["home-businesses"],
    queryFn: async () => {
      if (!isFirebaseConfigured) return demoBusinesses();
      return fetchBusinesses();
    },
    subscribe: (onData, onError) => {
      if (!isFirebaseConfigured) {
        onData(demoBusinesses());
        return () => undefined;
      }
      return subscribeVerifiedBusinesses(onData, onError);
    },
  });

  const workspaceEnabled = !!user && isFirebaseConfigured;

  const { data: contacts = [], refetch: refetchContacts } = useFirestoreLiveQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    subscribe: (onData, onError) => subscribeContacts(user!.uid, onData, onError),
    enabled: workspaceEnabled && canAccessModule(role, "contacts"),
  });

  const { data: gems = [] } = useFirestoreLiveQuery({
    queryKey: ["gems", user?.uid],
    queryFn: () => fetchGems(user!.uid),
    subscribe: (onData, onError) => subscribeGems(user!.uid, onData, onError),
    enabled: workspaceEnabled && canAccessModule(role, "gems"),
  });

  const contactPhoto = useMemo(
    () => (id: string | null | undefined) => {
      if (!id) return null;
      const contact = contacts.find((c) => c.id === id);
      return resolvePartyPhotoUrl(contact, businesses);
    },
    [contacts, businesses],
  );

  const businessPhoto = useMemo(
    () => (id: string | null | undefined) =>
      resolveBusinessPhotoById(id, businesses),
    [businesses],
  );

  const ownerBusinessPhoto = useMemo(
    () => (uid: string | null | undefined) =>
      resolveBusinessPhotoByOwnerUid(uid, businesses),
    [businesses],
  );

  const { data: apRecords = [], refetch: refetchAp } = useFirestoreLiveQuery({
    queryKey: ["ap", user?.uid],
    queryFn: () => fetchApRecords(user!.uid),
    subscribe: (onData, onError) =>
      subscribeApRecordsForUser(user!.uid, onData, onError),
    enabled: workspaceEnabled && canAccessModule(role, "ap"),
  });

  const apImage = (record: (typeof apRecords)[number]) => {
    const isTaken = !!user?.uid && record.receiverUid === user.uid;
    if (isTaken) {
      return {
        url: ownerBusinessPhoto(record.senderUid),
        shape: "circle" as const,
      };
    }
    const partyId = record.receiverContactId || record.apHolderContactId;
    const url =
      contactPhoto(partyId) || businessPhoto(record.receiverBusinessId);
    return { url, shape: "circle" as const };
  };

  const { data: services = [], refetch: refetchServices } = useFirestoreLiveQuery({
    queryKey: ["services", user?.uid],
    queryFn: () => fetchServices(user!.uid),
    subscribe: (onData, onError) => subscribeServices(user!.uid, onData, onError),
    enabled: workspaceEnabled,
  });

  const { data: trips = [], refetch: refetchTrips } = useFirestoreLiveQuery({
    queryKey: ["trips", user?.uid],
    queryFn: () => fetchTrips(user!.uid),
    subscribe: (onData, onError) => subscribeTrips(user!.uid, onData, onError),
    enabled: workspaceEnabled,
  });

  const { data: cheques = [], refetch: refetchCheques } = useFirestoreLiveQuery({
    queryKey: ["cheques", user?.uid],
    queryFn: () => fetchCheques(user!.uid),
    subscribe: (onData, onError) => subscribeCheques(user!.uid, onData, onError),
    enabled: workspaceEnabled,
  });

  const { data: bills = [], refetch: refetchBills } = useFirestoreLiveQuery({
    queryKey: ["bills", user?.uid],
    queryFn: () => fetchBills(user!.uid),
    subscribe: (onData, onError) => subscribeBills(user!.uid, onData, onError),
    enabled: workspaceEnabled && canAccessModule(role, "bills"),
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

  function contactName(id: string | null | undefined) {
    return contacts.find((c) => c.id === id)?.displayName ?? "Contact";
  }

  function refetchAll() {
    refetchListings();
    refetchBusinesses();
    void invalidateRates();
    if (workspaceEnabled) {
      refetchContacts();
      refetchAp();
      refetchServices();
      refetchTrips();
      refetchCheques();
      refetchBills();
    }
  }

  function browseMarket(tab?: string) {
    router.push({
      pathname: "/(marketplace)/(tabs)/market",
      params: tab ? { tab } : undefined,
    });
  }

  const showAvatarImage = !!avatarUri && !avatarFailed;
  // Estimate until onLayout so content doesn't jump under the chrome.
  const topPad =
    (chromeHeight > 0 ? chromeHeight : insets.top + 68) + Spacing.stackSm;

  return (
    <View
      collapsable={false}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      {/* First descendant must be ScrollView for NativeTabs scroll-to-top. */}
      <ThemedScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad }]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetchAll}
            progressViewOffset={topPad}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <HomeBannerCarousel />

        <View style={styles.sectionBleed}>
          <HomeCurrencyRates />
        </View>

        {workspaceEnabled ? (
          <ActiveProgressStrip
            trips={trips}
            apRecords={apRecords}
            cheques={cheques}
            bills={bills}
            services={services}
            currentUid={user?.uid}
            contactName={contactName}
            gemTitle={(id) => {
              if (!id) return "";
              const gem = gems.find((g) => g.id === id);
              if (!gem) return "";
              return gem.title?.trim() || formatGemType(gem.gemType);
            }}
            contactPhoto={contactPhoto}
            businessPhoto={businessPhoto}
            ownerBusinessPhoto={ownerBusinessPhoto}
            apImage={apImage}
            limit={5}
            style={styles.section}
          />
        ) : null}

        {/* Quick actions */}
        <View style={styles.section}>
          <View
            style={[
              styles.actionsCard,
              { backgroundColor: colors.surfaceContainerLowest },
            ]}
          >
            {quickActions.map((a, index) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                onPress={() => pushFromHome(a.href)}
                style={({ pressed }) => [
                  styles.actionItem,
                  index < quickActions.length - 1 && {
                    borderRightWidth: StyleSheet.hairlineWidth,
                    borderRightColor: colors.outlineVariant,
                  },
                  { opacity: pressed ? 0.88 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.actionIcon,
                    a.image
                      ? null
                      : {
                          backgroundColor:
                            index === 0
                              ? colors.primaryContainer
                              : colors.surfaceContainerHigh,
                        },
                  ]}
                >
                  {a.image ? (
                    <Image
                      source={a.image}
                      style={styles.actionImage}
                      contentFit="cover"
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <Icon
                      name={a.icon}
                      size={20}
                      color={
                        index === 0 ? colors.onPrimaryContainer : colors.primary
                      }
                    />
                  )}
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

        {/* Popular network */}
        {(
          [
            {
              title: "Popular traders",
              data: traders,
              tab: "traders" as const,
              role: "Trader" as const,
              empty: "Browse traders in the market",
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
          <View key={block.tab} style={styles.sectionBleed}>
            <View style={[styles.sectionHeader, styles.sectionInset]}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                {block.title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`See all ${block.tab}`}
                onPress={() => browseMarket(block.tab)}
                hitSlop={8}
              >
                <Text style={[styles.seeAll, { color: colors.primary }]}>
                  See all
                </Text>
              </Pressable>
            </View>
            {businessesLoading ? (
              <View style={styles.sectionInset}>
                <SkeletonList />
              </View>
            ) : (
              <HomeBusinessRail
                businesses={block.data}
                emptyLabel={block.empty}
                onBrowse={() => browseMarket(block.tab)}
                roleHint={block.role}
              />
            )}
          </View>
        ))}

        {/* New listings — full-bleed masonry grid */}
        <View style={styles.sectionBleed}>
          <View style={[styles.sectionHeader, styles.sectionInset]}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
              New listings
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all gems"
              onPress={() => router.push("/(marketplace)/(tabs)/market")}
              hitSlop={8}
            >
              <Text style={[styles.seeAll, { color: colors.primary }]}>
                See all
              </Text>
            </Pressable>
          </View>

          {listingsLoading ? (
            <View style={styles.sectionInset}>
              <SkeletonList />
            </View>
          ) : featured.length ? (
            <ProductGrid>
              {featured.map((gem) => (
                <ListingCard
                  key={gem.id}
                  listing={gem}
                  href={`/listing/${gem.shareableSlug}`}
                />
              ))}
            </ProductGrid>
          ) : (
            <View style={styles.sectionInset}>
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
            </View>
          )}
        </View>
      </ThemedScrollView>

      <View
        pointerEvents="box-none"
        style={[styles.chrome, { backgroundColor: colors.background }]}
        onLayout={(e) => setChromeHeight(e.nativeEvent.layout.height)}
      >
        <SafeAreaView edges={["top"]}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${displayName}, ${roleLabel}`}
              style={styles.headerLeft}
              onPress={() => router.push("/(marketplace)/profile")}
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
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  unread > 0
                    ? `Notifications, ${unread} unread`
                    : "Notifications"
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
                    style={[
                      styles.notifBadge,
                      { backgroundColor: colors.error },
                    ]}
                  >
                    <Text style={styles.notifBadgeText}>
                      {unread > 99 ? "99+" : unread}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  chrome: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.06)",
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
    paddingBottom: 120,
    gap: Spacing.sectionGap,
  },

  /** Sections own horizontal inset; screen stays full-bleed for carousel */
  section: {
    gap: Spacing.stackMd,
    paddingHorizontal: Spacing.containerMargin,
  },
  /** Full-bleed horizontal rails; header stays inset */
  sectionBleed: {
    gap: Spacing.stackMd,
    // Let rail card shadows paint without the section clipping them
    overflow: "visible",
  },
  sectionInset: {
    paddingHorizontal: Spacing.containerMargin,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { ...Typography.headlineSmMobile },
  seeAll: { ...Typography.labelMd, color: undefined, fontWeight: "600" },

  actionsCard: {
    flexDirection: "row",
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    paddingVertical: 14,
    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.06)",
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
    overflow: "hidden",
  },
  actionImage: {
    width: 44,
    height: 44,
  },
  actionLabel: {
    ...Typography.caption,
    fontWeight: "600",
    textAlign: "center",
  },

  quietCard: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: 14,
    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.06)",
  },
});
