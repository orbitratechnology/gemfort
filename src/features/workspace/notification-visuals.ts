import type { IconName } from "@/components/ui/icon";
import {
  fetchBusiness,
  fetchBusinessByOwnerUid,
} from "@/features/marketplace/marketplace-service";
import { fallbackIconForType } from "@/features/workspace/notification-presentation";
import { gemPrimaryPhotoUrl, resolvePartyPhotoUrl } from "@/features/workspace/party-photo";
import { fetchApRecordById } from "@/features/workspace/ap-lifecycle-service";
import {
  fetchBill,
  fetchCheque,
  fetchGem,
  fetchListingBySlug,
  fetchService,
} from "@/features/workspace/workspace-service";
import { getFirebaseDb } from "@/lib/firebase/config";
import { doc, getDoc } from "@/lib/firebase/db";
import type {
  Announcement,
  AppNotification,
  Contact,
} from "@/types";

export type NotificationVisual = {
  /** Primary avatar / logo (people, businesses). */
  imageUrl: string | null;
  /** Secondary media (gem, listing, cheque photo, announcement art). */
  mediaUrl: string | null;
  /** People/business logos are circular; gems/media use rounded squares. */
  shape: "circle" | "rounded";
  mediaShape: "circle" | "rounded";
  label: string;
  actorName: string | null;
  fallbackIcon: IconName;
};

export { fallbackIconForType };

function uniqueIds(
  notifications: AppNotification[],
  type: string,
): string[] {
  return [
    ...new Set(
      notifications
        .filter((n) => n.referenceType === type && n.referenceId)
        .map((n) => n.referenceId!),
    ),
  ];
}

async function mapFetch<T>(
  ids: string[],
  fetchOne: (id: string) => Promise<T | null>,
): Promise<Map<string, T>> {
  const results = await Promise.all(
    ids.map(async (id) => [id, await fetchOne(id)] as const),
  );
  const map = new Map<string, T>();
  for (const [id, value] of results) {
    if (value) map.set(id, value);
  }
  return map;
}

async function fetchContactById(contactId: string): Promise<Contact | null> {
  const snap = await getDoc(
    doc(getFirebaseDb(), "gemtrack_contacts", contactId),
  );
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Contact;
}

async function fetchAnnouncement(
  id: string,
): Promise<Announcement | null> {
  const snap = await getDoc(doc(getFirebaseDb(), "announcements", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Announcement;
}

/**
 * Builds an immediately usable visual from the denormalized notification.
 *
 * Notifications already persist actor and media URLs. The async resolver below
 * only enriches older/minimal records, so callers must be able to render this
 * shape while that work is pending or unavailable.
 */
export function notificationVisualFromNotification(
  n: AppNotification,
): NotificationVisual {
  return {
    imageUrl: n.actorPhotoUrl ?? null,
    mediaUrl: n.imageUrl ?? null,
    shape: "circle",
    mediaShape: "rounded",
    label: n.actorName?.slice(0, 2).toUpperCase() || n.title.slice(0, 2).toUpperCase(),
    actorName: n.actorName ?? null,
    fallbackIcon: fallbackIconForType(n.type),
  };
}

/**
 * Resolve avatars / gem photos for inbox rows from live Firestore refs.
 * Prefers denormalized actorPhotoUrl / imageUrl when present, then fills gaps.
 */
export async function resolveNotificationVisuals(
  notifications: AppNotification[],
  viewerUid: string,
): Promise<Record<string, NotificationVisual>> {
  const out: Record<string, NotificationVisual> = {};
  for (const n of notifications) {
    out[n.id] = notificationVisualFromNotification(n);
  }
  if (notifications.length === 0) return out;

  const listingIds = [
    ...new Set(
      notifications
        .filter(
          (n) =>
            (n.referenceType === "listing" ||
              n.type === "listing_offer_received") &&
            n.referenceId,
        )
        .map((n) => n.referenceId!),
    ),
  ];

  const [aps, services, cheques, bills, announcements, listings] =
    await Promise.all([
      mapFetch(uniqueIds(notifications, "ap"), fetchApRecordById),
      mapFetch(uniqueIds(notifications, "service"), fetchService),
      mapFetch(uniqueIds(notifications, "cheque"), fetchCheque),
      mapFetch(uniqueIds(notifications, "bill"), fetchBill),
      mapFetch(uniqueIds(notifications, "announcement"), fetchAnnouncement),
      mapFetch(listingIds, fetchListingBySlug),
    ]);

  const gemIds = new Set<string>();
  const businessIds = new Set<string>();
  const ownerUids = new Set<string>();
  const contactIds = new Set<string>();

  for (const ap of aps.values()) {
    const counterpartyUid =
      ap.senderUid === viewerUid ? ap.receiverUid : ap.senderUid;
    if (counterpartyUid) ownerUids.add(counterpartyUid);
    if (ap.receiverBusinessId) businessIds.add(ap.receiverBusinessId);
    for (const item of ap.items ?? []) {
      if (item.gemId) gemIds.add(item.gemId);
    }
  }
  for (const s of services.values()) {
    if (s.gemId) gemIds.add(s.gemId);
    if (s.providerBusinessId) businessIds.add(s.providerBusinessId);
  }
  for (const c of cheques.values()) {
    if (c.counterpartyContactId) contactIds.add(c.counterpartyContactId);
  }
  for (const b of bills.values()) {
    if (b.counterpartyContactId) contactIds.add(b.counterpartyContactId);
  }
  for (const a of announcements.values()) {
    if (a.linkedBusinessId) businessIds.add(a.linkedBusinessId);
    if (a.linkedGemId) gemIds.add(a.linkedGemId);
  }
  for (const listing of listings.values()) {
    if (listing.businessId) businessIds.add(listing.businessId);
  }

  const [gems, businessesById, contacts] = await Promise.all([
    mapFetch([...gemIds], fetchGem),
    mapFetch([...businessIds], fetchBusiness),
    mapFetch([...contactIds], fetchContactById),
  ]);

  for (const contact of contacts.values()) {
    if (contact.linkedBusinessId) businessIds.add(contact.linkedBusinessId);
  }

  const missingBiz = [...businessIds].filter((id) => !businessesById.has(id));
  if (missingBiz.length > 0) {
    const extra = await mapFetch(missingBiz, fetchBusiness);
    for (const [id, biz] of extra) businessesById.set(id, biz);
  }

  const businessesByOwner = new Map<
    string,
    Awaited<ReturnType<typeof fetchBusinessByOwnerUid>>
  >();
  await Promise.all(
    [...ownerUids].map(async (uid) => {
      const biz = await fetchBusinessByOwnerUid(uid);
      if (biz) businessesByOwner.set(uid, biz);
    }),
  );

  for (const n of notifications) {
    const visual = out[n.id];
    const refId = n.referenceId;
    if (!refId) continue;

    if (n.referenceType === "ap") {
      const ap = aps.get(refId);
      if (!ap) continue;
      const firstGemId = ap.items?.[0]?.gemId;
      const gemPhoto = firstGemId
        ? gemPrimaryPhotoUrl(gems.get(firstGemId))
        : null;
      const counterpartyUid =
        ap.senderUid === viewerUid ? ap.receiverUid : ap.senderUid;
      const counterpartyName =
        ap.senderUid === viewerUid ? ap.receiverName : ap.senderName;
      const biz =
        (ap.senderUid === viewerUid && ap.receiverBusinessId
          ? businessesById.get(ap.receiverBusinessId)
          : null) ??
        (counterpartyUid
          ? businessesByOwner.get(counterpartyUid)
          : null);

      visual.actorName = visual.actorName || counterpartyName || biz?.businessName || null;
      visual.label =
        visual.actorName?.slice(0, 2).toUpperCase() || visual.label;

      if (!visual.imageUrl && biz?.logoUrl) {
        visual.imageUrl = biz.logoUrl;
        visual.shape = "circle";
      }
      if (!visual.mediaUrl && gemPhoto) {
        visual.mediaUrl = gemPhoto;
        visual.mediaShape = "rounded";
      }
      continue;
    }

    if (n.referenceType === "service") {
      const service = services.get(refId);
      if (!service) continue;
      const gemPhoto = gemPrimaryPhotoUrl(gems.get(service.gemId));
      const biz = service.providerBusinessId
        ? businessesById.get(service.providerBusinessId)
        : null;
      visual.actorName =
        visual.actorName || biz?.businessName || service.providerName || null;
      visual.label =
        visual.actorName?.slice(0, 2).toUpperCase() || visual.label;
      if (!visual.imageUrl && biz?.logoUrl) {
        visual.imageUrl = biz.logoUrl;
        visual.shape = "circle";
      }
      if (!visual.mediaUrl && gemPhoto) {
        visual.mediaUrl = gemPhoto;
        visual.mediaShape = "rounded";
      }
      continue;
    }

    if (n.referenceType === "cheque") {
      const cheque = cheques.get(refId);
      if (!cheque) continue;
      const contact = cheque.counterpartyContactId
        ? contacts.get(cheque.counterpartyContactId)
        : null;
      visual.actorName =
        visual.actorName ||
        contact?.displayName ||
        cheque.issuedBy ||
        null;
      visual.label =
        visual.actorName?.slice(0, 2).toUpperCase() || visual.label;
      if (!visual.imageUrl) {
        visual.imageUrl = resolvePartyPhotoUrl(contact, businessesById);
        visual.shape = "circle";
      }
      if (!visual.mediaUrl && cheque.photoUrl) {
        visual.mediaUrl = cheque.photoUrl;
        visual.mediaShape = "rounded";
      }
      continue;
    }

    if (n.referenceType === "bill") {
      const bill = bills.get(refId);
      if (!bill) continue;
      const contact = bill.counterpartyContactId
        ? contacts.get(bill.counterpartyContactId)
        : null;
      visual.actorName = visual.actorName || contact?.displayName || null;
      visual.label =
        visual.actorName?.slice(0, 2).toUpperCase() || visual.label;
      if (!visual.imageUrl) {
        visual.imageUrl = resolvePartyPhotoUrl(contact, businessesById);
        visual.shape = "circle";
      }
      continue;
    }

    if (n.referenceType === "announcement") {
      const ann = announcements.get(refId);
      if (!ann) continue;
      if (!visual.mediaUrl && ann.imageUrl) {
        visual.mediaUrl = ann.imageUrl;
        visual.mediaShape = "rounded";
      }
      if (!visual.imageUrl && ann.linkedBusinessId) {
        const biz = businessesById.get(ann.linkedBusinessId);
        visual.imageUrl = biz?.logoUrl ?? null;
        visual.shape = "circle";
        visual.actorName = visual.actorName || biz?.businessName || null;
      } else if (!visual.mediaUrl && ann.linkedGemId) {
        visual.mediaUrl = gemPrimaryPhotoUrl(gems.get(ann.linkedGemId));
        visual.mediaShape = "rounded";
      }
      visual.actorName = visual.actorName || "GemFort";
      visual.label =
        visual.actorName?.slice(0, 2).toUpperCase() ||
        ann.title?.slice(0, 2).toUpperCase() ||
        visual.label;
      continue;
    }

    if (
      n.referenceType === "listing" ||
      n.type === "listing_offer_received"
    ) {
      const listing = listings.get(refId);
      if (!listing) continue;
      const listingPhoto = listing.photoUrls?.[0] ?? null;
      const biz = listing.businessId
        ? businessesById.get(listing.businessId)
        : null;

      // For offers, actor is the buyer (may already be denormalized).
      if (!visual.actorName && n.type !== "listing_offer_received") {
        visual.actorName = biz?.businessName || null;
      }
      if (!visual.imageUrl && n.type !== "listing_offer_received" && biz?.logoUrl) {
        visual.imageUrl = biz.logoUrl;
        visual.shape = "circle";
      }
      if (!visual.mediaUrl && listingPhoto) {
        visual.mediaUrl = listingPhoto;
        visual.mediaShape = "rounded";
      }
      visual.label =
        visual.actorName?.slice(0, 2).toUpperCase() || visual.label;
    }
  }

  return out;
}
