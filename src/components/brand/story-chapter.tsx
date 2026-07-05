import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type StoryChapterProps = {
  step?: number;
  total?: number;
  title: string;
  body: string;
  accent?: 'primary' | 'accent' | 'success';
};

export function StoryChapter({ step, total, title, body, accent = 'primary' }: StoryChapterProps) {
  const { colors } = useAppTheme();

  const accentColor =
    accent === 'accent' ? colors.accent : accent === 'success' ? colors.primary : colors.primary;

  return (
    <View style={styles.wrap}>
      {step != null && total != null ? (
        <Text style={[styles.step, { color: colors.textMuted }]}>
          {step} of {total}
        </Text>
      ) : null}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  step: {
    ...Typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  accentBar: {
    width: 32,
    height: 3,
    borderRadius: Radius.full,
  },
  title: {
    ...Typography.story,
  },
  body: {
    ...Typography.bodyLarge,
    maxWidth: 320,
  },
});
