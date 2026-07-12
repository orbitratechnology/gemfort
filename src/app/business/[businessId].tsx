import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FontAwesome6 } from '@react-native-vector-icons/fontawesome6/static';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FraudReportSheet } from '@/components/marketplace/fraud-report-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { ThemedScrollView } from '@/components/ui/screen';
import { BrandPalette, Radius, Spacing, Typography } from '@/constants/design-tokens';
import { formatGemType } from '@/constants/gem-options';
import {
  demoBusinesses,
  fetchBusiness,
  fetchBusinessByOwnerUid,
  sendEndorsement,
  trackBusinessAnalytics,
} from '@/features/marketplace/marketplace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { formatCurrency, openPhone, openWhatsApp } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import type { Business, BusinessType } from '@/types';

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function roleLabel(type: BusinessType, isProvider: boolean): string {
  if (type === 'gem_lab' || type === 'lab') return 'Gem Lab';
  if (type === 'trader' || type === 'seller') return 'Trader';
  if (type === 'lapidary' || isProvider) return 'Lapidary';
  return isProvider ? 'Lapidary' : 'Trader';
}

function tierLabel(tier: Business['verificationTier']): string {
  if (tier === 'full') return 'Full verified';
  if (tier === 'basic') return 'Basic verified';
  return 'Member';
}

function labelize(value: string): string {
  try {
    return formatGemType(value);
  } catch {
    return value.replace(/_/g, ' ');
  }
}

type StatItem = { label: string; value: string; icon: React.ComponentProps<typeof Icon>['name'] };

export default function BusinessProfileScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { colors } = useAppTheme();
  const { user, profile } = useAuth();
  const toast = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const [endorsing, setEndorsing] = useState(false);

  const { data: business, isLoading } = useQuery({
    queryKey: ['business', businessId],
    queryFn: async () => {
      if (!isFirebaseConfigured) {
        return demoBusinesses().find((b) => b.id === businessId) ?? null;
      }
      try {
        return await fetchBusiness(businessId!);
      } catch {
        return demoBusinesses().find((b) => b.id === businessId) ?? null;
      }
    },
    enabled: !!businessId,
  });

  const { data: myBusiness } = useQuery({
    queryKey: ['my-business', user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    enabled: !!user && isFirebaseConfigured,
  });

  useEffect(() => {
    if (business?.id) void trackBusinessAnalytics(business.id, 'profileViewsTotal');
  }, [business?.id]);

  const isProvider = !!business?.providerProfile;
  const isSeller = !!business?.sellerProfile;
  const specs = useMemo(
    () =>
      business?.sellerProfile?.gemSpecializations ??
      business?.providerProfile?.gemSpecializations ??
      [],
    [business],
  );
  const services = business?.providerProfile?.services?.filter((s) => s.isActive) ?? [];

  const isOwnBusiness = !!user && user.uid === business?.ownerUid;
  const isVerifiedMember =
    profile?.verificationStatus === 'verified' &&
    (profile?.role === 'trader' || profile?.role === 'lapidary' || profile?.role === 'gem_lab');
  const isVerifiedTrader = profile?.verificationStatus === 'verified' && profile?.role === 'trader';
  const canEndorse = !!user && isVerifiedMember && !!myBusiness && !isOwnBusiness;
  const isLab =
    business?.businessType === 'gem_lab' ||
    business?.businessType === 'lab' ||
    !!business?.labProfile;
  const canRequestService = isVerifiedTrader && isProvider && !isOwnBusiness && !isLab;
  const canRequestCert = isVerifiedTrader && isLab && !isOwnBusiness;

  const stats: StatItem[] = useMemo(() => {
    if (!business) return [];
    const items: StatItem[] = [
      {
        label: 'Years',
        value: String(business.badges.yearsActive || business.yearEstablished || '-'),
        icon: 'schedule',
      },
      {
        label: 'Endorsed',
        value: String(business.badges.endorsementCount),
        icon: 'thumb-up',
      },
    ];
    if (business.badges.isNgjaRegistered) {
      items.push({ label: 'NGJA', value: 'Yes', icon: 'workspace-premium' });
    }
    if (isProvider) {
      items.push({
        label: 'Orders',
        value: business.providerProfile?.isAcceptingOrders ? 'Open' : 'Closed',
        icon: business.providerProfile?.isAcceptingOrders ? 'lock-open' : 'lock',
      });
    } else if (business.sellerProfile?.priceRangeMin != null) {
      items.push({
        label: 'From',
        value: formatCurrency(
          business.sellerProfile.priceRangeMin,
          business.sellerProfile.preferredCurrencies?.[0] ?? 'LKR',
        ).replace(/\.00$/, ''),
        icon: 'payments',
      });
    }
    return items.slice(0, 4);
  }, [business, isProvider]);

  async function handleEndorse() {
    if (!user || !myBusiness || !business) return;
    setEndorsing(true);
    try {
      await sendEndorsement({
        fromUid: user.uid,
        fromBusinessId: myBusiness.id,
        toBusinessId: business.id,
      });
      toast.success(`You endorsed ${business.businessName}.`);
    } catch (e) {
      const msg = friendlyError(e, 'Could not send endorsement.');
      toast.error(
        msg.includes('PERMISSION') || msg.includes('already')
          ? 'You already endorsed this business.'
          : msg,
      );
    } finally {
      setEndorsing(false);
    }
  }

  if (isLoading || !business) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <StackHeader title="Profile" />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>
            {isLoading ? 'Loading profile…' : 'Business not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const role = roleLabel(business.businessType, isProvider);
  const locationLine = [business.city, business.district, business.country]
    .filter(Boolean)
    .join(', ');
  const hasWhatsApp = business.contacts?.whatsapp?.isVisible;
  const hasPhone = business.contacts?.phone?.isVisible;
  const hasEmail = business.contacts.email?.isVisible;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader
        title={role}
        right={
          user && !isOwnBusiness ? (
            <Pressable
              onPress={() => setReportOpen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Report business"
              style={styles.headerAction}>
              <Icon name="flag" size={20} color={colors.onSurfaceVariant} />
            </Pressable>
          ) : null
        }
      />

      <ThemedScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.coverWrap}>
            {business.coverPhotoUrl ? (
              <Image
                source={{ uri: business.coverPhotoUrl }}
                style={styles.cover}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  styles.cover,
                  {
                    backgroundColor: colors.primaryContainer,
                  },
                ]}>
                <View style={styles.coverFallbackPattern}>
                  <Icon name="diamond" size={48} color={colors.onPrimaryContainer + '33'} />
                </View>
              </View>
            )}
            <View style={styles.coverScrim} />
          </View>

          <View style={styles.avatarRow}>
            <View style={styles.logoWrap}>
              <View
                style={[
                  styles.logo,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.background,
                  },
                ]}>
                {business.logoUrl ? (
                  <Image
                    source={{ uri: business.logoUrl }}
                    style={styles.logoImg}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={[styles.logoInitials, { color: colors.primary }]}>
                    {initials(business.businessName)}
                  </Text>
                )}
              </View>
              {business.badges.isVerified ? (
                <View
                  style={[
                    styles.verifiedBadge,
                    {
                      backgroundColor: colors.accent,
                      borderColor: colors.background,
                    },
                  ]}
                  accessibilityLabel="Verified business">
                  <Icon name="verified" size={14} color={colors.onSecondary} />
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.identityBelow}>
            <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={2}>
              {business.businessName}
            </Text>
            <Text style={[styles.roleLine, { color: colors.onSurfaceVariant }]}>
              {role}
              {business.ownerName ? ` · ${business.ownerName}` : ''}
            </Text>
            {locationLine ? (
              <View style={styles.locRow}>
                <Icon name="location-on" size={14} color={colors.textMuted} />
                <Text style={[styles.locText, { color: colors.textMuted }]} numberOfLines={1}>
                  {locationLine}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Trust chips */}
        <View style={styles.chipRow}>
          <View style={[styles.chip, { backgroundColor: colors.secondaryContainer }]}>
            <Icon name="verified" size={14} color={colors.onSecondaryContainer} />
            <Text style={[styles.chipText, { color: colors.onSecondaryContainer }]}>
              {tierLabel(business.verificationTier)}
            </Text>
          </View>
          {business.badges.isNgjaRegistered ? (
            <View style={[styles.chip, { backgroundColor: colors.surfaceContainerHigh }]}>
              <Text style={[styles.chipText, { color: colors.onSurfaceVariant }]}>NGJA</Text>
            </View>
          ) : null}
          {isProvider && business.providerProfile ? (
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: business.providerProfile.isAcceptingOrders
                    ? colors.primaryContainer
                    : colors.surfaceContainerHigh,
                },
              ]}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: business.providerProfile.isAcceptingOrders
                      ? colors.successEmerald
                      : colors.outline,
                  },
                ]}
              />
              <Text
                style={[
                  styles.chipText,
                  {
                    color: business.providerProfile.isAcceptingOrders
                      ? colors.onPrimaryContainer
                      : colors.onSurfaceVariant,
                  },
                ]}>
                {business.providerProfile.isAcceptingOrders ? 'Accepting orders' : 'Not accepting'}
              </Text>
            </View>
          ) : null}
          {business.isFeatured ? (
            <View style={[styles.chip, { backgroundColor: colors.primaryContainer }]}>
              <Icon name="star" size={14} color={colors.onPrimaryContainer} />
              <Text style={[styles.chipText, { color: colors.onPrimaryContainer }]}>Featured</Text>
            </View>
          ) : null}
        </View>

        {/* Stats */}
        {stats.length > 0 ? (
          <View style={[styles.statsCard, { backgroundColor: colors.surfaceContainerLowest }]}>
            {stats.map((stat, index) => (
              <View
                key={stat.label}
                style={[
                  styles.statCell,
                  index < stats.length - 1 && {
                    borderRightWidth: StyleSheet.hairlineWidth,
                    borderRightColor: colors.outlineVariant,
                  },
                ]}>
                <Icon name={stat.icon} size={18} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.onSurface }]} numberOfLines={1}>
                  {stat.value}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Contact */}
        {(hasWhatsApp || hasPhone || hasEmail) && !isOwnBusiness ? (
          <View style={styles.contactRow}>
            {hasWhatsApp ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="WhatsApp"
                style={({ pressed }) => [
                  styles.contactPrimary,
                  { backgroundColor: BrandPalette.whatsapp, opacity: pressed ? 0.9 : 1 },
                ]}
                onPress={() => {
                  void trackBusinessAnalytics(business.id, 'whatsappTapsTotal');
                  const wa = business.contacts?.whatsapp?.value;
                  if (wa) Linking.openURL(openWhatsApp(wa));
                }}>
                <FontAwesome6 name="whatsapp" iconStyle="brand" size={18} color={BrandPalette.white} />
                <Text style={[styles.contactPrimaryText, { color: BrandPalette.white }]}>WhatsApp</Text>
              </Pressable>
            ) : null}
            {hasPhone ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Call"
                style={({ pressed }) => [
                  styles.contactSecondary,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
                onPress={() => {
                  void trackBusinessAnalytics(business.id, 'phoneTapsTotal');
                  const phone = business.contacts?.phone?.value;
                  if (phone) Linking.openURL(openPhone(phone));
                }}>
                <Icon name="call" size={18} color={colors.primary} />
              </Pressable>
            ) : null}
            {hasEmail ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Email"
                style={({ pressed }) => [
                  styles.contactSecondary,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
                onPress={() => Linking.openURL(`mailto:${business.contacts.email.value}`)}>
                <Icon name="mail-outline" size={18} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {canRequestService || canRequestCert ? (
          <View style={{ gap: 8 }}>
            {canRequestService ? (
              <Button
                title="Request service"
                icon="handyman"
                onPress={() =>
                  router.push({
                    pathname: '/request/[businessId]',
                    params: { businessId: business.id, mode: 'service' },
                  })
                }
              />
            ) : null}
            {canRequestCert ? (
              <Button
                title="Request certification"
                icon="workspace-premium"
                onPress={() =>
                  router.push({
                    pathname: '/request/[businessId]',
                    params: { businessId: business.id, mode: 'cert' },
                  })
                }
              />
            ) : null}
          </View>
        ) : null}

        {/* About */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>About</Text>
          <Text style={[styles.aboutBody, { color: colors.onSurfaceVariant }]}>
            {business.shortDescription ||
              `${business.businessName} is a ${role.toLowerCase()} on GemFort.`}
          </Text>
          {specs.length > 0 ? (
            <View style={styles.tagRow}>
              {specs.map((s) => (
                <View key={s} style={[styles.tag, { backgroundColor: colors.surfaceContainerLow }]}>
                  <Text style={[styles.tagText, { color: colors.onSurfaceVariant }]}>
                    {labelize(s)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Seller details */}
        {isSeller && business.sellerProfile ? (
          <View style={[styles.sectionCard, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Trading focus</Text>
            <View style={styles.detailList}>
              {business.sellerProfile.sourceOrigins.length > 0 ? (
                <DetailRow
                  icon="public"
                  label="Origins"
                  value={business.sellerProfile.sourceOrigins.map(labelize).join(', ')}
                  colors={colors}
                />
              ) : null}
              {business.sellerProfile.stoneTypes.length > 0 ? (
                <DetailRow
                  icon="diamond"
                  label="Stone types"
                  value={business.sellerProfile.stoneTypes.map(labelize).join(', ')}
                  colors={colors}
                />
              ) : null}
              {business.sellerProfile.priceRangeMin != null ||
              business.sellerProfile.priceRangeMax != null ? (
                <DetailRow
                  icon="payments"
                  label="Price range"
                  value={[
                    business.sellerProfile.priceRangeMin != null
                      ? formatCurrency(
                          business.sellerProfile.priceRangeMin,
                          business.sellerProfile.preferredCurrencies?.[0] ?? 'LKR',
                        )
                      : null,
                    business.sellerProfile.priceRangeMax != null
                      ? formatCurrency(
                          business.sellerProfile.priceRangeMax,
                          business.sellerProfile.preferredCurrencies?.[0] ?? 'LKR',
                        )
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' - ')}
                  colors={colors}
                />
              ) : null}
              {business.sellerProfile.preferredCurrencies.length > 0 ? (
                <DetailRow
                  icon="currency-exchange"
                  label="Currencies"
                  value={business.sellerProfile.preferredCurrencies.join(', ')}
                  colors={colors}
                />
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Provider services */}
        {isProvider && services.length > 0 ? (
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitlePad, { color: colors.onSurface }]}>Services</Text>
            <View style={styles.serviceList}>
              {services.map((s) => (
                <View
                  key={s.serviceId}
                  style={[styles.serviceCard, { backgroundColor: colors.surfaceContainerLowest }]}>
                  <View style={[styles.serviceIcon, { backgroundColor: colors.primaryContainer }]}>
                    <Icon name="handyman" size={20} color={colors.onPrimaryContainer} />
                  </View>
                  <View style={styles.serviceBody}>
                    <Text style={[styles.serviceName, { color: colors.onSurface }]} numberOfLines={1}>
                      {s.name}
                    </Text>
                    {s.description ? (
                      <Text
                        style={[styles.serviceDesc, { color: colors.onSurfaceVariant }]}
                        numberOfLines={2}>
                        {s.description}
                      </Text>
                    ) : null}
                    <View style={styles.serviceMetaRow}>
                      <Text style={[styles.serviceMeta, { color: colors.primary }]}>
                        {formatCurrency(s.priceMin, s.currency)}
                        {s.priceMax > s.priceMin
                          ? ` - ${formatCurrency(s.priceMax, s.currency)}`
                          : ''}
                      </Text>
                      <Text style={[styles.serviceMetaMuted, { color: colors.textMuted }]}>
                        {s.turnaroundDaysMin}-{s.turnaroundDaysMax} days
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Location */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Location</Text>
          <View style={styles.locationRow}>
            <View style={[styles.serviceIcon, { backgroundColor: colors.primaryContainer }]}>
              <Icon name="location-on" size={20} color={colors.onPrimaryContainer} />
            </View>
            <View style={styles.serviceBody}>
              <Text style={[styles.serviceName, { color: colors.onSurface }]}>
                {business.address || 'Showroom / workshop'}
              </Text>
              <Text style={[styles.serviceDesc, { color: colors.onSurfaceVariant }]}>
                {locationLine}
              </Text>
            </View>
          </View>
        </View>

        {/* Endorse */}
        {canEndorse ? (
          <Pressable
            onPress={handleEndorse}
            disabled={endorsing}
            style={({ pressed }) => [
              styles.endorseBtn,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
                opacity: pressed || endorsing ? 0.85 : 1,
              },
            ]}>
            <Icon name="thumb-up" size={18} color={colors.accent} />
            <Text style={[styles.endorseText, { color: colors.accent }]}>
              {endorsing ? 'Sending…' : 'Endorse this business'}
            </Text>
          </Pressable>
        ) : null}
      </ThemedScrollView>

      {user && business ? (
        <FraudReportSheet
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          reporterUid={user.uid}
          reportedBusinessId={business.id}
          reportedUserUid={business.ownerUid}
          businessName={business.businessName}
        />
      ) : null}
    </SafeAreaView>
  );
}

function DetailRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailIcon, { backgroundColor: colors.surfaceContainerLow }]}>
        <Icon name={icon} size={16} color={colors.onSurfaceVariant} />
      </View>
      <View style={styles.detailBody}>
        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: colors.onSurface }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 48,
    gap: Spacing.gutterMd,
  },

  hero: { marginBottom: 4 },
  coverWrap: {
    height: 168,
    marginHorizontal: Spacing.containerMargin,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cover: { width: '100%', height: '100%' },
  coverFallbackPattern: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(12, 67, 60, 0.14)',
  },
  avatarRow: {
    paddingHorizontal: Spacing.containerMargin,
    marginTop: -36,
    zIndex: 2,
  },
  logoWrap: {
    width: 80,
    height: 80,
    position: 'relative',
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: { width: '100%', height: '100%' },
  logoInitials: { fontSize: 24, fontWeight: '700' },
  verifiedBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityBelow: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.stackMd,
    gap: 4,
  },
  name: { ...Typography.headlineMdMobile },
  roleLine: { ...Typography.bodyMd },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  locText: { ...Typography.caption, flex: 1 },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: Spacing.containerMargin,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  chipText: { ...Typography.labelMd, fontSize: 11 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  statsCard: {
    marginHorizontal: Spacing.containerMargin,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    flexDirection: 'row',
    paddingVertical: 14,
    boxShadow: '0 2px 12px rgba(15, 118, 110, 0.06)',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  statValue: {
    ...Typography.bodyLg,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statLabel: { ...Typography.caption },

  contactRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: Spacing.containerMargin,
  },
  contactPrimary: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  contactPrimaryText: { ...Typography.button },
  contactSecondary: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionCard: {
    marginHorizontal: Spacing.containerMargin,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    padding: Spacing.gutterMd,
    gap: 12,
    boxShadow: '0 2px 12px rgba(15, 118, 110, 0.06)',
  },
  sectionBlock: { gap: 10 },
  sectionTitle: { ...Typography.headlineSmMobile },
  sectionTitlePad: {
    ...Typography.headlineSmMobile,
    paddingHorizontal: Spacing.containerMargin,
  },
  aboutBody: { ...Typography.bodyMd, lineHeight: 22 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  tagText: { ...Typography.caption, textTransform: 'capitalize' },

  detailList: { gap: 12 },
  detailRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBody: { flex: 1, gap: 2 },
  detailLabel: { ...Typography.caption },
  detailValue: { ...Typography.bodyMd, fontWeight: '500' },

  serviceList: {
    paddingHorizontal: Spacing.containerMargin,
    gap: 10,
  },
  serviceCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    boxShadow: '0 2px 12px rgba(15, 118, 110, 0.06)',
  },
  serviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceBody: { flex: 1, minWidth: 0, gap: 2 },
  serviceName: { ...Typography.bodyLg, fontWeight: '600' },
  serviceDesc: { ...Typography.bodyMd },
  serviceMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  serviceMeta: { ...Typography.labelMd, fontWeight: '700', flexShrink: 1 },
  serviceMetaMuted: { ...Typography.caption },

  locationRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },

  endorseBtn: {
    marginHorizontal: Spacing.containerMargin,
    minHeight: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  endorseText: { ...Typography.button },
});
