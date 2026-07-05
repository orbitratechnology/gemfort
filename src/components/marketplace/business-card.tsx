import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
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

export function BusinessCard({
  business,
  onPress,
}: {
  business: Business;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const specs =
    business.sellerProfile?.gemSpecializations?.slice(0, 3) ??
    business.providerProfile?.gemSpecializations?.slice(0, 3) ??
    [];
  const verified = business.badges.isVerified;
  const endorsements = business.badges.endorsementCount;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surfaceContainerLowest },
        pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
      ]}>
      {/* Cover */}
      <View style={styles.cover}>
        {business.coverPhotoUrl ? (
          <Image source={{ uri: business.coverPhotoUrl }} style={styles.coverImage} />
        ) : (
          <View style={[styles.coverPlaceholder, { backgroundColor: colors.surfaceContainerHigh }]}>
            <Icon name="image" size={40} color={colors.outlineVariant} />
          </View>
        )}
        <View style={styles.coverOverlay} />
        {/* Overlapping logo */}
        <View style={[styles.logoWrap, { borderColor: colors.surfaceContainerLowest, backgroundColor: colors.surfaceContainerHigh }]}>
          {business.logoUrl ? (
            <Image source={{ uri: business.logoUrl }} style={styles.logo} />
          ) : (
            <Text style={[styles.logoInitials, { color: colors.primary }]}>
              {initials(business.businessName)}
            </Text>
          )}
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <Text style={[styles.name, { color: colors.primary }]} numberOfLines={1}>
              {business.businessName}
            </Text>
            <View style={styles.locationRow}>
              <Icon name="location-on" size={16} color={colors.textMuted} />
              <Text style={[styles.location, { color: colors.textMuted }]} numberOfLines={1}>
                {business.city}
                {business.district ? `, ${business.district}` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.titleRight}>
            {verified ? (
              <View style={[styles.trustBadge, { backgroundColor: colors.secondaryContainer + '33' }]}>
                <Icon name="verified" size={14} color={colors.accent} />
                <Text style={[styles.trustText, { color: colors.accent }]}>Trusted</Text>
              </View>
            ) : null}
            {endorsements > 0 ? (
              <View style={styles.ratingRow}>
                <Icon name="star" size={14} color={colors.warningAmber} />
                <Text style={[styles.ratingText, { color: colors.textMain }]}>
                  {endorsements}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {business.shortDescription ? (
          <Text style={[styles.desc, { color: colors.textMuted }]} numberOfLines={2}>
            {business.shortDescription}
          </Text>
        ) : null}

        {specs.length > 0 ? (
          <View style={styles.tags}>
            {specs.map((s) => (
              <View key={s} style={[styles.tag, { backgroundColor: colors.surfaceContainerLow }]}>
                <Text style={[styles.tagText, { color: colors.textMain }]}>
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
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.05,
    shadowRadius: 30,
    elevation: 3,
  },
  cover: { height: 128, width: '100%', position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  logoWrap: {
    position: 'absolute',
    bottom: -24,
    left: Spacing.gutterMd,
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: '100%', height: '100%' },
  logoInitials: { ...Typography.headlineMd },
  body: { paddingTop: 32, paddingBottom: 20, paddingHorizontal: Spacing.gutterMd },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleLeft: { flex: 1, marginRight: 8 },
  name: { ...Typography.headlineSm },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  location: { ...Typography.bodyMd, flexShrink: 1 },
  titleRight: { alignItems: 'flex-end', gap: 4 },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  trustText: { ...Typography.labelMd },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { ...Typography.labelMd },
  desc: { ...Typography.bodyMd, marginTop: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  tag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full },
  tagText: { ...Typography.labelMd, textTransform: 'capitalize' },
});
