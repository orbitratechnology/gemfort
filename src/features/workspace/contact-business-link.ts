import { directoryTabFromBusinessType } from "@/constants/roles";
import { normalizePhoneKey } from "@/features/workspace/device-contacts-service";
import type { Business, Contact } from "@/types";

export type BusinessKind = "traders" | "lapidaries" | "labs";

export function businessPhoneKeys(business: Business): string[] {
  const keys = new Set<string>();
  for (const raw of [
    business.contacts?.phone?.value,
    business.contacts?.whatsapp?.value,
  ]) {
    const key = normalizePhoneKey(raw);
    if (key) keys.add(key);
  }
  return [...keys];
}

export function contactPhoneKeys(contact: Pick<Contact, "phone" | "whatsapp">): string[] {
  const keys = setFromPhones(contact.phone, contact.whatsapp);
  return [...keys];
}

function setFromPhones(...raws: (string | null | undefined)[]): Set<string> {
  const keys = new Set<string>();
  for (const raw of raws) {
    const key = normalizePhoneKey(raw);
    if (key) keys.add(key);
  }
  return keys;
}

export function businessKindOf(business: Business): BusinessKind | null {
  const tab = directoryTabFromBusinessType(business.businessType);
  if (tab === "traders" || tab === "lapidaries" || tab === "labs") return tab;
  if (business.sellerProfile) return "traders";
  if (business.providerProfile) return "lapidaries";
  if (business.labProfile) return "labs";
  return null;
}

export function filterBusinessesByKinds(
  businesses: Business[],
  kinds: BusinessKind[] | null | undefined,
): Business[] {
  if (!kinds || kinds.length === 0) return businesses;
  const allowed = new Set(kinds);
  return businesses.filter((b) => {
    const kind = businessKindOf(b);
    return kind != null && allowed.has(kind);
  });
}

/** Build phone → business map (first wins). Only businesses with a public phone. */
export function buildBusinessPhoneIndex(
  businesses: Business[],
): Map<string, Business> {
  const index = new Map<string, Business>();
  for (const business of businesses) {
    for (const key of businessPhoneKeys(business)) {
      if (!index.has(key)) index.set(key, business);
    }
  }
  return index;
}

/**
 * Find the unique verified business that shares a phone with this contact.
 * Returns null if none or ambiguous (multiple businesses share keys).
 */
export function matchBusinessForContact(
  contact: Pick<Contact, "phone" | "whatsapp" | "linkedBusinessId">,
  businesses: Business[],
): Business | null {
  if (contact.linkedBusinessId) {
    return businesses.find((b) => b.id === contact.linkedBusinessId) ?? null;
  }
  const contactKeys = contactPhoneKeys(contact);
  if (contactKeys.length === 0) return null;

  const matches = new Map<string, Business>();
  for (const business of businesses) {
    const bizKeys = businessPhoneKeys(business);
    if (bizKeys.some((k) => contactKeys.includes(k))) {
      matches.set(business.id, business);
    }
  }
  if (matches.size === 1) return [...matches.values()][0];
  return null;
}

export function findContactForBusiness(
  contacts: Contact[],
  business: Business,
): Contact | null {
  const byLink = contacts.find((c) => c.linkedBusinessId === business.id);
  if (byLink) return byLink;

  const bizKeys = new Set(businessPhoneKeys(business));
  if (bizKeys.size === 0) return null;

  return (
    contacts.find((c) => contactPhoneKeys(c).some((k) => bizKeys.has(k))) ??
    null
  );
}

export function linkFieldsFromBusiness(business: Business): Pick<
  Contact,
  "linkedBusinessId" | "linkedBusinessName" | "linkedBusinessType"
> {
  return {
    linkedBusinessId: business.id,
    linkedBusinessName: business.businessName,
    linkedBusinessType: business.businessType,
  };
}
