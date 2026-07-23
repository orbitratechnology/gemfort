import { useQuery } from "@tanstack/react-query";
import { Link, router, useLocalSearchParams } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { CountryLabel } from "@/components/ui/country-flag";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSection, ScreenInset } from "@/components/ui/form-section";
import { Icon, type IconName } from "@/components/ui/icon";
import { ImagePager } from "@/components/ui/image-pager";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import { fetchBusiness } from "@/features/marketplace/marketplace-service";
import { fetchListingBySlug } from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { copyLink, listingShareUrl, shareLink } from "@/lib/share";
import { formatCurrency, openWhatsApp } from "@/lib/utils";

const SPEC_ICONS: Record<string, IconName> = {
  Weight: "scale",
  Color: "palette",
  Clarity: "visibility",
  Shape: "category",
  Treatment: "science",
  Origin: "location-on",
  Lab: "verified",
};

const VISIBILITY_LABEL: Record<string, string> = {
  public: "Public",
  contacts: "Contacts",
  private: "Private link",
  members_only: "Members",
};

export default function PublicListingScreen() {
  const params = useLocalSearchParams<{ slug: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const { colors } = useAppTheme();

  const {
    data: listing,
    isLoading,
    isFetched,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["listing", slug],
    queryFn: () => fetchListingBySlug(slug!),
    enabled: !!slug,
  });

  const { data: business } = useQuery({
    queryKey: ["business", listing?.businessId],
    queryFn: () => fetchBusiness(listing!.businessId),
    enabled: !!listing?.businessId,
  });

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <StackHeader title="Listing" />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if ((isFetched && !listing) || isError) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <StackHeader title="Listing" />
        <View style={styles.center}>
          <EmptyState
            icon="diamond"
            title="Listing not found"
            subtitle="This gem may have been sold or removed from the marketplace."
          />
          <Button
            title="Try again"
            icon="refresh"
            variant="secondary"
            onPress={() => void refetch()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!listing) return null;

  const photos = (listing.photoUrls ?? []).filter(
    (u): u is string => typeof u === "string" && u.trim().length > 0,
  );
  const shareUrl =
    listing.shareableUrl || listingShareUrl(listing.shareableSlug || slug!);
  const listingTitle = listing.title;
  const sellerWhatsapp =
    business?.contacts?.whatsapp?.isVisible && business.contacts.whatsapp.value
      ? business.contacts.whatsapp.value
      : null;
  const visibilityLabel =
    VISIBILITY_LABEL[listing.visibility] ?? listing.visibility;
  const priceLabel =
    listing.showPrice && listing.priceMin != null
      ? `${formatCurrency(listing.priceMin, listing.currency ?? "USD")}${
          listing.priceMax
            ? ` – ${formatCurrency(listing.priceMax, listing.currency ?? "USD")}`
            : ""
        }`
      : "Contact for price";

  const specs = [
    { label: "Weight", value: `${listing.caratWeight} ct` },
    ...(listing.color ? [{ label: "Color", value: listing.color }] : []),
    ...(listing.clarity ? [{ label: "Clarity", value: listing.clarity }] : []),
    ...(listing.shape ? [{ label: "Shape", value: listing.shape }] : []),
    {
      label: "Treatment",
      value: listing.treatmentStatus?.replace(/_/g, " ") || "None",
    },
    { label: "Origin", value: listing.origin || "Unknown" },
    ...(listing.isCertified && listing.certifyingLab
      ? [{ label: "Lab", value: listing.certifyingLab }]
      : []),
  ];

  function handleShare() {
    void shareLink({
      url: shareUrl,
      message: `Check out this gem on GemFort: ${listingTitle}`,
      title: listingTitle,
    });
  }

  function handleCopyLink() {
    void copyLink(shareUrl);
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader
        title={listing.shareableSlug || "Listing"}
        right={
          <View style={styles.headerActions}>
            <Pressable
              onPress={handleCopyLink}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Copy listing link"
              style={styles.headerBtn}
            >
              <Icon name="link" size={22} color={colors.onSurface} />
            </Pressable>
            <Pressable
              onPress={handleShare}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Share listing"
              style={styles.headerBtn}
            >
              <Icon name="share" size={22} color={colors.onSurface} />
            </Pressable>
          </View>
        }
      />

      <ThemedScrollView contentContainerStyle={styles.content}>
        <ScreenInset style={styles.lead}>
          <View style={styles.heroWrap}>
            <ImagePager
              urls={photos}
              aspectRatio={1}
              accessibilityLabel={`${listing.title} photos`}
              wrapFirstPage={(node) => (
                <Link.AppleZoomTarget>{node}</Link.AppleZoomTarget>
              )}
            />
            {listing.isCertified ? (
              <View
                style={[
                  styles.certPill,
                  { backgroundColor: colors.surfaceContainerLowest },
                ]}
                pointerEvents="none"
              >
                <Icon name="verified" size={14} color={colors.primary} />
                <Text style={[styles.certPillText, { color: colors.primary }]}>
                  Certified
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.identity}>
            <View style={styles.identityTitleRow}>
              <View
                style={[
                  styles.identityIcon,
                  { backgroundColor: colors.primaryContainer },
                ]}
              >
                <Icon
                  name="diamond"
                  size={20}
                  color={colors.onPrimaryContainer}
                />
              </View>
              <View style={styles.identityText}>
                <Text style={[styles.gemName, { color: colors.onSurface }]}>
                  {listing.title || formatGemType(listing.gemType)}
                </Text>
                <Text
                  style={[styles.skuLine, { color: colors.onSurfaceVariant }]}
                >
                  {formatGemType(listing.gemType)}
                  {listing.shareableSlug ? ` · ${listing.shareableSlug}` : ""}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.statusChip,
                {
                  backgroundColor: colors.primaryContainer,
                  borderColor: colors.primary + "33",
                },
              ]}
            >
              <View
                style={[
                  styles.statusChipIcon,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Icon name="storefront" size={16} color={colors.onPrimary} />
              </View>
              <View style={styles.statusChipText}>
                <Text
                  style={[
                    styles.statusChipLabel,
                    { color: colors.onPrimaryContainer },
                  ]}
                >
                  Listed
                </Text>
                <Text
                  style={[styles.statusChipValue, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {visibilityLabel}
                </Text>
              </View>
            </View>

            <View style={styles.priceRow}>
              <Icon
                name="sell"
                size={18}
                color={
                  listing.showPrice && listing.priceMin != null
                    ? colors.primary
                    : colors.textMuted
                }
              />
              <Text
                style={[
                  listing.showPrice && listing.priceMin != null
                    ? styles.askPrice
                    : styles.askPriceMuted,
                  {
                    color:
                      listing.showPrice && listing.priceMin != null
                        ? colors.primary
                        : colors.textMuted,
                  },
                ]}
              >
                {priceLabel}
              </Text>
            </View>
          </View>

          <View style={styles.specGrid}>
            {specs.map((spec) => {
              const iconName = SPEC_ICONS[spec.label] ?? "info";
              return (
                <View
                  key={spec.label}
                  style={[
                    styles.specCell,
                    { backgroundColor: colors.surfaceContainerLowest },
                  ]}
                >
                  <View style={styles.specHeader}>
                    <View
                      style={[
                        styles.specIconWrap,
                        { backgroundColor: colors.surfaceContainerHigh },
                      ]}
                    >
                      <Icon name={iconName} size={16} color={colors.primary} />
                    </View>
                    <Text
                      style={[
                        styles.specLabel,
                        { color: colors.onSurfaceVariant },
                      ]}
                    >
                      {spec.label}
                    </Text>
                  </View>
                  {spec.label === "Origin" ? (
                    <CountryLabel
                      country={spec.value}
                      size="sm"
                      textStyle={[styles.specValue, { color: colors.onSurface }]}
                      numberOfLines={2}
                    />
                  ) : (
                    <Text
                      style={[styles.specValue, { color: colors.onSurface }]}
                      numberOfLines={2}
                    >
                      {spec.value}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </ScreenInset>

        {listing.description ? (
          <FormSection title="About" icon="notes">
            <Text style={[styles.notes, { color: colors.onSurfaceVariant }]}>
              {listing.description}
            </Text>
          </FormSection>
        ) : null}

        <FormSection title="Seller" icon="storefront">
          {business ? (
            <Pressable
              onPress={() =>
                router.push(`/business/${business.id}` as never)
              }
              style={({ pressed }) => [
                styles.sellerRow,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.sellerIcon,
                  { backgroundColor: colors.primaryContainer },
                ]}
              >
                <Icon
                  name="storefront"
                  size={20}
                  color={colors.onPrimaryContainer}
                />
              </View>
              <View style={styles.sellerText}>
                <Text
                  style={[styles.sellerName, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {business.businessName}
                </Text>
                {business.city ? (
                  <Text
                    style={[
                      styles.sellerMeta,
                      { color: colors.onSurfaceVariant },
                    ]}
                    numberOfLines={1}
                  >
                    {business.city}
                  </Text>
                ) : null}
              </View>
              <Icon
                name="chevron-right"
                size={22}
                color={colors.onSurfaceVariant}
              />
            </Pressable>
          ) : (
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              Seller details unavailable
            </Text>
          )}
        </FormSection>

        <ScreenInset style={styles.actions}>
          {sellerWhatsapp ? (
            <Button
              title="WhatsApp to inquire"
              icon="chat"
              variant="whatsapp"
              onPress={() =>
                Linking.openURL(
                  openWhatsApp(
                    sellerWhatsapp,
                    `Hi, interested in ${listing.title}`,
                  ),
                )
              }
            />
          ) : null}
          <Button
            title="Share listing"
            icon="share"
            variant="secondary"
            onPress={handleShare}
          />
        </ScreenInset>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          Powered by GemFort — gemfort.app
        </Text>
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerBtn: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  content: {
    paddingBottom: 48,
    gap: Spacing.sectionGap,
  },
  lead: { gap: Spacing.sectionGap },
  heroWrap: { position: "relative", width: "100%" },
  certPill: {
    position: "absolute",
    top: Spacing.md,
    left: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    zIndex: 2,
  },
  certPillText: { ...Typography.labelMd, fontWeight: "600" },

  identity: { gap: Spacing.stackMd },
  identityTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  identityIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  identityText: { flex: 1, gap: 2, minWidth: 0 },
  gemName: { ...Typography.headlineMdMobile },
  skuLine: { ...Typography.bodyMd },

  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: 1.5,
  },
  statusChipIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusChipText: { flex: 1, gap: 1, minWidth: 0 },
  statusChipLabel: {
    ...Typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statusChipValue: { ...Typography.bodyMd, fontWeight: "700" },

  priceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  askPrice: {
    ...Typography.headlineSmMobile,
    fontVariant: ["tabular-nums"],
  },
  askPriceMuted: { ...Typography.bodyMd },

  specGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.stackMd,
  },
  specCell: {
    width: "47%",
    flexGrow: 1,
    minWidth: "42%",
    maxWidth: "48%",
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    gap: 8,
    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.06)",
  },
  specHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  specIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  specLabel: { ...Typography.caption, flexShrink: 1 },
  specValue: { ...Typography.bodyMd, fontWeight: "600" },

  notes: { ...Typography.bodyMd, lineHeight: 22 },
  emptyHint: { ...Typography.bodyMd },

  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  sellerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sellerText: { flex: 1, gap: 2, minWidth: 0 },
  sellerName: { ...Typography.bodyLg, fontWeight: "700" },
  sellerMeta: { ...Typography.bodyMd },

  actions: { gap: Spacing.stackMd },
  footer: {
    ...Typography.caption,
    textAlign: "center",
    marginHorizontal: Spacing.lg,
  },
});
