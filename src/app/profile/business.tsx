import { Redirect, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedScrollView } from '@/components/ui/screen';
import { Input } from '@/components/ui/input';
import { Spacing, Typography } from '@/constants/design-tokens';
import {
  createBusinessProfile,
  fetchBusinessByOwnerUid,
  updateBusinessProfile,
} from '@/features/marketplace/marketplace-service';
import { useThemeStyles } from '@/hooks/use-theme-styles';
import type { AuthUser } from '@/lib/firebase/auth-types';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import type { Business, BusinessType, UserProfile } from '@/types';

type FormProps = {
  business: Business | null | undefined;
  user: AuthUser;
  profile: UserProfile | null;
};

function BusinessProfileForm({ business, user, profile }: FormProps) {
  const ts = useThemeStyles();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [businessName, setBusinessName] = useState(business?.businessName ?? '');
  const [shortDescription, setShortDescription] = useState(business?.shortDescription ?? '');
  const [city, setCity] = useState(business?.city ?? 'Beruwala');
  const [address, setAddress] = useState(business?.address ?? '');
  const [whatsapp, setWhatsapp] = useState(business?.contacts.whatsapp?.value ?? '');
  const [phone, setPhone] = useState(business?.contacts.phone?.value ?? '');
  const [businessType, setBusinessType] = useState<BusinessType>(business?.businessType ?? 'seller');
  const [loading, setLoading] = useState(false);

  const isVerified = business?.verificationStatus === 'verified';

  async function handleSave() {
    if (!businessName.trim() || !city.trim()) {
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
          whatsappVisible: !!whatsapp.trim(),
          phoneVisible: !!phone.trim(),
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
      toast.success('Your business profile has been updated.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Text style={[styles.intro, ts.textSecondary]}>
        {business
          ? isVerified
            ? 'Your verified business appears in the GemFort directory.'
            : 'Your business profile is pending verification.'
          : 'Create your business profile before publishing listings.'}
      </Text>

      {!business ? (
        <>
          <Text style={[styles.label, ts.textSecondary]}>Business type</Text>
          <Button
            title={businessType === 'seller' ? 'Seller ✓' : 'Seller'}
            variant={businessType === 'seller' ? 'primary' : 'secondary'}
            onPress={() => setBusinessType('seller')}
          />
          <Button
            title={businessType === 'cutter' ? 'Cutter ✓' : 'Service Provider'}
            variant={businessType === 'cutter' ? 'primary' : 'secondary'}
            onPress={() => setBusinessType('cutter')}
          />
        </>
      ) : null}

      <Input label="Business Name" value={businessName} onChangeText={setBusinessName} />
      <Input label="City" value={city} onChangeText={setCity} />
      <Input label="Address" value={address} onChangeText={setAddress} />
      <Input
        label="Short Description"
        value={shortDescription}
        onChangeText={setShortDescription}
        multiline
      />
      <Input label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" />
      <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      <Button
        title={business ? 'Save Changes' : 'Create Business Profile'}
        loading={loading}
        onPress={handleSave}
      />

      {business && isVerified ? (
        <Button
          title="View Public Profile"
          variant="secondary"
          onPress={() => router.push(`/business/${business.id}`)}
        />
      ) : null}

      {!isVerified ? (
        <Button
          title="Apply for Verification"
          variant="ghost"
          onPress={() => router.push('/profile/verify')}
        />
      ) : null}
    </>
  );
}

export default function MyBusinessProfileScreen() {
  const ts = useThemeStyles();
  const { user, profile } = useAuth();

  const { data: business, isLoading } = useQuery({
    queryKey: ['my-business', user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    enabled: !!user,
  });

  if (!user) return <Redirect href="/(auth)/login" />;

  if (isLoading) {
    return (
      <ThemedScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.loading, ts.textMuted]}>Loading…</Text>
      </ThemedScrollView>
    );
  }

  return (
    <ThemedScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <BusinessProfileForm
        key={business?.id ?? 'create'}
        business={business}
        user={user}
        profile={profile}
      />
    </ThemedScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: Spacing.lg, gap: Spacing.md },
  loading: { ...Typography.body },
  intro: { ...Typography.body },
  label: { ...Typography.label },
});
