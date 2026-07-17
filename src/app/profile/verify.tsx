import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { FormSection, FormSectionLabel, ScreenInset } from '@/components/ui/form-section';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { MediaField } from '@/components/ui/media-field';
import { StackHeader } from '@/components/ui/stack-header';
import { ThemedScrollView } from '@/components/ui/screen';
import { LAPIDARY_SERVICE_OPTIONS, ROLE_LABELS, resolveProfileRole } from '@/constants/roles';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { fetchBusinessByOwnerUid } from '@/features/marketplace/marketplace-service';
import { submitVerificationApplication } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  extensionForMedia,
  uploadLocalMedia,
  type LocalMedia,
} from '@/lib/firebase/storage-service';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { friendlyError } from '@/lib/errors';

const STEPS = ['Documents', 'Review'];

export default function VerifyApplicationScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const role = resolveProfileRole(profile);
  const needsTradeDocs = role === 'trader' || role === 'gem_lab';
  const isLapidary = role === 'lapidary';

  const [brNumber, setBrNumber] = useState('');
  const [gemLicenseNumber, setGemLicenseNumber] = useState('');
  const [tinNumber, setTinNumber] = useState('');
  const [servicesOffered, setServicesOffered] = useState<string[]>([]);
  const [idPhoto, setIdPhoto] = useState<LocalMedia | null>(null);
  const [brPhoto, setBrPhoto] = useState<LocalMedia | null>(null);
  const [licensePhoto, setLicensePhoto] = useState<LocalMedia | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleService(id: string) {
    setServicesOffered((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  if (!user) return <Redirect href="/(auth)/login" />;

  async function handleSubmit() {
    if (!user) return;
    if (needsTradeDocs) {
      if (!brNumber.trim() || !gemLicenseNumber.trim() || !tinNumber.trim()) {
        toast.error('BR number, Gem License, and TIN are required.');
        return;
      }
      if (!idPhoto || !brPhoto || !licensePhoto) {
        toast.error('Upload NIC, BR, and Gem License photos.');
        return;
      }
    }
    if (isLapidary && servicesOffered.length === 0) {
      toast.error('Select at least one service you provide.');
      return;
    }
    if (isLapidary && !idPhoto) {
      toast.error('Upload your NIC photo.');
      return;
    }

    setLoading(true);
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
      await submitVerificationApplication(user.uid, {
        businessId: business?.id ?? 'pending',
        applicationType: role === 'admin' ? 'trader' : role,
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
      toast.success('Verification submitted. Pending review.');
      router.back();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not submit. Please try again.'));
    } finally {
      setLoading(false);
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
          <Text style={[styles.title, { color: colors.primary }]}>Apply for verification</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Verifying as {ROLE_LABELS[role]}. Your registration role is locked for this application.
          </Text>

          <View style={styles.steps}>
            {STEPS.map((label, i) => (
              <View
                key={label}
                style={[styles.step, i === 0 && { backgroundColor: colors.primaryMuted }]}>
                <Text
                  style={[styles.stepText, { color: i === 0 ? colors.primary : colors.textMuted }]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </ScreenInset>

        <FormSectionLabel title="ACCOUNT TYPE" />
        <FormSection>
          <View style={styles.roleRow}>
            <Icon name="verified-user" size={20} color={colors.primary} />
            <Text style={[styles.roleBannerText, { color: colors.onSurface }]}>
              {ROLE_LABELS[role]}
            </Text>
          </View>
        </FormSection>

        {isLapidary ? (
          <>
            <FormSectionLabel title="SERVICES" />
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
                          backgroundColor: active ? colors.primary : colors.surfaceContainerLow,
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
              <MediaField
                label="NIC photo"
                value={idPhoto}
                onChange={setIdPhoto}
                allows="images"
                variant="row"
              />
              <Input
                label="BR number (optional)"
                value={brNumber}
                onChangeText={setBrNumber}
                leftIcon="badge"
              />
            </FormSection>
          </>
        ) : null}

        {needsTradeDocs ? (
          <>
            <FormSectionLabel title="REQUIRED DOCUMENTS" />
            <FormSection>
              <MediaField
                label="NIC (front/back)"
                value={idPhoto}
                onChange={setIdPhoto}
                allows="images"
                variant="row"
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
                label="Gem License number"
                value={gemLicenseNumber}
                onChangeText={setGemLicenseNumber}
                leftIcon="workspace-premium"
              />
              <MediaField
                label="Gem License photo"
                value={licensePhoto}
                onChange={setLicensePhoto}
                allows="images"
                variant="row"
              />
              <Input
                label="TIN (Taxpayer Identification Number)"
                value={tinNumber}
                onChangeText={setTinNumber}
                leftIcon="receipt"
              />
            </FormSection>
          </>
        ) : null}

        <ScreenInset style={styles.actions}>
          <Button title="Submit for review" icon="send" loading={loading} onPress={handleSubmit} />
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
  title: { ...Typography.headlineSm, fontWeight: '700' },
  subtitle: { ...Typography.bodyMd },
  steps: { flexDirection: 'row', gap: 8 },
  step: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full },
  stepText: { ...Typography.labelMd, fontWeight: '600' },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roleBannerText: { ...Typography.labelMd, fontWeight: '600' },
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
