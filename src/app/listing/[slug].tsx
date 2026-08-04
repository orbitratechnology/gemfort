import { Image } from "expo-image";
import { Link, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Linking,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { CountryFlag, CountryLabel } from "@/components/ui/country-flag";
import {
    CurrencyAmountField,
    type CurrencyAmountValue,
} from "@/components/ui/currency-amount-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { ImagePager } from "@/components/ui/image-pager";
import { Input } from "@/components/ui/input";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { resolveCurrencyCode, type CurrencyCode } from "@/constants/currencies";
import {
    FontFamily,
    Radius,
    Spacing,
    Typography,
} from "@/constants/design-tokens";
import {
    formatGemType,
    formatShapeLabel,
    formatTreatmentLabel,
} from "@/constants/gem-options";
import {
    clearListingOffers,
    fetchBusiness,
    fetchBusinessByOwnerUid,
    fetchBuyerOffersForListing,
    fetchOffersForListing,
    isBusinessVerified,
    isListingOfferUnread,
    LISTING_OFFER_LIMITS,
    markListingOffersRead,
    removeListingOffers,
    submitListingOffer,
    withdrawListingOffer,
} from "@/features/marketplace/marketplace-service";
import {
    subscribeBusiness,
    subscribeBusinessByOwnerUid,
    subscribeBuyerOffersForListing,
    subscribeListingBySlug,
    subscribeOffersForListing,
} from "@/features/workspace/firestore-subscriptions";
import { fetchListingBySlug } from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useFirestoreLiveQuery } from "@/hooks/use-firestore-live-query";
import { usePreferredMoney } from "@/hooks/use-preferred-money";
import { friendlyError } from "@/lib/errors";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { copyLink, listingShareUrl, shareLink } from "@/lib/share";
import { formatRelativeTime, openPhone, openWhatsApp } from "@/lib/utils";
import { listingOfferSchema, parseForm } from "@/lib/validation/form-schemas";
import { useAuth } from "@/providers/auth-provider";
import { confirm } from "@/providers/confirm-provider";
import { withLoading } from "@/providers/loading-provider";
import { useToast } from "@/providers/toast-provider";
import type { ListingOffer } from "@/types";

const SPEC_ICONS: Record<string, IconName> = {
  Weight: "scale",
  Color: "palette",
  Clarity: "visibility",
  Shape: "category",
  Treatment: "science",
  Origin: "location-on",
  Lab: "verified",
  Cut: "content-cut",
};

function businessRoleLabel(type: string | undefined): string {
  if (type === "gem_lab" || type === "lab") return "Gem Lab";
  if (type === "lapidary") return "Lapidary";
  return "Trader";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function PublicListingScreen() {
  const params = useLocalSearchParams<{
    slug: string | string[];
    offers?: string | string[];
  }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const { colors } = useAppTheme();
  const { formatStored } = usePreferredMoney();
  const { user, profile } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [descExpanded, setDescExpanded] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offersInboxOpen, setOffersInboxOpen] = useState(
    () => params.offers === "1",
  );
  const [offerSaving, setOfferSaving] = useState(false);
  const [offerAmount, setOfferAmount] = useState<CurrencyAmountValue>({
    amount: "",
    currency: "USD",
  });
  const [offerMessage, setOfferMessage] = useState("");
  const [offerError, setOfferError] = useState<string | null>(null);
  const lastOfferSubmitAt = useRef(0);

  const {
    data: listing,
    isLoading,
    isFetched,
    isError,
    refetch,
  } = useFirestoreLiveQuery({
    queryKey: ["listing", slug],
    queryFn: () => fetchListingBySlug(slug!),
    subscribe: (onData, onError) =>
      subscribeListingBySlug(slug!, onData, onError),
    enabled: !!slug,
  });

  const { data: business } = useFirestoreLiveQuery({
    queryKey: ["business", listing?.businessId],
    queryFn: () => fetchBusiness(listing!.businessId),
    subscribe: (onData, onError) =>
      subscribeBusiness(listing!.businessId, onData, onError),
    enabled: !!listing?.businessId,
  });

  const { data: myBusiness } = useFirestoreLiveQuery({
    queryKey: ["my-business", user?.uid],
    queryFn: () => fetchBusinessByOwnerUid(user!.uid),
    subscribe: (onData, onError) =>
      subscribeBusinessByOwnerUid(user!.uid, onData, onError),
    enabled: !!user && isFirebaseConfigured,
  });

  const isOwner = !!user && !!listing && user.uid === listing.sellerUid;

  const { data: receivedOffers = [] } = useFirestoreLiveQuery({
    queryKey: ["listing-offers", listing?.id],
    queryFn: () => fetchOffersForListing(listing!.id),
    subscribe: (onData, onError) =>
      subscribeOffersForListing(listing!.id, onData, onError),
    enabled: !!listing?.id && isOwner,
  });

  const { data: myOffers = [] } = useFirestoreLiveQuery({
    queryKey: ["my-listing-offers", user?.uid, listing?.id],
    queryFn: () => fetchBuyerOffersForListing(user!.uid, listing!.id),
    subscribe: (onData, onError) =>
      subscribeBuyerOffersForListing(user!.uid, listing!.id, onData, onError),
    enabled: !!user && !!listing?.id && !isOwner,
  });

  const pendingMine = useMemo(
    () => myOffers.find((o) => o.status === "pending") ?? null,
    [myOffers],
  );
  const unreadOfferCount = useMemo(
    () => receivedOffers.filter(isListingOfferUnread).length,
    [receivedOffers],
  );

  useEffect(() => {
    if (!offersInboxOpen || receivedOffers.length === 0) return;
    void markListingOffersRead(receivedOffers).catch(() => undefined);
  }, [offersInboxOpen, receivedOffers]);

  if (isLoading) {
    return (
      <View
        style={[
          styles.safe,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <StackHeader title="Listing" />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>Loading…</Text>
        </View>
      </View>
    );
  }

  if ((isFetched && !listing) || isError) {
    return (
      <View
        style={[
          styles.safe,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
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
      </View>
    );
  }

  if (!listing) return null;

  const activeListing = listing;

  const photos = (activeListing.photoUrls ?? []).filter(
    (u): u is string => typeof u === "string" && u.trim().length > 0,
  );
  const shareUrl =
    activeListing.shareableUrl ||
    listingShareUrl(activeListing.shareableSlug || slug!);
  const listingTitle =
    activeListing.title || formatGemType(activeListing.gemType);
  const sellerWhatsapp =
    business?.contacts?.whatsapp?.isVisible && business.contacts.whatsapp.value
      ? business.contacts.whatsapp.value
      : null;
  const sellerPhone =
    business?.contacts?.phone?.isVisible && business.contacts.phone.value
      ? business.contacts.phone.value
      : null;

  const hasPrice = activeListing.showPrice && activeListing.priceMin != null;
  const priceLabel = hasPrice
    ? `${formatStored({
        amount: activeListing.priceMin!,
        currency: activeListing.currency ?? "USD",
        amountBase: activeListing.priceMinBase,
      })}${
        activeListing.priceMax
          ? ` – ${formatStored({
              amount: activeListing.priceMax,
              currency: activeListing.currency ?? "USD",
              amountBase: activeListing.priceMaxBase,
            })}`
          : ""
      }`
    : "Contact for price";

  const perCaratLabel =
    hasPrice && activeListing.caratWeight > 0
      ? `${formatStored({
          amount: activeListing.priceMin! / activeListing.caratWeight,
          currency: activeListing.currency ?? "USD",
          amountBase:
            activeListing.priceMinBase != null
              ? activeListing.priceMinBase / activeListing.caratWeight
              : null,
        })} / ct`
      : null;

  const shapeLabel = formatShapeLabel(activeListing.shape);
  const treatmentLabel = formatTreatmentLabel(activeListing.treatmentStatus);
  const specs = [
    { label: "Weight", value: `${activeListing.caratWeight} ct` },
    ...(shapeLabel ? [{ label: "Shape", value: shapeLabel }] : []),
    ...(activeListing.color
      ? [{ label: "Color", value: activeListing.color }]
      : []),
    ...(activeListing.clarity
      ? [{ label: "Clarity", value: activeListing.clarity }]
      : []),
    {
      label: "Treatment",
      value: treatmentLabel || "None",
    },
    { label: "Origin", value: activeListing.origin || "Unknown" },
    ...(activeListing.isCertified && activeListing.certifyingLab
      ? [{ label: "Lab", value: activeListing.certifyingLab }]
      : []),
    ...(activeListing.certificateUrl
      ? [
          {
            label: "Certificate / Report",
            value: activeListing.certificateFileName || "View attachment",
          },
        ]
      : []),
  ];

  const tags: string[] = [];
  if (activeListing.isCertified) tags.push("Certified");
  if (treatmentLabel && treatmentLabel !== "None") tags.push(treatmentLabel);
  if (activeListing.clarity) tags.push(activeListing.clarity);

  const ownerName =
    business?.businessName?.trim() ||
    activeListing.sellerBusinessName?.trim() ||
    "Seller";
  const ownerRole = businessRoleLabel(
    business?.businessType ?? activeListing.sellerBusinessType ?? undefined,
  );
  const ownerVerified =
    isBusinessVerified(business) || activeListing.sellerIsVerified === true;
  const ownerAvatar = business?.logoUrl ?? activeListing.sellerLogoUrl ?? null;
  const ownerInitials = initials(ownerName);
  const yearsActive = business?.badges?.yearsActive;
  const locationBits = [
    business?.city ?? activeListing.sellerCity,
    business?.country ?? activeListing.sellerCountry,
  ]
    .filter(Boolean)
    .join(", ");

  const heroHeight = windowWidth;
  const bottomBarPad = Math.max(insets.bottom, 12);

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

  function inquireWhatsApp(prefix?: string) {
    if (!sellerWhatsapp) return;
    const msg = prefix
      ? `${prefix} ${listingTitle}`
      : `Hi, interested in ${listingTitle}`;
    void Linking.openURL(openWhatsApp(sellerWhatsapp, msg));
  }

  function openOfferSheet() {
    if (!user) {
      toast.show("Sign in to make an offer.");
      router.push("/(auth)/login" as never);
      return;
    }
    if (user.uid === activeListing.sellerUid) {
      toast.show("This is your listing.");
      return;
    }
    if (pendingMine) {
      toast.show(
        "You already have a pending offer. Withdraw it to send a new one.",
      );
      return;
    }
    setOfferError(null);
    setOfferAmount({
      amount:
        activeListing.showPrice && activeListing.priceMin != null
          ? String(activeListing.priceMin)
          : "",
      currency: resolveCurrencyCode(
        (activeListing.currency as CurrencyCode) || "USD",
        "USD",
      ),
    });
    setOfferMessage("");
    setOfferOpen(true);
  }

  async function handleSubmitOffer() {
    if (!user || offerSaving) return;
    const now = Date.now();
    if (
      now - lastOfferSubmitAt.current <
      LISTING_OFFER_LIMITS.submitDebounceMs
    ) {
      return;
    }
    lastOfferSubmitAt.current = now;

    const result = parseForm(listingOfferSchema, {
      amount: offerAmount.amount,
      message: offerMessage || undefined,
    });
    if (!result.success) {
      setOfferError(result.errors.amount ?? Object.values(result.errors)[0]!);
      return;
    }
    setOfferError(null);
    setOfferSaving(true);
    try {
      await withLoading(async () => {
        await submitListingOffer({
          listing: activeListing,
          buyerUid: user.uid,
          buyerName:
            myBusiness?.businessName?.trim() ||
            profile?.displayName?.trim() ||
            user.email ||
            "Buyer",
          buyerBusiness: myBusiness,
          amount: result.data.amount,
          currency: offerAmount.currency,
          message: result.data.message ?? "",
        });
      }, "Sending offer…");
      setOfferOpen(false);
      toast.success("Offer sent. The seller was notified.");
    } catch (e) {
      setOfferError(friendlyError(e, "Could not send offer."));
    } finally {
      setOfferSaving(false);
    }
  }

  async function handleWithdrawMine() {
    if (!pendingMine) return;
    try {
      await withLoading(async () => {
        await withdrawListingOffer(pendingMine.id);
      }, "Withdrawing…");
      toast.success("Offer withdrawn.");
    } catch (e) {
      toast.error(friendlyError(e, "Could not withdraw offer."));
    }
  }

  async function handleClearOffers() {
    if (receivedOffers.length === 0) return;
    const ok = await confirm({
      title: "Clear offers",
      message: "Hide all offers from this gem? You won’t see them again.",
      confirmLabel: "Clear all",
      onConfirm: () => clearListingOffers(receivedOffers),
    });
    if (!ok) return;
    setOffersInboxOpen(false);
    toast.success("Offers cleared.");
  }

  async function handleRemoveOffers() {
    if (receivedOffers.length === 0) return;
    const ok = await confirm({
      title: "Remove all offers",
      message: "Permanently delete all offers on this gem?",
      confirmLabel: "Remove all",
      tone: "destructive",
      onConfirm: () => removeListingOffers(receivedOffers),
    });
    if (!ok) return;
    setOffersInboxOpen(false);
    toast.success("Offers removed.");
  }

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar style={photos.length ? "light" : "auto"} />

      <ThemedScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 88 + bottomBarPad },
        ]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        {/* Full-bleed hero + film strip */}
        <View style={styles.heroBlock}>
          <ImagePager
            urls={photos}
            aspectRatio={1}
            edgeToEdge
            style={{ height: heroHeight }}
            accessibilityLabel={`${activeListing.title} photos`}
            wrapFirstPage={(node) => (
              <Link.AppleZoomTarget>{node}</Link.AppleZoomTarget>
            )}
            overlay={
              activeListing.isCertified ? (
                <View
                  style={[styles.heroBadge, { top: insets.top + 56 }]}
                  pointerEvents="none"
                >
                  <Icon name="verified" size={12} color="#FFFFFF" />
                  <Text style={styles.heroBadgeText}>VERIFIED</Text>
                </View>
              ) : null
            }
          />
        </View>

        {/* Overlapping detail sheet */}
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          {/* Title, then price on its own row */}
          <View style={styles.titleBlock}>
            <Text
              style={[styles.gemName, { color: colors.onSurface }]}
              selectable={false}
            >
              {listingTitle}
            </Text>
            <Text
              style={[styles.subtitle, { color: colors.onSurfaceVariant }]}
              selectable={false}
            >
              {formatGemType(activeListing.gemType)}
              {activeListing.caratWeight
                ? ` · ${activeListing.caratWeight} ct`
                : ""}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text
              style={[
                styles.priceHero,
                {
                  color: hasPrice ? colors.successEmerald : colors.textMuted,
                  fontFamily: FontFamily.bold,
                },
              ]}
              selectable={false}
            >
              {priceLabel}
            </Text>
            {perCaratLabel ? (
              <Text
                style={[
                  styles.perCarat,
                  {
                    color: hasPrice
                      ? colors.successEmerald
                      : colors.onSurfaceVariant,
                  },
                ]}
                selectable={false}
              >
                {perCaratLabel}
              </Text>
            ) : null}
          </View>

          {/* Elevated owner profile */}
          <Pressable
            onPress={() =>
              business
                ? router.push(`/business/${business.id}` as never)
                : undefined
            }
            disabled={!business}
            accessibilityRole="button"
            accessibilityLabel={`${ownerName}, ${ownerRole}`}
            style={({ pressed }) => [
              styles.ownerCard,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
                opacity: pressed && business ? 0.92 : 1,
              },
            ]}
          >
            <View style={styles.ownerAvatarWrap}>
              <View
                style={[
                  styles.ownerAvatar,
                  { backgroundColor: colors.primaryContainer },
                ]}
              >
                {ownerAvatar ? (
                  <Image
                    source={{ uri: ownerAvatar }}
                    style={styles.ownerAvatarImg}
                    contentFit="cover"
                  />
                ) : (
                  <Text
                    style={[
                      styles.ownerInitials,
                      { color: colors.onPrimaryContainer },
                    ]}
                  >
                    {ownerInitials || "?"}
                  </Text>
                )}
              </View>
              {ownerVerified ? (
                <View
                  style={[
                    styles.ownerVerifiedDot,
                    {
                      backgroundColor: colors.primary,
                      borderColor: colors.surfaceContainerLowest,
                    },
                  ]}
                >
                  <Icon name="verified" size={10} color={colors.onPrimary} />
                </View>
              ) : null}
            </View>
            <View style={styles.ownerText}>
              <Text
                style={[styles.ownerName, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                {ownerName}
              </Text>
              {ownerVerified ? (
                <View
                  style={[
                    styles.verifiedPill,
                    { backgroundColor: colors.primaryContainer },
                  ]}
                >
                  <Text
                    style={[
                      styles.verifiedPillText,
                      { color: colors.onPrimaryContainer },
                    ]}
                  >
                    VERIFIED SELLER
                  </Text>
                </View>
              ) : null}
              <Text
                style={[styles.ownerRole, { color: colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {[
                  ownerRole,
                  locationBits,
                  yearsActive ? `${yearsActive}+ yrs` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            {business ? (
              <Icon
                name="chevron-right"
                size={20}
                color={colors.onSurfaceVariant}
              />
            ) : null}
          </Pressable>

          {tags.length ? (
            <View style={styles.tags}>
              {tags.map((tag) => (
                <View
                  key={tag}
                  style={[
                    styles.tag,
                    {
                      backgroundColor: colors.surfaceContainerHigh,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                >
                  <Text style={[styles.tagText, { color: colors.onSurface }]}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Spec grid */}
          <View style={styles.specGrid}>
            {specs.map((spec) => {
              const iconName = SPEC_ICONS[spec.label] ?? "info";
              return (
                <View key={spec.label} style={styles.specCell}>
                  <View style={styles.specHeader}>
                    <Icon
                      name={iconName}
                      size={14}
                      color={colors.onSurfaceVariant}
                    />
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
                      textStyle={[
                        styles.specValue,
                        { color: colors.onSurface },
                      ]}
                      numberOfLines={2}
                    />
                  ) : (
                    <Text
                      style={[styles.specValue, { color: colors.onSurface }]}
                      numberOfLines={2}
                      selectable={false}
                    >
                      {spec.value}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {activeListing.certificateUrl ? (
            <Pressable
              onPress={() =>
                void Linking.openURL(activeListing.certificateUrl!)
              }
              accessibilityRole="link"
              accessibilityLabel="Open certificate or report"
              style={[styles.readMore, { alignSelf: "flex-start" }]}
            >
              <Icon name="description" size={18} color={colors.primary} />
              <Text style={[styles.readMoreText, { color: colors.primary }]}>
                View Certificate / Report
              </Text>
            </Pressable>
          ) : null}

          {activeListing.description ? (
            <View style={styles.descBlock}>
              <Text
                style={[styles.notes, { color: colors.onSurfaceVariant }]}
                numberOfLines={descExpanded ? undefined : 3}
                selectable={false}
              >
                {activeListing.description}
              </Text>
              {activeListing.description.length > 120 ? (
                <Pressable
                  onPress={() => setDescExpanded((v) => !v)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={descExpanded ? "Show less" : "Read more"}
                  style={styles.readMore}
                >
                  <Text
                    style={[styles.readMoreText, { color: colors.primary }]}
                  >
                    {descExpanded ? "Show less" : "Read more"}
                  </Text>
                  <Icon
                    name={descExpanded ? "expand-less" : "expand-more"}
                    size={18}
                    color={colors.primary}
                  />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <Text style={[styles.footer, { color: colors.textMuted }]}>
            Powered by Orbitra Tech (Pvt) Ltd
          </Text>
        </View>
      </ThemedScrollView>

      {/* Floating header over hero */}
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
                onPress={handleCopyLink}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Copy listing link"
                style={[styles.headerBtn, styles.headerChip]}
              >
                <Icon name="link" size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={handleShare}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Share listing"
                style={[styles.headerBtn, styles.headerChip]}
              >
                <Icon name="share" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          }
        />
      </View>

      {/* Sticky action bar */}
      <View
        style={[
          styles.actionBar,
          {
            paddingBottom: bottomBarPad,
            backgroundColor: colors.background,
            borderTopColor: colors.outlineVariant,
          },
        ]}
      >
        {isOwner ? (
          <Pressable
            onPress={() => setOffersInboxOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={
              unreadOfferCount > 0
                ? `Offers, ${unreadOfferCount} unread`
                : "Offers"
            }
            style={({ pressed }) => [
              styles.offerBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Icon name="local-offer" size={18} color={colors.onPrimary} />
            <Text style={[styles.offerBtnText, { color: colors.onPrimary }]}>
              View Offers
            </Text>
            {unreadOfferCount > 0 ? (
              <View
                style={[
                  styles.offerCountBadge,
                  { backgroundColor: colors.error },
                ]}
              >
                <Text style={styles.offerCountBadgeText}>
                  {unreadOfferCount > 99 ? "99+" : String(unreadOfferCount)}
                </Text>
              </View>
            ) : receivedOffers.length > 0 ? (
              <View
                style={[
                  styles.offerCountBadge,
                  { backgroundColor: colors.onPrimary + "33" },
                ]}
              >
                <Text
                  style={[
                    styles.offerCountBadgeText,
                    { color: colors.onPrimary },
                  ]}
                >
                  {receivedOffers.length}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : pendingMine ? (
          <Pressable
            onPress={() => void handleWithdrawMine()}
            accessibilityRole="button"
            accessibilityLabel="Withdraw offer"
            style={({ pressed }) => [
              styles.offerBtn,
              {
                backgroundColor: colors.surfaceContainerHigh,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Icon name="undo" size={18} color={colors.onSurface} />
            <Text style={[styles.offerBtnText, { color: colors.onSurface }]}>
              Withdraw offer
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={openOfferSheet}
            accessibilityRole="button"
            accessibilityLabel="Make an offer"
            style={({ pressed }) => [
              styles.offerBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Icon name="sell" size={18} color={colors.onPrimary} />
            <Text style={[styles.offerBtnText, { color: colors.onPrimary }]}>
              Make Offer
            </Text>
          </Pressable>
        )}

        {!isOwner && sellerWhatsapp ? (
          <Pressable
            onPress={() => inquireWhatsApp()}
            accessibilityRole="button"
            accessibilityLabel="WhatsApp seller"
            style={({ pressed }) => [
              styles.iconAction,
              {
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.outlineVariant,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Icon name="whatsapp" size={22} color={colors.onSurface} />
          </Pressable>
        ) : null}

        {!isOwner && sellerPhone ? (
          <Pressable
            onPress={() => void Linking.openURL(openPhone(sellerPhone))}
            accessibilityRole="button"
            accessibilityLabel="Call seller"
            style={({ pressed }) => [
              styles.iconAction,
              {
                backgroundColor: colors.surfaceContainerHigh,
                borderColor: colors.outlineVariant,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Icon name="phone" size={22} color={colors.onSurface} />
          </Pressable>
        ) : null}
      </View>

      <BottomSheet
        visible={offerOpen}
        onClose={() => {
          if (!offerSaving) setOfferOpen(false);
        }}
        title="Make an offer"
        footer={
          <Button
            title={offerSaving ? "Sending…" : "Send offer"}
            icon="send"
            loading={offerSaving}
            disabled={offerSaving}
            onPress={() => void handleSubmitOffer()}
          />
        }
      >
        <Text style={[styles.offerHint, { color: colors.textMuted }]}>
          The seller gets a notification. One pending offer per gem · max{" "}
          {LISTING_OFFER_LIMITS.maxOffersPerDay}/day ·{" "}
          {LISTING_OFFER_LIMITS.cooldownHoursPerListing}h cooldown after
          withdraw.
        </Text>
        <CurrencyAmountField
          label="Your offer"
          value={offerAmount}
          onChange={(next) => {
            setOfferAmount(next);
            setOfferError(null);
          }}
          error={offerError ?? undefined}
        />
        <Input
          label="Message (optional)"
          value={offerMessage}
          onChangeText={setOfferMessage}
          placeholder="Condition, timeline, or questions…"
          multiline
          style={{ minHeight: 72, textAlignVertical: "top" }}
        />
      </BottomSheet>

      <BottomSheet
        visible={isOwner && offersInboxOpen}
        onClose={() => setOffersInboxOpen(false)}
        title="Offers"
        footer={
          receivedOffers.length > 0 ? (
            <View style={styles.offersFooter}>
              <Button
                title="Clear all"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => void handleClearOffers()}
              />
              <Button
                title="Remove all"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => void handleRemoveOffers()}
              />
            </View>
          ) : undefined
        }
      >
        {receivedOffers.length === 0 ? (
          <Text style={[styles.offerHint, { color: colors.textMuted }]}>
            No offers yet on this gem.
          </Text>
        ) : (
          <View style={styles.offersList}>
            {receivedOffers.map((offer) => (
              <ReceivedOfferRow
                key={offer.id}
                offer={offer}
                unread={isListingOfferUnread(offer)}
              />
            ))}
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

function offerStatusLabel(status: ListingOffer["status"]): string {
  if (status === "pending") return "Pending";
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  return "Withdrawn";
}

function ReceivedOfferRow({
  offer,
  unread,
}: {
  offer: ListingOffer;
  unread: boolean;
}) {
  const { colors } = useAppTheme();
  const { formatStored } = usePreferredMoney();
  const needsBusinessResolve =
    !offer.buyerBusinessId || !offer.buyerLogoUrl || !offer.buyerBusinessName;

  const { data: buyerBusiness } = useFirestoreLiveQuery({
    queryKey: ["offer-buyer-business", offer.buyerBusinessId ?? offer.buyerUid],
    queryFn: () =>
      offer.buyerBusinessId
        ? fetchBusiness(offer.buyerBusinessId)
        : fetchBusinessByOwnerUid(offer.buyerUid),
    subscribe: (onData, onError) =>
      offer.buyerBusinessId
        ? subscribeBusiness(offer.buyerBusinessId, onData, onError)
        : subscribeBusinessByOwnerUid(offer.buyerUid, onData, onError),
    enabled: needsBusinessResolve && !!offer.buyerUid,
  });

  const businessId = offer.buyerBusinessId ?? buyerBusiness?.id ?? null;
  const name =
    offer.buyerBusinessName?.trim() ||
    buyerBusiness?.businessName?.trim() ||
    offer.buyerName?.trim() ||
    "Buyer";
  const photoUrl = offer.buyerLogoUrl ?? buyerBusiness?.logoUrl ?? null;
  const country =
    offer.buyerCountry?.trim() || buyerBusiness?.country?.trim() || null;
  const note = offer.message?.trim();
  const amountLabel = formatStored({
    amount: offer.amount,
    currency: offer.currency || "USD",
    amountBase: offer.amountBase,
  });
  const whenLabel = formatRelativeTime(offer.createdAt);
  const statusLabel = offerStatusLabel(offer.status);
  const statusTone =
    offer.status === "pending"
      ? colors.primary
      : offer.status === "accepted"
        ? colors.successEmerald
        : colors.onSurfaceVariant;

  return (
    <View
      style={[
        styles.receivedRow,
        {
          backgroundColor: unread
            ? colors.primaryContainer + "55"
            : colors.surfaceContainerLowest,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      <Pressable
        onPress={() =>
          businessId
            ? router.push(`/business/${businessId}` as never)
            : undefined
        }
        disabled={!businessId}
        accessibilityRole={businessId ? "button" : undefined}
        accessibilityLabel={businessId ? `View ${name} business profile` : name}
        style={({ pressed }) => [
          styles.receivedBuyer,
          { opacity: pressed && businessId ? 0.88 : 1 },
        ]}
      >
        <ContactAvatar name={name} photoUrl={photoUrl} size={44} />
        <View style={styles.receivedBuyerText}>
          <View style={styles.receivedTitleRow}>
            <Text
              style={[styles.receivedName, { color: colors.onSurface }]}
              numberOfLines={1}
            >
              {name}
            </Text>
            {country ? <CountryFlag country={country} size="xs" /> : null}
            {businessId ? (
              <Icon
                name="chevron-right"
                size={16}
                color={colors.onSurfaceVariant}
              />
            ) : null}
          </View>
          <Text
            style={[styles.receivedMeta, { color: colors.onSurfaceVariant }]}
            numberOfLines={1}
          >
            {whenLabel}
            {unread ? " · New" : ""}
          </Text>
        </View>
      </Pressable>

      <View style={styles.receivedOfferMeta}>
        <Text
          style={[styles.receivedAmount, { color: colors.onSurface }]}
          selectable={false}
        >
          {amountLabel}
        </Text>
        <View
          style={[
            styles.receivedStatusPill,
            { backgroundColor: statusTone + "22" },
          ]}
        >
          <Text style={[styles.receivedStatusText, { color: statusTone }]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {note ? (
        <Text
          style={[styles.receivedNote, { color: colors.onSurfaceVariant }]}
          numberOfLines={4}
          selectable={false}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  content: { gap: 0 },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerBtn: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerChip: {
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },

  heroBlock: {
    width: "100%",
  },
  heroBadge: {
    position: "absolute",
    right: Spacing.containerMargin,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  heroBadgeText: {
    ...Typography.caption,
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 0.6,
  },

  sheet: {
    // Sit below the film strip — negative margin was clipping thumb bottoms
    // and exposing the old black heroBlock as a thick bar under the carousel.
    marginTop: 0,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderCurve: "continuous",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
  },

  titleBlock: { gap: 4 },
  gemName: {
    ...Typography.headlineMdMobile,
    fontFamily: FontFamily.bold,
    fontWeight: "700",
  },
  subtitle: { ...Typography.bodyMd },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: -Spacing.xs,
  },
  priceHero: {
    ...Typography.headlineSm,
    fontVariant: ["tabular-nums"],
  },
  perCarat: {
    ...Typography.labelMd,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },

  ownerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  ownerAvatarWrap: {
    width: 52,
    height: 52,
    position: "relative",
  },
  ownerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ownerAvatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  ownerInitials: { ...Typography.labelMd, fontWeight: "700" },
  ownerVerifiedDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerText: { flex: 1, gap: 4, minWidth: 0 },
  ownerName: { ...Typography.bodyLg, fontWeight: "700", flexShrink: 1 },
  ownerRole: { ...Typography.caption },
  verifiedPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  verifiedPillText: {
    ...Typography.caption,
    fontWeight: "700",
    letterSpacing: 0.4,
    fontSize: 9,
  },

  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  tagText: { ...Typography.caption, fontWeight: "600" },

  specGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  specCell: {
    width: "47%",
    flexGrow: 1,
    minWidth: "42%",
    maxWidth: "48%",
    gap: 6,
  },
  specHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  specLabel: { ...Typography.caption, flexShrink: 1 },
  specValue: {
    ...Typography.bodyMd,
    fontWeight: "600",
    fontFamily: FontFamily.semibold,
  },

  descBlock: { gap: 6 },
  notes: { ...Typography.bodyMd, lineHeight: 22 },
  readMore: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
  },
  readMoreText: { ...Typography.labelMd, fontWeight: "600" },

  footer: {
    ...Typography.caption,
    textAlign: "center",
  },

  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconAction: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  offerBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  offerBtnText: {
    ...Typography.button,
    fontFamily: FontFamily.semibold,
  },
  offerCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    marginLeft: 2,
  },
  offerCountBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  offerHint: {
    ...Typography.bodyMd,
    marginBottom: Spacing.stackMd,
  },
  offersFooter: {
    flexDirection: "row",
    gap: 10,
  },
  offersList: {
    gap: 10,
  },
  receivedRow: {
    gap: 10,
    padding: 12,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  receivedBuyer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  receivedBuyerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  receivedTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  receivedName: {
    ...Typography.bodyMd,
    fontWeight: "700",
    flexShrink: 1,
  },
  receivedMeta: {
    ...Typography.caption,
  },
  receivedOfferMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  receivedAmount: {
    ...Typography.headlineSm,
    fontFamily: FontFamily.bold,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
  },
  receivedStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  receivedStatusText: {
    ...Typography.caption,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  receivedNote: {
    ...Typography.bodyMd,
    lineHeight: 20,
  },
});
