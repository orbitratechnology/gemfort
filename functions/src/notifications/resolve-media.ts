import { logger } from 'firebase-functions';

import { db } from '../admin';
import type { NotificationType } from './types';

export type ResolvedPushMedia = {
  actorName: string | null;
  actorPhotoUrl: string | null;
  /** Gem / listing / cheque / announcement art for BigPicture. */
  imageUrl: string | null;
};

function firstPhoto(urls: unknown): string | null {
  if (!Array.isArray(urls) || typeof urls[0] !== 'string') return null;
  const url = urls[0].trim();
  return url || null;
}

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t || null;
}

async function businessLogoById(businessId: string | null): Promise<{
  name: string | null;
  logoUrl: string | null;
} | null> {
  if (!businessId) return null;
  const snap = await db.collection('businesses').doc(businessId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    name: str(data.businessName),
    logoUrl: str(data.logoUrl),
  };
}

async function businessLogoByOwnerUid(uid: string | null): Promise<{
  name: string | null;
  logoUrl: string | null;
} | null> {
  if (!uid) return null;
  const snap = await db
    .collection('businesses')
    .where('ownerUid', '==', uid)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const data = snap.docs[0]!.data();
  return {
    name: str(data.businessName),
    logoUrl: str(data.logoUrl),
  };
}

async function gemPhoto(gemId: string | null): Promise<string | null> {
  if (!gemId) return null;
  const snap = await db.collection('gemtrack_gems').doc(gemId).get();
  if (!snap.exists) {
    const market = await db.collection('gems').doc(gemId).get();
    if (!market.exists) return null;
    return firstPhoto(market.data()?.photoUrls);
  }
  return firstPhoto(snap.data()?.photoUrls);
}

async function contactPhoto(contactId: string | null): Promise<{
  name: string | null;
  photoUrl: string | null;
}> {
  if (!contactId) return { name: null, photoUrl: null };
  const snap = await db.collection('gemtrack_contacts').doc(contactId).get();
  if (!snap.exists) return { name: null, photoUrl: null };
  const data = snap.data() ?? {};
  const own = str(data.photoUrl);
  if (own) {
    return { name: str(data.displayName), photoUrl: own };
  }
  const linked = await businessLogoById(str(data.linkedBusinessId));
  return {
    name: str(data.displayName) || linked?.name || null,
    photoUrl: linked?.logoUrl ?? null,
  };
}

/**
 * Resolve sender avatar + secondary media for the OS notification tray.
 * Fills gaps when the notification doc was created without denormalized media.
 */
export async function resolvePushMedia(input: {
  type: NotificationType | string;
  referenceType?: string | null;
  referenceId?: string | null;
  actorName?: string | null;
  actorPhotoUrl?: string | null;
  imageUrl?: string | null;
  recipientUid: string;
}): Promise<ResolvedPushMedia> {
  let actorName = str(input.actorName);
  let actorPhotoUrl = str(input.actorPhotoUrl);
  let imageUrl = str(input.imageUrl);

  const refType = str(input.referenceType);
  const refId = str(input.referenceId);

  try {
    if (refType === 'ap' && refId) {
      const snap = await db.collection('gemtrack_ap_records').doc(refId).get();
      if (snap.exists) {
        const ap = snap.data() ?? {};
        const viewerIsSender = ap.senderUid === input.recipientUid;
        const counterpartyUid = str(
          viewerIsSender ? ap.receiverUid : ap.senderUid,
        );
        const counterpartyName = str(
          viewerIsSender ? ap.receiverName : ap.senderName,
        );
        actorName = actorName || counterpartyName;

        if (!actorPhotoUrl) {
          const bizId = viewerIsSender
            ? str(ap.receiverBusinessId)
            : null;
          const biz =
            (await businessLogoById(bizId)) ??
            (await businessLogoByOwnerUid(counterpartyUid));
          actorPhotoUrl = biz?.logoUrl ?? null;
          actorName = actorName || biz?.name || null;
        }

        if (!imageUrl) {
          const firstGemId = Array.isArray(ap.items)
            ? str(ap.items[0]?.gemId)
            : null;
          imageUrl = await gemPhoto(firstGemId);
        }
      }
    } else if (refType === 'service' && refId) {
      const snap = await db.collection('gemtrack_services').doc(refId).get();
      if (snap.exists) {
        const s = snap.data() ?? {};
        actorName = actorName || str(s.providerName);
        if (!actorPhotoUrl) {
          const biz = await businessLogoById(str(s.providerBusinessId));
          actorPhotoUrl = biz?.logoUrl ?? null;
          actorName = actorName || biz?.name || null;
        }
        if (!imageUrl) imageUrl = await gemPhoto(str(s.gemId));
      }
    } else if (refType === 'cheque' && refId) {
      const snap = await db.collection('gemtrack_cheques').doc(refId).get();
      if (snap.exists) {
        const c = snap.data() ?? {};
        const contact = await contactPhoto(str(c.counterpartyContactId));
        actorName = actorName || contact.name || str(c.issuedBy);
        actorPhotoUrl = actorPhotoUrl || contact.photoUrl;
        if (!imageUrl) imageUrl = str(c.photoUrl);
      }
    } else if (refType === 'bill' && refId) {
      const snap = await db.collection('gemtrack_bills').doc(refId).get();
      if (snap.exists) {
        const b = snap.data() ?? {};
        const contact = await contactPhoto(str(b.counterpartyContactId));
        actorName = actorName || contact.name;
        actorPhotoUrl = actorPhotoUrl || contact.photoUrl;
      }
    } else if (refType === 'listing' && refId) {
      let listingData: Record<string, unknown> | null = null;
      const bySlug = await db
        .collection('gems')
        .where('shareableSlug', '==', refId)
        .limit(1)
        .get();
      if (!bySlug.empty) {
        listingData = bySlug.docs[0]!.data() as Record<string, unknown>;
      } else {
        const byId = await db.collection('gems').doc(refId).get();
        if (byId.exists) listingData = (byId.data() ?? null) as Record<string, unknown> | null;
      }
      if (listingData) {
        if (!imageUrl) imageUrl = firstPhoto(listingData.photoUrls);
        if (!actorPhotoUrl && input.type !== 'listing_offer_received') {
          const biz = await businessLogoById(str(listingData.businessId));
          actorPhotoUrl = biz?.logoUrl ?? str(listingData.sellerLogoUrl);
          actorName =
            actorName || biz?.name || str(listingData.sellerBusinessName);
        }
      }
    } else if (refType === 'announcement' && refId) {
      const snap = await db.collection('announcements').doc(refId).get();
      if (snap.exists) {
        const a = snap.data() ?? {};
        if (!imageUrl) imageUrl = str(a.imageUrl);
        if (!actorPhotoUrl) {
          const biz = await businessLogoById(str(a.linkedBusinessId));
          actorPhotoUrl = biz?.logoUrl ?? null;
          actorName = actorName || biz?.name || 'GemFort';
        }
        if (!imageUrl && a.linkedGemId) {
          imageUrl = await gemPhoto(str(a.linkedGemId));
        }
      }
    } else if (refType === 'verification' || String(input.type).startsWith('verification_')) {
      actorName = actorName || 'GemFort';
    } else if (String(input.type).startsWith('account_')) {
      actorName = actorName || 'GemFort';
    }
  } catch (error) {
    logger.warn('resolvePushMedia failed', {
      type: input.type,
      refType,
      refId,
      error,
    });
  }

  return { actorName, actorPhotoUrl, imageUrl };
}

/**
 * Image shown in the OS notification tray.
 * Prefer gem/listing art for BigPicture; fall back to sender profile.
 */
export function trayImageUrl(media: ResolvedPushMedia): string | null {
  return media.imageUrl || media.actorPhotoUrl || null;
}
