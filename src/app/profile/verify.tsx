import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { format, subYears } from 'date-fns';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { FormSection, FormSectionLabel, ScreenInset } from '@/components/ui/form-section';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { MediaField } from '@/components/ui/media-field';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { verificationBadgeAssets } from '@/components/ui/verification-badge';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { LAPIDARY_SERVICE_OPTIONS, resolveProfileRole } from '@/constants/roles';
import {
    fetchBusinessByOwnerUid,
    updateBusinessProfile,
} from '@/features/marketplace/marketplace-service';
import { submitVerificationApplication } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { friendlyError } from '@/lib/errors';
import {
    extensionForMedia,
    uploadLocalMedia,
    type LocalMedia,
} from '@/lib/firebase/storage-service';
import { parseForm, verificationApplicantSchema } from '@/lib/validation/form-schemas';
import { useAuth } from '@/providers/auth-provider';
import { withLoading } from '@/providers/loading-bridge';
import { useToast } from '@/providers/toast-provider';

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

const VERIFICATION_TIERS = [
  {
    id: 'member',
    number: '01',
    title: 'Member',
    shortDescription: 'Registered account',
    description: 'Everyone starts here as soon as they join GemFort.',
    label: 'STARTS HERE',
    color: '#E3B33C',
    image: verificationBadgeAssets.member,
  },
  {
    id: 'identity',
    number: '02',
    title: 'Identity Verified',
    shortDescription: 'NIC verified',
    description: 'GemFort checks your NIC to confirm who you are.',
    label: 'NIC CHECK',
    color: '#26A96B',
    image: verificationBadgeAssets.identity,
  },
  {
    id: 'business',
    number: '03',
    title: 'Business Verified',
    shortDescription: 'NIC + TIN + BR verified',
    description: 'Add your tax number and business registration details.',
    label: 'BUSINESS CHECK',
    color: '#D65B9A',
    image: verificationBadgeAssets.business,
  },
  {
    id: 'gem',
    number: '04',
    title: 'Gem Verified',
    shortDescription: 'All business documents + Gem Licence',
    description: 'Add your Gem Licence for the highest document tier.',
    label: 'GEM CHECK',
    color: '#4D8CF4',
    image: verificationBadgeAssets.gem,
  },
  {
    id: 'recognized',
    number: '05',
    title: 'Recognized',
    shortDescription: 'Approved by GemFort',
    description:
      'A manual badge for established partners, sponsors, associations, institutions, labs, and notable industry organizations.',
    label: 'ADMIN ASSIGNED',
    color: '#B13B52',
    image: verificationBadgeAssets.recognized,
  },
] as const;

export default function VerifyApplicationScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const role = resolveProfileRole(profile);
  const isLapidary = role === 'lapidary';
  const isPromotion = profile?.verificationStatus === 'verified';

  const maxDob = useMemo(() => new Date(), []);
  const minDob = useMemo(() => subYears(new Date(), 120), []);

  const [businessName, setBusinessName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(
    () => profile?.dateOfBirth ?? '',
  );
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [tiersExpanded, setTiersExpanded] = useState(false);
  const [applicantErrors, setApplicantErrors] = useState<Record<string, string>>(
    {},
  );

  const [brNumber, setBrNumber] = useState('');
  const [gemLicenseNumber, setGemLicenseNumber] = useState('');
  const [tinNumber, setTinNumber] = useState('');
  const [servicesOffered, setServicesOffered] = useState<string[]>([]);
  const [idPhoto, setIdPhoto] = useState<LocalMedia | null>(null);
  const [brPhoto, setBrPhoto] = useState<LocalMedia | null>(null);
  const [licensePhoto, setLicensePhoto] = useState<LocalMedia | null>(null);

  const dobDate = parseIsoDate(dateOfBirth) ?? maxDob;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetchBusinessByOwnerUid(user.uid).then((business) => {
      if (cancelled || !business?.businessName) return;
      setBusinessName((prev) => prev || business.businessName);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function toggleService(id: string) {
    setServicesOffered((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;

  async function handleSubmit() {
    if (!user) return;

    const applicant = parseForm(verificationApplicantSchema, {
      dateOfBirth,
      businessName,
    });
    if (!applicant.success) {
      setApplicantErrors(applicant.errors);
      toast.error('Date of birth and business/company name are required.');
      return;
    }
    setApplicantErrors({});

    if (!idPhoto) {
      toast.error('Upload your NIC photo to continue.');
      return;
    }
    if (isLapidary && servicesOffered.length === 0) {
      toast.error('Select at least one service you provide.');
      return;
    }

    try {
      await withLoading(async () => {
        let nicPhotoUrl: string | null = null;
        let brPhotoUrl: string | null = null;
        let gemLicensePhotoUrl: string | null = null;

        if (idPhoto) {
          nicPhotoUrl = await uploadLocalMedia(
            idPhoto,
            `verification/${user.uid}/nic.${extensionForMedia(idPhoto)}`,
          );
        }
        if (brPhoto) {
          brPhotoUrl = await uploadLocalMedia(
            brPhoto,
            `verification/${user.uid}/br.${extensionForMedia(brPhoto)}`,
          );
        }
        if (licensePhoto) {
          gemLicensePhotoUrl = await uploadLocalMedia(
            licensePhoto,
            `verification/${user.uid}/gem-license.${extensionForMedia(licensePhoto)}`,
          );
        }

        const business = await fetchBusinessByOwnerUid(user.uid);
        if (business && business.businessName.trim() !== applicant.data.businessName) {
          await updateBusinessProfile(business.id, {
            businessName: applicant.data.businessName,
          });
        }

        await submitVerificationApplication(user.uid, {
          businessId: business?.id ?? 'pending',
          applicationType: role === 'admin' ? 'trader' : role,
          dateOfBirth: applicant.data.dateOfBirth,
          businessName: applicant.data.businessName,
          servicesOffered: isLapidary ? servicesOffered : [],
          documents: {
            brNumber: brNumber.trim() || null,
            brPhotoUrl,
            ngjaNumber: null,
            ngjaPhotoUrl: null,
            nicPhotoUrl,
            gemLicenseNumber: gemLicenseNumber.trim() || null,
            gemLicensePhotoUrl,
            tinNumber: tinNumber.trim() || null,
            businessPhotosUrls: [],
            addressProofUrl: null,
            otherDocUrls: [],
          },
          preserveVerifiedStatus: isPromotion,
        });
        await refreshProfile();
        toast.success('Verification application submitted.');
        router.back();
      }, 'Submitting…');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not submit. Please try again.'));
    }
  }

  const heroDecoration =
    colors.onPrimary === '#0a0a0a'
      ? 'rgba(0, 0, 0, 0.08)'
      : 'rgba(255, 255, 255, 0.16)';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={[styles.backdropGlow, { backgroundColor: colors.primaryMuted }]}
        />
        <View
          style={[styles.backdropRing, { borderColor: colors.primaryMuted }]}
        />
      </View>

      <StackHeader title="Verification" closeIcon />

      <ThemedScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <ScreenInset style={styles.heroInset}>
          <View
            style={[
              styles.hero,
              {
                backgroundColor: colors.primary,
                boxShadow: `0 10px 28px ${colors.cardShadow}`,
              },
            ]}>
            <View
              pointerEvents="none"
              style={[styles.heroRing, { borderColor: heroDecoration }]}
            />
            <View
              pointerEvents="none"
              style={[styles.heroRingSmall, { borderColor: heroDecoration }]}
            />
            <View style={styles.heroBadgeRail}>
              {VERIFICATION_TIERS.map((tier, index) => (
                <View
                  key={tier.id}
                  style={[
                    styles.heroBadgePlate,
                    {
                      backgroundColor: heroDecoration,
                      transform: [{ translateY: index % 2 === 0 ? 0 : 10 }],
                    },
                  ]}>
                  <Image
                    source={tier.image}
                    style={styles.heroBadgeImage}
                    contentFit="contain"
                    accessibilityLabel={`${tier.title} badge`}
                  />
                </View>
              ))}
            </View>
            <Text style={[styles.heroEyebrow, { color: colors.onPrimary }]}>GEMFORT TRUST</Text>
            <Text style={[styles.heroTitle, { color: colors.onPrimary }]}>
              {isPromotion ? 'Promote your verification' : 'Make trust easy to see'}
            </Text>
            <Text style={[styles.heroDescription, { color: colors.onPrimary }]}>
              {isPromotion
                ? 'Add stronger documents to move up while your current badge stays active during review.'
                : 'Your badge tells people what GemFort has checked. Start with your identity, then add business proof.'}
            </Text>
            <View style={[styles.reviewPill, { backgroundColor: heroDecoration }]}>
              <Icon name="verified" size={17} color={colors.onPrimary} />
              <Text style={[styles.reviewPillText, { color: colors.onPrimary }]}>
                Every badge is reviewed by a GemFort admin
              </Text>
            </View>
          </View>
        </ScreenInset>

        <FormSectionLabel title="BADGES AT A GLANCE" />
        <ScreenInset style={styles.sectionIntro}>
          <Text style={[styles.sectionLead, { color: colors.textMuted }]}>
            Learn what each badge means and which documents help you move up.
          </Text>
        </ScreenInset>
        <ScreenInset>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View verification badge requirements"
            accessibilityState={{ expanded: tiersExpanded }}
            onPress={() => setTiersExpanded((expanded) => !expanded)}
            style={[
              styles.badgesToggle,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
              },
            ]}>
            <View style={[styles.badgesToggleIcon, { backgroundColor: colors.primaryMuted }]}>
              <Icon name="badge" size={20} color={colors.primary} />
            </View>
            <View style={styles.badgesToggleCopy}>
              <Text style={[styles.badgesToggleTitle, { color: colors.onSurface }]}>
                How badge levels work
              </Text>
              <Text style={[styles.badgesToggleSummary, { color: colors.textMuted }]}>
                {tiersExpanded ? 'Hide badge details' : 'Tap to view all badge requirements'}
              </Text>
            </View>
            <Icon
              name={tiersExpanded ? 'expand-less' : 'expand-more'}
              size={22}
              color={colors.textMuted}
            />
          </Pressable>
        </ScreenInset>
        {tiersExpanded ? (
          <ScreenInset style={styles.tierList}>
            {VERIFICATION_TIERS.map((tier) => (
              <View
                key={tier.id}
                style={[
                  styles.tierCard,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                    boxShadow: `0 4px 14px ${colors.cardShadow}`,
                  },
                ]}>
                <View style={styles.tierImageFrame}>
                  <Image
                    source={tier.image}
                    style={styles.tierImage}
                    contentFit="contain"
                    accessibilityLabel={`${tier.title} badge`}
                  />
                </View>
                <View style={styles.tierCardCopy}>
                  <View style={styles.tierCardTopLine}>
                    <Text style={[styles.tierTitle, { color: colors.onSurface }]}>
                      {tier.title}
                    </Text>
                    <View style={[styles.tierTag, { backgroundColor: `${tier.color}1A` }]}>
                      <Text style={[styles.tierTagText, { color: tier.color }]}>
                        {tier.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.tierShortDescription, { color: tier.color }]}>
                    {tier.shortDescription}
                  </Text>
                  <Text style={[styles.tierDescription, { color: colors.textMuted }]}>
                    {tier.description}
                  </Text>
                </View>
              </View>
            ))}
          </ScreenInset>
        ) : null}
        <FormSectionLabel title="YOUR DETAILS" />
        <ScreenInset style={styles.sectionIntro}>
          <Text style={[styles.sectionLead, { color: colors.textMuted }]}>
            These details help our review team match your documents to the right account.
          </Text>
        </ScreenInset>
        <FormSection>
          <View style={styles.fields}>
            <Input
              label="Business / company name (required)"
              value={businessName}
              onChangeText={(v) => {
                setBusinessName(v);
                setApplicantErrors((prev) => ({ ...prev, businessName: '' }));
              }}
              leftIcon="business"
              placeholder="Legal business or company name"
              autoCapitalize="words"
              error={applicantErrors.businessName}
            />

            <View style={styles.dobBlock}>
              <Text style={[styles.dobLabel, { color: colors.textSecondary }]}>
                Date of birth (required)
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose date of birth"
                onPress={() => setShowDobPicker(true)}
                style={[
                  styles.dobField,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: applicantErrors.dateOfBirth
                      ? colors.error
                      : colors.border,
                  },
                ]}>
                <Icon
                  name="cake"
                  size={20}
                  color={applicantErrors.dateOfBirth ? colors.error : colors.textMuted}
                />
                <Text
                  style={[
                    styles.dobValue,
                    {
                      color: dateOfBirth ? colors.text : colors.textMuted,
                    },
                  ]}>
                  {dateOfBirth
                    ? format(dobDate, 'd MMM yyyy')
                    : 'Select date of birth'}
                </Text>
              </Pressable>
              {applicantErrors.dateOfBirth ? (
                <Text style={[styles.dobError, { color: colors.error }]}>
                  {applicantErrors.dateOfBirth}
                </Text>
              ) : null}
            </View>

            {showDobPicker ? (
              <DateTimePicker
                value={dobDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                presentation="dialog"
                maximumDate={maxDob}
                minimumDate={minDob}
                onValueChange={(_event, selected) => {
                  if (selected) {
                    setDateOfBirth(format(selected, 'yyyy-MM-dd'));
                    setApplicantErrors((prev) => ({ ...prev, dateOfBirth: '' }));
                  }
                  setShowDobPicker(false);
                }}
                onDismiss={() => setShowDobPicker(false)}
              />
            ) : null}
          </View>
        </FormSection>

        {isLapidary ? (
          <>
            <FormSectionLabel title="SERVICES (REQUIRED)" />
            <FormSection>
              <View style={styles.serviceWrap}>
                {LAPIDARY_SERVICE_OPTIONS.map((s) => {
                  const active = servicesOffered.includes(s.id);
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => toggleService(s.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[
                        styles.serviceChip,
                        {
                          backgroundColor: active
                            ? colors.primary
                            : colors.surfaceContainerLow,
                          borderColor: active ? colors.primary : colors.outlineVariant,
                        },
                      ]}>
                      <Text
                        style={{
                          color: active ? colors.onPrimary : colors.onSurface,
                          fontWeight: '600',
                        }}>
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </FormSection>
          </>
        ) : null}

        <FormSectionLabel title="DOCUMENTS" />
        <ScreenInset style={styles.sectionIntro}>
          <Text style={[styles.sectionLead, { color: colors.textMuted }]}>
            NIC is required for everyone. The other documents are optional upgrades you can add now or later.
          </Text>
        </ScreenInset>
        <FormSection>
          <View style={styles.documentIntro}>
            <View style={[styles.documentIntroIcon, { backgroundColor: `${VERIFICATION_TIERS[1].color}1A` }]}>
              <Icon name="badge" size={20} color={VERIFICATION_TIERS[1].color} />
            </View>
            <View style={styles.documentIntroCopy}>
              <Text style={[styles.documentIntroTitle, { color: colors.onSurface }]}>Start with your identity</Text>
              <Text style={[styles.documentIntroText, { color: colors.textMuted }]}>
                Add more proof below to be considered for Business or Gem Verified.
              </Text>
            </View>
          </View>
          <MediaField
            label="NIC photo (required)"
            value={idPhoto}
            onChange={setIdPhoto}
            allows="images"
            variant="row"
          />
          <Input
            label="TIN"
            value={tinNumber}
            onChangeText={setTinNumber}
            leftIcon="receipt"
          />
          <Input
            label="Business Registration (BR) number"
            value={brNumber}
            onChangeText={setBrNumber}
            leftIcon="badge"
          />
          <MediaField
            label="BR certificate photo"
            value={brPhoto}
            onChange={setBrPhoto}
            allows="images"
            variant="row"
          />
          <Input
            label="Gem Licence number"
            value={gemLicenseNumber}
            onChangeText={setGemLicenseNumber}
            leftIcon="workspace-premium"
          />
          <MediaField
            label="Gem Licence photo"
            value={licensePhoto}
            onChange={setLicensePhoto}
            allows="images"
            variant="row"
          />
        </FormSection>

        <ScreenInset style={styles.actions}>
          <Button
            title={isPromotion ? 'Promote' : 'Submit'}
            icon="send"
            onPress={handleSubmit}
          />
        </ScreenInset>
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingBottom: 48,
    gap: Spacing.md,
  },
  backdropGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: 92,
    right: -150,
    opacity: 0.35,
  },
  backdropRing: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    top: 126,
    right: -130,
    opacity: 0.55,
  },
  heroInset: { gap: 0 },
  hero: {
    minHeight: 300,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  heroRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    top: -112,
    right: -92,
  },
  heroRingSmall: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    bottom: -54,
    left: -44,
  },
  heroBadgeRail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 72,
    marginBottom: Spacing.sm,
  },
  heroBadgePlate: {
    width: 54,
    height: 54,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadgeImage: { width: 50, height: 50 },
  heroEyebrow: {
    ...Typography.labelMd,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  heroTitle: {
    ...Typography.headlineMd,
    fontWeight: '700',
    maxWidth: 310,
  },
  heroDescription: {
    ...Typography.bodyMd,
    lineHeight: 21,
    maxWidth: 340,
  },
  reviewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.sm,
    minHeight: 42,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    marginTop: Spacing.xs,
  },
  reviewPillText: {
    ...Typography.labelMd,
    flexShrink: 1,
  },
  sectionIntro: {
    gap: Spacing.xs,
  },
  sectionLead: {
    ...Typography.bodyMd,
    lineHeight: 21,
  },
  badgesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    padding: Spacing.md,
    minHeight: 72,
  },
  badgesToggleIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgesToggleCopy: {
    flex: 1,
    gap: 2,
  },
  badgesToggleTitle: { ...Typography.labelMd, fontWeight: '700' },
  badgesToggleSummary: { ...Typography.bodySm, lineHeight: 19 },
  tierList: {
    gap: Spacing.sm,
  },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    padding: Spacing.md,
    minHeight: 104,
  },
  tierImageFrame: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierImage: { width: 62, height: 62 },
  tierCardCopy: { flex: 1, gap: 3, minWidth: 0 },
  tierCardTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  tierTitle: {
    ...Typography.headlineSmMobile,
    fontWeight: '700',
    flexShrink: 1,
  },
  tierTag: {
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tierTagText: {
    ...Typography.caption,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  tierShortDescription: {
    ...Typography.labelMd,
    fontWeight: '700',
  },
  tierDescription: {
    ...Typography.bodySm,
    lineHeight: 19,
  },
  fields: { gap: Spacing.lg },
  dobBlock: { gap: 6 },
  dobLabel: { ...Typography.labelMd },
  dobField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.gutterMd,
    minHeight: 52,
  },
  dobValue: { ...Typography.bodyLg, flex: 1 },
  dobError: { ...Typography.labelMd },
  documentIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  documentIntroIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentIntroCopy: { flex: 1, gap: 2 },
  documentIntroTitle: { ...Typography.labelMd, fontWeight: '700' },
  documentIntroText: { ...Typography.bodySm, lineHeight: 19 },
  serviceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  actions: { marginTop: Spacing.sm, gap: Spacing.sm },
});
