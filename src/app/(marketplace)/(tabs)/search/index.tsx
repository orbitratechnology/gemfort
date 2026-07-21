import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import { BusinessCard } from "@/components/marketplace/business-card";
import { ListingCard } from "@/components/marketplace/listing-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductGrid } from "@/components/ui/product-grid";
import { Spacing, Typography } from "@/constants/design-tokens";
import {
  demoBusinesses,
  demoListings,
  fetchBusinesses,
  fetchPublicListings,
  searchBusinesses,
  searchListings,
} from "@/features/marketplace/marketplace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { isFirebaseConfigured } from "@/lib/firebase/config";
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
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const debounced = useDebouncedValue(query, 250);

  const {
    data: listings = [],
    refetch: refetchListings,
    isRefetching: refreshingListings,
    isLoading: loadingListings,
  } = useQuery({
    queryKey: ["public-listings"],
    queryFn: async () => {
      if (!isFirebaseConfigured) return demoListings();
      return fetchPublicListings();
    },
  });

  const {
    data: businesses = [],
    refetch: refetchBusinesses,
    isRefetching: refreshingBusinesses,
    isLoading: loadingBusinesses,
  } = useQuery({
    queryKey: ["search-businesses"],
    queryFn: async () => {
      if (!isFirebaseConfigured) return demoBusinesses();
      return fetchBusinesses();
    },
  });

  const matchedGems = useMemo(
    () => searchListings(debounced, listings),
    [debounced, listings],
  );
  const matchedBusinesses = useMemo(
    () => searchBusinesses(debounced, businesses),
    [debounced, businesses],
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

  const isLoading = loadingListings || loadingBusinesses;
  const refreshing = refreshingListings || refreshingBusinesses;

  return (
    <>
      <Stack.Screen options={{ title: "Search" }} />
      <Stack.SearchBar
        placeholder="Search gems, traders, labs…"
        placement="automatic"
        hideWhenScrolling={false}
        autoCapitalize="none"
        onChangeText={(e) => setQuery(e.nativeEvent.text)}
        onCancelButtonPress={() => setQuery("")}
      />

      <FlatList
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
            onRefresh={() => {
              void refetchListings();
              void refetchBusinesses();
            }}
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
                  : "Find gems, traders, lapidaries, and labs."
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
                    href={
                      `/(marketplace)/listing/${listing.shareableSlug}` as never
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
