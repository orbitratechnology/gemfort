import type { IconName } from "@/components/ui/icon";
import {
  fetchBusiness,
  fetchBusinessByOwnerUid,
} from "@/features/marketplace/marketplace-service";
import { fetchApRecordById } from "@/features/workspace/ap-lifecycle-service";
import {
  fetchBill,
  fetchCheque,
  fetchGem,
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
  imageUrl: string | null;
  /** People/business logos are circular; gems/media use rounded squares. */
  shape: "circle" | "rounded";
  label: string;
  fallbackIcon: IconName;
};

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

export function fallbackIconForType(type: string): IconName {
  if (type.startsWith("cheque_")) return "money-check-dollar";
  if (type.startsWith("bill_")) return "receipt-long";
  if (type.startsWith("ap_")) return "handshake";
  if (type.startsWith("service_")) return "handyman";
  if (type.startsWith("cert_")) return "workspace-premium";
  if (type.startsWith("payment_")) return "payments";
  if (type.startsWith("verification_")) return "verified-user";
  if (type.startsWith("announcement_")) return "campaign";
  if (type.startsWith("report_")) return "flag";
  if (type.startsWith("account_")) return "manage-accounts";
  return "notifications";
}

function baseVisual(n: AppNotification): NotificationVisual {
  return {
    imageUrl: null,
    shape: "circle",
    label: n.title.slice(0, 2).toUpperCase(),
    fallbackIcon: fallbackIconForType(n.type),
  };
}

/**
 * Resolve avatars / gem photos for inbox rows from live Firestore refs.
 * Notifications only store referenceType + referenceId — images are never static.
 */
export async function resolveNotificationVisuals(
  notifications: AppNotification[],
  viewerUid: string,
): Promise<Record<string, NotificationVisual>> {
  const out: Record<string, NotificationVisual> = {};
  for (const n of notifications) out[n.id] = baseVisual(n);
  if (notifications.length === 0) return out;

  const [aps, services, cheques, bills, announcements] = await Promise.all([
    mapFetch(uniqueIds(notifications, "ap"), fetchApRecordById),
    mapFetch(uniqueIds(notifications, "service"), fetchService),
    mapFetch(uniqueIds(notifications, "cheque"), fetchCheque),
    mapFetch(uniqueIds(notifications, "bill"), fetchBill),
    mapFetch(uniqueIds(notifications, "announcement"), fetchAnnouncement),
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

  const [gems, businessesById, contacts] = await Promise.all([
    mapFetch([...gemIds], fetchGem),
    mapFetch([...businessIds], fetchBusiness),
    mapFetch([...contactIds], fetchContactById),
  ]);

  for (const contact of contacts.values()) {
    if (contact.linkedBusinessId) businessIds.add(contact.linkedBusinessId);
  }

  // Refetch businesses if contacts linked new business IDs.
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
      const preferGem =
        n.type === "ap_gem_sold" || n.type.includes("gem");
      const firstGemId = ap.items?.[0]?.gemId;
      const gemPhoto = firstGemId
        ? gems.get(firstGemId)?.photoUrls?.[0]
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
      if (preferGem && gemPhoto) {
        visual.imageUrl = gemPhoto;
        visual.shape = "rounded";
        visual.label = counterpartyName || "Gem";
      } else if (biz?.logoUrl) {
        visual.imageUrl = biz.logoUrl;
        visual.shape = "circle";
        visual.label = biz.businessName || counterpartyName || "AP";
      } else if (gemPhoto) {
        visual.imageUrl = gemPhoto;
        visual.shape = "rounded";
        visual.label = counterpartyName || "Gem";
      } else {
        visual.label = counterpartyName || "AP";
      }
      continue;
    }

    if (n.referenceType === "service") {
      const service = services.get(refId);
      if (!service) continue;
      const gemPhoto = gems.get(service.gemId)?.photoUrls?.[0] ?? null;
      const biz = service.providerBusinessId
        ? businessesById.get(service.providerBusinessId)
        : null;
      if (gemPhoto) {
        visual.imageUrl = gemPhoto;
        visual.shape = "rounded";
        visual.label = service.providerName || "Service";
      } else if (biz?.logoUrl) {
        visual.imageUrl = biz.logoUrl;
        visual.shape = "circle";
        visual.label = biz.businessName || service.providerName || "Service";
      } else {
        visual.label = service.providerName || "Service";
      }
      continue;
    }

    if (n.referenceType === "cheque") {
      const cheque = cheques.get(refId);
      if (!cheque) continue;
      if (cheque.photoUrl) {
        visual.imageUrl = cheque.photoUrl;
        visual.shape = "rounded";
        visual.label = cheque.issuedBy || cheque.chequeNumber || "Cheque";
      } else {
        const contact = cheque.counterpartyContactId
          ? contacts.get(cheque.counterpartyContactId)
          : null;
        const linkedBiz = contact?.linkedBusinessId
          ? businessesById.get(contact.linkedBusinessId)
          : null;
        visual.imageUrl =
          contact?.photoUrl ?? linkedBiz?.logoUrl ?? null;
        visual.shape = "circle";
        visual.label =
          contact?.displayName ||
          linkedBiz?.businessName ||
          cheque.issuedBy ||
          "Cheque";
      }
      continue;
    }

    if (n.referenceType === "bill") {
      const bill = bills.get(refId);
      if (!bill) continue;
      const contact = bill.counterpartyContactId
        ? contacts.get(bill.counterpartyContactId)
        : null;
      const linkedBiz = contact?.linkedBusinessId
        ? businessesById.get(contact.linkedBusinessId)
        : null;
      visual.imageUrl = contact?.photoUrl ?? linkedBiz?.logoUrl ?? null;
      visual.shape = "circle";
      visual.label =
        contact?.displayName || linkedBiz?.businessName || "Bill";
      continue;
    }

    if (n.referenceType === "announcement") {
      const ann = announcements.get(refId);
      if (!ann) continue;
      if (ann.imageUrl) {
        visual.imageUrl = ann.imageUrl;
        visual.shape = "rounded";
        visual.label = ann.title || "News";
      } else if (ann.linkedBusinessId) {
        const biz = businessesById.get(ann.linkedBusinessId);
        visual.imageUrl = biz?.logoUrl ?? null;
        visual.shape = "circle";
        visual.label = biz?.businessName || ann.title || "News";
      } else if (ann.linkedGemId) {
        visual.imageUrl = gems.get(ann.linkedGemId)?.photoUrls?.[0] ?? null;
        visual.shape = "rounded";
        visual.label = ann.title || "News";
      }
    }
  }

  return out;
}
