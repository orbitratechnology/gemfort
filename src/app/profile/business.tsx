import { Redirect, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { StackHeader } from '@/components/ui/stack-header';
import { Radius, Spacing, Typography, type ThemeColors } from '@/constants/design-tokens';
import {
  createBusinessProfile,
  fetchBusinessByOwnerUid,
  updateBusinessProfile,
} from '@/features/marketplace/marketplace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
import type { AuthUser } from '@/lib/firebase/auth-types';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import type { Business, BusinessType, UserProfile } from '@/types';

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function SectionCard({
  title,
  subtitle,
  children,
  colors,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.primary }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function StatusPill({
  label,
  tone,
  colors,
}: {
  label: string;
  tone: 'verified' | 'pending' | 'none';
  colors: ThemeColors;
}) {
  const bg =
    tone === 'verified'
      ? colors.secondaryContainer
      : tone === 'pending'
        ? colors.surfaceContainerHighest
        : colors.surfaceContainerHigh;
  const fg =
    tone === 'verified'
      ? colors.onSecondaryContainer
      : tone === 'pending'
        ? colors.warningAmber
        : colors.onSurfaceVariant;

  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      {tone === 'verified' ? <Icon name="verified" size={14} color={fg} /> : null}
      <Text style={[styles.statusPillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const TYPE_OPTIONS: { id: BusinessType; label: string; subtitle: string; icon: IconName }[] = [
  { id: 'seller', label: 'Gem Seller', subtitle: 'List and sell gemstones', icon: 'diamond' },
  { id: 'cutter', label: 'Service Provider', subtitle: 'Cutting, heat, lab & more', icon: 'build' },
];

type FormProps = {
  business: Business | null | undefined;
  user: AuthUser;
  profile: UserProfile | null;
  colors: ThemeColors;
};

function BusinessProfileForm({ business, user, profile, colors }: FormProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [businessName, setBusinessName] = useState(business?.businessName ?? '');
  const [shortDescription, setShortDescription] = useState(business?.shortDescription ?? '');
  const [city, setCity] = useState(business?.city ?? 'Beruwala');
  const [address, setAddress] = useState(business?.address ?? '');
  const [whatsapp, setWhatsapp] = useState(business?.contacts.whatsapp?.value ?? '');
  const [phone, setPhone] = useState(business?.contacts.phone?.value ?? '');
  const [whatsappVisible, setWhatsappVisible] = useState(business?.contacts.whatsapp?.isVisible ?? true);
  const [phoneVisible, setPhoneVisible] = useState(business?.contacts.phone?.isVisible ?? true);
  const [businessType, setBusinessType] = useState<BusinessType>(business?.businessType ?? 'seller');
  const [loading, setLoading] = useState(false);

  const isVerified = business?.verificationStatus === 'verified';
  const isPending = business?.verificationStatus === 'pending';
  const isCreate = !business;

  const previewName = businessName.trim() || 'Your Business';
  const previewCity = city.trim() || 'Sri Lanka';

  const statusTone = isVerified ? 'verified' : isPending ? 'pending' : 'none';
  const statusLabel = isVerified
    ? 'Verified in Directory'
    : isPending
      ? 'Verification pending'
      : business
        ? 'Not yet verified'
        : 'Profile not created';

  const tierLabel =
    business?.verificationTier === 'full'
      ? 'Gold Merchant'
      : business?.verificationTier === 'basic'
        ? 'Verified Merchant'
        : 'Member';

  const memberSince = business?.createdAt?.toDate?.().getFullYear();

  const canSave = businessName.trim().length > 0 && city.trim().length > 0;

  async function handleSave() {
    if (!canSave) {
      toast.error('Business name and city are required.');
      return;
    }
    setLoading(true);
    try {
      if (business) {
        await updateBusinessProfile(business.id, {
          businessName,
          shortDescription,
          city,
          address,
          whatsapp,
          phone,
          whatsappVisible: whatsappVisible && !!whatsapp.trim(),
          phoneVisible: phoneVisible && !!phone.trim(),
        });
      } else {
        await createBusinessProfile(user.uid, profile?.displayName ?? 'Owner', {
          businessName,
          businessType,
          city,
          shortDescription: shortDescription || 'Gem business in Beruwala.',
          whatsapp: whatsapp || profile?.phone || undefined,
          phone: phone || profile?.phone || undefined,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['my-business'] });
      toast.success(business ? 'Business profile updated.' : 'Business profile created.');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not save.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Live preview */}
      <View style={[styles.previewCard, { backgroundColor: colors.primary }]}>
        <View style={styles.previewGlow} />
        <View style={styles.previewRow}>
          <View style={[styles.previewLogo, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.previewInitials, { color: colors.primary }]}>
              {initials(previewName)}
            </Text>
          </View>
          <View style={styles.previewText}>
            <Text style={[styles.previewName, { color: colors.onPrimary }]} numberOfLines={1}>
              {previewName}
            </Text>
            <View style={styles.previewLocRow}>
              <Icon name="location-on" size={14} color={colors.onPrimary + 'CC'} />
              <Text style={[styles.previewLoc, { color: colors.onPrimary + 'CC' }]} numberOfLines={1}>
                {previewCity}, Sri Lanka
              </Text>
            </View>
          </View>
          <StatusPill label={statusLabel} tone={statusTone} colors={colors} />
        </View>
        {shortDescription.trim() ? (
          <Text style={[styles.previewDesc, { color: colors.onPrimary + 'B3' }]} numberOfLines={2}>
            {shortDescription.trim()}
          </Text>
        ) : null}
      </View>

      {/* Merchant status (edit only) */}
      {business ? (
        <View style={[styles.statusCard, { backgroundColor: colors.primary }]}>
          <Text style={[styles.statusHeading, { color: colors.onPrimary + '99' }]}>MERCHANT STATUS</Text>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.onPrimary + 'AA' }]}>Member since</Text>
            <Text style={[styles.statusValue, { color: colors.onPrimary }]} selectable>
              {memberSince ?? '—'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.onPrimary + 'AA' }]}>Tier</Text>
            <Text style={[styles.statusValueAccent, { color: colors.accent }]}>{tierLabel}</Text>
          </View>
          <View style={[styles.statusRow, styles.statusRowLast]}>
            <Text style={[styles.statusLabel, { color: colors.onPrimary + 'AA' }]}>Directory</Text>
            <Text style={[styles.statusValue, { color: colors.onPrimary }]}>
              {isVerified ? 'Live & searchable' : 'Hidden until verified'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.hintCard, { backgroundColor: colors.surfaceContainerLow }]}>
          <Icon name="info-outline" size={20} color={colors.primary} />
          <Text style={[styles.hintText, { color: colors.onSurfaceVariant }]}>
            Create your business profile before publishing listings. Buyers will find you in the GemFort
            directory after verification.
          </Text>
        </View>
      )}

      {/* Business type (create only) */}
      {isCreate ? (
        <SectionCard
          title="Business type"
          subtitle="Choose how you appear in the marketplace"
          colors={colors}>
          <View style={styles.typeGrid}>
            {TYPE_OPTIONS.map((opt) => {
              const active = businessType === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setBusinessType(opt.id)}
                  style={[
                    styles.typeOption,
                    {
                      backgroundColor: active ? colors.primaryContainer : colors.surfaceContainerHigh,
                      borderColor: active ? colors.primary : colors.outlineVariant,
                    },
                  ]}>
                  <View
                    style={[
                      styles.typeIconWrap,
                      { backgroundColor: active ? colors.primary : colors.surfaceContainerHighest },
                    ]}>
                    <Icon name={opt.icon} size={20} color={active ? colors.onPrimary : colors.onSurfaceVariant} />
                  </View>
                  <Text style={[styles.typeLabel, { color: active ? colors.onPrimaryContainer : colors.onSurface }]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.typeSub, { color: colors.textMuted }]}>{opt.subtitle}</Text>
                </Pressable>
              );
            })}
          </View>
        </SectionCard>
      ) : null}

      {/* Identity */}
      <SectionCard title="Identity" subtitle="How buyers recognize you" colors={colors}>
        <View style={styles.fieldStack}>
          <Input label="Business name" value={businessName} onChangeText={setBusinessName} placeholder="e.g. Celestial Sapphires" />
        </View>
      </SectionCard>

      {/* Location */}
      <SectionCard title="Location" subtitle="Where you operate from" colors={colors}>
        <View style={styles.fieldStack}>
          <Input label="City" value={city} onChangeText={setCity} placeholder="Beruwala" />
          <Input label="Address" value={address} onChangeText={setAddress} placeholder="Street, building, area" />
        </View>
      </SectionCard>

      {/* About */}
      <SectionCard title="About" subtitle="Tell buyers what makes you unique" colors={colors}>
        <Input
          label="Short description"
          value={shortDescription}
          onChangeText={setShortDescription}
          placeholder="Specializing in Ceylon sapphires, ethically sourced from Ratnapura…"
          multiline
          style={styles.textArea}
        />
      </SectionCard>

      {/* Contact */}
      <SectionCard title="Contact" subtitle="How buyers reach you" colors={colors}>
        <View style={styles.fieldStack}>
          <Input
            label="WhatsApp"
            value={whatsapp}
            onChangeText={setWhatsapp}
            keyboardType="phone-pad"
            placeholder="+94 77X XXX XXXX"
          />
          {business ? (
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={[styles.toggleLabel, { color: colors.onSurface }]}>Show WhatsApp</Text>
                <Text style={[styles.toggleSub, { color: colors.textMuted }]}>Visible on your public profile</Text>
              </View>
              <Switch
                value={whatsappVisible}
                onValueChange={setWhatsappVisible}
                trackColor={{ false: colors.surfaceContainerHighest, true: colors.primary + '80' }}
                thumbColor={whatsappVisible ? colors.primary : colors.outlineVariant}
              />
            </View>
          ) : null}

          <Input
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+94 XX XXX XXXX"
          />
          {business ? (
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={[styles.toggleLabel, { color: colors.onSurface }]}>Show phone</Text>
                <Text style={[styles.toggleSub, { color: colors.textMuted }]}>Visible on your public profile</Text>
              </View>
              <Switch
                value={phoneVisible}
                onValueChange={setPhoneVisible}
                trackColor={{ false: colors.surfaceContainerHighest, true: colors.primary + '80' }}
                thumbColor={phoneVisible ? colors.primary : colors.outlineVariant}
              />
            </View>
          ) : null}
        </View>
      </SectionCard>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={business ? 'Save changes' : 'Create business profile'}
          loading={loading}
          disabled={!canSave}
          onPress={handleSave}
        />

        {business && isVerified ? (
          <Pressable
            onPress={() => router.push(`/business/${business.id}`)}
            style={({ pressed }) => [
              styles.secondaryAction,
              { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
              pressed && { opacity: 0.85 },
            ]}>
            <Icon name="visibility" size={20} color={colors.primary} />
            <Text style={[styles.secondaryActionText, { color: colors.primary }]}>View public profile</Text>
            <Icon name="chevron-right" size={20} color={colors.outline} />
          </Pressable>
        ) : null}

        {business && !isVerified ? (
          <Pressable
            onPress={() => router.push('/profile/verify')}
            style={({ pressed }) => [
              styles.secondaryAction,
              { backgroundColor: colors.secondaryContainer, borderColor: 'transparent' },
              pressed && { opacity: 0.85 },
            ]}>
            <Icon name="verified-user" size={20} color={colors.onSecondaryContainer} />
            <View style={styles.verifyText}>
              <Text style={[styles.verifyTitle, { color: colors.onSecondaryContainer }]}>
                Apply for verification
              </Text>
              <Text style={[styles.verifySub, { color: colors.onSecondaryContainer + 'CC' }]}>
                Get listed in the GemFort directory
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.onSecondaryContainer} />
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

export default function MyBusinessProfileScreen() {
  const { colors } = useAppTheme();
  const { user, profile } = useAuth();

  const { data: business, isLoading } = useQuery({
    queryKey: ['my-business', user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    enabled: !!user,
  });

  const screenTitle = useMemo(() => (business ? 'Edit Business' : 'My Business'), [business]);

  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title={screenTitle} />

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading your business…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <BusinessProfileForm
            key={business?.id ?? 'create'}
            business={business}
            user={user}
            profile={profile}
            colors={colors}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.section,
    gap: Spacing.lg,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: { ...Typography.bodyMd },
  previewCard: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    padding: Spacing.lg,
    overflow: 'hidden',
    gap: Spacing.md,
    boxShadow: '0 8px 24px rgba(15, 118, 110, 0.18)',
  },
  previewGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  previewLogo: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInitials: { ...Typography.headlineMdMobile, fontWeight: '700' },
  previewText: { flex: 1, gap: 2, minWidth: 0 },
  previewName: { ...Typography.headlineMdMobile, fontWeight: '700' },
  previewLocRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  previewLoc: { ...Typography.bodySmall, flex: 1 },
  previewDesc: { ...Typography.bodySmall, lineHeight: 20 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    maxWidth: 130,
  },
  statusPillText: { ...Typography.labelMd, fontSize: 10, fontWeight: '600' },
  statusCard: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  statusHeading: {
    ...Typography.labelMd,
    letterSpacing: 1.2,
    marginBottom: Spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  statusRowLast: { borderBottomWidth: 0 },
  statusLabel: { ...Typography.labelMd, textTransform: 'uppercase', letterSpacing: 0.8 },
  statusValue: { ...Typography.bodyMd, fontWeight: '600' },
  statusValueAccent: { ...Typography.bodyMd, fontWeight: '700' },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
  },
  hintText: { ...Typography.bodySmall, flex: 1, lineHeight: 20 },
  card: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    padding: Spacing.lg,
    gap: Spacing.md,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  cardHeader: { gap: 4 },
  cardTitle: { ...Typography.headlineMdMobile, fontWeight: '700' },
  cardSubtitle: { ...Typography.bodySmall },
  typeGrid: { flexDirection: 'row', gap: Spacing.md },
  typeOption: {
    flex: 1,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  typeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: { ...Typography.labelMd, fontWeight: '600' },
  typeSub: { ...Typography.bodySmall, lineHeight: 18 },
  fieldStack: { gap: Spacing.md },
  textArea: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { ...Typography.labelMd, fontWeight: '500' },
  toggleSub: { ...Typography.bodySmall },
  actions: { gap: Spacing.md, marginTop: Spacing.sm },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    minHeight: 56,
  },
  secondaryActionText: { ...Typography.labelMd, fontWeight: '600', flex: 1 },
  verifyText: { flex: 1, gap: 2 },
  verifyTitle: { ...Typography.labelMd, fontWeight: '600' },
  verifySub: { ...Typography.bodySmall },
});
