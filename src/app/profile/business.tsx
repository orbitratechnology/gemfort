import { useQueryClient } from "@tanstack/react-query";
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
import { CityField } from "@/components/ui/city-field";
import { CurrencyAmountField } from "@/components/ui/currency-amount-field";
import { MediaAlbumField } from "@/components/ui/media-album-field";
import { CountryField } from "@/components/ui/country-field";
import { COVER_BANNER_HEIGHT, CoverBanner } from "@/components/ui/cover-banner";
import { FormSection, FormSectionLabel } from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { PhoneNumberField } from "@/components/ui/phone-number-field";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { cityBelongsToCountry } from "@/constants/cities";
import type { CurrencyCode } from "@/constants/currencies";
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
    MAX_GALLERY_PHOTOS,
    updateBusinessProfile,
} from "@/features/marketplace/marketplace-service";
import { subscribeBusinessByOwnerUid } from "@/features/workspace/firestore-subscriptions";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { Timestamp } from "@/lib/firebase/db";
import { friendlyError } from "@/lib/errors";
import type { AuthUser } from "@/lib/firebase/auth-types";
import { parseAmountInput } from "@/lib/money/mask";
import {
    extensionForMedia,
    pickLocalMedia,
    uploadLocalMedia,
    type LocalMedia,
} from "@/lib/firebase/storage-service";
import { useAuth } from "@/providers/auth-provider";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";
import type {
  Business,
  LapidaryServiceOffering,
  UserProfile,
} from "@/types";

type LapidaryServiceDraft = {
  serviceId: string;
  name: string;
  description: string;
  priceText: string;
  currency: string;
  isActive: boolean;
};

function lapidaryDraftsFromBusiness(
  business: Business | null | undefined,
): LapidaryServiceDraft[] {
  return (business?.providerProfile?.services ?? []).map((service) => ({
    serviceId: service.serviceId,
    name: service.name,
    description: service.description,
    priceText: String(service.priceMin),
    currency: service.currency || "LKR",
    isActive: service.isActive,
  }));
}

function lapidaryOfferingsFromDrafts(
  drafts: LapidaryServiceDraft[],
): LapidaryServiceOffering[] {
  return drafts.flatMap((draft) => {
    const price = parseAmountInput(draft.priceText);
    const name = draft.name.trim();
    if (!name || !Number.isFinite(price) || price < 0) return [];
    return [{
      serviceId: draft.serviceId,
      name,
      description: draft.description.trim(),
      pricingType: "fixed" as const,
      priceMin: price,
      priceMax: price,
      currency: draft.currency || "LKR",
      turnaroundDaysMin: 0,
      turnaroundDaysMax: 0,
      isActive: draft.isActive,
    }];
  });
}

function newLapidaryServiceDraft(): LapidaryServiceDraft {
  return {
    serviceId: `service_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    description: "",
    priceText: "",
    currency: "LKR",
    isActive: true,
  };
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
  const [country, setCountry] = useState(business?.country ?? "Sri Lanka");
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
  const [lapidaryServiceDrafts, setLapidaryServiceDrafts] = useState<
    LapidaryServiceDraft[]
  >(() => lapidaryDraftsFromBusiness(business));
  /** Business gallery — existing photos surface as their storage URLs. */
  const [galleryLocal, setGalleryLocal] = useState<LocalMedia[]>(() =>
    (business?.galleryPhotos ?? []).map((p) => ({
      uri: p.url,
      kind: "image" as const,
    })),
  );

  /** Already-uploaded gallery photos keyed by URL so save doesn't re-upload them. */
  const existingGalleryByUrl = useMemo(() => {
    const map = new Map<string, Business["galleryPhotos"][number]>();
    for (const p of business?.galleryPhotos ?? []) map.set(p.url, p);
    return map;
  }, [business]);

  const accountTypeLabel = accountTypeLabelFromRegistration(profile);
  const derivedBusinessType = businessTypeFromRegistration(profile);
  const isLapidary =
    derivedBusinessType === "lapidary" ||
    business?.businessType === "lapidary" ||
    !!business?.providerProfile;
  const isVerified =
    isBusinessVerified(business) || profile?.verificationStatus === "verified";
  const displayName = businessName.trim() || "Your Business";

  function updateLapidaryServiceDraft(
    serviceId: string,
    patch: Partial<LapidaryServiceDraft>,
  ) {
    setLapidaryServiceDrafts((prev) =>
      prev.map((service) =>
        service.serviceId === serviceId ? { ...service, ...patch } : service,
      ),
    );
  }
  const canSave =
    businessName.trim().length > 0 &&
    city.trim().length > 0 &&
    country.trim().length > 0 &&
    (!!business || !!derivedBusinessType);

  async function pickCover() {
    try {
      const media = await pickLocalMedia({ allows: "images", aspect: [3, 1] });
      if (!media) return;
      setCoverLocal(media);
      setCoverUri(media.uri);
    } catch (e) {
      toast.error(friendlyError(e, "Could not pick cover photo."));
    }
  }

  async function pickLogo() {
    try {
      const media = await pickLocalMedia({ allows: "images", aspect: [1, 1] });
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
    try {
      await withLoading(async () => {
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

        const stamp = Date.now();
        const galleryEntries: Business["galleryPhotos"] = [];
        for (let i = 0; i < galleryLocal.length; i++) {
          const item = galleryLocal[i];
          const existing = existingGalleryByUrl.get(item.uri);
          if (existing) {
            galleryEntries.push(existing);
            continue;
          }
          const url = await uploadLocalMedia(
            item,
            `businesses/${user.uid}/gallery/${stamp}_${i}.${extensionForMedia(item)}`,
          );
          galleryEntries.push({
            photoId: `${stamp}_${i}`,
            url,
            type: "work",
            beforeUrl: null,
            afterUrl: null,
            caption: null,
            uploadedAt: Timestamp.now(),
          });
        }

        if (business) {
          await updateBusinessProfile(business.id, {
            businessName,
            shortDescription,
            city,
            country,
            address,
            whatsapp,
            phone,
            socialLinks,
            logoUrl: nextLogo,
            coverPhotoUrl: nextCover,
            galleryPhotos: galleryEntries,
            ...(isLapidary
              ? {
                  lapidaryServiceOfferings: lapidaryOfferingsFromDrafts(
                    lapidaryServiceDrafts,
                  ),
                }
              : {}),
          });
        } else {
          if (!derivedBusinessType) {
            toast.error(
              "Create a business profile after registering as Trader or Lapidary.",
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
              country,
              address,
              shortDescription: shortDescription || "Gem business in Beruwala.",
              whatsapp: whatsapp || profile?.phone || undefined,
              phone: phone || profile?.phone || undefined,
              socialLinks,
            },
          );
          const mediaUpdates: Parameters<typeof updateBusinessProfile>[1] = {};
          if (nextLogo) mediaUpdates.logoUrl = nextLogo;
          if (nextCover) mediaUpdates.coverPhotoUrl = nextCover;
          if (galleryEntries.length > 0) mediaUpdates.galleryPhotos = galleryEntries;
          if (isLapidary) {
            mediaUpdates.lapidaryServiceOfferings = lapidaryOfferingsFromDrafts(
              lapidaryServiceDrafts,
            );
          }
          if (Object.keys(mediaUpdates).length > 0) {
            await updateBusinessProfile(id, mediaUpdates);
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
      }, "Saving…");
    } catch (e) {
      toast.error(friendlyError(e, "Could not save."));
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

      <FormSection title="Business Photos">
        <MediaAlbumField
          value={galleryLocal}
          onChange={setGalleryLocal}
          max={MAX_GALLERY_PHOTOS}
          emptyTitle="Add business photos"
          emptySubtitle="Works, work samples, showroom, and business photos"
        />
      </FormSection>

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
        <CountryField
          label="Country"
          value={country}
          onChange={(name) => {
            setCountry(name);
            if (!city) return;
            void cityBelongsToCountry(city, name).then((ok) => {
              if (!ok) setCity("");
            });
          }}
          placeholder="Select country"
        />
        <CityField
          label="City"
          value={city}
          country={country}
          onChange={setCity}
          placeholder="Select city"
        />
        <Input
          label="Address"
          value={address}
          onChangeText={setAddress}
          placeholder="Street, building, area"
          leftIcon="home"
        />
      </FormSection>

      {isLapidary ? (
        <>
          <FormSectionLabel title="PUBLIC SERVICES" />
          <FormSection>
            <Text style={[styles.serviceHint, { color: colors.textMuted }]}>
              Add the services you provide. Active services and their prices are
              shown on your public profile.
            </Text>
            {lapidaryServiceDrafts.map((service) => (
              <View
                key={service.serviceId}
                style={[
                  styles.serviceCard,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    opacity: service.isActive ? 1 : 0.72,
                  },
                ]}
              >
                <View style={styles.serviceCardHeader}>
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityState={{ checked: service.isActive }}
                    accessibilityLabel={`${service.name || "New service"}, ${service.isActive ? "shown publicly" : "hidden"}`}
                    onPress={() =>
                      updateLapidaryServiceDraft(service.serviceId, {
                        isActive: !service.isActive,
                      })
                    }
                    style={styles.serviceCardCopy}
                  >
                    <Text
                      style={[styles.serviceTitle, { color: colors.onSurface }]}
                    >
                      {service.name || "New service"}
                    </Text>
                    <Text
                      style={[styles.serviceDesc, { color: colors.onSurfaceVariant }]}
                    >
                      {service.isActive ? "Visible on your profile" : "Hidden from your profile"}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${service.name || "service"}`}
                    onPress={() =>
                      setLapidaryServiceDrafts((prev) =>
                        prev.filter((item) => item.serviceId !== service.serviceId),
                      )
                    }
                    hitSlop={8}
                    style={styles.removeServiceButton}
                  >
                    <Icon name="delete-outline" size={20} color={colors.error} />
                  </Pressable>
                </View>
                <Input
                  label="Service name"
                  value={service.name}
                  onChangeText={(name) =>
                    updateLapidaryServiceDraft(service.serviceId, { name })
                  }
                  placeholder="e.g. Precision recutting"
                  leftIcon="handyman"
                />
                <Input
                  label="Description"
                  value={service.description}
                  onChangeText={(description) =>
                    updateLapidaryServiceDraft(service.serviceId, { description })
                  }
                  placeholder="What is included?"
                  multiline
                  style={styles.serviceDescription}
                />
                <CurrencyAmountField
                  label="Price"
                  value={{
                    amount: service.priceText,
                    currency: service.currency as CurrencyCode,
                  }}
                  onChange={({ amount, currency }) =>
                    updateLapidaryServiceDraft(service.serviceId, {
                      priceText: amount,
                      currency,
                    })
                  }
                  placeholder="0"
                />
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add service"
              onPress={() =>
                setLapidaryServiceDrafts((prev) => [
                  ...prev,
                  newLapidaryServiceDraft(),
                ])
              }
              style={({ pressed }) => [
                styles.addServiceButton,
                {
                  borderColor: colors.outlineVariant,
                  backgroundColor: colors.surfaceContainerLow,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <Icon name="add" size={20} color={colors.primary} />
              <Text style={[styles.addServiceText, { color: colors.primary }]}>
                Add service
              </Text>
            </Pressable>
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
                Get listed in the GemFort market
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

  const { data: business, isLoading } = useFirestoreLiveQuery({
    queryKey: ["my-business", user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    subscribe: (onData, onError) =>
      subscribeBusinessByOwnerUid(user!.uid, onData, onError),
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
        closeIcon
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

  serviceHint: {
    ...Typography.caption,
    marginBottom: Spacing.sm,
    paddingHorizontal: 2,
  },
  serviceCard: {
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  serviceTitle: { ...Typography.bodyLg, fontWeight: "700" },
  serviceDesc: { ...Typography.caption, lineHeight: 16 },
  serviceCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  serviceCardCopy: { flex: 1, gap: 4, minWidth: 0 },
  removeServiceButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceDescription: {
    minHeight: 76,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  addServiceButton: {
    minHeight: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  addServiceText: { ...Typography.labelMd, fontWeight: "700" },
});
