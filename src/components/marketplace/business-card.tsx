import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Typography } from '@/constants/design-tokens';
import { formatGemType } from '@/constants/gem-options';
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
  roleLabel?: 'Trader' | 'Lapidary' | 'Gem Lab' | 'Seller' | 'Provider';
};

/**
 * Directory tile — recognition-first: logo, role, name, place, specialty.
 */
export function BusinessCard({ business, onPress, roleLabel }: BusinessCardProps) {
  const { colors } = useAppTheme();
  const rawSpecs =
    business.sellerProfile?.gemSpecializations?.slice(0, 2) ??
    business.providerProfile?.gemSpecializations?.slice(0, 2) ??
    business.labProfile?.reportTypes?.slice(0, 2) ??
    [];
  const specs = rawSpecs.map((s) => formatGemType(s));
  const verified = business.badges.isVerified;
  const years = business.badges.yearsActive;
  const inferredRole =
    roleLabel ??
    (business.businessType === 'gem_lab' || business.labProfile
      ? 'Gem Lab'
      : business.businessType === 'lapidary' || business.providerProfile
        ? 'Lapidary'
        : 'Trader');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${business.businessName}, ${inferredRole}, ${business.city}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surfaceContainerLowest,
          opacity: pressed ? 0.94 : 1,
        },
      ]}>
      <View style={styles.header}>
        <View
          style={[
            styles.logo,
            { backgroundColor: colors.surfaceContainerHigh },
          ]}>
          {business.logoUrl ? (
            <Image source={{ uri: business.logoUrl }} style={styles.logoImg} contentFit="cover" />
          ) : business.coverPhotoUrl ? (
            <Image
              source={{ uri: business.coverPhotoUrl }}
              style={styles.logoImg}
              contentFit="cover"
            />
          ) : (
            <Text style={[styles.logoInitials, { color: colors.primary }]}>
              {initials(business.businessName)}
            </Text>
          )}
        </View>
        {verified ? (
          <View style={[styles.verified, { backgroundColor: colors.primaryContainer }]}>
            <Icon name="verified" size={14} color={colors.onPrimaryContainer} />
          </View>
        ) : null}
      </View>

      <Text style={[styles.role, { color: colors.textMuted }]}>{inferredRole}</Text>
      <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={2}>
        {business.businessName}
      </Text>

      <View style={styles.locationRow}>
        <Icon name="location-on" size={12} color={colors.textMuted} />
        <Text style={[styles.location, { color: colors.textMuted }]} numberOfLines={1}>
          {business.city}
          {business.district ? `, ${business.district}` : ''}
          {years > 0 ? ` · ${years}y` : ''}
        </Text>
      </View>

      {specs.length > 0 ? (
        <View style={styles.tags}>
          {specs.map((s) => (
            <View key={s} style={[styles.tag, { backgroundColor: colors.surfaceContainerLow }]}>
              <Text style={[styles.tagText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                {s}
              </Text>
            </View>
          ))}
        </View>
      ) : business.shortDescription ? (
        <Text style={[styles.blurb, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
          {business.shortDescription}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    padding: 14,
    gap: 4,
    boxShadow: '0 2px 12px rgba(15, 118, 110, 0.06)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: { width: '100%', height: '100%' },
  logoInitials: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  verified: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  role: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  name: {
    ...Typography.bodyLg,
    fontWeight: '700',
    lineHeight: 22,
    minHeight: 44,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  location: {
    ...Typography.caption,
    flex: 1,
    fontWeight: '500',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    maxWidth: '100%',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  blurb: {
    ...Typography.caption,
    lineHeight: 16,
    marginTop: 6,
  },
});
