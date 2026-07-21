import { matchBusinessForContact } from "@/features/workspace/contact-business-link";
import type { Business, Contact } from "@/types";

/** Primary gem album image — always `photoUrls[0]`. */
export function gemPrimaryPhotoUrl(
  gem: { photoUrls?: string[] | null } | null | undefined,
): string | null {
  const url = gem?.photoUrls?.[0]?.trim();
  return url || null;
}

export function businessLogoUrl(
  business: { logoUrl?: string | null } | null | undefined,
): string | null {
  const url = business?.logoUrl?.trim();
  return url || null;
}

function businessesList(
  businesses: Business[] | Map<string, Business> | undefined,
): Business[] {
  if (!businesses) return [];
  return Array.isArray(businesses) ? businesses : [...businesses.values()];
}

/**
 * Contact / counterparty avatar: contact photo, else linked/matched business logo.
 */
export function resolvePartyPhotoUrl(
  contact: Pick<
    Contact,
    "photoUrl" | "phone" | "whatsapp" | "linkedBusinessId"
  > | null | undefined,
  businesses?: Business[] | Map<string, Business>,
): string | null {
  const own = contact?.photoUrl?.trim();
  if (own) return own;
  if (!contact) return null;

  const list = businessesList(businesses);
  if (list.length === 0) return null;

  if (contact.linkedBusinessId) {
    const linked =
      list.find((b) => b.id === contact.linkedBusinessId) ?? null;
    const logo = businessLogoUrl(linked);
    if (logo) return logo;
  }

  return businessLogoUrl(matchBusinessForContact(contact, list));
}

/** Logo for a known GemFort business id (trader / lapidary / lab). */
export function resolveBusinessPhotoById(
  businessId: string | null | undefined,
  businesses?: Business[] | Map<string, Business>,
): string | null {
  if (!businessId) return null;
  const list = businessesList(businesses);
  return businessLogoUrl(list.find((b) => b.id === businessId) ?? null);
}

/** Logo for the GemFort business owned by this uid. */
export function resolveBusinessPhotoByOwnerUid(
  ownerUid: string | null | undefined,
  businesses?: Business[] | Map<string, Business>,
): string | null {
  if (!ownerUid) return null;
  const list = businessesList(businesses);
  return businessLogoUrl(list.find((b) => b.ownerUid === ownerUid) ?? null);
}

/** Build contactId → resolved photo map for list screens. */
export function buildContactPhotoMap(
  contacts: Contact[],
  businesses?: Business[] | Map<string, Business>,
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const c of contacts) {
    map.set(c.id, resolvePartyPhotoUrl(c, businesses));
  }
  return map;
}
