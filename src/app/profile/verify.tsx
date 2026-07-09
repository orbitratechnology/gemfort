import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { MediaField } from '@/components/ui/media-field';
import { ThemedScrollView } from '@/components/ui/screen';
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

const STEPS = ['Documents', 'Face Match', 'Review'];

export default function VerifyApplicationScreen() {
  const { user, refreshProfile } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const [brNumber, setBrNumber] = useState('');
  const [ngjaNumber, setNgjaNumber] = useState('');
  const [applicationType, setApplicationType] = useState<'seller' | 'provider'>('seller');
  const [idPhoto, setIdPhoto] = useState<LocalMedia | null>(null);
  const [brPhoto, setBrPhoto] = useState<LocalMedia | null>(null);
  const [loading, setLoading] = useState(false);

  if (!user) return <Redirect href="/(auth)/login" />;

  async function handleSubmit() {
    if (!user) return;
    if (!brNumber) {
      toast.error('Enter your business registration number to continue.');
      return;
    }
    setLoading(true);
    try {
      let nicPhotoUrl: string | null = null;
      let brPhotoUrl: string | null = null;

      if (idPhoto) {
        const ext = extensionForMedia(idPhoto);
        nicPhotoUrl = await uploadLocalMedia(idPhoto, `verification/${user.uid}/nic.${ext}`);
      }
      if (brPhoto) {
        const ext = extensionForMedia(brPhoto);
        brPhotoUrl = await uploadLocalMedia(brPhoto, `verification/${user.uid}/br.${ext}`);
      }

      const business = await fetchBusinessByOwnerUid(user.uid);
      await submitVerificationApplication(user.uid, {
        businessId: business?.id ?? 'pending',
        applicationType,
        documents: {
          brNumber,
          brPhotoUrl,
          ngjaNumber: ngjaNumber || null,
          ngjaPhotoUrl: null,
          nicPhotoUrl,
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
      <View style={[styles.header]}>
        <View style={styles.headerLeft}>
          <Icon name="diamond" size={22} color={colors.primary} />
          <Text style={[styles.brand, { color: colors.primary }]}>GemFort</Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="close" size={24} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>

      <ThemedScrollView contentContainerStyle={styles.content}>
        <View style={styles.steps}>
          {STEPS.map((label, i) => {
            const active = i === 0;
            return (
              <View key={label} style={styles.stepCol}>
                <View
                  style={[
                    styles.stepCircle,
                    active
                      ? { backgroundColor: colors.accent }
                      : { backgroundColor: colors.surfaceVariant },
                  ]}>
                  <Text
                    style={[
                      styles.stepNum,
                      { color: active ? colors.onSecondary : colors.onSurfaceVariant },
                    ]}>
                    {i + 1}
                  </Text>
                </View>
                <Text
                  style={[styles.stepLabel, { color: active ? colors.accent : colors.textMuted }]}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={[styles.title, { color: colors.primary }]}>Identity Verification</Text>
          <Text style={[styles.desc, { color: colors.onSurfaceVariant }]}>
            To ensure a secure trading environment, please upload a government-issued ID and your
            official business registration license.
          </Text>
        </View>

        <View style={[styles.banner, { backgroundColor: colors.secondaryContainer + '55' }]}>
          <View style={styles.bannerHeader}>
            <Icon name="verified-user" size={18} color={colors.accent} />
            <Text style={[styles.bannerTitle, { color: colors.accent }]}>Security Standards</Text>
          </View>
          <View style={styles.bannerChecks}>
            {['Clear photo', 'No glare', 'Valid dates'].map((c) => (
              <View key={c} style={styles.checkItem}>
                <Icon name="check-circle" size={16} color={colors.accent} />
                <Text style={[styles.checkText, { color: colors.onSurfaceVariant }]}>{c}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.segment, { backgroundColor: colors.surfaceContainerLow }]}>
          {(['seller', 'provider'] as const).map((t) => {
            const active = applicationType === t;
            return (
              <Pressable
                key={t}
                onPress={() => setApplicationType(t)}
                style={[styles.segmentBtn, active && { backgroundColor: colors.primary }]}>
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? colors.onPrimary : colors.onSurfaceVariant },
                  ]}>
                  {t === 'seller' ? 'Seller' : 'Service Provider'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <MediaField
          label="Government ID"
          hint="Passport, NIC, or Driver's License"
          value={idPhoto}
          onChange={setIdPhoto}
          emptyTitle="Add ID photo"
          emptySubtitle="Kept on device until you submit"
        />

        <MediaField
          label="Business Registration"
          hint="Authorized operating license for gem trading"
          value={brPhoto}
          onChange={setBrPhoto}
          allows="all"
          emptyTitle="Add BR document"
          emptySubtitle="Photo or file. Uploads on submit"
        />

        <View style={styles.fields}>
          <Input
            label="BR Number"
            value={brNumber}
            onChangeText={setBrNumber}
            placeholder="PV 00123456"
            leftIcon="business"
          />
          <Input
            label="NGJA Number (optional)"
            value={ngjaNumber}
            onChangeText={setNgjaNumber}
            leftIcon="verified"
          />
        </View>

        <View style={styles.encRow}>
          <Icon name="lock" size={14} color={colors.textMuted} />
          <Text style={[styles.encText, { color: colors.textMuted }]}>
            ENCRYPTED &amp; SECURE 256-BIT PROCESSING
          </Text>
        </View>

        <Button title="Continue" icon="arrow-forward" loading={loading} onPress={handleSubmit} />
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.stackMd,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { ...Typography.headlineMdMobile },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: { padding: Spacing.containerMargin, gap: Spacing.xl, paddingBottom: 60 },

  steps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
  },
  stepCol: { alignItems: 'center', gap: 6, flex: 1 },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { ...Typography.labelMd },
  stepLabel: { ...Typography.labelMd, textTransform: 'uppercase', letterSpacing: 0.5 },

  section: { gap: Spacing.sm },
  title: { ...Typography.headlineSm },
  desc: { ...Typography.bodyLg },

  banner: { borderRadius: Radius.lg, padding: 16, gap: 10 },
  bannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerTitle: { ...Typography.bodyLg, fontWeight: '700' },
  bannerChecks: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkText: { ...Typography.labelMd },

  segment: { flexDirection: 'row', borderRadius: Radius.full, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.full },
  segmentText: { ...Typography.labelMd },

  fields: { gap: Spacing.md },
  encRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  encText: { ...Typography.labelMd, letterSpacing: 0.5 },
});
