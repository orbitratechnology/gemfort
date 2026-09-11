import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { format, subYears } from 'date-fns';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { FormSection, FormSectionLabel, ScreenInset } from '@/components/ui/form-section';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { MediaField } from '@/components/ui/media-field';
import { ThemedScrollView } from '@/components/ui/screen';
import { StackHeader } from '@/components/ui/stack-header';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { LAPIDARY_SERVICE_OPTIONS, ROLE_LABELS, resolveProfileRole } from '@/constants/roles';
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
    number: '1',
    title: 'Member',
    description: 'Every registered account starts here.',
  },
  {
    number: '2',
    title: 'Identity Verified',
    description: 'Submit a NIC photo for identity verification.',
  },
  {
    number: '3',
    title: 'Business Verified',
    description: 'Add your TIN and business registration details.',
  },
  {
    number: '4',
    title: 'Gem Verified',
    description: 'Add a verified Gem Licence.',
  },
] as const;

export default function VerifyApplicationScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const role = resolveProfileRole(profile);
  const isLapidary = role === 'lapidary';

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
        });
        await refreshProfile();
        toast.success('Verification application submitted.');
        router.back();
      }, 'Submitting…');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not submit. Please try again.'));
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StackHeader title="Verification" closeIcon />

      <ThemedScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <ScreenInset style={styles.intro}>
          <View
            style={[
              styles.verificationMark,
              {
                backgroundColor: colors.primaryMuted,
                borderColor: colors.primary,
              },
            ]}>
            <Icon name="verified" size={64} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.primary }]}>Apply for verification</Text>
          <View
            style={[
              styles.roleCard,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
              },
            ]}>
            <View style={[styles.roleIcon, { backgroundColor: colors.primaryMuted }]}>
              <Icon
                name={isLapidary ? 'diamond' : 'business'}
                size={24}
                color={colors.primary}
              />
            </View>
            <View style={styles.roleCopy}>
              <Text style={[styles.roleEyebrow, { color: colors.textMuted }]}>ACCOUNT TYPE</Text>
              <Text style={[styles.roleValue, { color: colors.onSurface }]}>
                {ROLE_LABELS[role]}
              </Text>
            </View>
            <View style={[styles.roleCheck, { backgroundColor: colors.primaryMuted }]}>
              <Icon name="check-circle" size={22} color={colors.primary} />
            </View>
          </View>
        </ScreenInset>

        <FormSectionLabel title="VERIFICATION TIERS" />
        <FormSection>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Verification tiers information"
            accessibilityState={{ expanded: tiersExpanded }}
            onPress={() => setTiersExpanded((expanded) => !expanded)}
            style={[
              styles.tiersInfo,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
              },
            ]}>
            <View style={[styles.tiersInfoIcon, { backgroundColor: colors.primaryMuted }]}>
              <Icon name="info-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.tiersInfoText}>
              <Text style={[styles.tiersInfoTitle, { color: colors.onSurface }]}>
                How verification works
              </Text>
              <Text style={[styles.tiersInfoSummary, { color: colors.textMuted }]}>
                Tap to view the requirements for each tier.
              </Text>
            </View>
            <Icon
              name={tiersExpanded ? 'expand-less' : 'expand-more'}
              size={22}
              color={colors.textMuted}
            />
          </Pressable>

          {tiersExpanded ? (
            <View
              style={[
                styles.tiersInfoPanel,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                },
              ]}>
              {VERIFICATION_TIERS.map((tier) => (
                <View key={tier.title} style={styles.tierRow}>
                  <View style={[styles.tierMarker, { backgroundColor: colors.primaryMuted }]}>
                    <Text style={[styles.tierMarkerText, { color: colors.primary }]}>
                      {tier.number}
                    </Text>
                  </View>
                  <View style={styles.tierCopy}>
                    <Text style={[styles.tierTitle, { color: colors.onSurface }]}>
                      {tier.title}
                    </Text>
                    <Text style={[styles.tierDescription, { color: colors.textMuted }]}>
                      {tier.description}
                    </Text>
                  </View>
                </View>
              ))}

              <View
                style={[
                  styles.tierNote,
                  { borderTopColor: colors.outlineVariant },
                ]}>
                <Icon name="verified" size={18} color={colors.primary} />
                <Text style={[styles.tierNoteText, { color: colors.textMuted }]}>
                  Recognized is a manual GemFort approval for established partners,
                  sponsors, associations, institutions, labs, or notable industry
                  organizations.
                </Text>
              </View>
            </View>
          ) : null}
        </FormSection>

        <FormSectionLabel title="APPLICANT DETAILS" />
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

        <FormSection>
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
          <Button title="Submit application" icon="send" onPress={handleSubmit} />
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
  intro: {
    gap: Spacing.md,
  },
  verificationMark: {
    alignSelf: 'center',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.headlineSm,
    fontWeight: '700',
    textAlign: 'center',
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    padding: Spacing.md,
    minHeight: 76,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCopy: {
    flex: 1,
    gap: 2,
  },
  roleEyebrow: {
    ...Typography.labelMd,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  roleValue: {
    ...Typography.headlineSm,
    fontWeight: '700',
  },
  roleCheck: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
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
  tiersInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    padding: Spacing.md,
    minHeight: 68,
  },
  tiersInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiersInfoText: {
    flex: 1,
    gap: 2,
  },
  tiersInfoTitle: { ...Typography.labelMd, fontWeight: '700' },
  tiersInfoSummary: { ...Typography.bodySm, lineHeight: 19 },
  tiersInfoPanel: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  tierMarker: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierMarkerText: { ...Typography.labelMd, fontWeight: '700' },
  tierCopy: {
    flex: 1,
    gap: 2,
  },
  tierTitle: { ...Typography.labelMd, fontWeight: '700' },
  tierDescription: { ...Typography.bodySm, lineHeight: 19 },
  tierNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tierNoteText: { ...Typography.bodySm, flex: 1, lineHeight: 19 },
  serviceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  actions: {
    marginTop: Spacing.sm,
  },
});
