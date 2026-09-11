import type { DocumentData } from 'firebase-admin/firestore';

const SOCIAL_KEYS = ['website', 'instagram', 'tiktok', 'facebook', 'wechat'] as const;
const CONTACT_KEYS = ['phone', 'whatsapp', 'email'] as const;

function objectOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableString(value: unknown): string | null {
  const result = stringValue(value);
  return result || null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function numberOrZero(value: unknown): number {
  return numberOrNull(value) ?? 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function publicContacts(value: unknown): Record<string, { value: string; isVisible: true }> {
  const source = objectOf(value);
  const result: Record<string, { value: string; isVisible: true }> = {};
  if (!source) return result;

  for (const key of CONTACT_KEYS) {
    const contact = objectOf(source[key]);
    const contactValue = stringValue(contact?.value);
    if (contactValue && contact?.isVisible === true) {
      result[key] = { value: contactValue, isVisible: true };
    }
  }
  return result;
}

function publicSocialLinks(value: unknown): Record<string, string> {
  const source = objectOf(value);
  const result: Record<string, string> = {};
  for (const key of SOCIAL_KEYS) {
    result[key] = stringValue(source?.[key]);
  }
  return result;
}

function publicLocation(value: unknown): Record<string, unknown> | null {
  const source = objectOf(value);
  if (!source) return null;
  const latitude = numberOrNull(source.latitude);
  const longitude = numberOrNull(source.longitude);
  const label = stringValue(source.label);
  if (latitude == null || longitude == null || !label) return null;

  return {
    latitude,
    longitude,
    label,
    city: nullableString(source.city),
    district: nullableString(source.district),
    country: nullableString(source.country),
  };
}

function publicSellerProfile(value: unknown): Record<string, unknown> | null {
  const source = objectOf(value);
  if (!source) return null;
  return {
    gemSpecializations: stringArray(source.gemSpecializations),
    sourceOrigins: stringArray(source.sourceOrigins),
    stoneTypes: stringArray(source.stoneTypes),
    priceRangeMin: numberOrNull(source.priceRangeMin),
    priceRangeMax: numberOrNull(source.priceRangeMax),
    preferredCurrencies: stringArray(source.preferredCurrencies),
  };
}

function publicServices(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const source = objectOf(item);
    if (!source) return [];
    const name = stringValue(source.name);
    if (!name) return [];
    return [{
      serviceId: stringValue(source.serviceId) || name,
      name,
      description: stringValue(source.description),
      pricingType: source.pricingType === 'fixed' ? 'fixed' : 'optional',
      priceMin: numberOrNull(source.priceMin),
      priceMax: numberOrNull(source.priceMax),
      currency: nullableString(source.currency),
      turnaroundDaysMin: numberOrZero(source.turnaroundDaysMin),
      turnaroundDaysMax: numberOrZero(source.turnaroundDaysMax),
      isActive: source.isActive !== false,
    }];
  });
}

function publicProviderProfile(value: unknown): Record<string, unknown> | null {
  const source = objectOf(value);
  if (!source) return null;
  return {
    services: publicServices(source.services),
    servicesOffered: stringArray(source.servicesOffered),
    gemSpecializations: stringArray(source.gemSpecializations),
    isAcceptingOrders: source.isAcceptingOrders !== false,
    portfolioCount: numberOrZero(source.portfolioCount),
  };
}

function publicBadges(value: unknown): Record<string, unknown> {
  const source = objectOf(value);
  const reputation = stringValue(source?.businessReputation);
  return {
    isVerified: source?.isVerified === true,
    ...(reputation ? { businessReputation: reputation } : {}),
    isNgjaRegistered: source?.isNgjaRegistered === true,
    isPremium: source?.isPremium === true,
    verifiedSinceYear: numberOrNull(source?.verifiedSinceYear),
    yearsActive: numberOrZero(source?.yearsActive),
    hasRepeatBusiness: source?.hasRepeatBusiness === true,
    listingMilestone: numberOrZero(source?.listingMilestone),
    likeCount: numberOrZero(source?.likeCount),
  };
}

function publicGalleryPhotos(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const source = objectOf(item);
    const url = stringValue(source?.url);
    if (!source || !url) return [];
    return [{
      photoId: stringValue(source.photoId),
      url,
      type: stringValue(source.type),
      beforeUrl: nullableString(source.beforeUrl),
      afterUrl: nullableString(source.afterUrl),
      caption: nullableString(source.caption),
      ...(source.uploadedAt != null ? { uploadedAt: source.uploadedAt } : {}),
    }];
  });
}

/**
 * Return only fields intended for public business discovery/profile views.
 * Never spread the source business document here: it contains private
 * registration, tax, verification, ownership, and workspace metadata.
 */
export function buildPublicBusinessProjection(
  data: DocumentData,
): Record<string, unknown> | null {
  if (data.verificationStatus !== 'verified' || data.isActive !== true) {
    return null;
  }

  return {
    businessType: stringValue(data.businessType),
    businessName: stringValue(data.businessName),
    ownerName: stringValue(data.ownerName),
    yearEstablished: numberOrNull(data.yearEstablished),
    shortDescription: stringValue(data.shortDescription),
    city: stringValue(data.city),
    district: stringValue(data.district),
    province: stringValue(data.province),
    country: stringValue(data.country),
    location: publicLocation(data.location),
    verificationStatus: 'verified',
    verificationTier: stringValue(data.verificationTier) || 'member',
    badges: publicBadges(data.badges),
    sellerProfile: publicSellerProfile(data.sellerProfile),
    providerProfile: publicProviderProfile(data.providerProfile),
    contacts: publicContacts(data.contacts),
    socialLinks: publicSocialLinks(data.socialLinks),
    logoUrl: nullableString(data.logoUrl),
    coverPhotoUrl: nullableString(data.coverPhotoUrl),
    galleryPhotos: publicGalleryPhotos(data.galleryPhotos),
    isFeatured: data.isFeatured === true,
    isActive: true,
  };
}
