import { FlashList } from '@/components/ui/gesture-lists';
import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import {
    Pressable,
    RefreshControl,
    Text,
    View,
} from 'react-native';

import { BusinessCard } from "@/components/marketplace/business-card";
import { ListingCard } from "@/components/marketplace/listing-card";
import { EmptyState } from "@/components/ui/empty-state";
import { InfiniteListFooter } from "@/components/ui/infinite-list-footer";
import { ProductGrid } from "@/components/ui/product-grid";
import { Spacing, Typography } from "@/constants/design-tokens";
import {
    fetchBusinessesPage,
    fetchPublicListingsPage,
} from "@/features/marketplace/marketplace-pagination";
import {
    demoBusinesses,
    demoListings,
    fetchBusinessByOwnerUid,
    searchBusinesses,
    searchListings,
} from "@/features/marketplace/marketplace-service";
import { filterBusinessesForViewer } from "@/features/workspace/contact-business-link";
import { subscribeBusinessByOwnerUid } from "@/features/workspace/firestore-subscriptions";
import { resolveBusinessPhotoById } from "@/features/workspace/party-photo";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFirestoreInfiniteQuery } from "@/hooks/use-firestore-infinite-query";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useAuth } from "@/providers/auth-provider";
import type { Business, MarketplaceListing } from "@/types";


type Scope = "all" | "gems" | "businesses";

const SCOPES: { id: Scope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "gems", label: "Gems" },
  { id: "businesses", label: "Businesses" },
];

type SearchRow =
  | { kind: "heading"; id: string; title: string }
  | { kind: "gems"; id: string; items: MarketplaceListing[] }
  | { kind: "business"; id: string; business: Business };

export default function SearchScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const debounced = useDebouncedValue(query, 250);

  const { data: myBusiness = null } = useFirestoreLiveQuery({
    queryKey: ["my-business", user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    subscribe: (onData, onError) =>
      subscribeBusinessByOwnerUid(user!.uid, onData, onError),
    enabled: !!user && isFirebaseConfigured,
  });

  const listingsQuery = useFirestoreInfiniteQuery({
    queryKey: ["public-listings", "search", "infinite"],
    fetchPage: (cursor, pageSize) => fetchPublicListingsPage(cursor, pageSize),
    enabled: isFirebaseConfigured && scope !== "businesses",
  });

  const businessesQuery = useFirestoreInfiniteQuery({
    queryKey: ["search-businesses", "infinite"],
    fetchPage: (cursor, pageSize) => fetchBusinessesPage(cursor, pageSize),
    enabled: isFirebaseConfigured && scope !== "gems",
  });

  const listings = isFirebaseConfigured
    ? listingsQuery.items
    : demoListings();
  const businesses = isFirebaseConfigured
    ? businessesQuery.items
    : demoBusinesses();
  const publicBusinesses = useMemo(
    () => filterBusinessesForViewer(businesses, myBusiness?.id),
    [businesses, myBusiness?.id],
  );

  const matchedGems = useMemo(
    () => searchListings(debounced, listings),
    [debounced, listings],
  );
  const matchedBusinesses = useMemo(
    () => searchBusinesses(debounced, publicBusinesses),
    [debounced, publicBusinesses],
  );

  const rows = useMemo((): SearchRow[] => {
    const hasQuery = debounced.trim().length > 0;
    const gems =
      scope === "businesses"
        ? []
        : hasQuery
          ? matchedGems.slice(0, 40)
          : matchedGems.slice(0, 12);
    const biz =
      scope === "gems"
        ? []
        : hasQuery
          ? matchedBusinesses.slice(0, 40)
          : matchedBusinesses.slice(0, 12);

    const next: SearchRow[] = [];
    if (gems.length > 0 && scope !== "businesses") {
      next.push({
        kind: "heading",
        id: "h-gems",
        title: hasQuery ? "Gems" : "Recent gems",
      });
      next.push({ kind: "gems", id: "gems-grid", items: gems });
    }
    if (biz.length > 0 && scope !== "gems") {
      next.push({
        kind: "heading",
        id: "h-biz",
        title: hasQuery ? "Businesses" : "Featured businesses",
      });
      for (const business of biz) {
        next.push({ kind: "business", id: `b-${business.id}`, business });
      }
    }
    return next;
  }, [debounced, matchedGems, matchedBusinesses, scope]);

  const isLoading =
    (scope !== "businesses" && listingsQuery.isLoading) ||
    (scope !== "gems" && businessesQuery.isLoading);
  const refreshing =
    (scope !== "businesses" && listingsQuery.isRefetching) ||
    (scope !== "gems" && businessesQuery.isRefetching);
  const hasNextPage =
    (scope !== "businesses" && listingsQuery.hasNextPage) ||
    (scope !== "gems" && businessesQuery.hasNextPage);
  const isFetchingNextPage =
    (scope !== "businesses" && listingsQuery.isFetchingNextPage) ||
    (scope !== "gems" && businessesQuery.isFetchingNextPage);
  const isFetchNextPageError =
    (scope !== "businesses" && listingsQuery.isFetchNextPageError) ||
    (scope !== "gems" && businessesQuery.isFetchNextPageError);

  function loadMore() {
    const requests: Promise<unknown>[] = [];
    if (
      scope !== "businesses" &&
      listingsQuery.hasNextPage &&
      !listingsQuery.isFetchingNextPage
    ) {
      requests.push(listingsQuery.fetchNextPage());
    }
    if (
      scope !== "gems" &&
      businessesQuery.hasNextPage &&
      !businessesQuery.isFetchingNextPage
    ) {
      requests.push(businessesQuery.fetchNextPage());
    }
    void Promise.all(requests);
  }

  return (
    <>
      <Stack.Screen options={{ title: "Search" }} />
      <Stack.SearchBar
        placeholder="Search gems, traders, lapidaries…"
        placement="automatic"
        hideWhenScrolling={false}
        autoCapitalize="none"
        onChangeText={(e) => setQuery(e.nativeEvent.text)}
        onCancelButtonPress={() => setQuery("")}
      />

      <FlashList
        data={rows}
        keyExtractor={(item) => item.id}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: Spacing.xxl,
          gap: Spacing.sm,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void Promise.all([
              listingsQuery.refetch(),
              businessesQuery.refetch(),
            ])}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          <InfiniteListFooter
            hasNextPage={isFirebaseConfigured ? hasNextPage : false}
            isFetchingNextPage={isFetchingNextPage}
            isFetchNextPageError={isFetchNextPageError}
            onRetry={loadMore}
          />
        }
        ListHeaderComponent={
          <View
            style={{
              flexDirection: "row",
              gap: Spacing.sm,
              paddingHorizontal: Spacing.containerMargin,
              paddingTop: Spacing.sm,
            }}
          >
            {SCOPES.map((s) => {
              const active = scope === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setScope(s.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    paddingHorizontal: Spacing.md,
                    paddingVertical: Spacing.sm,
                    borderRadius: 999,
                    minHeight: 36,
                    justifyContent: "center",
                    backgroundColor: active
                      ? colors.primary
                      : colors.surfaceContainerLow,
                  }}
                >
                  <Text
                    style={{
                      ...Typography.labelMd,
                      fontWeight: "600",
                      color: active
                        ? colors.onPrimary
                        : colors.onSurfaceVariant,
                    }}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingTop: Spacing.xxl,
              }}
            >
              <Text style={{ color: colors.textMuted }}>Searching…</Text>
            </View>
          ) : (
            <EmptyState
              icon="search"
              title={debounced.trim() ? "No matches" : "Search the marketplace"}
              subtitle={
                debounced.trim()
                  ? "Try another name, gem type, or city."
                  : "Find gems, traders, and lapidaries."
              }
            />
          )
        }
        renderItem={({ item }) => {
          if (item.kind === "heading") {
            return (
              <Text
                style={{
                  ...Typography.bodyLg,
                  fontWeight: "700",
                  color: colors.onSurface,
                  paddingHorizontal: Spacing.containerMargin,
                  marginTop: Spacing.sm,
                }}
              >
                {item.title}
              </Text>
            );
          }
          if (item.kind === "gems") {
            return (
              <ProductGrid>
                {item.items.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    ownerPhotoUrl={resolveBusinessPhotoById(
                      listing.businessId,
                      businesses,
                    )}
                    href={
                      `/listing/${listing.shareableSlug}` as never
                    }
                  />
                ))}
              </ProductGrid>
            );
          }
          return (
            <View style={{ paddingHorizontal: Spacing.containerMargin }}>
              <BusinessCard
                business={item.business}
                href={
                  `/(marketplace)/business/${item.business.id}` as never
                }
              />
            </View>
          );
        }}
      />
    </>
  );
}
