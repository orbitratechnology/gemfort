import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedScrollView, ThemedView } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Palette, Spacing, Typography } from '@/constants/design-tokens';
import { fetchBusiness } from '@/features/marketplace/marketplace-service';
import { fetchListingBySlug } from '@/features/workspace/workspace-service';
import { formatCurrency, openWhatsApp } from '@/lib/utils';

export default function PublicListingScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const { data: listing, isLoading, isFetched } = useQuery({
    queryKey: ['listing', slug],
    queryFn: () => fetchListingBySlug(slug!),
    enabled: !!slug,
  });

  const { data: business } = useQuery({
    queryKey: ['business', listing?.businessId],
    queryFn: () => fetchBusiness(listing!.businessId),
    enabled: !!listing?.businessId,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>Loading listing...</Text>
      </View>
    );
  }

  if (isFetched && !listing) {
    return (
      <View style={styles.center}>
        <EmptyState
          title="Listing not found"
          subtitle="This gem may have been sold or removed from the marketplace."
        />
      </View>
    );
  }

  if (!listing) return null;

  const photo = listing.photoUrls?.[0];
  const sellerWhatsapp =
    business?.contacts?.whatsapp?.isVisible && business.contacts.whatsapp.value
      ? business.contacts.whatsapp.value
      : null;

  return (
    <ThemedScrollView style={styles.container} contentContainerStyle={styles.content}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.hero} />
      ) : (
        <View style={styles.heroPlaceholder} />
      )}

      <Text style={styles.title}>{listing.title}</Text>
      <Text style={styles.specs}>
        {listing.caratWeight} ct · {listing.gemType.replace(/_/g, ' ')} · {listing.origin}
      </Text>

      <Card>
        {listing.showPrice && listing.priceMin ? (
          <Text style={styles.price}>
            {formatCurrency(listing.priceMin, listing.currency ?? 'USD')}
            {listing.priceMax
              ? ` – ${formatCurrency(listing.priceMax, listing.currency ?? 'USD')}`
              : ''}
          </Text>
        ) : (
          <Text style={styles.price}>Contact for price</Text>
        )}
        <Text style={styles.treatment}>
          Treatment: {listing.treatmentStatus.replace(/_/g, ' ')}
        </Text>
        {listing.isCertified ? <Text style={styles.cert}>✅ Certified</Text> : null}
      </Card>

      {sellerWhatsapp ? (
        <Button
          title="WhatsApp to Inquire"
          variant="whatsapp"
          onPress={() =>
            Linking.openURL(openWhatsApp(sellerWhatsapp, `Hi, interested in ${listing.title}`))
          }
        />
      ) : (
        <Text style={styles.noContact}>Contact details are not available for this listing.</Text>
      )}

      <Text style={styles.footer}>Powered by GemFort — gemfort.app</Text>
    </ThemedScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.white },
  content: { padding: Spacing.lg, gap: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  loading: { ...Typography.body, color: Palette.gray500 },
  hero: { width: '100%', height: 240, borderRadius: 12 },
  heroPlaceholder: { width: '100%', height: 240, borderRadius: 12, backgroundColor: Palette.gray300 },
  title: { ...Typography.h1, color: Palette.gray900 },
  specs: { ...Typography.body, color: Palette.gray500, textTransform: 'capitalize' },
  price: { ...Typography.h2, color: Palette.gemGold },
  treatment: { ...Typography.body, color: Palette.gray700, marginTop: Spacing.sm },
  cert: { ...Typography.bodySmall, color: Palette.verifiedGreen, marginTop: 4 },
  noContact: { ...Typography.body, color: Palette.gray500, textAlign: 'center' },
  footer: { ...Typography.caption, color: Palette.gray500, textAlign: 'center', marginTop: Spacing.xl },
});
