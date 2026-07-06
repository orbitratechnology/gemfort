import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { StackHeader } from '@/components/ui/stack-header';
import { ThemedScrollView } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  demoBusinesses,
  fetchBusiness,
  trackBusinessAnalytics,
} from '@/features/marketplace/marketplace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { formatCurrency, openPhone, openWhatsApp } from '@/lib/utils';

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export default function BusinessProfileScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { colors } = useAppTheme();

  const { data: business } = useQuery({
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

  useEffect(() => {
    if (business?.id) void trackBusinessAnalytics(business.id, 'profileViewsTotal');
  }, [business?.id]);

  if (!business) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const specs =
    business.sellerProfile?.gemSpecializations ??
    business.providerProfile?.gemSpecializations ??
    [];
  const services = business.providerProfile?.services ?? [];
  const tierLabel =
    business.verificationTier === 'full'
      ? 'Gold Merchant'
      : business.verificationTier === 'basic'
        ? 'Verified Merchant'
        : 'Member';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Business" />

      <ThemedScrollView contentContainerStyle={styles.content}>
        {/* Cover + identity */}
        <View style={styles.coverWrap}>
          {business.coverPhotoUrl ? (
            <Image source={{ uri: business.coverPhotoUrl }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, { backgroundColor: colors.primary }]} />
          )}
          <View style={styles.coverOverlay} />
          <View style={styles.coverContent}>
            <View style={[styles.logo, { backgroundColor: colors.surfaceContainerLowest }]}>
              {business.logoUrl ? (
                <Image source={{ uri: business.logoUrl }} style={styles.logoImg} />
              ) : (
                <Text style={[styles.logoInitials, { color: colors.primary }]}>{initials(business.businessName)}</Text>
              )}
            </View>
            <View style={styles.coverText}>
              <Text style={styles.coverName}>{business.businessName}</Text>
              <View style={styles.coverLocRow}>
                <Icon name="location-on" size={14} color="#FFFFFFCC" />
                <Text style={styles.coverLoc}>
                  {business.city}, {business.country}
                </Text>
              </View>
            </View>
            {business.badges.isVerified ? (
              <View style={[styles.verifiedChip, { backgroundColor: colors.accent }]}>
                <Icon name="verified" size={16} color={colors.onSecondary} />
              </View>
            ) : null}
          </View>
        </View>

        {/* About Us */}
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Text style={[styles.cardTitle, { color: colors.primary }]}>About Us</Text>
          <Text style={[styles.aboutText, { color: colors.onSurfaceVariant }]}>
            {business.shortDescription || 'A trusted member of the GemFort marketplace.'}
          </Text>
          {specs.length > 0 ? (
            <View style={styles.tagRow}>
              {specs.slice(0, 4).map((s) => (
                <View key={s} style={[styles.tag, { backgroundColor: colors.surfaceContainerHighest }]}>
                  <Text style={[styles.tagText, { color: colors.onSurfaceVariant }]}>{s.replace(/_/g, ' ')}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Contact buttons */}
        <View style={styles.contactRow}>
          {business.contacts.email?.isVisible ? (
            <Pressable
              style={[styles.contactBtn, { backgroundColor: colors.primary }]}
              onPress={() => Linking.openURL(`mailto:${business.contacts.email.value}`)}>
              <Icon name="mail-outline" size={18} color={colors.onPrimary} />
              <Text style={[styles.contactBtnText, { color: colors.onPrimary }]}>Message</Text>
            </Pressable>
          ) : null}
          {business.contacts.phone?.isVisible ? (
            <Pressable
              style={[styles.contactBtn, { backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant }]}
              onPress={() => {
                void trackBusinessAnalytics(business.id, 'phoneTapsTotal');
                Linking.openURL(openPhone(business.contacts.phone.value));
              }}>
              <Icon name="call" size={18} color={colors.primary} />
              <Text style={[styles.contactBtnText, { color: colors.primary }]}>Call</Text>
            </Pressable>
          ) : null}
          {business.contacts.whatsapp?.isVisible ? (
            <Pressable
              style={[styles.contactBtn, { backgroundColor: '#25D366' }]}
              onPress={() => {
                void trackBusinessAnalytics(business.id, 'whatsappTapsTotal');
                Linking.openURL(openWhatsApp(business.contacts.whatsapp.value));
              }}>
              <Icon name="chat" size={18} color="#FFFFFF" />
              <Text style={[styles.contactBtnText, { color: '#FFFFFF' }]}>WhatsApp</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Merchant status */}
        <View style={[styles.statusCard, { backgroundColor: colors.primary }]}>
          <Text style={[styles.statusHeading, { color: colors.onPrimary + '99' }]}>MERCHANT STATUS</Text>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.onPrimary + 'AA' }]}>Member Since</Text>
            <Text style={[styles.statusValue, { color: colors.onPrimary }]}>
              {business.badges.verifiedSinceYear ??
                business.createdAt?.toDate?.().getFullYear() ??
                '—'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.onPrimary + 'AA' }]}>Tier</Text>
            <Text style={[styles.statusValue, { color: colors.accent }]}>{tierLabel}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.onPrimary + 'AA' }]}>Verified</Text>
            <Text style={[styles.statusValue, { color: colors.onPrimary }]}>
              {business.badges.isVerified ? 'GemFort Elite' : 'Pending'}
            </Text>
          </View>
          {specs.length > 0 ? (
            <View style={styles.statusTags}>
              {specs.slice(0, 3).map((s) => (
                <View key={s} style={[styles.statusTag, { backgroundColor: colors.onPrimary + '1A' }]}>
                  <Text style={[styles.statusTagText, { color: colors.onPrimary }]}>{s.replace(/_/g, ' ')}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Services / Listings */}
        {services.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Services</Text>
            {services.map((s) => (
              <View key={s.serviceId} style={[styles.listingCard, { backgroundColor: colors.surfaceContainerLowest }]}>
                <View style={[styles.listingIcon, { backgroundColor: colors.primaryMuted }]}>
                  <Icon name="handyman" size={22} color={colors.primary} />
                </View>
                <View style={styles.listingBody}>
                  <Text style={[styles.listingName, { color: colors.primary }]}>{s.name}</Text>
                  <Text style={[styles.listingMeta, { color: colors.textMuted }]}>
                    {formatCurrency(s.priceMin)} – {formatCurrency(s.priceMax)} · {s.turnaroundDaysMin}–{s.turnaroundDaysMax} days
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.outline} />
              </View>
            ))}
          </View>
        ) : null}

        {/* Location */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Location</Text>
          <View style={[styles.locationCard, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={[styles.listingIcon, { backgroundColor: colors.primaryMuted }]}>
              <Icon name="location-on" size={22} color={colors.primary} />
            </View>
            <View style={styles.listingBody}>
              <Text style={[styles.listingName, { color: colors.primary }]}>
                {business.address || 'Office & Showroom'}
              </Text>
              <Text style={[styles.listingMeta, { color: colors.textMuted }]}>
                {business.city}, {business.district}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.footer, { color: colors.textMuted }]}>Powered by GemFort</Text>
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.stackMd,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brand: { ...Typography.headlineMdMobile },

  content: { padding: Spacing.containerMargin, gap: Spacing.gutterMd, paddingBottom: 60 },

  coverWrap: { borderRadius: Radius.lg, overflow: 'hidden', height: 160 },
  cover: { width: '100%', height: '100%' },
  coverOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, backgroundColor: 'rgba(0,22,44,0.45)' },
  coverContent: { position: 'absolute', left: 16, right: 16, bottom: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  logo: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: '100%', height: '100%' },
  logoInitials: { ...Typography.headlineSm },
  coverText: { flex: 1 },
  coverName: { ...Typography.headlineSm, color: '#FFFFFF' },
  coverLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  coverLoc: { ...Typography.bodyMd, color: '#FFFFFFCC' },
  verifiedChip: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  card: {
    borderRadius: Radius.lg,
    padding: 16,
    gap: 12,
    shadowColor: '#00162C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: { ...Typography.headlineSmMobile },
  aboutText: { ...Typography.bodyMd },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.sm },
  tagText: { ...Typography.labelMd, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 10 },

  contactRow: { flexDirection: 'row', gap: Spacing.sm },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
  },
  contactBtnText: { ...Typography.labelMd },

  statusCard: { borderRadius: Radius.lg, padding: 16, gap: 10 },
  statusHeading: { ...Typography.labelMd, letterSpacing: 1, marginBottom: 4 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { ...Typography.bodyMd },
  statusValue: { ...Typography.bodyLg, fontWeight: '700' },
  statusTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.sm },
  statusTagText: { ...Typography.labelMd, textTransform: 'capitalize' },

  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.headlineSmMobile, marginBottom: 4 },
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.lg,
    marginBottom: 8,
  },
  listingIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  listingBody: { flex: 1, minWidth: 0 },
  listingName: { ...Typography.bodyLg, fontWeight: '600' },
  listingMeta: { ...Typography.bodyMd, marginTop: 2 },
  locationCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: Radius.lg },

  footer: { ...Typography.labelMd, textAlign: 'center', marginTop: Spacing.md },
});
