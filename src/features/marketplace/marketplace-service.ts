import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
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
import type { Announcement, Business, BusinessType } from '@/types';

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
  businessType?: 'seller' | 'provider';
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
    businessType?: 'seller' | 'provider';
    city?: string;
    verifiedOnly?: boolean;
  },
): Business[] {
  let result = items;

  if (filters?.businessType === 'seller') {
    result = result.filter((b) => b.businessType === 'seller' || b.sellerProfile != null);
  }
  if (filters?.businessType === 'provider') {
    result = result.filter(
      (b) => b.providerProfile != null || (b.businessType !== 'seller' && b.sellerProfile == null),
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
  const isSeller = input.businessType === 'seller';
  const ref = await addDoc(collection(getFirebaseDb(), 'businesses'), {
    ownerUid,
    businessType: input.businessType,
    businessName: input.businessName.trim(),
    ownerName: ownerName.trim(),
    brNumber: '',
    ngjaNumber: '',
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
    sellerProfile: isSeller
      ? {
          gemSpecializations: [],
          sourceOrigins: ['sri_lanka'],
          stoneTypes: [],
          priceRangeMin: null,
          priceRangeMax: null,
          preferredCurrencies: ['LKR', 'USD'],
        }
      : null,
    providerProfile: isSeller
      ? null
      : {
          services: [],
          gemSpecializations: [],
          isAcceptingOrders: true,
          portfolioCount: 0,
        },
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
  businessType?: 'seller' | 'provider';
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
      id: 'demo-seller-1',
      businessType: 'seller',
      businessName: 'Beruwala Sapphire House',
      ownerName: 'Mahesh Perera',
      shortDescription: 'Trusted sapphire dealer specializing in Ceylon blue sapphires.',
      city: 'Beruwala',
      sellerProfile: {
        gemSpecializations: ['blue_sapphire', 'ruby'],
        sourceOrigins: ['sri_lanka'],
        stoneTypes: ['cut_polished', 'certified'],
        priceRangeMin: 50000,
        priceRangeMax: 5000000,
        preferredCurrencies: ['LKR', 'USD'],
      },
      providerProfile: null,
      isFeatured: true,
    },
    {
      ...base,
      id: 'demo-provider-1',
      businessType: 'cutter',
      businessName: 'Kamal Gem Cutting',
      ownerName: 'Kamal Silva',
      shortDescription: 'Precision cutting for sapphires and spinels.',
      city: 'Beruwala',
      sellerProfile: null,
      providerProfile: {
        services: [
          {
            serviceId: '1',
            name: 'Sapphire Cutting',
            category: 'cutting',
            pricingType: 'per_stone',
            priceMin: 5000,
            priceMax: 25000,
            currency: 'LKR',
            turnaroundDaysMin: 7,
            turnaroundDaysMax: 14,
            description: 'Precision cutting',
            isActive: true,
          },
        ],
        gemSpecializations: ['blue_sapphire'],
        isAcceptingOrders: true,
        portfolioCount: 12,
      },
    },
  ];

  return filterBusinesses(all, filters);
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
