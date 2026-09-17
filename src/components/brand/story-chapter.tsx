import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type StoryChapterProps = {
  step?: number;
  total?: number;
  title: string;
  body: string;
  accent?: 'primary' | 'accent' | 'success';
  align?: 'left' | 'center';
};

export function StoryChapter({
  step,
  total,
  title,
  body,
  accent = 'primary',
  align = 'left',
}: StoryChapterProps) {
  const { colors } = useAppTheme();
  const isCentered = align === 'center';

  const accentColor =
    accent === 'accent' ? colors.accent : accent === 'success' ? colors.primary : colors.primary;

  return (
    <View style={[styles.wrap, isCentered && styles.centeredWrap]}>
      {step != null && total != null ? (
        <Text
          style={[styles.step, isCentered && styles.centeredText, { color: colors.textMuted }]}
        >
          {step} of {total}
        </Text>
      ) : null}
      <View
        style={[
          styles.accentBar,
          isCentered && styles.centeredAccentBar,
          { backgroundColor: accentColor },
        ]}
      />
      <Text style={[styles.title, isCentered && styles.centeredText, { color: colors.text }]}>
        {title}
      </Text>
      <Text
        style={[styles.body, isCentered && styles.centeredText, { color: colors.textSecondary }]}
      >
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  centeredWrap: {
    alignItems: 'center',
  },
  centeredText: {
    textAlign: 'center',
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
  centeredAccentBar: {
    alignSelf: 'center',
  },
  title: {
    ...Typography.story,
  },
  body: {
    ...Typography.bodyLarge,
    maxWidth: 320,
  },
});
