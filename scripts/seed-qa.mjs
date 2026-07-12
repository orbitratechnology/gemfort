/**
 * QA seed — Auth users + Firestore profiles/businesses/certs for personas.
 * Prereq: `gcloud auth application-default login` (or GOOGLE_APPLICATION_CREDENTIALS).
 * Usage: node scripts/seed-qa.mjs
 *
 * Accounts (password: QaTest123!):
 *   qa-trader@gemfort.test   — verified trader
 *   qa-lapidary@gemfort.test — verified lapidary
 *   qa-lab@gemfort.test      — verified gem lab
 *   qa-suspended@gemfort.test — suspended lockout (AC-AUTH-003)
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

initializeApp({
  credential: applicationDefault(),
  projectId: 'gemfort',
});

const auth = getAuth();
const db = getFirestore();
const now = Timestamp.now();
const QA_PASSWORD = 'QaTest123!';

const PERSONAS = [
  {
    email: 'qa-trader@gemfort.test',
    displayName: 'QA Trader Mahesh',
    phone: '+94770000001',
    role: 'trader',
    businessId: 'qa-trader-biz',
    businessName: 'QA Beruwala Sapphire House',
  },
  {
    email: 'qa-lapidary@gemfort.test',
    displayName: 'QA Lapidary Kamal',
    phone: '+94770000002',
    role: 'lapidary',
    businessId: 'qa-lapidary-biz',
    businessName: 'QA Kamal Gem Cutting',
  },
  {
    email: 'qa-lab@gemfort.test',
    displayName: 'QA Lab Nisha',
    phone: '+94770000003',
    role: 'gem_lab',
    businessId: 'qa-lab-biz',
    businessName: 'QA Nisha Gem Lab',
  },
];

async function ensureAuthUser({ email, displayName, phone }) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, {
      password: QA_PASSWORD,
      displayName,
      phoneNumber: undefined,
      disabled: false,
      emailVerified: true,
    });
    return existing.uid;
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    const created = await auth.createUser({
      email,
      password: QA_PASSWORD,
      displayName,
      emailVerified: true,
    });
    return created.uid;
  }
}

function userDoc(uid, p) {
  return {
    uid,
    email: p.email,
    phone: p.phone,
    displayName: p.displayName,
    role: p.role,
    roleIntent: p.role,
    verificationStatus: 'verified',
    preferredCurrency: 'LKR',
    preferredLanguage: 'en',
    isActive: true,
    isSuspended: false,
    suspendedReason: null,
    suspendedAt: null,
    companyId: null,
    fcmToken: null,
    phoneVerified: true,
    notificationPreferences: {
      pushAnnouncements: true,
      pushChequeAlerts: true,
      pushApAlerts: true,
      pushPaymentAlerts: true,
    },
    createdAt: now,
    lastActiveAt: now,
    updatedAt: now,
  };
}

function businessBase(uid, p) {
  return {
    ownerUid: uid,
    businessName: p.businessName,
    ownerName: p.displayName,
    brNumber: `BR-QA-${p.role}`,
    ngjaNumber: `NGJA-QA-${p.role}`,
    gemLicenseNumber: `GL-QA-${p.role}`,
    tinNumber: `TIN-QA-${p.role}`,
    yearEstablished: 2015,
    shortDescription: `QA ${p.role} business for GemFort dogfood.`,
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
      verifiedSinceYear: 2015,
      yearsActive: 11,
      hasRepeatBusiness: true,
      listingMilestone: 5,
      endorsementCount: 2,
    },
    contacts: {
      whatsapp: { value: p.phone, isVisible: true },
      phone: { value: p.phone, isVisible: true },
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
    rankScore: p.role === 'trader' ? 900 : p.role === 'lapidary' ? 800 : 700,
    isFeatured: p.role === 'trader',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

function businessForRole(uid, p) {
  const base = businessBase(uid, p);
  if (p.role === 'trader') {
    return {
      ...base,
      businessType: 'trader',
      sellerProfile: {
        gemSpecializations: ['blue_sapphire', 'ruby'],
        sourceOrigins: ['sri_lanka'],
        stoneTypes: ['rough', 'cut_polished'],
        priceRangeMin: 50000,
        priceRangeMax: 5000000,
        preferredCurrencies: ['LKR', 'USD'],
      },
      providerProfile: null,
      labProfile: null,
    };
  }
  if (p.role === 'lapidary') {
    return {
      ...base,
      businessType: 'lapidary',
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
        servicesOffered: ['cutting', 'polishing'],
        gemSpecializations: ['blue_sapphire'],
        isAcceptingOrders: true,
        portfolioCount: 12,
      },
      labProfile: null,
    };
  }
  return {
    ...base,
    businessType: 'gem_lab',
    sellerProfile: null,
    providerProfile: null,
    labProfile: {
      accreditations: ['GIA', 'Gübelin'],
      reportTypes: ['identification', 'origin'],
      isAcceptingOrders: true,
      certificatesIssued: 1,
    },
  };
}

async function main() {
  const uids = {};

  for (const p of PERSONAS) {
    const uid = await ensureAuthUser(p);
    uids[p.role] = uid;
    await db.collection('users').doc(uid).set(userDoc(uid, p), { merge: true });
    await db.collection('businesses').doc(p.businessId).set(businessForRole(uid, p), { merge: true });
    console.log(`OK ${p.role}: ${p.email} → ${uid}`);
  }

  await db.collection('announcements').doc('welcome').set(
    {
      type: 'platform',
      title: 'Welcome to GemFort QA',
      content: 'Seeded announcement for dogfood. Find verified businesses in Directory.',
      externalUrl: null,
      linkedBusinessId: 'qa-trader-biz',
      linkedGemId: null,
      imageUrl: null,
      isVisible: true,
      publishedAt: now,
      expiresAt: null,
      createdByAdminUid: 'seed-qa',
      createdAt: now,
    },
    { merge: true },
  );

  await db.collection('certificates').doc('qa-cert-GF-2026-0001').set(
    {
      labUid: uids.gem_lab,
      labBusinessId: 'qa-lab-biz',
      labName: 'QA Nisha Gem Lab',
      certificateNumber: 'GF-2026-0001',
      verificationCode: 'QAVERIFY01',
      reportType: 'identification',
      certificateDate: now,
      fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileType: 'pdf',
      gemId: null,
      gemName: 'Blue Sapphire 2.14ct',
      traderUid: uids.trader,
      certificationRequestId: null,
      resultsSummary: {
        weight: '2.14 ct',
        color: 'Blue',
        origin: 'Sri Lanka',
        treatment: 'None',
        clarity: 'VS',
      },
      visibility: 'public',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  // Sample gem for trader GemTrack flows
  await db.collection('gemtrack_gems').doc('qa-gem-1').set(
    {
      ownerUid: uids.trader,
      companyId: null,
      sku: 'GF-2026-00001',
      gemType: 'sapphire',
      variety: 'blue_sapphire',
      originCountry: 'Sri Lanka',
      originMine: 'Ratnapura',
      acquisitionType: 'purchase',
      acquisitionDate: now,
      acquisitionCost: 150000,
      acquisitionCurrency: 'LKR',
      acquisitionCostBase: 150000,
      roughWeight: 3.2,
      currentWeight: 3.2,
      colorPrimary: 'Blue',
      clarity: null,
      cutType: null,
      shape: null,
      isNatural: true,
      treatmentStatus: 'untreated',
      treatmentDetails: null,
      status: 'ready_for_sale',
      currentLocation: 'Vault',
      currentHolderContactId: null,
      totalCost: 150000,
      totalCostCurrency: 'LKR',
      askingPrice: null,
      askingPriceCurrency: null,
      minimumPrice: null,
      minimumPriceCurrency: null,
      soldPrice: null,
      soldPriceCurrency: null,
      notes: 'QA seed gem',
      photos: [],
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  await db.collection('gemtrack_gem_events').doc('qa-gem-1-created').set(
    {
      gemId: 'qa-gem-1',
      ownerUid: uids.trader,
      eventType: 'created',
      fromStatus: null,
      toStatus: 'ready_for_sale',
      weight: 3.2,
      note: 'Seeded for QA',
      photoUrl: null,
      createdAt: now,
    },
    { merge: true },
  );

  // Trader contact + cheque + deep-link notification
  await db.collection('gemtrack_contacts').doc('qa-trader-contact-1').set(
    {
      ownerUid: uids.trader,
      displayName: 'QA Broker Ravi',
      companyName: 'Ravi Gems',
      phone: '+94771112233',
      whatsapp: '+94771112233',
      email: null,
      contactTypes: ['broker', 'ap_holder', 'cutter'],
      notes: 'Seeded contact for cheque/AP/cutting',
      isFavourite: true,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  const maturity = Timestamp.fromMillis(now.toMillis() + 14 * 86400000);
  await db.collection('gemtrack_cheques').doc('qa-cheque-1').set(
    {
      ownerUid: uids.trader,
      direction: 'received',
      chequeNumber: 'QA-CHQ-001',
      bankName: 'Commercial Bank',
      branch: 'Beruwala',
      amount: 25000,
      currency: 'LKR',
      amountBase: 25000,
      counterpartyContactId: 'qa-trader-contact-1',
      issuedBy: 'QA Broker Ravi',
      issueDate: now,
      maturityDate: maturity,
      depositedDate: null,
      clearedDate: null,
      status: 'holding',
      bouncedReason: null,
      replacementChequeId: null,
      photoUrl: null,
      gemId: null,
      apRecordId: null,
      tripId: null,
      notes: 'Seeded cheque for QA',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  await db.collection('notifications').doc('qa-trader-notif-1').set(
    {
      recipientUid: uids.trader,
      type: 'cheque_alert',
      title: 'QA deep-link check',
      message: 'Tap to open cheque QA-CHQ-001',
      referenceType: 'cheque',
      referenceId: 'qa-cheque-1',
      isRead: false,
      isPushSent: false,
      createdAt: now,
    },
    { merge: true },
  );

  await db.collection('notifications').doc('welcome-trader').set(
    {
      recipientUid: uids.trader,
      type: 'announcement_platform',
      title: 'Welcome to GemFort QA',
      message: 'Seeded announcement for dogfood. Find verified businesses in Directory.',
      referenceType: 'announcement',
      referenceId: 'welcome',
      priority: 'low',
      isRead: false,
      isPushSent: false,
      createdAt: now,
    },
    { merge: true },
  );

  // Suspended persona for AC-AUTH-003
  let suspendedUid;
  try {
    const existing = await auth.getUserByEmail('qa-suspended@gemfort.test');
    suspendedUid = existing.uid;
    await auth.updateUser(suspendedUid, {
      password: QA_PASSWORD,
      displayName: 'QA Suspended User',
      emailVerified: true,
      disabled: false,
    });
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    suspendedUid = (
      await auth.createUser({
        email: 'qa-suspended@gemfort.test',
        password: QA_PASSWORD,
        displayName: 'QA Suspended User',
        emailVerified: true,
      })
    ).uid;
  }
  await db
    .collection('users')
    .doc(suspendedUid)
    .set(
      {
        uid: suspendedUid,
        email: 'qa-suspended@gemfort.test',
        displayName: 'QA Suspended User',
        phone: '+94770000099',
        role: 'trader',
        roleIntent: 'trader',
        verificationStatus: 'unverified',
        isSuspended: true,
        suspendedReason: 'QA lockout test',
        suspendedAt: now,
        createdAt: now,
        lastActiveAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
  console.log(`OK suspended: qa-suspended@gemfort.test → ${suspendedUid}`);

  console.log('\nQA seed complete.');
  console.log('Password for all personas:', QA_PASSWORD);
  console.log('Public cert number: GF-2026-0001');
  console.log(JSON.stringify({ ...uids, suspended: suspendedUid }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
