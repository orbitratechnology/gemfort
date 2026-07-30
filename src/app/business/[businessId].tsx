import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6/static";
import { Image } from "expo-image";
import { Link, router, useLocalSearchParams, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
    Linking,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BusinessSocialLinksRow } from "@/components/marketplace/business-social-links";
import { FraudReportSheet } from "@/components/marketplace/fraud-report-sheet";
import { ListingCard } from "@/components/marketplace/listing-card";
import { Button } from "@/components/ui/button";
import { PlaceLabel } from "@/components/ui/country-flag";
import { COVER_BANNER_HEIGHT, CoverBanner } from "@/components/ui/cover-banner";
import { FormSection, FormSectionLabel } from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { ProductGrid } from "@/components/ui/product-grid";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import {
    BrandPalette,
    Radius,
    Spacing,
    Typography,
} from "@/constants/design-tokens";
import { formatGemType } from "@/constants/gem-options";
import { hasAnySocialLink } from "@/features/marketplace/business-links";
import { normalizeLabCertificateOfferings } from "@/features/marketplace/lab-certificate-offerings";
import {
    demoBusinesses,
    demoListings,
    fetchBusiness,
    fetchBusinessByOwnerUid,
    fetchBusinesses,
    fetchPublicListings,
    sendLike,
    trackBusinessAnalytics,
} from "@/features/marketplace/marketplace-service";
import {
    subscribeBusiness,
    subscribeBusinessByOwnerUid,
    subscribePublicListings,
    subscribeVerifiedBusinesses,
} from "@/features/workspace/firestore-subscriptions";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { businessShareUrl, copyLink, shareLink } from "@/lib/share";
import { openPhone, openWhatsApp } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type { Business, BusinessType, MarketplaceListing } from "@/types";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function roleLabel(type: BusinessType, isProvider: boolean): string {
  if (type === "gem_lab" || type === "lab") return "Gem Lab";
  if (type === "trader" || type === "seller") return "Trader";
  if (type === "lapidary" || isProvider) return "Lapidary";
  return isProvider ? "Lapidary" : "Trader";
}

function labelize(value: string): string {
  try {
    return formatGemType(value);
  } catch {
    return value.replace(/_/g, " ");
  }
}

const SUGGEST_LIMIT = 8;
const AVATAR_SIZE = 86;

export default function BusinessProfileScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { colors } = useAppTheme();
  const { formatFace } = usePreferredMoney();
  const { user, profile } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [reportOpen, setReportOpen] = useState(false);
  const [liking, setLiking] = useState(false);
  const [showSuggested, setShowSuggested] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const { data: business, isLoading } = useFirestoreLiveQuery({
    queryKey: ["business", businessId],
    queryFn: async () => {
      if (!isFirebaseConfigured) {
        return demoBusinesses().find((b) => b.id === businessId) ?? null;
      }
      try {
        return await fetchBusiness(businessId!);
      } catch {
        return demoBusinesses().find((b) => b.id === businessId) ?? null;
      }
    },
    subscribe: (onData, onError) => {
      if (!isFirebaseConfigured) {
        onData(demoBusinesses().find((b) => b.id === businessId) ?? null);
        return () => undefined;
      }
      return subscribeBusiness(businessId!, onData, onError);
    },
    enabled: !!businessId,
  });

  const { data: myBusiness } = useFirestoreLiveQuery({
    queryKey: ["my-business", user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    subscribe: (onData, onError) =>
      subscribeBusinessByOwnerUid(user!.uid, onData, onError),
    enabled: !!user && isFirebaseConfigured,
  });

  const { data: allListings = [] } = useFirestoreLiveQuery({
    queryKey: ["public-listings"],
    queryFn: async () => {
      if (!isFirebaseConfigured) return demoListings();
      try {
        return await fetchPublicListings();
      } catch {
        return demoListings();
      }
    },
    subscribe: (onData, onError) => {
      if (!isFirebaseConfigured) {
        onData(demoListings());
        return () => undefined;
      }
      return subscribePublicListings(onData, onError);
    },
  });

  const { data: allBusinesses = [] } = useFirestoreLiveQuery({
    queryKey: ["verified-businesses"],
    queryFn: async () => {
      if (!isFirebaseConfigured) return demoBusinesses();
      try {
        return await fetchBusinesses();
      } catch {
        return demoBusinesses();
      }
    },
    subscribe: (onData, onError) => {
      if (!isFirebaseConfigured) {
        onData(demoBusinesses());
        return () => undefined;
      }
      return subscribeVerifiedBusinesses(onData, onError);
    },
  });

  useEffect(() => {
    if (business?.id)
      void trackBusinessAnalytics(business.id, "profileViewsTotal");
  }, [business?.id]);

  const isProvider = !!business?.providerProfile;
  const specs = useMemo(
    () =>
      business?.sellerProfile?.gemSpecializations ??
      business?.providerProfile?.gemSpecializations ??
      [],
    [business],
  );
  const services =
    business?.providerProfile?.services?.filter((s) => s.isActive) ?? [];
  const certificateOfferings = business?.labProfile
    ? normalizeLabCertificateOfferings(
        business.labProfile.certificateOfferings,
        business.labProfile.reportTypes,
      ).filter((o) => o.isActive)
    : [];

  const isOwnBusiness = !!user && user.uid === business?.ownerUid;
  const isVerifiedMember =
    profile?.verificationStatus === "verified" &&
    (profile?.role === "trader" ||
      profile?.role === "lapidary" ||
      profile?.role === "gem_lab");
  const isVerifiedTrader =
    profile?.verificationStatus === "verified" && profile?.role === "trader";
  const canLike =
    !!user && isVerifiedMember && !!myBusiness && !isOwnBusiness;
  const isLab =
    business?.businessType === "gem_lab" ||
    business?.businessType === "lab" ||
    !!business?.labProfile;
  const canRequestService =
    isVerifiedTrader && isProvider && !isOwnBusiness && !isLab;

  const gems = useMemo(() => {
    if (!business) return [] as MarketplaceListing[];
    return allListings.filter(
      (l) => l.businessId === business.id && l.status === "active",
    );
  }, [allListings, business]);

  const suggested = useMemo(() => {
    if (!business) return [] as Business[];
    const sameType = allBusinesses.filter(
      (b) =>
        b.id !== business.id &&
        !dismissedIds.includes(b.id) &&
        b.businessType === business.businessType,
    );
    const others = allBusinesses.filter(
      (b) =>
        b.id !== business.id &&
        !dismissedIds.includes(b.id) &&
        b.businessType !== business.businessType,
    );
    return [...sameType, ...others].slice(0, SUGGEST_LIMIT);
  }, [allBusinesses, business, dismissedIds]);

  const yearsValue = business
    ? String(business.badges.yearsActive || business.yearEstablished || "—")
    : "—";
  const likesValue = business
    ? String(business.badges.likeCount)
    : "0";

  async function handleLike() {
    if (!user || !myBusiness || !business) return;
    setLiking(true);
    try {
      await sendLike({
        fromUid: user.uid,
        fromBusinessId: myBusiness.id,
        toBusinessId: business.id,
      });
      toast.success(`You liked ${business.businessName}.`);
    } catch (e) {
      const msg = friendlyError(e, "Could not send like.");
      toast.error(
        msg.includes("PERMISSION") || msg.includes("already")
          ? "You already liked this business."
          : msg,
      );
    } finally {
      setLiking(false);
    }
  }

  if (isLoading || !business) {
    return (
      <View
        style={[
          styles.safe,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <StackHeader title="Profile" />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>
            {isLoading ? "Loading profile…" : "Business not found"}
          </Text>
        </View>
      </View>
    );
  }

  const role = roleLabel(business.businessType, isProvider);
  const hasWhatsApp = !!business.contacts?.whatsapp?.value?.trim();
  const hasPhone = !!business.contacts?.phone?.value?.trim();
  const hasEmail = !!business.contacts?.email?.value?.trim();
  const hasSocial = hasAnySocialLink(business.socialLinks);
  const hasLocation = !!(
    business.city ||
    business.district ||
    business.country
  );
  const profileUrl = businessShareUrl(business.id);
  const businessName = business.businessName;
  const bizId = business.id;
  const whatsappValue = business.contacts?.whatsapp?.value;
  const phoneValue = business.contacts?.phone?.value;
  const emailValue = business.contacts?.email?.value;
  const suggestCardWidth = Math.min(148, Math.round(windowWidth * 0.38));

  function handleShareProfile() {
    void shareLink({
      url: profileUrl,
      message: `Check out ${businessName} on GemFort`,
      title: businessName,
    });
  }

  function handlePrimaryAction() {
    if (isOwnBusiness) {
      router.push("/profile/business" as Href);
      return;
    }
    if (canLike) {
      void handleLike();
      return;
    }
    if (hasWhatsApp && whatsappValue) {
      void trackBusinessAnalytics(bizId, "whatsappTapsTotal");
      Linking.openURL(openWhatsApp(whatsappValue));
    }
  }

  const primaryLabel = isOwnBusiness
    ? "Edit profile"
    : canLike
      ? liking
        ? "Liking…"
        : "Likes"
      : hasWhatsApp
        ? "Message"
        : hasPhone
          ? "Call"
          : "Share";

  const primaryDisabled = canLike && liking;

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar style={business.coverPhotoUrl ? "light" : "auto"} />
      <ThemedScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <CoverBanner
          uri={business.coverPhotoUrl}
          height={COVER_BANNER_HEIGHT + insets.top}
        />

        {/* Avatar + stats (Instagram header) */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            <Link.AppleZoomTarget>
              <View
                style={StyleSheet.flatten([
                  styles.avatar,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.background,
                  },
                ])}
              >
                {business.logoUrl ? (
                  <Image
                    source={{ uri: business.logoUrl }}
                    style={styles.avatarImg}
                    contentFit="cover"
                  />
                ) : (
                  <Text
                    style={[styles.avatarInitials, { color: colors.primary }]}
                  >
                    {initials(business.businessName)}
                  </Text>
                )}
              </View>
            </Link.AppleZoomTarget>
            {business.badges.isVerified ||
            business.verificationStatus === "verified" ? (
              <View
                style={[
                  styles.verifiedBadge,
                  {
                    backgroundColor: colors.accent,
                    borderColor: colors.background,
                  },
                ]}
                accessibilityLabel="Verified business"
              >
                <Icon name="verified" size={14} color={colors.onSecondary} />
              </View>
            ) : null}
          </View>

          <View style={styles.statsRow}>
            <StatCell
              value={String(gems.length)}
              label="Gems"
              color={colors.onSurface}
              muted={colors.textMuted}
            />
            <StatCell
              value={yearsValue}
              label="Years"
              color={colors.onSurface}
              muted={colors.textMuted}
            />
            <StatCell
              value={likesValue}
              label="Likes"
              color={colors.onSurface}
              muted={colors.textMuted}
            />
          </View>
        </View>

        {/* Name + bio */}
        <View style={styles.bioBlock}>
          <Text style={[styles.name, { color: colors.onSurface }]}>
            {business.businessName}
          </Text>
          <Text style={[styles.roleLine, { color: colors.onSurfaceVariant }]}>
            {role}
            {business.ownerName ? ` · ${business.ownerName}` : ""}
          </Text>
          {business.shortDescription?.trim() ? (
            <Text style={[styles.bio, { color: colors.onSurface }]}>
              {business.shortDescription.trim()}
            </Text>
          ) : null}
          {hasLocation ? (
            <PlaceLabel
              parts={[business.city, business.district]}
              country={business.country}
              size="xs"
              style={styles.locRow}
              textStyle={[styles.locText, { color: colors.textMuted }]}
            />
          ) : null}
          {specs.length > 0 ? (
            <Text
              style={[styles.specsLine, { color: colors.onSurfaceVariant }]}
              numberOfLines={2}
            >
              {specs.map(labelize).join(" · ")}
            </Text>
          ) : null}
          {hasSocial ? (
            <BusinessSocialLinksRow
              links={business.socialLinks}
              style={styles.socialRow}
            />
          ) : null}
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
            disabled={primaryDisabled}
            onPress={() => {
              if (!isOwnBusiness && !canLike && !hasWhatsApp && hasPhone) {
                void trackBusinessAnalytics(bizId, "phoneTapsTotal");
                if (phoneValue) Linking.openURL(openPhone(phoneValue));
                return;
              }
              if (!isOwnBusiness && !canLike && !hasWhatsApp && !hasPhone) {
                handleShareProfile();
                return;
              }
              handlePrimaryAction();
            }}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.surfaceContainerHigh,
                opacity: pressed || primaryDisabled ? 0.75 : 1,
              },
            ]}
          >
            <Text style={[styles.primaryBtnText, { color: colors.onSurface }]}>
              {primaryLabel}
            </Text>
          </Pressable>

          {!isOwnBusiness && hasWhatsApp && (canLike || hasPhone) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="WhatsApp"
              onPress={() => {
                void trackBusinessAnalytics(bizId, "whatsappTapsTotal");
                if (whatsappValue) Linking.openURL(openWhatsApp(whatsappValue));
              }}
              style={({ pressed }) => [
                styles.secondaryBtn,
                {
                  backgroundColor: colors.surfaceContainerHigh,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <FontAwesome6
                name="whatsapp"
                iconStyle="brand"
                size={18}
                color={BrandPalette.whatsapp}
              />
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              showSuggested
                ? "Hide suggested profiles"
                : "Show suggested profiles"
            }
            onPress={() => setShowSuggested((v) => !v)}
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                backgroundColor: colors.surfaceContainerHigh,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Icon name="person-add" size={20} color={colors.onSurface} />
          </Pressable>
        </View>

        {canRequestService ? (
          <View style={styles.requestWrap}>
            <Button
              title="Request service"
              icon="handyman"
              onPress={() =>
                router.push({
                  pathname: "/request/[businessId]",
                  params: { businessId: business.id, mode: "service" },
                })
              }
            />
          </View>
        ) : null}

        {/* Discover people */}
        {showSuggested && suggested.length > 0 ? (
          <View style={styles.discoverSection}>
            <View style={styles.discoverHeader}>
              <Text style={[styles.discoverTitle, { color: colors.onSurface }]}>
                Suggested profiles
              </Text>
              <Pressable
                onPress={() => router.push("/(marketplace)/(tabs)/market")}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel="See all businesses"
              >
                <Text style={[styles.seeAll, { color: colors.primary }]}>
                  See All
                </Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.discoverRail}
            >
              {suggested.map((b) => (
                <SuggestedCard
                  key={b.id}
                  business={b}
                  width={suggestCardWidth}
                  onDismiss={() =>
                    setDismissedIds((ids) =>
                      ids.includes(b.id) ? ids : [...ids, b.id],
                    )
                  }
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Gems tab + 2-col grid */}
        <View
          style={[styles.tabBar, { borderBottomColor: colors.outlineVariant }]}
        >
          <View
            style={[styles.tabActive, { borderBottomColor: colors.onSurface }]}
          >
            <Icon name="grid-view" size={22} color={colors.onSurface} />
          </View>
        </View>

        {gems.length > 0 ? (
          <ProductGrid style={styles.gemsGrid}>
            {gems.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                href={`/listing/${listing.shareableSlug}`}
              />
            ))}
          </ProductGrid>
        ) : (
          <View style={styles.emptyGems}>
            <Icon name="diamond" size={36} color={colors.outlineVariant} />
            <Text style={[styles.emptyGemsText, { color: colors.textMuted }]}>
              No public gems yet
            </Text>
          </View>
        )}

        {/* Lapidary services */}
        {isProvider && services.length > 0 ? (
          <>
            <FormSectionLabel title="SERVICES" />
            <FormSection>
              {services.map((s) => (
                <View key={s.serviceId} style={styles.serviceRow}>
                  <View
                    style={[
                      styles.serviceIcon,
                      { backgroundColor: colors.primaryContainer },
                    ]}
                  >
                    <Icon
                      name="handyman"
                      size={20}
                      color={colors.onPrimaryContainer}
                    />
                  </View>
                  <View style={styles.serviceBody}>
                    <Text
                      style={[styles.serviceName, { color: colors.onSurface }]}
                      numberOfLines={1}
                    >
                      {s.name}
                    </Text>
                    {s.description ? (
                      <Text
                        style={[
                          styles.serviceDesc,
                          { color: colors.onSurfaceVariant },
                        ]}
                        numberOfLines={2}
                      >
                        {s.description}
                      </Text>
                    ) : null}
                    <View style={styles.serviceMetaRow}>
                      <Text
                        style={[styles.serviceMeta, { color: colors.primary }]}
                      >
                        {formatFace(s.priceMin, s.currency)}
                        {s.priceMax > s.priceMin
                          ? ` - ${formatFace(s.priceMax, s.currency)}`
                          : ""}
                      </Text>
                      <Text
                        style={[
                          styles.serviceMetaMuted,
                          { color: colors.textMuted },
                        ]}
                      >
                        {s.turnaroundDaysMin}-{s.turnaroundDaysMax} days
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </FormSection>
          </>
        ) : null}

        {/* Gem Lab certificates */}
        {isLab && certificateOfferings.length > 0 ? (
          <>
            <FormSectionLabel title="CERTIFICATES" />
            <FormSection>
              {certificateOfferings.map((c) => (
                <View key={c.id} style={styles.serviceRow}>
                  <View
                    style={[
                      styles.serviceIcon,
                      { backgroundColor: colors.primaryContainer },
                    ]}
                  >
                    <Icon
                      name="workspace-premium"
                      size={20}
                      color={colors.onPrimaryContainer}
                    />
                  </View>
                  <View style={styles.serviceBody}>
                    <Text
                      style={[styles.serviceName, { color: colors.onSurface }]}
                      numberOfLines={2}
                    >
                      {c.title}
                    </Text>
                    {c.description ? (
                      <Text
                        style={[
                          styles.serviceDesc,
                          { color: colors.onSurfaceVariant },
                        ]}
                        numberOfLines={3}
                      >
                        {c.description}
                      </Text>
                    ) : null}
                    <View style={styles.serviceMetaRow}>
                      <Text
                        style={[styles.serviceMeta, { color: colors.primary }]}
                      >
                        {c.price != null
                          ? formatFace(c.price, c.currency)
                          : "Inquire"}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </FormSection>
          </>
        ) : null}

        {/* Email-only contact fallback */}
        {hasEmail && !isOwnBusiness && !hasWhatsApp && !hasPhone ? (
          <View style={styles.emailWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Email"
              style={({ pressed }) => [
                styles.emailBtn,
                {
                  backgroundColor: colors.surfaceContainerHigh,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={() =>
                emailValue ? Linking.openURL(`mailto:${emailValue}`) : undefined
              }
            >
              <Icon name="mail-outline" size={18} color={colors.primary} />
              <Text style={[styles.emailBtnText, { color: colors.primary }]}>
                Email
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ThemedScrollView>

      {user && business ? (
        <FraudReportSheet
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          reporterUid={user.uid}
          reportedBusinessId={business.id}
          reportedUserUid={business.ownerUid}
          businessName={business.businessName}
        />
      ) : null}

      <View
        pointerEvents="box-none"
        style={[styles.headerOverlay, { paddingTop: insets.top }]}
      >
        <StackHeader
          title=""
          tintColor="#FFFFFF"
          right={
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => void copyLink(profileUrl)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Copy profile link"
                style={[styles.headerAction, styles.headerActionChip]}
              >
                <Icon name="link" size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={handleShareProfile}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Share business profile"
                style={[styles.headerAction, styles.headerActionChip]}
              >
                <Icon name="share" size={20} color="#FFFFFF" />
              </Pressable>
              {user && !isOwnBusiness ? (
                <Pressable
                  onPress={() => setReportOpen(true)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Report business"
                  style={[styles.headerAction, styles.headerActionChip]}
                >
                  <Icon name="flag" size={20} color="#FFFFFF" />
                </Pressable>
              ) : null}
            </View>
          }
        />
      </View>
    </View>
  );
}

function StatCell({
  value,
  label,
  color,
  muted,
}: {
  value: string;
  label: string;
  color: string;
  muted: string;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: muted }]}>{label}</Text>
    </View>
  );
}

function SuggestedCard({
  business,
  width,
  onDismiss,
}: {
  business: Business;
  width: number;
  onDismiss: () => void;
}) {
  const { colors } = useAppTheme();
  const role = roleLabel(business.businessType, !!business.providerProfile);
  const verified =
    business.badges.isVerified || business.verificationStatus === "verified";

  return (
    <View
      style={[
        styles.suggestCard,
        {
          width,
          backgroundColor: colors.surfaceContainerLowest,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      <Pressable
        onPress={onDismiss}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Dismiss suggestion"
        style={styles.suggestDismiss}
      >
        <Icon name="close" size={16} color={colors.textMuted} />
      </Pressable>

      <Link href={`/business/${business.id}`} asChild>
        <Pressable style={styles.suggestBody}>
          <View
            style={[
              styles.suggestAvatar,
              { backgroundColor: colors.surfaceContainerHigh },
            ]}
          >
            {business.logoUrl ? (
              <Image
                source={{ uri: business.logoUrl }}
                style={styles.suggestAvatarImg}
                contentFit="cover"
              />
            ) : (
              <Text style={[styles.suggestInitials, { color: colors.primary }]}>
                {initials(business.businessName)}
              </Text>
            )}
          </View>
          <Text
            style={[styles.suggestName, { color: colors.onSurface }]}
            numberOfLines={1}
          >
            {business.businessName}
          </Text>
          <Text
            style={[styles.suggestMeta, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {verified ? "Verified" : "Suggested for you"} · {role}
          </Text>
        </Pressable>
      </Link>

      <Link href={`/business/${business.id}`} asChild>
        <Pressable
          style={({ pressed }) => [
            styles.suggestFollow,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          <Text style={[styles.suggestFollowText, { color: colors.onPrimary }]}>
            View
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerAction: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActionChip: {
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  content: {
    paddingBottom: 48,
  },

  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.containerMargin,
    marginTop: -AVATAR_SIZE / 2,
    gap: 12,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    position: "relative",
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitials: { fontSize: 26, fontWeight: "700" },
  verifiedBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: AVATAR_SIZE / 2 + 4,
  },
  statCell: {
    alignItems: "center",
    minWidth: 56,
    gap: 2,
  },
  statValue: {
    ...Typography.bodyLg,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  statLabel: { ...Typography.caption },

  bioBlock: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.stackMd,
    gap: 4,
  },
  name: {
    ...Typography.bodyLg,
    fontWeight: "700",
  },
  roleLine: { ...Typography.caption },
  bio: {
    ...Typography.bodyMd,
    lineHeight: 20,
    marginTop: 2,
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 2,
  },
  locText: { ...Typography.caption, flexShrink: 1 },
  specsLine: {
    ...Typography.caption,
    marginTop: 2,
  },
  socialRow: {
    justifyContent: "flex-start",
    marginTop: Spacing.stackSm,
  },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.gutterMd,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: Radius.md,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  primaryBtnText: {
    ...Typography.labelMd,
    fontWeight: "700",
  },
  secondaryBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  requestWrap: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.stackMd,
  },

  discoverSection: {
    paddingTop: Spacing.gutterMd,
    gap: Spacing.stackSm,
  },
  discoverHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.containerMargin,
  },
  discoverTitle: {
    ...Typography.bodyMd,
    fontWeight: "700",
  },
  seeAll: {
    ...Typography.labelMd,
    fontWeight: "600",
  },
  discoverRail: {
    paddingHorizontal: Spacing.containerMargin,
    gap: 10,
    paddingBottom: 4,
  },
  suggestCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    padding: 12,
    paddingTop: 28,
    alignItems: "center",
    gap: 8,
  },
  suggestDismiss: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestBody: {
    alignItems: "center",
    gap: 6,
    width: "100%",
  },
  suggestAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestAvatarImg: { width: "100%", height: "100%" },
  suggestInitials: { fontSize: 18, fontWeight: "700" },
  suggestName: {
    ...Typography.labelMd,
    fontWeight: "700",
    textAlign: "center",
    width: "100%",
  },
  suggestMeta: {
    ...Typography.caption,
    fontSize: 11,
    textAlign: "center",
  },
  suggestFollow: {
    width: "100%",
    minHeight: 32,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  suggestFollowText: {
    ...Typography.labelMd,
    fontWeight: "700",
    fontSize: 12,
  },

  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.gutterMd,
  },
  tabActive: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1.5,
  },
  gemsGrid: {
    paddingTop: Spacing.stackMd,
  },
  emptyGems: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 10,
  },
  emptyGemsText: { ...Typography.bodyMd },

  serviceRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  serviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceBody: { flex: 1, minWidth: 0, gap: 2 },
  serviceName: { ...Typography.bodyLg, fontWeight: "600" },
  serviceDesc: { ...Typography.bodyMd },
  serviceMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    gap: 8,
  },
  serviceMeta: { ...Typography.labelMd, fontWeight: "700", flexShrink: 1 },
  serviceMetaMuted: { ...Typography.caption },

  emailWrap: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.gutterMd,
  },
  emailBtn: {
    minHeight: 44,
    borderRadius: Radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emailBtnText: { ...Typography.button },
});
