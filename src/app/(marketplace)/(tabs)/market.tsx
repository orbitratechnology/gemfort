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
import { SkeletonList } from "@/components/ui/skeleton-list";
import {
  AttributePickerField,
  GemTypePickerSheet,
} from "@/components/workspace/gem-attribute-pickers";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { GEM_TYPES, formatGemType } from "@/constants/gem-options";
import {
  demoBusinesses,
  demoListings,
  fetchBusinesses,
  fetchPublicListings,
  filterBusinesses,
  filterListings,
  searchBusinesses,
  searchListings,
  type ListingFilters,
} from "@/features/marketplace/marketplace-service";
import {
  subscribePublicListings,
  subscribeVerifiedBusinesses,
} from "@/features/workspace/firestore-subscriptions";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import type { Business, MarketplaceListing } from "@/types";

type Tab = "gems" | "traders" | "lapidaries";
type BusinessSortBy = "featured" | "rating" | "name";
const VALID_TABS: Tab[] = ["gems", "traders", "lapidaries"];

const QUICK_TYPES: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "blue_sapphire", label: "Sapphires" },
  { id: "ruby", label: "Rubies" },
  { id: "emerald", label: "Emeralds" },
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

export default function MarketScreen() {
  const { colors } = useAppTheme();
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
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [city, setCity] = useState("all");
  const [businessSort, setBusinessSort] = useState<BusinessSortBy>("featured");
  const [draftBusiness, setDraftBusiness] = useState<{
    verified: "all" | "verified";
    city: string;
    sort: BusinessSortBy;
  }>({ verified: "all", city: "all", sort: "featured" });

  const businessType = tab === "traders" ? ("trader" as const) : ("lapidary" as const);

  const {
    data: businesses,
    isLoading: businessesLoading,
    refetch: refetchBusinesses,
    isRefetching: businessesRefetching,
  } = useFirestoreLiveQuery({
    queryKey: ["businesses", tab],
    queryFn: async () => {
      const filters = { businessType };
      if (!isFirebaseConfigured) return demoBusinesses(filters);
      return fetchBusinesses(filters);
    },
    subscribe: (onData, onError) => {
      const filters = { businessType };
      if (!isFirebaseConfigured) {
        onData(demoBusinesses(filters));
        return () => undefined;
      }
      return subscribeVerifiedBusinesses((all) => {
        onData(filterBusinesses(all, filters));
      }, onError);
    },
    enabled: tab !== "gems",
  });

  const {
    data: listings = [],
    isLoading: listingsLoading,
    refetch: refetchListings,
    isRefetching: listingsRefetching,
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
    enabled: tab === "gems",
  });

  const cities = useMemo(() => {
    const set = new Set((businesses ?? []).map((b) => b.city).filter(Boolean));
    return ["all", ...Array.from(set).sort()];
  }, [businesses]);

  const filteredGems = useMemo(() => {
    const searched = searchListings(debouncedSearch, listings);
    return filterListings(searched, { gemType, sort: gemSort });
  }, [listings, debouncedSearch, gemType, gemSort]);

  const filteredBusinesses = useMemo(() => {
    let result = searchBusinesses(debouncedSearch, businesses ?? []);
    if (verifiedOnly) result = result.filter((b) => b.badges.isVerified);
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
  }, [debouncedSearch, businesses, verifiedOnly, city, businessSort]);

  const segments: { id: Tab; label: string; icon: IconName }[] = [
    { id: "gems", label: "Gems", icon: "diamond" },
    { id: "traders", label: "Traders", icon: "storefront" },
    { id: "lapidaries", label: "Lapidaries", icon: "handyman" },
  ];

  const isLoading = tab === "gems" ? listingsLoading : businessesLoading;
  const isRefetching =
    tab === "gems" ? listingsRefetching : businessesRefetching;
  const gemFilterActive = gemType !== "all" || gemSort !== "recent";
  const businessFilterCount =
    (verifiedOnly ? 1 : 0) +
    (city !== "all" ? 1 : 0) +
    (businessSort !== "featured" ? 1 : 0);

  const listData: (Business | MarketplaceListing)[] =
    tab === "gems" ? filteredGems : filteredBusinesses;

  function openFilter() {
    if (tab === "gems") {
      setDraftGemType(gemType);
      setDraftGemSort(gemSort);
    } else {
      setDraftBusiness({
        verified: verifiedOnly ? "verified" : "all",
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
      setVerifiedOnly(draftBusiness.verified === "verified");
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
            onRefresh={tab === "gems" ? refetchListings : refetchBusinesses}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View
              style={[
                styles.searchBox,
                styles.contentInset,
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

            <View
              style={[
                styles.segmentTrack,
                styles.contentInset,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.segment}
              >
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
              </ScrollView>
            </View>

            {tab === "gems" ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                <Pressable
                  onPress={openFilter}
                  style={[
                    styles.filterChip,
                    gemFilterActive
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
                  <Icon
                    name="tune"
                    size={16}
                    color={gemFilterActive ? colors.onPrimary : colors.textMain}
                  />
                  <Text
                    style={[
                      styles.filterText,
                      {
                        color: gemFilterActive
                          ? colors.onPrimary
                          : colors.textMain,
                      },
                    ]}
                  >
                    Filter
                  </Text>
                </Pressable>
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
                <Pressable
                  onPress={openFilter}
                  style={[
                    styles.filterChip,
                    businessFilterCount > 0
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
                  <Icon
                    name="tune"
                    size={16}
                    color={
                      businessFilterCount > 0
                        ? colors.onPrimary
                        : colors.textMain
                    }
                  />
                  <Text
                    style={[
                      styles.filterText,
                      {
                        color:
                          businessFilterCount > 0
                            ? colors.onPrimary
                            : colors.textMain,
                      },
                    ]}
                  >
                    Filters
                    {businessFilterCount > 0
                      ? ` (${businessFilterCount})`
                      : ""}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setVerifiedOnly((v) => !v)}
                  style={[
                    styles.filterChip,
                    verifiedOnly
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
                  <Text
                    style={[
                      styles.filterText,
                      {
                        color: verifiedOnly
                          ? colors.onPrimary
                          : colors.textMain,
                      },
                    ]}
                  >
                    Verified
                  </Text>
                  <Icon
                    name="verified"
                    size={16}
                    color={verifiedOnly ? colors.onPrimary : colors.textMain}
                  />
                </Pressable>
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
                    verified: "all",
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
              value={draftBusiness.verified}
              onChange={(v) => setDraftBusiness((d) => ({ ...d, verified: v }))}
              options={[
                { id: "all", label: "All" },
                { id: "verified", label: "Verified only" },
              ]}
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
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    height: 48,
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
    flexDirection: "row",
    alignItems: "center",
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
