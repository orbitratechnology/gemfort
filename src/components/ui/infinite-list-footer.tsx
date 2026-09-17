import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

export function InfiniteListFooter({
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  onRetry,
}: {
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  onRetry: () => void;
}) {
  const { colors } = useAppTheme();

  if (!hasNextPage && !isFetchingNextPage && !isFetchNextPageError) return null;

  return (
    <View style={styles.container}>
      {isFetchingNextPage ? (
        <ActivityIndicator color={colors.primary} />
      ) : isFetchNextPageError ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry loading more"
          style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.retryText, { color: colors.primary }]}>Retry loading more</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  retry: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  retryText: { ...Typography.labelMd, fontWeight: '700' },
});
