import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { formatGemType } from '@/constants/gem-options';
import { useAppTheme } from '@/hooks/use-app-theme';
import type { Business } from '@/types';

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function roleFor(b: Business): 'Trader' | 'Lapidary' | 'Gem Lab' {
  if (b.businessType === 'gem_lab' || b.labProfile) return 'Gem Lab';
  if (b.businessType === 'lapidary' || b.providerProfile) return 'Lapidary';
  return 'Trader';
}

function specialties(b: Business): string[] {
  const raw =
    b.sellerProfile?.gemSpecializations?.slice(0, 2) ??
    b.providerProfile?.gemSpecializations?.slice(0, 2) ??
    b.labProfile?.reportTypes?.slice(0, 2) ??
    [];
  return raw.map((s) => formatGemType(s));
}

type HomeBusinessRailProps = {
  businesses: Business[];
  onPress: (business: Business) => void;
  emptyLabel: string;
  onBrowse: () => void;
  roleHint?: 'Trader' | 'Lapidary' | 'Gem Lab';
};

/** Horizontal rail of recognition-first business cards (Workspace-aligned). */
export function HomeBusinessRail({
  businesses,
  onPress,
  emptyLabel,
  onBrowse,
  roleHint,
}: HomeBusinessRailProps) {
  const { colors } = useAppTheme();

  if (!businesses.length) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={emptyLabel}
        onPress={onBrowse}
        style={({ pressed }) => [
          styles.empty,
          {
            backgroundColor: colors.surfaceContainerLowest,
            opacity: pressed ? 0.94 : 1,
          },
        ]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.primaryContainer }]}>
          <Icon name="storefront" size={18} color={colors.onPrimaryContainer} />
        </View>
        <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
          {emptyLabel}
        </Text>
        <Icon name="chevron-right" size={18} color={colors.outline} />
      </Pressable>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
    >
      {businesses.map((b) => {
        const verified = b.badges.isVerified;
        const role = roleHint ?? roleFor(b);
        const specs = specialties(b);
        const years = b.badges.yearsActive;

        return (
          <Pressable
            key={b.id}
            accessibilityRole="button"
            accessibilityLabel={`${b.businessName}, ${role}, ${b.city}`}
            onPress={() => onPress(b)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.surfaceContainerLowest,
                opacity: pressed ? 0.94 : 1,
              },
            ]}>
            <View style={styles.cardTop}>
              <View
                style={[
                  styles.logo,
                  {
                    backgroundColor: colors.surfaceContainerHigh,
                    borderColor: colors.surfaceContainerLowest,
                  },
                ]}>
                {b.logoUrl ? (
                  <Image source={{ uri: b.logoUrl }} style={styles.logoImg} contentFit="cover" />
                ) : (
                  <Text style={[styles.logoInitials, { color: colors.primary }]}>
                    {initials(b.businessName)}
                  </Text>
                )}
              </View>
              {verified ? (
                <View style={[styles.verified, { backgroundColor: colors.primaryContainer }]}>
                  <Icon name="verified" size={14} color={colors.onPrimaryContainer} />
                </View>
              ) : null}
            </View>

            <Text style={[styles.role, { color: colors.textMuted }]}>{role}</Text>
            <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={2}>
              {b.businessName}
            </Text>

            <View style={styles.metaRow}>
              <Icon name="location-on" size={13} color={colors.textMuted} />
              <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                {b.city}
                {years > 0 ? ` · ${years}y` : ''}
              </Text>
            </View>

            {specs.length > 0 ? (
              <View style={styles.tags}>
                {specs.map((s) => (
                  <View
                    key={s}
                    style={[styles.tag, { backgroundColor: colors.surfaceContainerLow }]}>
                    <Text
                      style={[styles.tagText, { color: colors.onSurfaceVariant }]}
                      numberOfLines={1}>
                      {s}
                    </Text>
                  </View>
                ))}
              </View>
            ) : b.shortDescription ? (
              <Text
                style={[styles.blurb, { color: colors.onSurfaceVariant }]}
                numberOfLines={2}>
                {b.shortDescription}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: {
    gap: Spacing.stackMd,
    paddingRight: 4,
  },
  card: {
    width: 188,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    padding: 14,
    gap: 6,
    boxShadow: '0 2px 12px rgba(15, 118, 110, 0.06)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  logoImg: { width: '100%', height: '100%' },
  logoInitials: { fontSize: 18, fontWeight: '700', letterSpacing: 0.4 },
  verified: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  role: {
    ...Typography.caption,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  name: {
    ...Typography.bodyLg,
    fontWeight: '700',
    lineHeight: 22,
    minHeight: 44,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  meta: { ...Typography.caption, flex: 1, fontWeight: '500' },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
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
    marginTop: 2,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    minHeight: 64,
    boxShadow: '0 2px 12px rgba(15, 118, 110, 0.06)',
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { ...Typography.bodyMd, flex: 1 },
});
