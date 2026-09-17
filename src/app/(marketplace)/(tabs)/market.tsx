import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from "react-native-safe-area-context";

import { BusinessCard } from "@/components/marketplace/business-card";
import { ListingCard } from "@/components/marketplace/listing-card";
import { BottomSheet, FilterChipGroup } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FlashList } from "@/components/ui/gesture-lists";
import { Icon, type IconName } from "@/components/ui/icon";
import { InfiniteListFooter } from "@/components/ui/infinite-list-footer";
import { SkeletonList } from "@/components/ui/skeleton-list";
import { verificationBadgeAssets } from "@/components/ui/verification-badge";
import {
    AttributePickerField,
    GemTypePickerSheet,
} from "@/components/workspace/gem-attribute-pickers";
import {
    BUSINESS_REPUTATION_BADGE_LABELS,
    businessReputationBadgeForBusiness,
} from "@/constants/business-reputation";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { GEM_TYPES, formatGemType } from "@/constants/gem-options";
import { marketTabFromBusinessType } from "@/constants/roles";
import { fetchBusinessesPage, fetchPublicListingsPage } from "@/features/marketplace/marketplace-pagination";
import {
    demoBusinesses,
    demoListings,
    fetchBusinessByOwnerUid,
    filterListings,
    searchBusinesses,
    searchListings,
    type ListingFilters,
} from "@/features/marketplace/marketplace-service";
import { filterBusinessesForViewer } from "@/features/workspace/contact-business-link";
import { subscribeBusinessByOwnerUid } from "@/features/workspace/firestore-subscriptions";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFirestoreInfiniteQuery } from "@/hooks/use-firestore-infinite-query";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useAuth } from "@/providers/auth-provider";
import type {
    Business,
    BusinessReputationBadge,
    MarketplaceListing,
} from "@/types";


type Tab = "gems" | "traders" | "lapidaries";
type BusinessSortBy = "featured" | "rating" | "name";
type BusinessVerificationFilter =
  | "all"
  | Exclude<BusinessReputationBadge, "none">;
const VALID_TABS: Tab[] = ["gems", "traders", "lapidaries"];

const QUICK_TYPES = [
  {
    id: "all",
    label: "All",
    image: GEM_TYPES.find((type) => type.value === "diamond")!.image,
  },
  {
    id: "blue_sapphire",
    label: "Sapphires",
    image: GEM_TYPES.find((type) => type.value === "blue_sapphire")!.image,
  },
  {
    id: "ruby",
    label: "Rubies",
    image: GEM_TYPES.find((type) => type.value === "ruby")!.image,
  },
  {
    id: "emerald",
    label: "Emeralds",
    image: GEM_TYPES.find((type) => type.value === "emerald")!.image,
  },
];

const GEM_SORT_OPTIONS: {
  id: NonNullable<ListingFilters["sort"]>;
  label: string;
}[] = [
  { id: "recent", label: "Most Recent" },
  { id: "price_low", label: "Price: Low to High" },
  { id: "price_high", label: "Price: High to Low" },
];

const BUSINESS_SORT_OPTIONS: { id: BusinessSortBy; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "rating", label: "Top Rated" },
  { id: "name", label: "Name (A–Z)" },
];

const BUSINESS_VERIFICATION_OPTIONS: {
  id: BusinessVerificationFilter;
  label: string;
}[] = [
  { id: "all", label: "All levels" },
  { id: "member", label: BUSINESS_REPUTATION_BADGE_LABELS.member },
  { id: "identity", label: "Identity" },
  { id: "business", label: "Business" },
  { id: "gem", label: "Gem" },
  { id: "recognized", label: BUSINESS_REPUTATION_BADGE_LABELS.recognized },
];

const BUSINESS_VERIFICATION_LEVELS = BUSINESS_VERIFICATION_OPTIONS.filter(
  (option): option is {
    id: Exclude<BusinessVerificationFilter, "all">;
    label: string;
  } => option.id !== "all",
);

type VerificationBadgeType = Exclude<BusinessVerificationFilter, "all">;

function VerificationBadgeImage({ type }: { type: VerificationBadgeType }) {
  return (
    <Image
      source={verificationBadgeAssets[type]}
      style={styles.verificationBadgeImage}
      contentFit="contain"
    />
  );
}

export default function MarketScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const initialTab =
    typeof tabParam === "string" && VALID_TABS.includes(tabParam as Tab)
      ? (tabParam as Tab)
      : "gems";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [tabSynced, setTabSynced] = useState(initialTab);
  if (initialTab !== tabSynced) {
    setTabSynced(initialTab);
    setTab(initialTab);
  }
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [filterOpen, setFilterOpen] = useState(false);
  const [gemTypeSheetOpen, setGemTypeSheetOpen] = useState(false);

  // Gem filters
  const [gemType, setGemType] = useState("all");
  const [gemSort, setGemSort] =
    useState<NonNullable<ListingFilters["sort"]>>("recent");
  const [draftGemType, setDraftGemType] = useState("all");
  const [draftGemSort, setDraftGemSort] =
    useState<NonNullable<ListingFilters["sort"]>>("recent");

  const draftGemTypeOption = useMemo(
    () => GEM_TYPES.find((t) => t.value === draftGemType),
    [draftGemType],
  );

  // Business filters
  const [verificationTier, setVerificationTier] =
    useState<BusinessVerificationFilter>("all");
  const [city, setCity] = useState("all");
  const [businessSort, setBusinessSort] = useState<BusinessSortBy>("featured");
  const [draftBusiness, setDraftBusiness] = useState<{
    verificationTier: BusinessVerificationFilter;
    city: string;
    sort: BusinessSortBy;
  }>({ verificationTier: "all", city: "all", sort: "featured" });

  const businessType = tab === "traders" ? ("trader" as const) : ("lapidary" as const);

  const { data: myBusiness = null } = useFirestoreLiveQuery({
    queryKey: ["my-business", user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    subscribe: (onData, onError) =>
      subscribeBusinessByOwnerUid(user!.uid, onData, onError),
    enabled: !!user && isFirebaseConfigured,
  });

  const businessesQuery = useFirestoreInfiniteQuery({
    queryKey: ["businesses", tab, "infinite"],
    fetchPage: (cursor, pageSize) => fetchBusinessesPage(cursor, pageSize),
    enabled: isFirebaseConfigured,
  });

  const listingsQuery = useFirestoreInfiniteQuery({
    queryKey: ["public-listings", "infinite"],
    fetchPage: (cursor, pageSize) => fetchPublicListingsPage(cursor, pageSize),
    enabled: tab === "gems" && isFirebaseConfigured,
  });

  const businesses = isFirebaseConfigured
    ? filterBusinessesForViewer(businessesQuery.items, myBusiness?.id)
    : demoBusinesses({ businessType });
  const listings = isFirebaseConfigured ? listingsQuery.items : demoListings();

  const cities = useMemo(() => {
    const marketTab = tab === "lapidaries" ? "lapidaries" : "traders";
    const set = new Set(
      (businesses ?? [])
        .filter(
          (business) =>
            marketTabFromBusinessType(business.businessType) === marketTab,
        )
        .map((b) => b.city)
        .filter(Boolean),
    );
    return ["all", ...Array.from(set).sort()];
  }, [businesses, tab]);

  const filteredGems = useMemo(() => {
    const searched = searchListings(debouncedSearch, listings);
    return filterListings(searched, { gemType, sort: gemSort });
  }, [listings, debouncedSearch, gemType, gemSort]);

  const filteredBusinesses = useMemo(() => {
    const marketTab = tab === "lapidaries" ? "lapidaries" : "traders";
    let result = searchBusinesses(debouncedSearch, businesses ?? []).filter(
      (business) =>
        marketTabFromBusinessType(business.businessType) === marketTab,
    );
    if (verificationTier !== "all") {
      result = result.filter(
        (business) =>
          businessReputationBadgeForBusiness(business) === verificationTier,
      );
    }
    if (city !== "all") result = result.filter((b) => b.city === city);
    const sorted = [...result];
    if (businessSort === "rating") {
      sorted.sort(
        (a, b) => b.badges.likeCount - a.badges.likeCount,
      );
    } else if (businessSort === "name") {
      sorted.sort((a, b) => a.businessName.localeCompare(b.businessName));
    } else {
      sorted.sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
        return a.businessName.localeCompare(b.businessName);
      });
    }
    return sorted;
  }, [
    debouncedSearch,
    businesses,
    verificationTier,
    city,
    businessSort,
    tab,
  ]);

  const segments: { id: Tab; label: string; icon: IconName }[] = [
    { id: "gems", label: "Gems", icon: "diamond" },
    { id: "traders", label: "Traders", icon: "storefront" },
    { id: "lapidaries", label: "Lapidaries", icon: "handyman" },
  ];

  const activeQuery = tab === "gems" ? listingsQuery : businessesQuery;
  const isLoading = isFirebaseConfigured && activeQuery.isLoading;
  const isRefetching = isFirebaseConfigured && activeQuery.isRefetching;
  const gemFilterActive = gemType !== "all" || gemSort !== "recent";
  const businessFilterCount =
    (verificationTier !== "all" ? 1 : 0) +
    (city !== "all" ? 1 : 0) +
    (businessSort !== "featured" ? 1 : 0);
  const filterActive =
    tab === "gems" ? gemFilterActive : businessFilterCount > 0;

  const listData: (Business | MarketplaceListing)[] =
    tab === "gems" ? filteredGems : filteredBusinesses;

  function openFilter() {
    if (tab === "gems") {
      setDraftGemType(gemType);
      setDraftGemSort(gemSort);
    } else {
      setDraftBusiness({
        verificationTier,
        city,
        sort: businessSort,
      });
    }
    setFilterOpen(true);
  }

  function applyFilter() {
    if (tab === "gems") {
      setGemType(draftGemType);
      setGemSort(draftGemSort);
    } else {
      setVerificationTier(draftBusiness.verificationTier);
      setCity(draftBusiness.city);
      setBusinessSort(draftBusiness.sort);
    }
    setFilterOpen(false);
  }

  function switchTab(next: Tab) {
    setTab(next);
  }

  return (
    <SafeAreaView
      collapsable={false}
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <FlashList<Business | MarketplaceListing>
        data={isLoading ? [] : listData}
        keyExtractor={(item) => item.id}
        numColumns={2}
        masonry
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void activeQuery.refetch()}
          />
        }
        onEndReached={() => {
          if (
            isFirebaseConfigured &&
            activeQuery.hasNextPage &&
            !activeQuery.isFetchingNextPage
          ) {
            void activeQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          <InfiniteListFooter
            hasNextPage={isFirebaseConfigured ? activeQuery.hasNextPage : false}
            isFetchingNextPage={activeQuery.isFetchingNextPage}
            isFetchNextPageError={activeQuery.isFetchNextPageError}
            onRetry={() => void activeQuery.fetchNextPage()}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={[styles.searchRow, styles.contentInset]}>
              <View
                style={[
                  styles.searchBox,
                  { backgroundColor: colors.surfaceContainerLow },
                ]}
              >
                <Icon name="search" size={22} color={colors.textMuted} />
                <TextInput
                  style={[styles.searchInput, { color: colors.textMain }]}
                  placeholder={
                    tab === "gems"
                      ? "Search gems, origins…"
                      : "Search traders, lapidaries…"
                  }
                  placeholderTextColor={colors.textMuted}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
              <Pressable
                onPress={openFilter}
                accessibilityRole="button"
                accessibilityLabel="Open filters"
                accessibilityState={{ selected: filterActive }}
                style={[
                  styles.searchFilterButton,
                  {
                    backgroundColor: filterActive
                      ? colors.primary
                      : colors.surfaceContainerLow,
                    borderColor: filterActive
                      ? colors.primary
                      : colors.outlineVariant,
                  },
                ]}
              >
                <Icon
                  name="tune"
                  size={22}
                  color={filterActive ? colors.onPrimary : colors.textMain}
                />
              </Pressable>
            </View>

            <View
              style={[
                styles.segmentTrack,
                styles.contentInset,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <View style={styles.segment}>
                {segments.map((s) => {
                  const active = tab === s.id;
                  const tone = active ? colors.onPrimary : colors.onSurfaceVariant;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => switchTab(s.id)}
                      style={[
                        styles.segmentBtn,
                        active && { backgroundColor: colors.primary },
                      ]}
                    >
                      <Icon name={s.icon} size={16} color={tone} />
                      <Text style={[styles.segmentText, { color: tone }]}>
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {tab === "gems" ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {QUICK_TYPES.map((t) => {
                  const active = gemType === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => setGemType(t.id)}
                      style={[
                        styles.filterChip,
                        active
                          ? {
                              backgroundColor: colors.primary,
                              borderColor: colors.primary,
                            }
                          : {
                              backgroundColor: colors.surfaceContainerLowest,
                              borderColor: colors.outlineVariant,
                            },
                      ]}
                    >
                      <Image
                        source={t.image}
                        style={styles.quickTypeImage}
                        contentFit="cover"
                      />
                      <Text
                        style={[
                          styles.filterText,
                          {
                            color: active ? colors.onPrimary : colors.textMain,
                          },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {BUSINESS_VERIFICATION_LEVELS.map((option) => {
                  const active = verificationTier === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() =>
                        setVerificationTier(active ? "all" : option.id)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`${option.label} verification level`}
                      accessibilityState={{ selected: active }}
                      style={[
                        styles.filterChip,
                        active
                          ? {
                              backgroundColor: colors.primary,
                              borderColor: colors.primary,
                            }
                          : {
                              backgroundColor: colors.surfaceContainerLowest,
                              borderColor: colors.outlineVariant,
                            },
                      ]}
                    >
                      <VerificationBadgeImage type={option.id} />
                      <Text
                        style={[
                          styles.filterText,
                          { color: active ? colors.onPrimary : colors.textMain },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
                {city !== "all" ? (
                  <Pressable
                    onPress={() => setCity("all")}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <Icon
                      name="location-on"
                      size={16}
                      color={colors.onPrimary}
                    />
                    <Text
                      style={[styles.filterText, { color: colors.onPrimary }]}
                    >
                      {city}
                    </Text>
                    <Icon name="close" size={14} color={colors.onPrimary} />
                  </Pressable>
                ) : null}
              </ScrollView>
            )}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.contentInset}>
              <SkeletonList />
            </View>
          ) : tab === "gems" ? (
            <View style={styles.contentInset}>
              <EmptyState
                icon="diamond"
                title="No gems match"
                subtitle={
                  gemType === "all"
                    ? "Try a different search."
                    : "Try clearing gem type filters."
                }
              />
            </View>
          ) : (
            <View style={styles.contentInset}>
              <EmptyState
                icon="business"
                title={tab === "lapidaries" ? "No lapidaries yet" : "No traders match"}
                subtitle={
                  tab === "lapidaries"
                    ? "Verified lapidaries will appear here."
                    : "Try clearing filters or check back after verification."
                }
              />
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.cell}>
            {tab === "gems" ? (
              <ListingCard
                listing={item as MarketplaceListing}
                ownerPhotoUrl={businessesQuery.items.find(
                  (business) =>
                    business.id === (item as MarketplaceListing).businessId,
                )?.logoUrl}
                href={`/listing/${(item as MarketplaceListing).shareableSlug}`}
              />
            ) : (
              <BusinessCard
                business={item as Business}
                roleLabel={tab === "lapidaries" ? "Lapidary" : "Trader"}
                href={`/business/${item.id}`}
              />
            )}
          </View>
        )}
      />

      <BottomSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={tab === "gems" ? "Filter Gems" : "Filter Market"}
        footer={
          <>
            <Button
              title="Apply Filters"
              icon="filter-list"
              onPress={applyFilter}
            />
            <Button
              title="Reset"
              variant="ghost"
              onPress={() => {
                if (tab === "gems") {
                  setDraftGemType("all");
                  setDraftGemSort("recent");
                } else {
                  setDraftBusiness({
                    verificationTier: "all",
                    city: "all",
                    sort: "featured",
                  });
                }
              }}
            />
          </>
        }
      >
        {tab === "gems" ? (
          <>
            <AttributePickerField
              label="Gem type"
              valueLabel={
                draftGemType === "all"
                  ? "All types"
                  : formatGemType(draftGemType)
              }
              onPress={() => setGemTypeSheetOpen(true)}
              leading={
                draftGemTypeOption ? (
                  <Image
                    source={draftGemTypeOption.image}
                    style={styles.gemTypeThumb}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.gemTypeThumb,
                      {
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.surfaceContainerHigh,
                      },
                    ]}
                  >
                    <Icon name="diamond" size={18} color={colors.outline} />
                  </View>
                )
              }
            />
            <FilterChipGroup
              label="Sort By"
              value={draftGemSort}
              onChange={setDraftGemSort}
              options={GEM_SORT_OPTIONS}
            />
          </>
        ) : (
          <>
            <FilterChipGroup
              label="Verification"
              value={draftBusiness.verificationTier}
              onChange={(v) =>
                setDraftBusiness((d) => ({ ...d, verificationTier: v }))
              }
              options={BUSINESS_VERIFICATION_OPTIONS}
              renderLeading={(option) =>
                option.id === "all" ? null : (
                  <VerificationBadgeImage type={option.id} />
                )
              }
            />
            <FilterChipGroup
              label="Location"
              value={draftBusiness.city}
              onChange={(v) => setDraftBusiness((d) => ({ ...d, city: v }))}
              options={cities.map((c) => ({
                id: c,
                label: c === "all" ? "All cities" : c,
              }))}
            />
            <FilterChipGroup
              label="Sort By"
              value={draftBusiness.sort}
              onChange={(v) => setDraftBusiness((d) => ({ ...d, sort: v }))}
              options={BUSINESS_SORT_OPTIONS}
            />
          </>
        )}
      </BottomSheet>

      <GemTypePickerSheet
        visible={gemTypeSheetOpen}
        onClose={() => setGemTypeSheetOpen(false)}
        value={draftGemType}
        includeAll
        onSelect={setDraftGemType}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingTop: Spacing.containerMargin,
    paddingBottom: 100,
  },
  headerBlock: {
    gap: Spacing.gutterMd,
    marginBottom: Spacing.stackSm,
  },
  contentInset: {
    marginHorizontal: Spacing.containerMargin,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.stackSm,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    height: 48,
  },
  searchFilterButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: { flex: 1, ...Typography.bodyMd },
  segmentTrack: {
    alignSelf: "stretch",
    borderRadius: Radius.full,
    overflow: "hidden",
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  segmentText: { ...Typography.labelMd },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.stackSm,
    paddingVertical: 4,
    paddingHorizontal: Spacing.containerMargin,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  quickTypeImage: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderCurve: "continuous",
  },
  verificationBadgeImage: {
    width: 20,
    height: 20,
  },
  filterText: { ...Typography.labelMd },
  cell: {
    paddingHorizontal: Spacing.stackSm / 2,
    paddingBottom: Spacing.stackSm,
  },
  gemTypeThumb: {
    width: 36,
    height: 36,
    borderRadius: 12,
  },
});
