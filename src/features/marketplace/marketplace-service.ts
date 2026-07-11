import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  increment,
  serverTimestamp,
  Timestamp,
} from '@/lib/firebase/db';
import { getFirebaseDb } from '@/lib/firebase/config';
import { businessTypeFromRole, directoryTabFromBusinessType, normalizeUserRole, ROLE_LABELS } from '@/constants/roles';
import type { Announcement, Business, BusinessType, FraudReportType, MarketplaceListing, UserRole } from '@/types';

export type DirectoryBusinessFilter = 'trader' | 'lapidary' | 'gem_lab' | 'seller' | 'provider';

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const q = query(
    collection(getFirebaseDb(), 'announcements'),
    where('isVisible', '==', true),
    orderBy('publishedAt', 'desc'),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Announcement);
}

export async function fetchBusinesses(filters?: {
  businessType?: DirectoryBusinessFilter;
  city?: string;
  verifiedOnly?: boolean;
}): Promise<Business[]> {
  const q = query(
    collection(getFirebaseDb(), 'businesses'),
    where('verificationStatus', '==', 'verified'),
    where('isActive', '==', true),
  );
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Business);
  return filterBusinesses(items, filters);
}

export function filterBusinesses(
  items: Business[],
  filters?: {
    businessType?: DirectoryBusinessFilter;
    city?: string;
    verifiedOnly?: boolean;
  },
): Business[] {
  let result = items;

  if (filters?.businessType === 'trader' || filters?.businessType === 'seller') {
    result = result.filter((b) => directoryTabFromBusinessType(b.businessType) === 'traders' || b.sellerProfile != null);
  }
  if (filters?.businessType === 'lapidary' || filters?.businessType === 'provider') {
    result = result.filter((b) => directoryTabFromBusinessType(b.businessType) === 'lapidaries' || b.providerProfile != null);
  }
  if (filters?.businessType === 'gem_lab') {
    result = result.filter(
      (b) => directoryTabFromBusinessType(b.businessType) === 'labs' || b.labProfile != null,
    );
  }
  if (filters?.city) {
    result = result.filter((b) => b.city.toLowerCase() === filters.city!.toLowerCase());
  }
  if (filters?.verifiedOnly) {
    result = result.filter((b) => b.badges.isVerified);
  }

  return result.sort((a, b) => {
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;
    if (a.badges.isVerified && !b.badges.isVerified) return -1;
    if (!a.badges.isVerified && b.badges.isVerified) return 1;
    return a.businessName.localeCompare(b.businessName);
  });
}

export async function fetchBusiness(businessId: string): Promise<Business | null> {
  const snap = await getDoc(doc(getFirebaseDb(), 'businesses', businessId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Business;
}

export async function fetchBusinessByOwnerUid(ownerUid: string): Promise<Business | null> {
  const q = query(
    collection(getFirebaseDb(), 'businesses'),
    where('ownerUid', '==', ownerUid),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Business;
}

/** Map registration role → business document type. */
export function businessTypeFromRegistration(profile: {
  role?: string | null;
  roleIntent?: string | null;
} | null): BusinessType | null {
  const role = normalizeUserRole(profile?.role || profile?.roleIntent);
  return businessTypeFromRole(role as UserRole);
}

export function accountTypeLabelFromRegistration(profile: {
  role?: string | null;
  roleIntent?: string | null;
} | null): string {
  const role = normalizeUserRole(profile?.role || profile?.roleIntent);
  return ROLE_LABELS[role] ?? 'Member';
}

export async function createBusinessProfile(
  ownerUid: string,
  ownerName: string,
  input: {
    businessName: string;
    businessType: BusinessType;
    city: string;
    shortDescription: string;
    whatsapp?: string;
    phone?: string;
  },
): Promise<string> {
  const now = Timestamp.now();
  const type = input.businessType === 'seller' ? 'trader' : input.businessType === 'cutter' || input.businessType === 'provider' ? 'lapidary' : input.businessType;
  const isTrader = type === 'trader';
  const isLapidary = type === 'lapidary';
  const isLab = type === 'gem_lab';
  const ref = await addDoc(collection(getFirebaseDb(), 'businesses'), {
    ownerUid,
    businessType: type,
    businessName: input.businessName.trim(),
    ownerName: ownerName.trim(),
    brNumber: '',
    ngjaNumber: '',
    gemLicenseNumber: '',
    tinNumber: '',
    yearEstablished: null,
    shortDescription: input.shortDescription.trim(),
    address: '',
    city: input.city.trim(),
    district: 'Kalutara',
    province: 'Western',
    country: 'Sri Lanka',
    verificationStatus: 'none',
    verificationTier: 'none',
    badges: {
      isVerified: false,
      isBasicVerified: false,
      isNgjaRegistered: false,
      isPremium: false,
      verifiedSinceYear: null,
      yearsActive: 0,
      hasRepeatBusiness: false,
      listingMilestone: 0,
      endorsementCount: 0,
    },
    sellerProfile: isTrader
      ? {
          gemSpecializations: [],
          sourceOrigins: ['sri_lanka'],
          stoneTypes: [],
          priceRangeMin: null,
          priceRangeMax: null,
          preferredCurrencies: ['LKR', 'USD'],
        }
      : null,
    providerProfile: isLapidary
      ? {
          services: [],
          servicesOffered: [],
          gemSpecializations: [],
          isAcceptingOrders: true,
          portfolioCount: 0,
        }
      : null,
    labProfile: isLab
      ? {
          accreditations: [],
          reportTypes: ['full', 'brief', 'origin'],
          isAcceptingOrders: true,
          certificatesIssued: 0,
        }
      : null,
    contacts: {
      whatsapp: { value: input.whatsapp?.trim() ?? '', isVisible: !!input.whatsapp?.trim() },
      phone: { value: input.phone?.trim() ?? '', isVisible: !!input.phone?.trim() },
    },
    logoUrl: null,
    coverPhotoUrl: null,
    galleryPhotos: [],
    analytics: {
      profileViewsTotal: 0,
      listingViewsTotal: 0,
      whatsappTapsTotal: 0,
      phoneTapsTotal: 0,
    },
    isFeatured: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateBusinessProfile(
  businessId: string,
  data: {
    businessName?: string;
    shortDescription?: string;
    city?: string;
    address?: string;
    whatsapp?: string;
    whatsappVisible?: boolean;
    phone?: string;
    phoneVisible?: boolean;
  },
) {
  const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (data.businessName !== undefined) updates.businessName = data.businessName.trim();
  if (data.shortDescription !== undefined) updates.shortDescription = data.shortDescription.trim();
  if (data.city !== undefined) updates.city = data.city.trim();
  if (data.address !== undefined) updates.address = data.address.trim();
  if (data.whatsapp !== undefined) {
    updates['contacts.whatsapp'] = {
      value: data.whatsapp.trim(),
      isVisible: data.whatsappVisible ?? !!data.whatsapp.trim(),
    };
  }
  if (data.phone !== undefined) {
    updates['contacts.phone'] = {
      value: data.phone.trim(),
      isVisible: data.phoneVisible ?? !!data.phone.trim(),
    };
  }
  await updateDoc(doc(getFirebaseDb(), 'businesses', businessId), updates);
}

type BusinessAnalyticsField = 'profileViewsTotal' | 'whatsappTapsTotal' | 'phoneTapsTotal';

/** Best-effort analytics bump (guests allowed via Firestore rules for verified businesses). */
export async function trackBusinessAnalytics(
  businessId: string,
  field: BusinessAnalyticsField,
): Promise<void> {
  try {
    await updateDoc(doc(getFirebaseDb(), 'businesses', businessId), {
      [`analytics.${field}`]: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking — directory still works if rules reject the write
  }
}

export function searchBusinesses(
  search: string,
  businesses: Business[],
): Business[] {
  const term = search.toLowerCase().trim();
  if (!term) return businesses;
  return businesses.filter((b) => {
    const sellerSpecs = b.sellerProfile?.gemSpecializations ?? [];
    const providerSpecs = b.providerProfile?.gemSpecializations ?? [];
    const serviceNames = b.providerProfile?.services.map((s) => s.name) ?? [];
    return (
      b.businessName.toLowerCase().includes(term) ||
      b.city.toLowerCase().includes(term) ||
      b.shortDescription.toLowerCase().includes(term) ||
      sellerSpecs.some((s) => s.toLowerCase().includes(term)) ||
      providerSpecs.some((s) => s.toLowerCase().includes(term)) ||
      serviceNames.some((s) => s.toLowerCase().includes(term))
    );
  });
}

export function demoBusinesses(filters?: {
  businessType?: DirectoryBusinessFilter;
  verifiedOnly?: boolean;
}): Business[] {
  const now = Timestamp.now();
  const base = {
    ownerUid: 'demo',
    brNumber: 'BR-001',
    ngjaNumber: 'NGJA-001',
    yearEstablished: 2010,
    address: 'Main Street',
    district: 'Kalutara',
    province: 'Western',
    country: 'Sri Lanka',
    verificationStatus: 'verified' as const,
    verificationTier: 'full' as const,
    badges: {
      isVerified: true,
      isBasicVerified: false,
      isNgjaRegistered: true,
      isPremium: false,
      verifiedSinceYear: 2010,
      yearsActive: 15,
      hasRepeatBusiness: true,
      listingMilestone: 10,
      endorsementCount: 5,
    },
    contacts: {
      whatsapp: { value: '+94771234001', isVisible: true },
      phone: { value: '+94342256789', isVisible: true },
    },
    logoUrl: null,
    coverPhotoUrl: null,
    galleryPhotos: [],
    isFeatured: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const all: Business[] = [
    {
      ...base,
      id: 'demo-trader-1',
      businessType: 'trader',
      businessName: 'Beruwala Sapphire House',
      ownerName: 'Demo Trader',
      shortDescription: 'Ceylon sapphires',
      city: 'Beruwala',
      sellerProfile: {
        gemSpecializations: ['blue_sapphire'],
        sourceOrigins: ['sri_lanka'],
        stoneTypes: ['rough', 'cut'],
        priceRangeMin: 100,
        priceRangeMax: 50000,
        preferredCurrencies: ['LKR', 'USD'],
      },
      providerProfile: null,
      labProfile: null,
      analytics: { profileViewsTotal: 0, listingViewsTotal: 0, whatsappTapsTotal: 0, phoneTapsTotal: 0 },
    },
    {
      ...base,
      id: 'demo-lapidary-1',
      businessType: 'lapidary',
      businessName: 'Kamal Gem Cutting',
      ownerName: 'Demo Lapidary',
      shortDescription: 'Precision cutting',
      city: 'Beruwala',
      sellerProfile: null,
      providerProfile: {
        services: [],
        servicesOffered: ['cutting', 'polishing'],
        gemSpecializations: ['blue_sapphire'],
        isAcceptingOrders: true,
        portfolioCount: 12,
      },
      labProfile: null,
      analytics: { profileViewsTotal: 0, listingViewsTotal: 0, whatsappTapsTotal: 0, phoneTapsTotal: 0 },
    },
    {
      ...base,
      id: 'demo-lab-1',
      businessType: 'gem_lab',
      businessName: 'Ceylon Gem Lab',
      ownerName: 'Demo Lab',
      shortDescription: 'Independent gem reports',
      city: 'Colombo',
      sellerProfile: null,
      providerProfile: null,
      labProfile: {
        accreditations: ['NGJA'],
        reportTypes: ['full', 'brief'],
        isAcceptingOrders: true,
        certificatesIssued: 120,
      },
      analytics: { profileViewsTotal: 0, listingViewsTotal: 0, whatsappTapsTotal: 0, phoneTapsTotal: 0 },
    },
  ];

  return filterBusinesses(all, filters);
}

// ─── Public marketplace listings (gems collection) ─────────────

export type ListingFilters = {
  gemType?: string | null;
  verifiedOnly?: boolean;
  sort?: 'recent' | 'price_low' | 'price_high';
};

/** Public, active gem listings — readable by guests per Firestore rules. */
export async function fetchPublicListings(): Promise<MarketplaceListing[]> {
  const q = query(
    collection(getFirebaseDb(), 'gems'),
    where('visibility', '==', 'public'),
    where('status', '==', 'active'),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MarketplaceListing);
}

export function filterListings(
  items: MarketplaceListing[],
  filters?: ListingFilters,
): MarketplaceListing[] {
  let result = items;
  if (filters?.gemType && filters.gemType !== 'all') {
    result = result.filter((l) => l.gemType === filters.gemType);
  }
  const sorted = [...result];
  if (filters?.sort === 'price_low') {
    sorted.sort((a, b) => (a.priceMin ?? Infinity) - (b.priceMin ?? Infinity));
  } else if (filters?.sort === 'price_high') {
    sorted.sort((a, b) => (b.priceMin ?? 0) - (a.priceMin ?? 0));
  } else {
    sorted.sort((a, b) => (b.publishedAt?.toMillis?.() ?? 0) - (a.publishedAt?.toMillis?.() ?? 0));
  }
  return sorted;
}

export function searchListings(search: string, items: MarketplaceListing[]): MarketplaceListing[] {
  const term = search.toLowerCase().trim();
  if (!term) return items;
  return items.filter(
    (l) =>
      l.title.toLowerCase().includes(term) ||
      l.gemType.toLowerCase().includes(term) ||
      l.origin.toLowerCase().includes(term),
  );
}

export function demoListings(): MarketplaceListing[] {
  const now = Timestamp.now();
  const base = {
    sellerUid: 'demo',
    businessId: 'demo-seller-1',
    workspaceGemId: null,
    description: null,
    visibility: 'public' as const,
    clarity: 'VS',
    shape: 'Oval',
    isCertified: true,
    certifyingLab: 'GIA',
    certificateNumber: null,
    showPrice: true,
    currency: 'USD',
    status: 'active' as const,
    analytics: { totalViews: 0, whatsappTaps: 0 },
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  };
  return [
    {
      ...base,
      id: 'demo-listing-1',
      title: 'Natural Blue Sapphire',
      gemType: 'blue_sapphire',
      caratWeight: 2.4,
      color: 'Royal Blue',
      origin: 'Ceylon, Sri Lanka',
      treatmentStatus: 'unheated',
      priceMin: 2300,
      priceMax: null,
      photoUrls: [
        'https://lh3.googleusercontent.com/aida-public/AB6AXuC_7OK_3UypEsNQwZgFXed6mI302725BO5QYFtofpbY8PzSm0dEMgGn54C6ym8vcSee6QXTw0g8Z6QU8_OBltA7gLcCeJ4kKFCFOupuVgLA93mmVDwqpxn7RHgD51EFt_nfNONxJ8W0mD2MXxTTSfbepmKUi2HN1p34G4HIfEVddJGuuYIVj0dS-jRlotHtTEWA3B8HbOXVkWB3z1_VpTgc_qNslfs4GY3HmzQHKipxkV3v8LwmE2pD-1wjEXnKy-yn5iw',
      ],
      shareableSlug: 'GF-L-00001',
      shareableUrl: 'https://gemfort.app/l/GF-L-00001',
    },
    {
      ...base,
      id: 'demo-listing-2',
      title: 'Pigeon Blood Ruby',
      gemType: 'ruby',
      caratWeight: 1.8,
      color: 'Pigeon Blood',
      origin: 'Mogok, Myanmar',
      treatmentStatus: 'heated',
      priceMin: 5500,
      priceMax: null,
      photoUrls: [
        'https://lh3.googleusercontent.com/aida-public/AB6AXuAnxTKk7Lh3v8VRIiVT16UI-WibWqYAYWYptNYrqza3yY8wTHL_v-2aw6XRG4BZHj3R-uVySUjExAGUwSOcA7QO1tFoxcJToAb-1tZh-DxfSuLUud96jxa3xaKZnzxWGxox981P5jRQ6kUIr7f10n7mpdN3aPRZ1WGiM9W6b8gxlblPu9qP5lkdoTlhcI-Yr6M7HR-QCb8-58Fs9emGEYkKhvx0oSDCOppcYSq_yRMooh1CXQ45fIUC8g',
      ],
      shareableSlug: 'GF-L-00002',
      shareableUrl: 'https://gemfort.app/l/GF-L-00002',
    },
  ];
}

export function demoAnnouncements(): Announcement[] {
  const now = Timestamp.now();
  return [
    {
      id: 'demo-1',
      type: 'platform',
      title: 'Welcome to GemFort',
      content: 'Find verified gem businesses and track your private inventory in one app.',
      externalUrl: null,
      linkedBusinessId: null,
      linkedGemId: null,
      imageUrl: null,
      isVisible: true,
      publishedAt: now,
      expiresAt: null,
      createdAt: now,
    },
  ];
}

export async function submitFraudReport(input: {
  reporterUid: string;
  reportedBusinessId: string;
  reportedUserUid: string | null;
  reportType: FraudReportType;
  description: string;
  evidenceUrls?: string[];
}): Promise<string> {
  const ref = await addDoc(collection(getFirebaseDb(), 'reports'), {
    reporterUid: input.reporterUid,
    reportedBusinessId: input.reportedBusinessId,
    reportedUserUid: input.reportedUserUid,
    reportType: input.reportType,
    description: input.description.trim(),
    evidenceUrls: input.evidenceUrls ?? [],
    status: 'pending',
    adminUid: null,
    adminNotes: null,
    resolution: null,
    actionTaken: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    resolvedAt: null,
  });
  return ref.id;
}

export async function sendEndorsement(input: {
  fromUid: string;
  fromBusinessId: string;
  toBusinessId: string;
}): Promise<void> {
  const endorsementId = `${input.fromBusinessId}_${input.toBusinessId}`;
  await setDoc(doc(getFirebaseDb(), 'endorsements', endorsementId), {
    fromBusinessId: input.fromBusinessId,
    toBusinessId: input.toBusinessId,
    fromUid: input.fromUid,
    createdAt: serverTimestamp(),
  });
}
