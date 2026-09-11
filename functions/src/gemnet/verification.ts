import { Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import {
  onDocumentUpdated,
  onDocumentWritten,
} from 'firebase-functions/v2/firestore';

import { db } from '../admin';
import { REGION } from '../config';
import { createNotificationDoc } from '../notifications/create';

type VerificationTier = 'member' | 'identity' | 'business' | 'gem';

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function verificationTier(value: unknown): VerificationTier {
  return value === 'identity' || value === 'business' || value === 'gem'
    ? value
    : 'member';
}

function hasVerifiedBadge(data: DocumentData): boolean {
  const badges = data.badges;
  return (
    data.verificationStatus === 'verified' &&
    badges &&
    typeof badges === 'object' &&
    !Array.isArray(badges) &&
    (badges as { isVerified?: unknown }).isVerified === true
  );
}

async function ensureApprovedBusiness(application: DocumentData): Promise<string | null> {
  const applicantUid = stringValue(application.applicantUid);
  if (!applicantUid) return null;

  const rawBusinessId = stringValue(application.businessId);
  const requestedBusinessId =
    rawBusinessId && rawBusinessId !== 'pending'
      ? rawBusinessId
      : null;
  const requestedBusinessSnapshot = requestedBusinessId
    ? await db.collection('businesses').doc(requestedBusinessId).get()
    : null;
  const requestedBusinessIsOwned =
    requestedBusinessSnapshot?.exists === true &&
    requestedBusinessSnapshot.data()?.ownerUid === applicantUid;
  let businessSnapshot = requestedBusinessIsOwned
    ? requestedBusinessSnapshot
    : null;

  if (!businessSnapshot) {
    const ownerBusinesses = await db
      .collection('businesses')
      .where('ownerUid', '==', applicantUid)
      .limit(1)
      .get();
    businessSnapshot = ownerBusinesses.docs[0] ?? null;
  }

  const userSnapshot = await db.collection('users').doc(applicantUid).get();
  if (!userSnapshot.exists) return null;

  const tier = verificationTier(application.verificationTier);
  const adminUid = stringValue(application.adminUid);
  const now = Timestamp.now();

  if (businessSnapshot) {
    const business = businessSnapshot.data() ?? {};
    if (hasVerifiedBadge(business)) return businessSnapshot.id;

    await businessSnapshot.ref.update({
      verificationStatus: 'verified',
      verificationTier: tier,
      verifiedAt: now,
      verifiedByAdminUid: adminUid,
      'badges.isVerified': true,
      'badges.businessReputation': tier,
      updatedAt: now,
    });
    return businessSnapshot.id;
  }

  const user = userSnapshot.data() ?? {};
  const applicationType = stringValue(application.applicationType);
  const isLapidary =
    applicationType === 'lapidary' ||
    applicationType === 'provider' ||
    applicationType === 'cutter';
  const businessType = isLapidary ? 'lapidary' : 'trader';
  const businessName = stringValue(application.businessName);
  if (!businessName) return null;

  const businessIdForCreate =
    requestedBusinessSnapshot?.exists === true && !requestedBusinessIsOwned
      ? null
      : requestedBusinessId;
  const businessRef = businessIdForCreate
    ? db.collection('businesses').doc(businessIdForCreate)
    : db.collection('businesses').doc();
  const ownerName = stringValue(user.displayName) ?? 'GemFort member';
  const serviceIds = Array.isArray(application.servicesOffered)
    ? application.servicesOffered
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
        .slice(0, 20)
    : [];

  try {
    await businessRef.create({
      ownerUid: applicantUid,
      businessType,
      businessName,
      ownerName,
      brNumber: '',
      ngjaNumber: '',
      gemLicenseNumber: '',
      tinNumber: '',
      yearEstablished: null,
      shortDescription: '',
      address: '',
      city: '',
      district: '',
      province: '',
      country: 'Sri Lanka',
      location: null,
      verificationStatus: 'verified',
      verificationTier: tier,
      verifiedAt: now,
      verifiedByAdminUid: adminUid,
      badges: {
        isVerified: true,
        businessReputation: tier,
        isNgjaRegistered: false,
        isPremium: false,
        verifiedSinceYear: now.toDate().getFullYear(),
        yearsActive: 0,
        hasRepeatBusiness: false,
        listingMilestone: 0,
        likeCount: 0,
      },
      sellerProfile: isLapidary
        ? null
        : {
            gemSpecializations: [],
            sourceOrigins: ['sri_lanka'],
            stoneTypes: [],
            priceRangeMin: null,
            priceRangeMax: null,
            preferredCurrencies: ['LKR', 'USD'],
          },
      providerProfile: isLapidary
        ? {
            services: serviceIds.map((serviceId) => ({
              serviceId,
              name: serviceId,
              description: '',
              pricingType: 'optional',
              priceMin: null,
              priceMax: null,
              currency: null,
              turnaroundDaysMin: 0,
              turnaroundDaysMax: 0,
              isActive: true,
            })),
            servicesOffered: serviceIds,
            gemSpecializations: [],
            isAcceptingOrders: true,
            portfolioCount: 0,
          }
        : null,
      contacts: {
        whatsapp: { value: '', isVisible: false },
        phone: { value: '', isVisible: false },
      },
      socialLinks: {
        website: '',
        instagram: '',
        tiktok: '',
        facebook: '',
        wechat: '',
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
    return businessRef.id;
  } catch (error) {
    const code = String(
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : '',
    ).toUpperCase();
    if (code === '6' || code === 'ALREADY_EXISTS') return businessRef.id;
    throw error;
  }
}

const STATUS_MESSAGES: Record<string, { type: string; title: string; message: string }> = {
  approved: {
    type: 'verification_approved',
    title: 'Verification approved',
    message: 'Your business verification has been approved. You can now access verified features.',
  },
  rejected: {
    type: 'verification_rejected',
    title: 'Verification rejected',
    message: 'Your verification application was not approved. Check your application for details.',
  },
  info_requested: {
    type: 'verification_info_requested',
    title: 'More information needed',
    message: 'We need additional information to complete your verification review.',
  },
};

export const onVerificationStatusChanged = onDocumentUpdated(
  {
    document: 'verification_applications/{applicationId}',
    region: REGION,
    retry: true,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === after.status) return;

    const mapping = STATUS_MESSAGES[after.status as string];
    if (!mapping) return;

    if (after.status === 'approved') {
      const businessId = await ensureApprovedBusiness(after);
      if (businessId && after.businessId !== businessId) {
        await db
          .collection('verification_applications')
          .doc(event.params.applicationId)
          .update({ businessId, updatedAt: Timestamp.now() });
      }
    }

    await createNotificationDoc({
      recipientUid: after.applicantUid as string,
      type: mapping.type as 'verification_approved',
      title: mapping.title,
      message: mapping.message,
      referenceType: 'verification',
      referenceId: event.params.applicationId,
    });

    logger.info('Verification notification', {
      applicationId: event.params.applicationId,
      status: after.status,
    });
  },
);

/**
 * A verified user may create their business profile after approval. The
 * client must still create it as unverified because verification fields are
 * server-owned, so reconcile that profile on the server before it can enter
 * the public directory.
 */
export const onBusinessProfileChanged = onDocumentWritten(
  {
    document: 'businesses/{businessId}',
    region: REGION,
    retry: true,
  },
  async (event) => {
    const businessSnapshot = event.data?.after;
    if (!businessSnapshot?.exists) return;

    const business = businessSnapshot.data();
    if (!business || hasVerifiedBadge(business)) return;

    const ownerUid = stringValue(business.ownerUid);
    if (!ownerUid) return;

    const userSnapshot = await db.collection('users').doc(ownerUid).get();
    const user = userSnapshot.data();
    if (
      !userSnapshot.exists ||
      user?.verificationStatus !== 'verified' ||
      user?.isSuspended === true
    ) {
      return;
    }

    const tier = verificationTier(user?.verificationTier);
    const reputation = user?.recognizedBadge === true ? 'recognized' : tier;
    const now = Timestamp.now();

    await businessSnapshot.ref.update({
      verificationStatus: 'verified',
      verificationTier: tier,
      verifiedAt: now,
      verifiedByAdminUid: stringValue(user?.verifiedByAdminUid),
      'badges.isVerified': true,
      'badges.businessReputation': reputation,
      updatedAt: now,
    });

    logger.info('Business profile reconciled for verified owner', {
      businessId: event.params.businessId,
      ownerUid,
    });
  },
);
