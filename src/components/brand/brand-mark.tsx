import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Palette, Radius, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type BrandMarkProps = {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  style?: ViewStyle;
};

const sizes = { sm: 32, md: 44, lg: 56 } as const;

/** Geometric gem facet mark — brand logo without external assets */
export function BrandMark({ size = 'md', showWordmark = false, style }: BrandMarkProps) {
  const { colors } = useAppTheme();
  const dim = sizes[size];

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.mark, { width: dim, height: dim, borderRadius: dim * 0.22 }]}>
        <View style={[styles.facetTop, { borderBottomColor: colors.accent }]} />
        <View style={[styles.facetBottom, { backgroundColor: colors.primary }]} />
        <View style={[styles.facetShine, { backgroundColor: colors.accentSoft }]} />
      </View>
      {showWordmark ? (
        <Text style={[styles.wordmark, { color: colors.text }]}>GemFort</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mark: {
    overflow: 'hidden',
    backgroundColor: Palette.gemBlueDark,
  },
  facetTop: {
    position: 'absolute',
    top: 0,
    left: '15%',
    right: '15%',
    height: '42%',
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 28,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    opacity: 0.95,
  },
  facetBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '58%',
    opacity: 0.92,
  },
  facetShine: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.7,
  },
  wordmark: {
    ...Typography.h2,
    letterSpacing: -0.4,
  },
});
