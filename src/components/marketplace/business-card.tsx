import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Typography } from '@/constants/design-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';
import type { Business } from '@/types';

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

type BusinessCardProps = {
  business: Business;
  onPress?: () => void;
  /** Visual cue for sellers vs providers in mixed contexts */
  roleLabel?: 'Seller' | 'Provider';
};

/**
 * Seller / Provider tile for 2-column ecommerce grids.
 * Cover-led with overlapping logo, compact trust signals.
 */
export function BusinessCard({ business, onPress, roleLabel }: BusinessCardProps) {
  const { colors } = useAppTheme();
  const specs =
    business.sellerProfile?.gemSpecializations?.slice(0, 2) ??
    business.providerProfile?.gemSpecializations?.slice(0, 2) ??
    [];
  const verified = business.badges.isVerified;
  const endorsements = business.badges.endorsementCount;
  const inferredRole =
    roleLabel ??
    (business.sellerProfile ? 'Seller' : business.providerProfile ? 'Provider' : undefined);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={business.businessName}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surfaceContainerLowest,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}>
      <View style={styles.cover}>
        {business.coverPhotoUrl ? (
          <Image source={{ uri: business.coverPhotoUrl }} style={styles.coverImage} contentFit="cover" />
        ) : (
          <View style={[styles.coverImage, styles.coverPlaceholder, { backgroundColor: colors.surfaceContainerHigh }]}>
            <Icon name="store" size={28} color={colors.outlineVariant} />
          </View>
        )}
        <View style={styles.coverScrim} />
        {verified ? (
          <View style={[styles.verifiedPill, { backgroundColor: colors.surfaceGlass }]}>
            <Icon name="verified" size={12} color={colors.accent} />
          </View>
        ) : null}
        <View
          style={[
            styles.logoWrap,
            {
              borderColor: colors.surfaceContainerLowest,
              backgroundColor: colors.surfaceContainerHigh,
            },
          ]}>
          {business.logoUrl ? (
            <Image source={{ uri: business.logoUrl }} style={styles.logo} contentFit="cover" />
          ) : (
            <Text style={[styles.logoInitials, { color: colors.primary }]}>
              {initials(business.businessName)}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.body}>
        {inferredRole ? (
          <Text style={[styles.role, { color: colors.textMuted }]}>{inferredRole}</Text>
        ) : null}
        <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={2}>
          {business.businessName}
        </Text>
        <View style={styles.locationRow}>
          <Icon name="location-on" size={12} color={colors.textMuted} />
          <Text style={[styles.location, { color: colors.textMuted }]} numberOfLines={1}>
            {business.city}
            {business.district ? `, ${business.district}` : ''}
          </Text>
        </View>

        {endorsements > 0 ? (
          <View style={styles.ratingRow}>
            <Icon name="star" size={12} color={colors.warningAmber} />
            <Text style={[styles.ratingText, { color: colors.onSurfaceVariant }]}>
              {endorsements}
            </Text>
          </View>
        ) : null}

        {specs.length > 0 ? (
          <View style={styles.tags}>
            {specs.map((s) => (
              <View key={s} style={[styles.tag, { backgroundColor: colors.surfaceContainerLow }]}>
                <Text style={[styles.tagText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                  {s.replace(/_/g, ' ')}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    boxShadow: '0 4px 16px rgba(15, 118, 110, 0.08)',
  },
  cover: {
    width: '100%',
    aspectRatio: 4 / 3,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  verifiedPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    position: 'absolute',
    bottom: -18,
    left: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: '100%', height: '100%' },
  logoInitials: { fontSize: 13, fontWeight: '700' },
  body: {
    paddingTop: 24,
    paddingHorizontal: 10,
    paddingBottom: 12,
    gap: 3,
  },
  role: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  name: {
    ...Typography.bodyMd,
    fontWeight: '600',
    lineHeight: 18,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  location: {
    ...Typography.caption,
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  ratingText: {
    ...Typography.caption,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    maxWidth: '100%',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
});
