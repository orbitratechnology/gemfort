/**
 * Admin seed — bypasses Firestore client rules via Application Default Credentials.
 * Prereq: `firebase login` (or GOOGLE_APPLICATION_CREDENTIALS set).
 * Usage: node scripts/seed-admin.mjs
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({
  credential: applicationDefault(),
  projectId: 'gemfort',
});

const db = getFirestore();
const now = Timestamp.now();

const contacts = {
  whatsapp: { value: '+94771234001', isVisible: true },
  phone: { value: '+94342256789', isVisible: true },
};

await db.collection('announcements').doc('welcome').set(
  {
    type: 'platform',
    title: 'Welcome to GemFort',
    content: 'Find verified gem businesses and track your private inventory.',
    externalUrl: null,
    linkedBusinessId: null,
    linkedGemId: null,
    imageUrl: null,
    isVisible: true,
    publishedAt: now,
    expiresAt: null,
    createdByAdminUid: 'seed',
    createdAt: now,
  },
  { merge: true },
);

await db.collection('businesses').doc('beruwala-sapphire-house').set(
  {
    contacts,
    updatedAt: now,
  },
  { merge: true },
);

await db.collection('businesses').doc('kamal-gem-cutting').set(
  {
    ownerUid: 'seed',
    businessType: 'cutter',
    businessName: 'Kamal Gem Cutting',
    ownerName: 'Kamal Silva',
    brNumber: 'BR-002',
    ngjaNumber: 'NGJA-002',
    yearEstablished: 2008,
    shortDescription: 'Precision cutting for sapphires and spinels.',
    address: 'Gem Street, Beruwala',
    city: 'Beruwala',
    district: 'Kalutara',
    province: 'Western',
    country: 'Sri Lanka',
    verificationStatus: 'verified',
    verificationTier: 'full',
    badges: {
      isVerified: true,
      isBasicVerified: false,
      isNgjaRegistered: true,
      isPremium: false,
      verifiedSinceYear: 2008,
      yearsActive: 17,
      hasRepeatBusiness: true,
      listingMilestone: 5,
      endorsementCount: 3,
    },
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
    contacts: {
      whatsapp: { value: '+94776655443', isVisible: true },
      phone: { value: '+94342288901', isVisible: true },
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
  },
  { merge: true },
);

console.log('Admin seed complete: contacts updated, provider added.');
