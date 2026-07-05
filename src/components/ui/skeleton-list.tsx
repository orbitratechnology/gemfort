import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

export function SkeletonList({ count = 3 }: { count?: number }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[styles.item, { backgroundColor: colors.skeleton }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.md, padding: Spacing.lg },
  item: {
    height: 88,
    borderRadius: Radius.md,
    opacity: 0.6,
  },
});
