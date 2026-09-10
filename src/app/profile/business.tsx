import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import {
    Redirect,
    router,
    useLocalSearchParams,
} from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { BusinessReputationBadge } from "@/components/ui/verification-badge";
import { CityField } from "@/components/ui/city-field";
import { CountryField } from "@/components/ui/country-field";
import { COVER_BANNER_HEIGHT, CoverBanner } from "@/components/ui/cover-banner";
import { CurrencyAmountField } from "@/components/ui/currency-amount-field";
import { FormSection } from "@/components/ui/form-section";
import { Icon, type IconName } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { MediaAlbumField } from "@/components/ui/media-album-field";
import { PhoneNumberField } from "@/components/ui/phone-number-field";
import { ProfileLocationPicker } from "@/components/ui/profile-location-picker";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import {
    businessProfileSectionTitle,
    isBusinessProfileSection,
    type BusinessProfileSection,
} from "@/constants/business-profile-sections";
import { businessReputationBadgeForBusiness } from "@/constants/business-reputation";
import { cityBelongsToCountry } from "@/constants/cities";
import type { CurrencyCode } from "@/constants/currencies";
import {
    Radius,
    Spacing,
    Typography,
    type ThemeColors,
} from "@/constants/design-tokens";
import {
    LAPIDARY_SERVICE_OPTIONS,
    normalizeLapidaryServiceId,
    type LapidaryServiceId,
} from "@/constants/roles";
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
import { friendlyError } from "@/lib/errors";
import type { AuthUser } from "@/lib/firebase/auth-types";
import { Timestamp } from "@/lib/firebase/db";
import {
    extensionForMedia,
    pickLocalMedia,
    uploadLocalMedia,
    type LocalMedia,
} from "@/lib/firebase/storage-service";
import {
    detectProfileLocation,
    profileLocationLabel,
} from "@/lib/location/profile-location";
import { parseAmountInput } from "@/lib/money/mask";
import { useAuth } from "@/providers/auth-provider";
import { withLoading } from "@/providers/loading-bridge";
import { useToast } from "@/providers/toast-provider";
import type {
    Business,
    LapidaryServiceOffering,
    ProfileLocation,
    UserProfile,
} from "@/types";

type LapidaryServiceDraft = {
  serviceId: LapidaryServiceId;
  priceText: string;
  currency: string;
};

const LAPIDARY_SERVICE_ICONS: Record<LapidaryServiceId, IconName> = {
  cutting: "content-cut",
  heating: "local-fire-department",
  polishing: "auto-awesome",
};

const LAPIDARY_SERVICE_HINTS: Record<LapidaryServiceId, string> = {
  cutting: "Facet, shape, or re-cut gemstones",
  heating: "Controlled heat treatment",
  polishing: "Bring out the final luster",
};

function serviceOption(serviceId: LapidaryServiceId) {
  return LAPIDARY_SERVICE_OPTIONS.find((service) => service.id === serviceId)!;
}

function lapidaryDraftsFromBusiness(
  business: Business | null | undefined,
): LapidaryServiceDraft[] {
  const offerings = business?.providerProfile?.services ?? [];
  const legacyTypes = business?.providerProfile?.servicesOffered ?? [];
  const drafts: LapidaryServiceDraft[] = [];
  const seen = new Set<LapidaryServiceId>();

  for (const service of offerings) {
    const serviceId =
      normalizeLapidaryServiceId(service.serviceId) ??
      normalizeLapidaryServiceId(service.name);
    if (!serviceId || seen.has(serviceId)) continue;
    seen.add(serviceId);
    drafts.push({
      serviceId,
      priceText:
        service.pricingType === "optional" || service.priceMin == null
          ? ""
          : String(service.priceMin),
      currency: service.currency || "LKR",
    });
  }

  for (const value of legacyTypes) {
    const serviceId = normalizeLapidaryServiceId(value);
    if (!serviceId || seen.has(serviceId)) continue;
    seen.add(serviceId);
    drafts.push({ serviceId, priceText: "", currency: "LKR" });
  }

  return drafts;
}

function lapidaryOfferingsFromDrafts(
  drafts: LapidaryServiceDraft[],
): LapidaryServiceOffering[] {
  return drafts.flatMap((draft) => {
    const priceText = draft.priceText.trim();
    const price = priceText ? parseAmountInput(priceText) : null;
    if (priceText && (price == null || !Number.isFinite(price) || price < 0)) return [];
    const name = serviceOption(draft.serviceId).label;
    return [{
      serviceId: draft.serviceId,
      name,
      description: "",
      pricingType: price == null ? ("optional" as const) : ("fixed" as const),
      priceMin: price,
      priceMax: price,
      currency: price == null ? null : draft.currency || "LKR",
      turnaroundDaysMin: 0,
      turnaroundDaysMax: 0,
      isActive: true,
    }];
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
  section: BusinessProfileSection | null;
};

function BusinessProfileForm({
  business,
  user,
  profile,
  colors,
  section,
}: FormProps) {
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
  const [location, setLocation] = useState<ProfileLocation | null>(
    business?.location ?? null,
  );
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [locationDetecting, setLocationDetecting] = useState(false);
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
  const coverLocalRef = useRef<LocalMedia | null>(null);
  const logoLocalRef = useRef<LocalMedia | null>(null);
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
  const reputationBadge = profile?.memberBadge
    ? "member"
    : businessReputationBadgeForBusiness(business);
  const displayName = businessName.trim() || "Your Business";
  const showAllSections = section === null;
  const showPhotos = showAllSections || section === "photos";
  const showIdentity = showAllSections || section === "identity";
  const showLocation = showAllSections || section === "location";
  const showServices = showAllSections || section === "services";
  const showContact = showAllSections || section === "contact";
  const showWebsite = showAllSections || section === "website";
  const showSocial = showAllSections || section === "social";

  useEffect(() => {
    if (!showLocation || business?.location) return;
    let active = true;
    setLocationDetecting(true);
    void detectProfileLocation()
      .then((detected) => {
        if (!active || !detected) return;
        setLocation(detected);
        if (detected.city) setCity(detected.city);
        if (detected.country) setCountry(detected.country);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLocationDetecting(false);
      });

    return () => {
      active = false;
    };
  }, [business?.id, business?.location, showLocation]);

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
      coverLocalRef.current = media;
      setCoverUri(media.uri);
    } catch (e) {
      toast.error(friendlyError(e, "Could not pick cover photo."));
    }
  }

  async function pickLogo() {
    try {
      const media = await pickLocalMedia({ allows: "images", aspect: [1, 1] });
      if (!media) return;
      logoLocalRef.current = media;
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
    if (isLapidary) {
      const hasInvalidPrice = lapidaryServiceDrafts.some((service) => {
        const value = service.priceText.trim();
        if (!value) return false;
        const price = parseAmountInput(value);
        return !Number.isFinite(price) || price < 0;
      });
      if (hasInvalidPrice) {
        toast.error("Enter a valid price or leave pricing blank.");
        return;
      }
    }
    try {
      const nextLogoLocal = logoLocalRef.current;
      const nextCoverLocal = coverLocalRef.current;
      await withLoading(async () => {
        const socialLinks = { website, instagram, tiktok, facebook, wechat };
        let nextLogo = logoUri;
        let nextCover = coverUri;

        if (nextLogoLocal) {
          nextLogo = await uploadLocalMedia(
            nextLogoLocal,
            `businesses/${user.uid}/logo.${extensionForMedia(nextLogoLocal)}`,
          );
        }
        if (nextCoverLocal) {
          nextCover = await uploadLocalMedia(
            nextCoverLocal,
            `businesses/${user.uid}/cover.${extensionForMedia(nextCoverLocal)}`,
          );
        }

        const stamp = Date.now();
        const galleryEntries: Business["galleryPhotos"] = await Promise.all(
          galleryLocal.map(async (item, i) => {
            const existing = existingGalleryByUrl.get(item.uri);
            if (existing) {
              return existing;
            }
            const url = await uploadLocalMedia(
              item,
              `businesses/${user.uid}/gallery/${stamp}_${i}.${extensionForMedia(item)}`,
            );
            return {
              photoId: `${stamp}_${i}`,
              url,
              type: "work",
              beforeUrl: null,
              afterUrl: null,
              caption: null,
              uploadedAt: Timestamp.now(),
            };
          }),
        );

        if (business) {
          await updateBusinessProfile(business.id, {
            businessName,
            shortDescription,
            city,
            country,
            address,
            location,
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
              location,
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

        coverLocalRef.current = null;
        logoLocalRef.current = null;
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
      {showPhotos ? (
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
          {reputationBadge !== "none" ? (
            <BusinessReputationBadge type={reputationBadge} />
          ) : null}
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
        </>
      ) : null}

      {showIdentity ? (
        <>
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
        </>
      ) : null}

      {showLocation ? (
        <>
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose business location on map"
          onPress={() => setLocationPickerOpen(true)}
          style={({ pressed }) => [
            styles.locationField,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.locationIcon,
              { backgroundColor: colors.primaryContainer },
            ]}
          >
            {locationDetecting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Icon
                name="location-on"
                size={20}
                color={colors.onPrimaryContainer}
              />
            )}
          </View>
          <View style={styles.locationCopy}>
            <Text style={[styles.locationTitle, { color: colors.onSurface }]}>Map pin</Text>
            <Text
              style={[styles.locationValue, { color: colors.textMuted }]}
              numberOfLines={2}
            >
              {locationDetecting
                ? "Detecting your current location…"
                : location
                  ? profileLocationLabel(location)
                  : "Choose the exact public location"}
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.outline} />
        </Pressable>
        <Input
          label="Address"
          value={address}
          onChangeText={setAddress}
          placeholder="Street, building, area"
          leftIcon="home"
        />
          </FormSection>
        </>
      ) : null}

      {showServices && isLapidary ? (
        <>
          <FormSection>
            <Text style={[styles.serviceHint, { color: colors.textMuted }]}>
              Select every service your workshop provides. Pricing is optional and
              can be added per service.
            </Text>
            <View style={styles.serviceOptions}>
              {LAPIDARY_SERVICE_OPTIONS.map((option) => {
                const selected = lapidaryServiceDrafts.some(
                  (service) => service.serviceId === option.id,
                );
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${option.label} service`}
                    onPress={() => {
                      setLapidaryServiceDrafts((prev) =>
                        selected
                          ? prev.filter((service) => service.serviceId !== option.id)
                          : [
                              ...prev,
                              {
                                serviceId: option.id,
                                priceText: "",
                                currency: "LKR",
                              },
                            ],
                      );
                    }}
                    style={({ pressed }) => [
                      styles.serviceOption,
                      {
                        backgroundColor: selected
                          ? colors.primaryContainer
                          : colors.surfaceContainerLowest,
                        borderColor: selected
                          ? colors.primary
                          : colors.outlineVariant,
                        opacity: pressed ? 0.82 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.serviceOptionIcon,
                        {
                          backgroundColor: selected
                            ? colors.primary
                            : colors.surfaceContainerHigh,
                        },
                      ]}
                    >
                      <Icon
                        name={LAPIDARY_SERVICE_ICONS[option.id]}
                        size={20}
                        color={selected ? colors.onPrimary : colors.onSurfaceVariant}
                      />
                    </View>
                    <View style={styles.serviceOptionCopy}>
                      <Text
                        style={[styles.serviceTitle, { color: colors.onSurface }]}
                      >
                        {option.label}
                      </Text>
                      <Text
                        style={[styles.serviceDesc, { color: colors.textMuted }]}
                        numberOfLines={1}
                      >
                        {LAPIDARY_SERVICE_HINTS[option.id]}
                      </Text>
                    </View>
                    <Icon
                      name={selected ? "check-circle" : "radio-button-unchecked"}
                      size={22}
                      color={selected ? colors.primary : colors.outline}
                    />
                  </Pressable>
                );
              })}
            </View>

            {lapidaryServiceDrafts.length > 0 ? (
              <View style={styles.pricingList}>
                <Text style={[styles.pricingTitle, { color: colors.onSurface }]}>
                  Pricing (optional)
                </Text>
                <Text style={[styles.pricingHint, { color: colors.textMuted }]}>
                  Leave a price blank to invite a quote.
                </Text>
                {lapidaryServiceDrafts.map((service) => {
                  const option = serviceOption(service.serviceId);
                  return (
                    <View
                      key={service.serviceId}
                      style={[
                        styles.pricingCard,
                        {
                          backgroundColor: colors.surfaceContainerLow,
                          borderColor: colors.outlineVariant,
                        },
                      ]}
                    >
                      <View style={styles.pricingCardHeader}>
                        <Icon
                          name={LAPIDARY_SERVICE_ICONS[service.serviceId]}
                          size={18}
                          color={colors.primary}
                        />
                        <Text
                          style={[styles.pricingLabel, { color: colors.onSurface }]}
                        >
                          {option.label}
                        </Text>
                      </View>
                      <CurrencyAmountField
                        label="Starting price (optional)"
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
                        placeholder="Quote on request"
                      />
                    </View>
                  );
                })}
              </View>
            ) : null}
          </FormSection>
        </>
      ) : null}

      {showContact ? (
        <>
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
        </>
      ) : null}

      {showWebsite ? (
        <>
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
        </>
      ) : null}

      {showSocial ? (
        <>
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
        </>
      ) : null}

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
      <ProfileLocationPicker
        visible={locationPickerOpen}
        value={location}
        onClose={() => setLocationPickerOpen(false)}
        onSave={(next) => {
          setLocation(next);
          if (next.city) setCity(next.city);
          if (next.country) setCountry(next.country);
          setLocationPickerOpen(false);
        }}
      />
    </>
  );
}

export default function MyBusinessProfileScreen() {
  const { colors } = useAppTheme();
  const { user, profile } = useAuth();
  const { section: sectionParam } = useLocalSearchParams<{
    section?: string | string[];
  }>();
  const section = isBusinessProfileSection(sectionParam) ? sectionParam : null;

  const { data: business, isLoading } = useFirestoreLiveQuery({
    queryKey: ["my-business", user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    subscribe: (onData, onError) =>
      subscribeBusinessByOwnerUid(user!.uid, onData, onError),
    enabled: !!user,
  });

  const screenTitle = section
    ? businessProfileSectionTitle(section)
    : business
      ? "Edit Business"
      : "My Business";

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
        closeIcon={!section}
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
            section={section}
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

  locationField: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    minHeight: 64,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderCurve: "continuous",
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  locationCopy: { flex: 1, gap: 2, minWidth: 0 },
  locationTitle: { ...Typography.labelMd, fontWeight: "600" },
  locationValue: { ...Typography.caption, lineHeight: 17 },

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
  serviceOptions: {
    gap: Spacing.sm,
  },
  serviceOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    minHeight: 72,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  serviceOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceOptionCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  serviceTitle: { ...Typography.bodyLg, fontWeight: "700" },
  serviceDesc: { ...Typography.caption, lineHeight: 16 },
  pricingList: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  pricingTitle: {
    ...Typography.labelMd,
    fontWeight: "700",
  },
  pricingHint: {
    ...Typography.caption,
    marginTop: -4,
  },
  pricingCard: {
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  pricingCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  pricingLabel: {
    ...Typography.labelMd,
    fontWeight: "700",
  },
});
