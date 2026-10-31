import { FlashList } from "@/components/ui/gesture-lists";
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

import { EmptyState } from "@/components/ui/empty-state";
import { InfiniteListFooter } from "@/components/ui/infinite-list-footer";
import { SearchField } from "@/components/ui/search-field";
import { StackHeader } from "@/components/ui/stack-header";
import { GemCard } from "@/components/workspace/gem-card";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { resolveGemLifecycle, resolveGemSaleStatus } from "@/features/workspace/gem-lifecycle";
import { filterGems } from "@/features/workspace/gem-utils";
import { fetchArchivedGemsPage } from "@/features/workspace/workspace-pagination";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFirestoreInfiniteQuery } from "@/hooks/use-firestore-infinite-query";
import { useAuth } from "@/providers/auth-provider";

const GRID_GAP = Spacing.stackSm;

type ArchiveTab = "all" | "sold" | "returned";

export default function GemsArchiveScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [tab, setTab] = useState<ArchiveTab>("all");

  const {
    items: gems,
    refetch,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useFirestoreInfiniteQuery({
    queryKey: ["gems", "archive", user?.uid, "infinite"],
    fetchPage: (cursor, pageSize) =>
      fetchArchivedGemsPage(user!.uid, cursor, pageSize),
    enabled: !!user,
  });

  const archived = useMemo(() => {
    let rows = filterGems(gems, {
      search: debouncedSearch,
      archiveOnly: true,
    });
    if (tab === "sold") {
      rows = rows.filter(
        (g) => resolveGemSaleStatus(g) === "sold",
      );
    } else if (tab === "returned") {
      rows = rows.filter(
        (g) => resolveGemLifecycle(g).outcome === "returned",
      );
    }
    return rows;
  }, [gems, debouncedSearch, tab]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="Archive" />

      <View style={styles.searchRow}>
        <SearchField
          placeholder="Search sold or returned…"
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Search archive"
        />
      </View>

      <View style={styles.tabs}>
        {(
          [
            { id: "all", label: "All" },
            { id: "sold", label: "Sold" },
            { id: "returned", label: "Returned" },
          ] as const
        ).map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.tab,
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
                  styles.tabText,
                  {
                    color: active ? colors.onPrimary : colors.onSurfaceVariant,
                  },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlashList
        data={archived}
        keyExtractor={(item) => item.id}
        numColumns={2}
        masonry
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          <InfiniteListFooter
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isFetchNextPageError={isFetchNextPageError}
            onRetry={() => void fetchNextPage()}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="archive"
            title="No archived gems"
            subtitle="Sold and returned stones appear here."
          />
        }
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <GemCard
              gem={item}
              href={`/(marketplace)/(tabs)/workspace/gems/${item.id}`}
              onEdit={() =>
                router.push({
                  pathname: "/(marketplace)/gems/edit",
                  params: { gemId: item.id },
                } as never)
              }
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  searchRow: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.stackMd,
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.stackMd,
  },
  tab: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: { ...Typography.labelMd, fontWeight: "600" },
  list: {
    paddingHorizontal: GRID_GAP / 2,
    paddingBottom: 48,
  },
  cell: {
    padding: GRID_GAP / 2,
  },
});
