import { Image } from 'expo-image';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type BrandMarkProps = {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  /** Prefer mark-only in tight chrome; wordmark lockup uses logo.png */
  variant?: 'mark' | 'lockup';
  style?: ViewStyle;
};

const sizes = { sm: 32, md: 44, lg: 64 } as const;

/** GemFort brand mark — faceted G from assets/images */
export function BrandMark({
  size = 'md',
  showWordmark = false,
  variant = 'mark',
  style,
}: BrandMarkProps) {
  const { colors } = useAppTheme();
  const dim = sizes[size];

  if (variant === 'lockup') {
    return (
      <View style={[styles.wrap, style]} accessibilityRole="image" accessibilityLabel="GemFort">
        <Image
          source={require('@/assets/images/logo.png')}
          style={[styles.lockup, { height: dim * 1.15 }]}
          contentFit="contain"
        />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]} accessibilityRole="image" accessibilityLabel="GemFort">
      <Image
        source={require('@/assets/images/icon-transparent.png')}
        style={{ width: dim, height: dim }}
        contentFit="contain"
      />
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
  lockup: {
    width: 220,
    maxWidth: '100%',
  },
  wordmark: {
    ...Typography.h2,
    letterSpacing: -0.4,
  },
});
