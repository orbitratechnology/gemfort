import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { NEWS_TOPICS } from '@/constants/news';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatDate } from '@/lib/utils';
import type { GemNewsArticle, NewsTopic } from '@/types';

export async function openNewsArticle(url: string) {
  await openBrowserAsync(url, {
    presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
  });
}

function topicLabel(id: NewsTopic) {
  return NEWS_TOPICS.find((t) => t.id === id)?.label ?? id;
}

export function NewsArticleCard({
  article,
  compact = false,
}: {
  article: GemNewsArticle;
  compact?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${article.title}. ${article.source}`}
      onPress={() => void openNewsArticle(article.url)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surfaceContainerLowest,
          opacity: pressed ? 0.92 : 1,
          padding: compact ? Spacing.md : Spacing.gutterMd,
        },
      ]}>
      <View style={styles.metaRow}>
        <Text style={[styles.source, { color: colors.primary }]} numberOfLines={1}>
          {article.source}
        </Text>
        <Text style={[styles.date, { color: colors.textMuted }]}>
          {formatDate(article.publishedAt)}
        </Text>
      </View>
      <Text
        style={[styles.title, { color: colors.onSurface }]}
        numberOfLines={compact ? 2 : 3}
        selectable>
        {article.title}
      </Text>
      {!compact ? (
        <Text
          style={[styles.summary, { color: colors.textMuted }]}
          numberOfLines={3}
          selectable>
          {article.summary}
        </Text>
      ) : null}
      <View style={styles.footer}>
        <View style={styles.topics}>
          {(article.topics ?? []).slice(0, 3).map((topic) => (
            <View
              key={topic}
              style={[styles.topicPill, { backgroundColor: colors.surfaceContainerHigh }]}>
              <Text style={[styles.topicText, { color: colors.onSurfaceVariant }]}>
                {topicLabel(topic)}
              </Text>
            </View>
          ))}
        </View>
        <Icon name="open-in-new" size={16} color={colors.outline} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    gap: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  source: { ...Typography.labelMd, fontWeight: '700', flexShrink: 1 },
  date: { ...Typography.labelMd },
  title: { ...Typography.bodyLg, fontWeight: '700' },
  summary: { ...Typography.bodyMd, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: 2,
  },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  topicPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  topicText: { ...Typography.labelMd, fontSize: 11, fontWeight: '600' },
});
