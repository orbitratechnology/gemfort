import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NewsArticleCard } from '@/components/news/news-article-card';
import { Icon } from '@/components/ui/icon';
import { Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatDate } from '@/lib/utils';
import type { GemExhibition, GemNewsArticle } from '@/types';

export function HomeNewsTeaser({
  local,
  global,
  exhibitions,
}: {
  local: GemNewsArticle[];
  global: GemNewsArticle[];
  exhibitions: GemExhibition[];
}) {
  const { colors } = useAppTheme();
  const hasNews = local.length > 0 || global.length > 0;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Gem News</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See all gem news"
          onPress={() => router.push('/news' as Href)}
          hitSlop={8}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
        </Pressable>
      </View>

      {exhibitions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.showsRow}>
          {exhibitions.map((show) => (
            <Pressable
              key={show.id}
              accessibilityRole="button"
              accessibilityLabel={`${show.title} exhibition`}
              onPress={() =>
                router.push({ pathname: '/news', params: { tab: 'shows' } } as unknown as Href)
              }
              style={[styles.showChip, { backgroundColor: colors.primaryContainer }]}>
              <Icon name="event" size={14} color={colors.onPrimaryContainer} />
              <Text
                style={[styles.showChipText, { color: colors.onPrimaryContainer }]}
                numberOfLines={1}>
                {show.title}
              </Text>
              <Text style={[styles.showChipDate, { color: colors.onPrimaryContainer }]}>
                {formatDate(show.startDate)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {!hasNews ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          Trade news will appear here as sources sync.
        </Text>
      ) : (
        <>
          {local.length > 0 ? (
            <View style={styles.block}>
              <Text style={[styles.regionLabel, { color: colors.textMuted }]}>LOCAL</Text>
              <View style={styles.cards}>
                {local.map((article) => (
                  <NewsArticleCard key={article.id} article={article} compact />
                ))}
              </View>
            </View>
          ) : null}
          {global.length > 0 ? (
            <View style={styles.block}>
              <Text style={[styles.regionLabel, { color: colors.textMuted }]}>GLOBAL</Text>
              <View style={styles.cards}>
                {global.map((article) => (
                  <NewsArticleCard key={article.id} article={article} compact />
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md, paddingHorizontal: Spacing.containerMargin },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { ...Typography.headlineSmMobile },
  seeAll: { ...Typography.labelMd, fontWeight: '700' },
  showsRow: { gap: Spacing.sm, paddingRight: Spacing.containerMargin },
  showChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: 260,
  },
  showChipText: { ...Typography.labelMd, fontWeight: '700', flexShrink: 1 },
  showChipDate: { ...Typography.labelMd, opacity: 0.85 },
  block: { gap: Spacing.sm },
  regionLabel: { ...Typography.labelMd, letterSpacing: 0.6, fontWeight: '700' },
  cards: { gap: Spacing.sm },
  empty: { ...Typography.bodyMd },
});
