import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NewsArticleCard } from '@/components/news/news-article-card';
import { CountryFlag } from '@/components/ui/country-flag';
import { EmptyState } from '@/components/ui/empty-state';
import { StackHeader } from '@/components/ui/stack-header';
import { NEWS_REGIONS, NEWS_TOPICS } from '@/constants/news';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  fetchGemNewsPage,
  fetchUpcomingExhibitions,
  NEWS_PAGE_SIZE,
} from '@/features/news/news-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatDate } from '@/lib/utils';
import type { NewsRegion, NewsTopic } from '@/types';

type MainTab = 'news' | 'shows';

export default function GemNewsScreen() {
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab: MainTab = params.tab === 'shows' ? 'shows' : 'news';

  const [mainTab, setMainTab] = useState<MainTab>(initialTab);
  const [region, setRegion] = useState<NewsRegion | 'all'>('all');
  const [topic, setTopic] = useState<NewsTopic | null>(null);

  const newsQuery = useInfiniteQuery({
    queryKey: ['gem-news', region, topic],
    queryFn: ({ pageParam }) =>
      fetchGemNewsPage({ region, topic }, pageParam ?? null, NEWS_PAGE_SIZE),
    initialPageParam: null as Awaited<ReturnType<typeof fetchGemNewsPage>>['cursor'],
    getNextPageParam: (last) => (last.hasMore ? last.cursor : undefined),
    enabled: mainTab === 'news',
  });

  const showsQuery = useQuery({
    queryKey: ['exhibitions-upcoming', region],
    queryFn: () => fetchUpcomingExhibitions(region, 20),
    enabled: mainTab === 'shows',
  });

  const articles = useMemo(
    () => newsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [newsQuery.data],
  );

  const refreshing =
    mainTab === 'news' ? newsQuery.isRefetching : showsQuery.isRefetching;

  async function onRefresh() {
    if (mainTab === 'news') await newsQuery.refetch();
    else await showsQuery.refetch();
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Gem News" />

      <View style={styles.filters}>
        <View style={[styles.segment, { backgroundColor: colors.surfaceContainerLow }]}>
          {(
            [
              { id: 'news' as const, label: 'News' },
              { id: 'shows' as const, label: 'Shows' },
            ] as const
          ).map((tab) => {
            const active = mainTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setMainTab(tab.id)}
                style={[styles.segmentBtn, active && { backgroundColor: colors.primary }]}>
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? colors.onPrimary : colors.onSurfaceVariant },
                  ]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.segment, { backgroundColor: colors.surfaceContainerLow }]}>
          {NEWS_REGIONS.map((r) => {
            const active = region === r.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => setRegion(r.id)}
                style={[styles.segmentBtn, active && { backgroundColor: colors.primary }]}>
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? colors.onPrimary : colors.onSurfaceVariant },
                  ]}>
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mainTab === 'news' ? (
          <FlatList
            horizontal
            data={NEWS_TOPICS}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.topicRow}
            renderItem={({ item }) => {
              const active = topic === item.id;
              return (
                <Pressable
                  onPress={() => setTopic(active ? null : item.id)}
                  style={[
                    styles.topicChip,
                    {
                      backgroundColor: active ? colors.primary : colors.surfaceContainerHigh,
                      borderColor: active ? colors.primary : colors.outlineVariant,
                    },
                  ]}>
                  <Text
                    style={{
                      color: active ? colors.onPrimary : colors.onSurface,
                      fontWeight: '600',
                      fontSize: 13,
                    }}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
          />
        ) : null}
      </View>

      {mainTab === 'news' ? (
        <FlatList
          data={articles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
          onEndReached={() => {
            if (newsQuery.hasNextPage && !newsQuery.isFetchingNextPage) {
              void newsQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            newsQuery.isLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
              <EmptyState
                icon="newspaper"
                title="No articles yet"
                subtitle="Try another region or topic, or check back after the next sync."
              />
            )
          }
          ListFooterComponent={
            newsQuery.isFetchingNextPage ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
            ) : null
          }
          renderItem={({ item }) => <NewsArticleCard article={item} />}
        />
      ) : (
        <FlatList
          data={showsQuery.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
          ListEmptyComponent={
            showsQuery.isLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
              <EmptyState
                icon="event"
                title="No upcoming shows"
                subtitle="Exhibition dates appear here when sources sync."
              />
            )
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.showCard,
                { backgroundColor: colors.surfaceContainerLowest },
              ]}>
              <Text style={[styles.showTitle, { color: colors.onSurface }]} selectable>
                {item.title}
              </Text>
              <View style={styles.showMetaRow}>
                {item.country ? (
                  <CountryFlag country={item.country} size="xs" />
                ) : null}
                <Text style={[styles.showMeta, { color: colors.textMuted }]} selectable>
                  {item.venue}
                  {item.city ? ` · ${item.city}` : ''}
                  {item.country ? `, ${item.country}` : ''}
                </Text>
              </View>
              <Text style={[styles.showDates, { color: colors.primary }]}>
                {formatDate(item.startDate)}
                {item.endDate ? ` – ${formatDate(item.endDate)}` : ''}
              </Text>
              <Text style={[styles.showRegion, { color: colors.textMuted }]}>
                {item.region === 'local' ? 'Local' : 'Global'} · {item.sourceId}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  filters: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  segmentText: { ...Typography.labelMd, fontWeight: '700' },
  topicRow: { gap: 8, paddingVertical: 4 },
  topicChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  list: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 48,
    gap: Spacing.md,
  },
  showCard: {
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    padding: Spacing.gutterMd,
    gap: 6,
  },
  showMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  showTitle: { ...Typography.bodyLg, fontWeight: '700' },
  showMeta: { ...Typography.bodyMd, flexShrink: 1 },
  showDates: { ...Typography.labelMd, fontWeight: '700', marginTop: 4 },
  showRegion: { ...Typography.labelMd, textTransform: 'capitalize' },
});
