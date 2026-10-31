import { Image, type ImageSource } from 'expo-image';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { FontFamily } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

/** Three-per-row grid for `ActionTile`s; each cell is the whole touch target. */
export function ActionTileGrid({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.grid, style]}>{children}</View>;
}

/**
 * Sheet action tile: artwork (standing on its own) or a tinted icon circle
 * over a short label. Used by the Scan and Quick actions sheets.
 */
export function ActionTile({
  label,
  accessibilityLabel,
  hint,
  icon,
  image,
  accent,
  busy = false,
  disabled = false,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  hint?: string;
  icon: IconName;
  image?: ImageSource | number;
  /** Tint for icon tiles; ignored when `image` is set. */
  accent: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={hint}
      accessibilityState={{ busy, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed, disabled && !busy && styles.dimmed]}
    >
      {/* Artwork stands on its own; only bare icons get a tinted circle. */}
      <View style={[styles.icon, !image && { backgroundColor: `${accent}1A` }]}>
        {busy ? (
          <ActivityIndicator size="small" color={accent} />
        ) : image ? (
          <Image source={image} style={styles.image} contentFit="contain" accessibilityIgnoresInvertColors />
        ) : (
          <Icon name={icon} size={30} color={accent} />
        )}
      </View>
      <Text style={[styles.label, { color: colors.onSurface }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  tile: {
    width: '33.333%',
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  dimmed: { opacity: 0.5 },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: 60, height: 60 },
  label: { includeFontPadding: false, fontFamily: FontFamily.semibold, fontSize: 14 },
});
