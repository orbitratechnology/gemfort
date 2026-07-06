import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';

import { Button } from '@/components/ui/button';
import { ThemedScrollView } from '@/components/ui/screen';
import { Input } from '@/components/ui/input';
import { Spacing, Typography } from '@/constants/design-tokens';
import { fetchBusinessByOwnerUid } from '@/features/marketplace/marketplace-service';
import { createListing, fetchGems } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { openWhatsApp } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

export default function CreateListingScreen() {
  const { user, profile } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const { workspaceGemId: preselectedGemId } = useLocalSearchParams<{ workspaceGemId?: string }>();
  const [title, setTitle] = useState('');
  const [gemType, setGemType] = useState('blue_sapphire');
  const [caratWeight, setCaratWeight] = useState('');
  const [origin, setOrigin] = useState('Sri Lanka');
  const [visibility, setVisibility] = useState<'private' | 'members_only' | 'public'>('private');
  const [workspaceGemId, setWorkspaceGemId] = useState<string | null>(preselectedGemId ?? null);
  const [loading, setLoading] = useState(false);

  const isVerifiedSeller =
    profile?.role === 'verified_seller' && profile?.verificationStatus === 'verified';

  const { data: gems = [] } = useQuery({
    queryKey: ['gems', user?.uid],
    queryFn: () => fetchGems(user!.uid),
    enabled: !!user && isVerifiedSeller,
  });

  const linkedGem = gems.find((g) => g.id === workspaceGemId);

  if (!user) return <Redirect href="/(auth)/login" />;

  if (!isVerifiedSeller) {
    return (
      <ThemedScrollView contentContainerStyle={styles.blocked}>
        <Text style={[styles.blockedTitle, { color: colors.primary }]}>Verified sellers only</Text>
        <Text style={[styles.blockedBody, { color: colors.textMuted }]}>
          Apply for verification from your profile to create gem listings.
        </Text>
        <Button title="Go to Profile" onPress={() => router.push('/(marketplace)/(tabs)/profile')} />
      </ThemedScrollView>
    );
  }

  async function handlePublish() {
    if (!user) return;
    setLoading(true);
    try {
      const business = await fetchBusinessByOwnerUid(user.uid);
      if (!business) {
        Alert.alert(
          'Business profile required',
          'Set up your business profile before publishing listings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Set Up', onPress: () => router.push('/profile/business' as Href) },
          ],
        );
        return;
      }

      const resolvedGemType = gemType || linkedGem?.gemType || 'blue_sapphire';
      const resolvedCarat = caratWeight || (linkedGem ? String(linkedGem.currentWeight) : '');
      const resolvedOrigin = origin || linkedGem?.originCountry || 'Sri Lanka';
      const resolvedTitle =
        title ||
        (linkedGem
          ? `${linkedGem.gemType.replace(/_/g, ' ')} ${linkedGem.currentWeight}ct`
          : `${resolvedGemType} ${resolvedCarat}ct`);

      const { slug } = await createListing(user.uid, business.id, {
        workspaceGemId,
        title: resolvedTitle,
        description: null,
        visibility,
        gemType: resolvedGemType,
        caratWeight: parseFloat(resolvedCarat) || 0,
        color: 'Blue',
        clarity: 'VS',
        shape: 'Oval',
        origin: resolvedOrigin,
        treatmentStatus: 'heated',
        isCertified: false,
        certifyingLab: null,
        certificateNumber: null,
        showPrice: false,
        priceMin: null,
        priceMax: null,
        currency: 'USD',
        photoUrls: [],
      });
      const url = `https://gemfort.app/l/${slug}`;
      await Clipboard.setStringAsync(url);
      const whatsapp = business.contacts?.whatsapp?.value;
      Alert.alert('Published', `Link copied:\n${url}`, [
        ...(whatsapp
          ? [
              {
                text: 'WhatsApp',
                onPress: () =>
                  Linking.openURL(openWhatsApp(whatsapp, `Check out my gem listing: ${url}`)),
              },
            ]
          : []),
        { text: 'Share', onPress: () => Sharing.shareAsync(url).catch(() => {}) },
        { text: 'View', onPress: () => router.push(`/listing/${slug}`) },
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to publish');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.section, { color: colors.primary }]}>Source from Workspace</Text>
      {linkedGem ? (
        <Text style={[styles.linkedHint, { color: colors.textMuted }]}>
          Linked: {linkedGem.sku} — {linkedGem.currentWeight}ct
        </Text>
      ) : null}
      {gems
        .filter((g) => g.status === 'ready_for_sale' || g.status === 'certified')
        .map((g) => (
          <Button
            key={g.id}
            title={`${g.sku} — ${g.currentWeight}ct`}
            variant={workspaceGemId === g.id ? 'primary' : 'secondary'}
            onPress={() => {
              setWorkspaceGemId(g.id);
              setTitle(`${g.gemType.replace(/_/g, ' ')} ${g.currentWeight}ct`);
              setCaratWeight(String(g.currentWeight));
              setGemType(g.gemType);
              setOrigin(g.originCountry);
            }}
          />
        ))}

      <Input label="Title" value={title} onChangeText={setTitle} />
      <Input label="Carat Weight" value={caratWeight} onChangeText={setCaratWeight} keyboardType="decimal-pad" />
      <Input label="Origin" value={origin} onChangeText={setOrigin} />

      <Text style={[styles.section, { color: colors.primary }]}>Visibility</Text>
      {(['private', 'members_only', 'public'] as const).map((v) => (
        <Pressable key={v} onPress={() => setVisibility(v)}>
          <Text
            style={[
              styles.vis,
              { color: visibility === v ? colors.primary : colors.textMuted },
              visibility === v && styles.visActive,
            ]}>
            {v === 'private' ? '🔒 Private (link only)' : v === 'members_only' ? '👥 Members' : '🌐 Public'}
          </Text>
        </Pressable>
      ))}

      <Button title="Publish Listing" loading={loading} onPress={handlePublish} />
    </ThemedScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md },
  section: { ...Typography.h3 },
  linkedHint: { ...Typography.bodySmall },
  vis: { ...Typography.body, paddingVertical: 8 },
  visActive: { fontWeight: '600' },
  blocked: { padding: Spacing.xxl, gap: Spacing.md },
  blockedTitle: { ...Typography.h2 },
  blockedBody: { ...Typography.body },
});
