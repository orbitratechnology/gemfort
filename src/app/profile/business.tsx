import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Redirect, router } from "expo-router";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SocialLinkField } from "@/components/marketplace/business-social-links";
import { Button } from "@/components/ui/button";
import { COVER_BANNER_HEIGHT, CoverBanner } from "@/components/ui/cover-banner";
import { FormSection, FormSectionLabel } from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { PhoneNumberField } from "@/components/ui/phone-number-field";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import {
    Radius,
    Spacing,
    Typography,
    type ThemeColors,
} from "@/constants/design-tokens";
import {
    accountTypeLabelFromRegistration,
    businessTypeFromRegistration,
    createBusinessProfile,
    fetchBusinessByOwnerUid,
    isBusinessVerified,
    updateBusinessProfile,
} from "@/features/marketplace/marketplace-service";
import { normalizeLabCertificateOfferings } from "@/features/marketplace/lab-certificate-offerings";
import { useAppTheme } from "@/hooks/use-app-theme";
import { friendlyError } from "@/lib/errors";
import type { AuthUser } from "@/lib/firebase/auth-types";
import {
    extensionForMedia,
    pickLocalMedia,
    uploadLocalMedia,
    type LocalMedia,
} from "@/lib/firebase/storage-service";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type { Business, LabCertificateOffering, UserProfile } from "@/types";

type CertDraft = {
  id: string;
  title: string;
  description: string;
  priceText: string;
  currency: string;
  isActive: boolean;
};

function draftsFromBusiness(business: Business | null | undefined): CertDraft[] {
  return normalizeLabCertificateOfferings(
    business?.labProfile?.certificateOfferings,
    business?.labProfile?.reportTypes,
  ).map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    priceText: o.price != null ? String(o.price) : "",
    currency: o.currency || "LKR",
    isActive: o.isActive,
  }));
}

function offeringsFromDrafts(drafts: CertDraft[]): LabCertificateOffering[] {
  return drafts.map((d) => {
    const parsed = Number(d.priceText.replace(/,/g, "").trim());
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      price: Number.isFinite(parsed) && parsed >= 0 ? parsed : null,
      currency: d.currency || "LKR",
      isActive: d.isActive,
    };
  });
}
const BANNER_H = COVER_BANNER_HEIGHT;
const AVATAR = 96;
const AVATAR_OVERLAP = 48;

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

type FormProps = {
  business: Business | null | undefined;
  user: AuthUser;
  profile: UserProfile | null;
  colors: ThemeColors;
};

function BusinessProfileForm({ business, user, profile, colors }: FormProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [businessName, setBusinessName] = useState(
    business?.businessName ?? "",
  );
  const [shortDescription, setShortDescription] = useState(
    business?.shortDescription ?? "",
  );
  const [city, setCity] = useState(business?.city ?? "Beruwala");
  const [address, setAddress] = useState(business?.address ?? "");
  const [whatsapp, setWhatsapp] = useState(
    business?.contacts?.whatsapp?.value ?? "",
  );
  const [phone, setPhone] = useState(business?.contacts?.phone?.value ?? "");
  const [website, setWebsite] = useState(business?.socialLinks?.website ?? "");
  const [instagram, setInstagram] = useState(
    business?.socialLinks?.instagram ?? "",
  );
  const [tiktok, setTiktok] = useState(business?.socialLinks?.tiktok ?? "");
  const [facebook, setFacebook] = useState(
    business?.socialLinks?.facebook ?? "",
  );
  const [wechat, setWechat] = useState(business?.socialLinks?.wechat ?? "");
  const [coverUri, setCoverUri] = useState<string | null>(
    business?.coverPhotoUrl ?? null,
  );
  const [logoUri, setLogoUri] = useState<string | null>(
    business?.logoUrl ?? null,
  );
  const [coverLocal, setCoverLocal] = useState<LocalMedia | null>(null);
  const [logoLocal, setLogoLocal] = useState<LocalMedia | null>(null);
  const [loading, setLoading] = useState(false);
  const [certDrafts, setCertDrafts] = useState<CertDraft[]>(() =>
    draftsFromBusiness(business),
  );

  const accountTypeLabel = accountTypeLabelFromRegistration(profile);
  const derivedBusinessType = businessTypeFromRegistration(profile);
  const isLab =
    derivedBusinessType === "gem_lab" ||
    business?.businessType === "gem_lab" ||
    business?.businessType === "lab" ||
    !!business?.labProfile;
  const isVerified =
    isBusinessVerified(business) || profile?.verificationStatus === "verified";
  const displayName = businessName.trim() || "Your Business";

  function updateCertDraft(id: string, patch: Partial<CertDraft>) {
    setCertDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    );
  }
  const canSave =
    businessName.trim().length > 0 &&
    city.trim().length > 0 &&
    (!!business || !!derivedBusinessType);

  async function pickCover() {
    try {
      const media = await pickLocalMedia({ allows: "images" });
      if (!media) return;
      setCoverLocal(media);
      setCoverUri(media.uri);
    } catch (e) {
      toast.error(friendlyError(e, "Could not pick cover photo."));
    }
  }

  async function pickLogo() {
    try {
      const media = await pickLocalMedia({ allows: "images" });
      if (!media) return;
      setLogoLocal(media);
      setLogoUri(media.uri);
    } catch (e) {
      toast.error(friendlyError(e, "Could not pick profile photo."));
    }
  }

  async function handleSave() {
    if (!canSave) {
      toast.error("Business name and city are required.");
      return;
    }
    setLoading(true);
    try {
      const socialLinks = { website, instagram, tiktok, facebook, wechat };
      let nextLogo = logoUri;
      let nextCover = coverUri;

      if (logoLocal) {
        nextLogo = await uploadLocalMedia(
          logoLocal,
          `businesses/${user.uid}/logo.${extensionForMedia(logoLocal)}`,
        );
      }
      if (coverLocal) {
        nextCover = await uploadLocalMedia(
          coverLocal,
          `businesses/${user.uid}/cover.${extensionForMedia(coverLocal)}`,
        );
      }

      if (business) {
        await updateBusinessProfile(business.id, {
          businessName,
          shortDescription,
          city,
          address,
          whatsapp,
          phone,
          socialLinks,
          logoUrl: nextLogo,
          coverPhotoUrl: nextCover,
          ...(isLab
            ? { certificateOfferings: offeringsFromDrafts(certDrafts) }
            : {}),
        });
      } else {
        if (!derivedBusinessType) {
          toast.error(
            "Create a business profile after registering as Trader, Lapidary, or Gem Lab.",
          );
          return;
        }
        const id = await createBusinessProfile(
          user.uid,
          profile?.displayName ?? "Owner",
          {
            businessName,
            businessType: derivedBusinessType,
            city,
            address,
            shortDescription: shortDescription || "Gem business in Beruwala.",
            whatsapp: whatsapp || profile?.phone || undefined,
            phone: phone || profile?.phone || undefined,
            socialLinks,
          },
        );
        const mediaAndCert: Parameters<typeof updateBusinessProfile>[1] = {};
        if (nextLogo) mediaAndCert.logoUrl = nextLogo;
        if (nextCover) mediaAndCert.coverPhotoUrl = nextCover;
        if (isLab) {
          mediaAndCert.certificateOfferings = offeringsFromDrafts(certDrafts);
        }
        if (Object.keys(mediaAndCert).length > 0) {
          await updateBusinessProfile(id, mediaAndCert);
        }
      }

      setCoverLocal(null);
      setLogoLocal(null);
      setCoverUri(nextCover);
      setLogoUri(nextLogo);
      await queryClient.invalidateQueries({ queryKey: ["my-business"] });
      if (business) {
        await queryClient.invalidateQueries({
          queryKey: ["business", business.id],
        });
      }
      toast.success(
        business ? "Business profile updated." : "Business profile created.",
      );
    } catch (e) {
      toast.error(friendlyError(e, "Could not save."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Edge-to-edge banner + centered avatar (Instagram edit profile) */}
      <View style={styles.hero}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change cover photo"
          onPress={() => void pickCover()}
          style={({ pressed }) => pressed && { opacity: 0.92 }}
        >
          <CoverBanner
            uri={coverUri}
            height={BANNER_H}
          >
            <View
              style={[
                styles.bannerEdit,
                { backgroundColor: "rgba(0,0,0,0.55)" },
              ]}
            >
              <Icon name="photo-camera" size={16} color="#FFFFFF" />
              <Text style={styles.bannerEditText}>Edit cover</Text>
            </View>
          </CoverBanner>
        </Pressable>

        <View style={styles.avatarBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            onPress={() => void pickLogo()}
            style={({ pressed }) => [
              styles.avatarPress,
              pressed && { opacity: 0.92 },
            ]}
          >
            <View
              style={[
                styles.avatarRing,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.background,
                },
              ]}
            >
              {logoUri ? (
                <Image
                  source={{ uri: logoUri }}
                  style={styles.avatarImg}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.avatarFallback,
                    { backgroundColor: colors.primaryMuted },
                  ]}
                >
                  <Text
                    style={[styles.avatarInitials, { color: colors.primary }]}
                  >
                    {initials(displayName)}
                  </Text>
                </View>
              )}
            </View>
            {isVerified ? (
              <View
                style={[
                  styles.verifiedBadge,
                  {
                    backgroundColor: colors.accent,
                    borderColor: colors.background,
                  },
                ]}
              >
                <Icon name="verified" size={16} color={colors.onSecondary} />
              </View>
            ) : null}
            <View
              style={[styles.avatarCam, { backgroundColor: colors.primary }]}
            >
              <Icon name="photo-camera" size={14} color={colors.onPrimary} />
            </View>
          </Pressable>

          <Text
            style={[styles.heroName, { color: colors.onSurface }]}
            numberOfLines={2}
          >
            {displayName}
          </Text>
          <Text style={[styles.heroMeta, { color: colors.textMuted }]}>
            {accountTypeLabel}
            {isVerified ? " · Verified" : ""}
          </Text>
        </View>
      </View>

      <FormSectionLabel title="IDENTITY" />
      <FormSection>
        <Input
          label="Business name"
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="e.g. Celestial Sapphires"
          leftIcon="business"
        />
        <Input
          label="Bio"
          value={shortDescription}
          onChangeText={setShortDescription}
          placeholder="Tell buyers what you specialize in…"
          multiline
          style={styles.textArea}
          leftIcon="notes"
        />
      </FormSection>

      <FormSectionLabel title="LOCATION" />
      <FormSection>
        <Input
          label="City"
          value={city}
          onChangeText={setCity}
          placeholder="Beruwala"
          leftIcon="place"
        />
        <Input
          label="Address"
          value={address}
          onChangeText={setAddress}
          placeholder="Street, building, area"
          leftIcon="home"
        />
      </FormSection>

      {isLab ? (
        <>
          <FormSectionLabel title="CERTIFICATE TYPES" />
          <FormSection>
            <Text style={[styles.certHint, { color: colors.textMuted }]}>
              Toggle tiers you offer and set a public price. Leave price blank to
              show “Inquire”.
            </Text>
            {certDrafts.map((cert) => (
              <View
                key={cert.id}
                style={[
                  styles.certCard,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    opacity: cert.isActive ? 1 : 0.72,
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: cert.isActive }}
                  accessibilityLabel={`${cert.title}, ${cert.isActive ? "offered" : "not offered"}`}
                  onPress={() =>
                    updateCertDraft(cert.id, { isActive: !cert.isActive })
                  }
                  style={styles.certHeader}
                >
                  <View style={styles.certHeaderCopy}>
                    <Text
                      style={[styles.certTitle, { color: colors.onSurface }]}
                      numberOfLines={2}
                    >
                      {cert.title}
                    </Text>
                    <Text
                      style={[
                        styles.certDesc,
                        { color: colors.onSurfaceVariant },
                      ]}
                      numberOfLines={3}
                    >
                      {cert.description}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.certToggle,
                      {
                        backgroundColor: cert.isActive
                          ? colors.primary
                          : colors.surfaceContainerHigh,
                      },
                    ]}
                  >
                    <Icon
                      name={cert.isActive ? "check" : "close"}
                      size={16}
                      color={
                        cert.isActive
                          ? colors.onPrimary
                          : colors.onSurfaceVariant
                      }
                    />
                  </View>
                </Pressable>
                {cert.isActive ? (
                  <Input
                    label={`Price (${cert.currency})`}
                    value={cert.priceText}
                    onChangeText={(priceText) =>
                      updateCertDraft(cert.id, { priceText })
                    }
                    placeholder="e.g. 8500"
                    keyboardType="decimal-pad"
                    leftIcon="payments"
                  />
                ) : null}
              </View>
            ))}
          </FormSection>
        </>
      ) : null}

      <FormSectionLabel title="CONTACT" />
      <FormSection>
        <PhoneNumberField
          label="WhatsApp"
          value={whatsapp}
          onChangeText={setWhatsapp}
        />
        <PhoneNumberField
          label="Phone"
          value={phone}
          onChangeText={setPhone}
        />
      </FormSection>

      <FormSectionLabel title="WEBSITE" />
      <FormSection>
        <SocialLinkField
          platform="website"
          label="Website"
          value={website}
          onChangeText={setWebsite}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="yourbusiness.com"
        />
      </FormSection>

      <FormSectionLabel title="SOCIAL" />
      <FormSection>
        <SocialLinkField
          platform="instagram"
          label="Instagram"
          value={instagram}
          onChangeText={setInstagram}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="@username or profile URL"
        />
        <SocialLinkField
          platform="tiktok"
          label="TikTok"
          value={tiktok}
          onChangeText={setTiktok}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="@username or profile URL"
        />
        <SocialLinkField
          platform="facebook"
          label="Facebook"
          value={facebook}
          onChangeText={setFacebook}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Page name or profile URL"
        />
        <SocialLinkField
          platform="wechat"
          label="WeChat"
          value={wechat}
          onChangeText={setWechat}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="WeChat ID"
        />
      </FormSection>

      <View style={styles.actions}>
        <Button
          title={business ? "Save changes" : "Create business profile"}
          icon="shield"
          loading={loading}
          disabled={!canSave}
          onPress={handleSave}
        />

        {business && !isVerified ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Apply for verification"
            onPress={() => router.push("/profile/verify")}
            style={({ pressed }) => [
              styles.linkRow,
              pressed && { opacity: 0.75 },
            ]}
          >
            <Icon name="verified-user" size={20} color={colors.primary} />
            <View style={styles.linkBody}>
              <Text style={[styles.linkText, { color: colors.primary }]}>
                Apply for verification
              </Text>
              <Text style={[styles.linkSub, { color: colors.textMuted }]}>
                Get listed in the GemFort directory
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.outline} />
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

export default function MyBusinessProfileScreen() {
  const { colors } = useAppTheme();
  const { user, profile } = useAuth();

  const { data: business, isLoading } = useQuery({
    queryKey: ["my-business", user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    enabled: !!user,
  });

  const screenTitle = useMemo(
    () => (business ? "Edit Business" : "My Business"),
    [business],
  );

  const canPreviewPublic =
    !!business &&
    (isBusinessVerified(business) ||
      profile?.verificationStatus === "verified");

  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader
        title={screenTitle}
        right={
          canPreviewPublic ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View public profile"
              onPress={() => router.push(`/business/${business.id}`)}
              hitSlop={8}
            >
              <Icon name="person" size={24} color={colors.onSurface} />
            </Pressable>
          ) : null
        }
      />

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading your business…
          </Text>
        </View>
      ) : (
        <ThemedScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <BusinessProfileForm
            key={business?.id ?? "create"}
            business={business}
            user={user}
            profile={profile}
            colors={colors}
          />
        </ThemedScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingBottom: Spacing.section,
    gap: Spacing.md,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  loadingText: { ...Typography.bodyMd },

  hero: {
    marginBottom: Spacing.sm,
  },
  bannerEdit: {
    position: "absolute",
    right: Spacing.containerMargin,
    top: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    minHeight: 36,
  },
  bannerEditText: {
    ...Typography.labelMd,
    color: "#FFFFFF",
    fontWeight: "600",
  },

  avatarBlock: {
    alignItems: "center",
    marginTop: -AVATAR_OVERLAP,
    paddingHorizontal: Spacing.containerMargin,
    gap: 6,
  },
  avatarPress: {
    position: "relative",
    marginBottom: 4,
  },
  avatarRing: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 3,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { ...Typography.headlineMdMobile, fontWeight: "700" },
  verifiedBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCam: {
    position: "absolute",
    left: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  heroName: {
    ...Typography.headlineMdMobile,
    fontWeight: "700",
    textAlign: "center",
  },
  heroMeta: {
    ...Typography.bodyMd,
    textAlign: "center",
  },

  textArea: { minHeight: 96, textAlignVertical: "top", paddingTop: 12 },

  actions: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.containerMargin,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    minHeight: 48,
    paddingVertical: Spacing.sm,
  },
  linkBody: { flex: 1, gap: 2 },
  linkText: { ...Typography.labelMd, fontWeight: "600", flex: 1 },
  linkSub: { ...Typography.bodySmall },

  certHint: {
    ...Typography.caption,
    marginBottom: Spacing.sm,
    paddingHorizontal: 2,
  },
  certCard: {
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  certHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  certHeaderCopy: { flex: 1, gap: 4, minWidth: 0 },
  certTitle: { ...Typography.bodyLg, fontWeight: "700" },
  certDesc: { ...Typography.caption, lineHeight: 16 },
  certToggle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
