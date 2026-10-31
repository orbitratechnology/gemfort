import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { format, subYears } from 'date-fns';
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
import {
  FieldLabel,
  FieldMessage,
  FieldWrap,
  fieldStyles,
  useFieldChrome,
} from '@/components/ui/field-chrome';
import { FormSection, FormSectionLabel, ScreenInset } from '@/components/ui/form-section';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { MediaField } from '@/components/ui/media-field';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { VerificationSeal, type VerificationTier } from '@/components/ui/verification-badge';
import { VerificationStatusCard } from '@/components/verification/verification-status-card';
import {
  BUSINESS_REPUTATION_BADGE_COLORS,
  reputationBadgeForOwner,
} from '@/constants/business-reputation';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { LAPIDARY_SERVICE_OPTIONS, resolveProfileRole } from '@/constants/roles';
import {
    fetchBusinessByOwnerUid,
    updateBusinessProfile,
} from '@/features/marketplace/marketplace-service';
import { submitVerificationApplication } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { usePendingAction } from '@/hooks/use-pending-action';
import { friendlyError } from '@/lib/errors';
import {
    extensionForMedia,
    uploadLocalMedia,
    type LocalMedia,
} from '@/lib/firebase/storage-service';
import { parseForm, verificationApplicantSchema } from '@/lib/validation/form-schemas';
import { useAuth } from '@/providers/auth-provider';
import type { Business } from '@/types';
import { useToast } from '@/providers/toast-provider';

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

const VERIFICATION_TIERS: {
  id: VerificationTier;
  title: string;
  requirement: string;
}[] = [
  { id: 'member', title: 'Member', requirement: 'Registered GemFort account' },
  { id: 'identity', title: 'Identity Verified', requirement: 'NIC checked by GemFort' },
  { id: 'business', title: 'Business Verified', requirement: 'NIC + TIN + Business Registration' },
  { id: 'gem', title: 'Gem Verified', requirement: 'All business documents + Gem Licence' },
  {
    id: 'recognized',
    title: 'Recognized',
    requirement: 'Assigned by GemFort to established partners and institutions',
  },
];

export default function VerifyApplicationScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const role = resolveProfileRole(profile);
  const isLapidary = role === 'lapidary';
  const isPromotion = profile?.verificationStatus === 'verified';

  const maxDob = useMemo(() => new Date(), []);
  const minDob = useMemo(() => subYears(new Date(), 120), []);

  const [business, setBusiness] = useState<Business | null>(null);
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
  const dobChrome = useFieldChrome({
    focused: showDobPicker,
    error: !!applicantErrors.dateOfBirth,
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetchBusinessByOwnerUid(user.uid).then((found) => {
      if (cancelled || !found) return;
      setBusiness(found);
      if (found.businessName) {
        setBusinessName((prev) => prev || found.businessName);
      }
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

  const [submitting, handleSubmit] = usePendingAction(async () => {
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
    } catch (e) {
      toast.error(friendlyError(e, 'Could not submit. Please try again.'));
    }
  });

  if (!user) return <Redirect href="/(auth)/login" />;

  const currentTier = reputationBadgeForOwner(profile, business);
  const currentTierIndex = VERIFICATION_TIERS.findIndex((t) => t.id === currentTier);
  const inReview =
    profile?.verificationStatus === 'pending' ||
    profile?.verificationStatus === 'under_review';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Verification" closeIcon />

      <ThemedScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <ScreenInset style={styles.statusInset}>
          <VerificationStatusCard tier={currentTier} status={profile?.verificationStatus} />
          <Text style={[styles.sectionLead, { color: colors.textMuted }]}>
            {inReview
              ? 'You can update your documents while the review is in progress.'
              : isPromotion
                ? 'Add stronger documents to move up. Your current badge stays active during review.'
                : 'Every badge is reviewed by a GemFort admin before it appears on your profile.'}
          </Text>
        </ScreenInset>

        <ScreenInset>
          <View
            style={[
              styles.levels,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
              },
            ]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Badge levels"
              accessibilityState={{ expanded: tiersExpanded }}
              onPress={() => setTiersExpanded((expanded) => !expanded)}
              style={({ pressed }) => [styles.levelsToggle, pressed && styles.pressed]}>
              <View style={styles.levelsSeals}>
                {VERIFICATION_TIERS.map((tier, i) => (
                  <VerificationSeal
                    key={tier.id}
                    type={tier.id}
                    size={22}
                    ringColor={colors.surfaceContainerLowest}
                    style={i > 0 ? styles.sealOverlap : undefined}
                  />
                ))}
              </View>
              <Text style={[styles.levelsTitle, { color: colors.onSurface }]}>
                Badge levels
              </Text>
              <Icon
                name={tiersExpanded ? 'expand-less' : 'expand-more'}
                size={22}
                color={colors.textMuted}
              />
            </Pressable>
            {tiersExpanded
              ? VERIFICATION_TIERS.map((tier, i) => {
                  const isCurrent = tier.id === currentTier;
                  const reached =
                    tier.id !== 'recognized' && i <= currentTierIndex && !isCurrent;
                  return (
                    <View
                      key={tier.id}
                      style={[styles.levelRow, { borderTopColor: colors.outlineVariant }]}>
                      <VerificationSeal type={tier.id} size={32} />
                      <View style={styles.levelCopy}>
                        <Text style={[styles.levelTitle, { color: colors.onSurface }]}>
                          {tier.title}
                        </Text>
                        <Text style={[styles.levelRequirement, { color: colors.textMuted }]}>
                          {tier.requirement}
                        </Text>
                      </View>
                      {isCurrent ? (
                        <View
                          style={[
                            styles.currentTag,
                            { backgroundColor: `${BUSINESS_REPUTATION_BADGE_COLORS[tier.id]}1A` },
                          ]}>
                          <Text
                            style={[
                              styles.currentTagText,
                              { color: BUSINESS_REPUTATION_BADGE_COLORS[tier.id] },
                            ]}>
                            Current
                          </Text>
                        </View>
                      ) : reached ? (
                        <Icon name="check" size={18} color={colors.successEmerald} />
                      ) : null}
                    </View>
                  );
                })
              : null}
          </View>
        </ScreenInset>

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

            <FieldWrap>
              <FieldLabel>Date of birth (required)</FieldLabel>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose date of birth"
                onPress={() => setShowDobPicker(true)}
                style={({ pressed }) => [
                  fieldStyles.box,
                  dobChrome.box,
                  pressed && dobChrome.pressedBox,
                ]}>
                <Icon name="cake" size={20} color={dobChrome.iconColor} />
                <Text
                  style={[
                    fieldStyles.value,
                    { color: dateOfBirth ? colors.text : dobChrome.placeholderColor },
                  ]}>
                  {dateOfBirth
                    ? format(dobDate, 'd MMM yyyy')
                    : 'Select date of birth'}
                </Text>
              </Pressable>
              <FieldMessage error={applicantErrors.dateOfBirth} />
            </FieldWrap>

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
            <View style={[styles.documentIntroIcon, { backgroundColor: `${BUSINESS_REPUTATION_BADGE_COLORS.identity}1A` }]}>
              <VerificationSeal type="identity" size={24} />
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
            loading={submitting}
            onPress={() => void handleSubmit()}
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
  statusInset: { gap: Spacing.sm },
  sectionIntro: {
    gap: Spacing.xs,
  },
  sectionLead: {
    ...Typography.bodySmall,
    lineHeight: 19,
  },
  pressed: { opacity: 0.7 },
  levels: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  levelsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 56,
  },
  levelsSeals: { flexDirection: 'row' },
  sealOverlap: { marginLeft: -6 },
  levelsTitle: { ...Typography.labelMd, fontWeight: '700', flex: 1 },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  levelCopy: { flex: 1, minWidth: 0, gap: 2 },
  levelTitle: { ...Typography.labelMd, fontWeight: '700' },
  levelRequirement: { ...Typography.bodySmall, lineHeight: 17 },
  currentTag: {
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  currentTagText: { ...Typography.caption, fontWeight: '700' },
  fields: { gap: Spacing.lg },
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
  documentIntroText: { ...Typography.bodySmall, lineHeight: 19 },
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
