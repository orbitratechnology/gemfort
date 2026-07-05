/**
 * Seed marketplace demo data into Firestore.
 * Usage: npx ts-node scripts/seed-marketplace.ts
 * Requires GOOGLE_APPLICATION_CREDENTIALS or firebase login.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, Timestamp } from 'firebase/firestore';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

async function seed() {
  if (!config.projectId) {
    console.error('Set EXPO_PUBLIC_FIREBASE_* env vars');
    process.exit(1);
  }
  const app = initializeApp(config);
  const db = getFirestore(app);
  const now = Timestamp.now();

  await setDoc(doc(db, 'announcements', 'welcome'), {
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
  });

  await setDoc(doc(db, 'businesses', 'beruwala-sapphire-house'), {
    ownerUid: 'seed',
    businessType: 'seller',
    businessName: 'Beruwala Sapphire House',
    ownerName: 'Mahesh Perera',
    brNumber: 'BR-001',
    ngjaNumber: 'NGJA-001',
    yearEstablished: 2010,
    shortDescription: 'Trusted Ceylon sapphire dealer in Beruwala.',
    address: 'Main Street, Beruwala',
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
      verifiedSinceYear: 2010,
      yearsActive: 15,
      hasRepeatBusiness: true,
      listingMilestone: 10,
      endorsementCount: 5,
    },
    sellerProfile: {
      gemSpecializations: ['blue_sapphire', 'ruby'],
      sourceOrigins: ['sri_lanka'],
      stoneTypes: ['cut_polished'],
      priceRangeMin: 50000,
      priceRangeMax: 5000000,
      preferredCurrencies: ['LKR', 'USD'],
    },
    providerProfile: null,
    contacts: {
      whatsapp: { value: '+94771234001', isVisible: true },
      phone: { value: '+94342256789', isVisible: true },
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
    isFeatured: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc(db, 'businesses', 'kamal-gem-cutting'), {
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
  });

  console.log('Seed complete.');
}

seed().catch(console.error);