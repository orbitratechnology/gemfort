import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BusinessCard } from "@/components/marketplace/business-card";
import { ListingCard } from "@/components/marketplace/listing-card";
import { BottomSheet, FilterChipGroup } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { ProductGrid } from "@/components/ui/product-grid";
import { SkeletonList } from "@/components/ui/skeleton-list";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { GEM_TYPES } from "@/constants/gem-options";
import {
  demoBusinesses,
  demoListings,
  fetchBusinesses,
  fetchPublicListings,
  filterListings,
  searchBusinesses,
  searchListings,
  type ListingFilters,
} from "@/features/marketplace/marketplace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import type { Business, MarketplaceListing } from "@/types";

type Tab = "gems" | "traders" | "lapidaries" | "labs";
type BusinessSortBy = "featured" | "rating" | "name";
const PAGE_SIZE = 20;
const VALID_TABS: Tab[] = ["gems", "traders", "lapidaries", "labs"];

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

export default function DirectoryScreen() {
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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filterOpen, setFilterOpen] = useState(false);

  // Gem filters
  const [gemType, setGemType] = useState("all");
  const [gemSort, setGemSort] =
    useState<NonNullable<ListingFilters["sort"]>>("recent");
  const [draftGemType, setDraftGemType] = useState("all");
  const [draftGemSort, setDraftGemSort] =
    useState<NonNullable<ListingFilters["sort"]>>("recent");

  // Business filters
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [city, setCity] = useState("all");
  const [businessSort, setBusinessSort] = useState<BusinessSortBy>("featured");
  const [draftBusiness, setDraftBusiness] = useState<{
    verified: "all" | "verified";
    city: string;
    sort: BusinessSortBy;
  }>({ verified: "all", city: "all", sort: "featured" });

  const businessType =
    tab === "traders"
      ? ("trader" as const)
      : tab === "labs"
        ? ("gem_lab" as const)
        : ("lapidary" as const);

  const {
    data: businesses,
    isLoading: businessesLoading,
    refetch: refetchBusinesses,
    isRefetching: businessesRefetching,
  } = useQuery({
    queryKey: ["businesses", tab],
    queryFn: async () => {
      const filters = { businessType };
      if (!isFirebaseConfigured) return demoBusinesses(filters);
      return fetchBusinesses(filters);
    },
    enabled: tab !== "gems",
  });

  const {
    data: listings = [],
    isLoading: listingsLoading,
    refetch: refetchListings,
    isRefetching: listingsRefetching,
  } = useQuery({
    queryKey: ["public-listings"],
    queryFn: async () => {
      if (!isFirebaseConfigured) return demoListings();
      return fetchPublicListings();
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
        (a, b) => b.badges.endorsementCount - a.badges.endorsementCount,
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

  const visibleGems = useMemo(
    () => filteredGems.slice(0, visibleCount),
    [filteredGems, visibleCount],
  );
  const visibleBusinesses = useMemo(
    () => filteredBusinesses.slice(0, visibleCount),
    [filteredBusinesses, visibleCount],
  );

  const segments: { id: Tab; label: string; icon: IconName }[] = [
    { id: "gems", label: "Gems", icon: "diamond" },
    { id: "traders", label: "Traders", icon: "storefront" },
    { id: "lapidaries", label: "Lapidaries", icon: "handyman" },
    { id: "labs", label: "Labs", icon: "workspace-premium" },
  ];

  const isLoading = tab === "gems" ? listingsLoading : businessesLoading;
  const isRefetching =
    tab === "gems" ? listingsRefetching : businessesRefetching;
  const gemFilterActive = gemType !== "all" || gemSort !== "recent";
  const businessFilterCount =
    (verifiedOnly ? 1 : 0) +
    (city !== "all" ? 1 : 0) +
    (businessSort !== "featured" ? 1 : 0);

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
    setVisibleCount(PAGE_SIZE);
    setFilterOpen(false);
  }

  function switchTab(next: Tab) {
    setTab(next);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <SafeAreaView
      collapsable={false}
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={tab === "gems" ? refetchListings : refetchBusinesses}
          />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
                : "Search traders, lapidaries, labs…"
            }
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={(text) => {
              setSearch(text);
              setVisibleCount(PAGE_SIZE);
            }}
          />
        </View>

        <View
          style={[
            styles.segmentTrack,
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
            style={styles.hBleed}
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
                    color: gemFilterActive ? colors.onPrimary : colors.textMain,
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
                  onPress={() => {
                    setGemType(t.id);
                    setVisibleCount(PAGE_SIZE);
                  }}
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
                      { color: active ? colors.onPrimary : colors.textMain },
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
            style={styles.hBleed}
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
                  businessFilterCount > 0 ? colors.onPrimary : colors.textMain
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
                {businessFilterCount > 0 ? ` (${businessFilterCount})` : ""}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setVerifiedOnly((v) => !v);
                setVisibleCount(PAGE_SIZE);
              }}
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
                  { color: verifiedOnly ? colors.onPrimary : colors.textMain },
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
                onPress={() => {
                  setCity("all");
                  setVisibleCount(PAGE_SIZE);
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Icon name="location-on" size={16} color={colors.onPrimary} />
                <Text style={[styles.filterText, { color: colors.onPrimary }]}>
                  {city}
                </Text>
                <Icon name="close" size={14} color={colors.onPrimary} />
              </Pressable>
            ) : null}
          </ScrollView>
        )}

        <View style={styles.grid}>
          {isLoading ? (
            <SkeletonList />
          ) : tab === "gems" ? (
            filteredGems.length ? (
              <>
                <ProductGrid>
                  {visibleGems.map((gem: MarketplaceListing) => (
                    <ListingCard
                      key={gem.id}
                      listing={gem}
                      href={`/listing/${gem.shareableSlug}`}
                    />
                  ))}
                </ProductGrid>
                {visibleCount < filteredGems.length ? (
                  <Button
                    title={`Load more (${filteredGems.length - visibleCount} remaining)`}
                    variant="secondary"
                    onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  />
                ) : null}
              </>
            ) : (
              <EmptyState
                icon="diamond"
                title="No gems match"
                subtitle={
                  gemType === "all"
                    ? "Try a different search."
                    : "Try clearing gem type filters."
                }
              />
            )
          ) : filteredBusinesses.length ? (
            <>
              <ProductGrid>
                {visibleBusinesses.map((b: Business) => (
                  <BusinessCard
                    key={b.id}
                    business={b}
                    roleLabel={
                      tab === "labs"
                        ? "Gem Lab"
                        : tab === "lapidaries"
                          ? "Lapidary"
                          : "Trader"
                    }
                    href={`/business/${b.id}`}
                  />
                ))}
              </ProductGrid>
              {visibleCount < filteredBusinesses.length ? (
                <Button
                  title={`Load more (${filteredBusinesses.length - visibleCount} remaining)`}
                  variant="secondary"
                  onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
                />
              ) : null}
            </>
          ) : (
            <EmptyState
              icon="business"
              title={
                tab === "labs"
                  ? "No gem labs yet"
                  : tab === "lapidaries"
                    ? "No lapidaries yet"
                    : "No traders match"
              }
              subtitle={
                tab === "labs"
                  ? "Verified gem labs will appear here."
                  : tab === "lapidaries"
                    ? "Verified lapidaries will appear here."
                    : "Try clearing filters or check back after verification."
              }
            />
          )}
        </View>
      </ScrollView>

      <BottomSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={tab === "gems" ? "Filter Gems" : "Filter Directory"}
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
            <FilterChipGroup
              label="Gem Type"
              value={draftGemType}
              onChange={setDraftGemType}
              options={[
                { id: "all", label: "All" },
                ...GEM_TYPES.map((t) => ({ id: t.value, label: t.label })),
              ]}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: Spacing.containerMargin,
    paddingBottom: 100,
    gap: Spacing.gutterMd,
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
  hBleed: {
    marginHorizontal: -Spacing.containerMargin,
  },
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
  grid: { gap: Spacing.gutterMd, marginTop: Spacing.stackSm },
});
