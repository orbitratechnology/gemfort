import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedScrollView, ThemedView } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Spacing, Typography } from '@/constants/design-tokens';
import { fetchBusiness } from '@/features/marketplace/marketplace-service';
import { fetchListingBySlug } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatCurrency, openWhatsApp } from '@/lib/utils';

export default function PublicListingScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useAppTheme();

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
      <ThemedView style={styles.center}>
        <Text style={[styles.loading, { color: colors.textMuted }]}>Loading listing...</Text>
      </ThemedView>
    );
  }

  if (isFetched && !listing) {
    return (
      <ThemedView style={styles.center}>
        <EmptyState
          icon="diamond"
          title="Listing not found"
          subtitle="This gem may have been sold or removed from the marketplace."
        />
      </ThemedView>
    );
  }

  if (!listing) return null;

  const photo = listing.photoUrls?.[0];
  const sellerWhatsapp =
    business?.contacts?.whatsapp?.isVisible && business.contacts.whatsapp.value
      ? business.contacts.whatsapp.value
      : null;

  return (
    <ThemedScrollView contentContainerStyle={styles.content}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.hero} />
      ) : (
        <View style={[styles.heroPlaceholder, { backgroundColor: colors.surfaceContainerHigh }]} />
      )}

      <Text style={[styles.title, { color: colors.primary }]}>{listing.title}</Text>
      <Text style={[styles.specs, { color: colors.textMuted }]}>
        {listing.caratWeight} ct · {listing.gemType.replace(/_/g, ' ')} · {listing.origin}
      </Text>

      <Card>
        {listing.showPrice && listing.priceMin ? (
          <Text style={[styles.price, { color: colors.accent }]}>
            {formatCurrency(listing.priceMin, listing.currency ?? 'USD')}
            {listing.priceMax
              ? ` – ${formatCurrency(listing.priceMax, listing.currency ?? 'USD')}`
              : ''}
          </Text>
        ) : (
          <Text style={[styles.price, { color: colors.accent }]}>Contact for price</Text>
        )}
        <Text style={[styles.treatment, { color: colors.textSecondary }]}>
          Treatment: {listing.treatmentStatus.replace(/_/g, ' ')}
        </Text>
        {listing.isCertified ? (
          <Text style={[styles.cert, { color: colors.successEmerald }]}>✅ Certified</Text>
        ) : null}
      </Card>

      {sellerWhatsapp ? (
        <Button
          title="WhatsApp to Inquire"
          icon="chat"
          variant="whatsapp"
          onPress={() =>
            Linking.openURL(openWhatsApp(sellerWhatsapp, `Hi, interested in ${listing.title}`))
          }
        />
      ) : (
        <Text style={[styles.noContact, { color: colors.textMuted }]}>
          Contact details are not available for this listing.
        </Text>
      )}

      <Text style={[styles.footer, { color: colors.textMuted }]}>Powered by GemFort — gemfort.app</Text>
    </ThemedScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  loading: { ...Typography.body },
  hero: { width: '100%', height: 240, borderRadius: 12 },
  heroPlaceholder: { width: '100%', height: 240, borderRadius: 12 },
  title: { ...Typography.h1 },
  specs: { ...Typography.body, textTransform: 'capitalize' },
  price: { ...Typography.h2 },
  treatment: { ...Typography.body, marginTop: Spacing.sm },
  cert: { ...Typography.bodySmall, marginTop: 4 },
  noContact: { ...Typography.body, textAlign: 'center' },
  footer: { ...Typography.caption, textAlign: 'center', marginTop: Spacing.xl },
});
