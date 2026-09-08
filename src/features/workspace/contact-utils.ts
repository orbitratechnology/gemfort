import { normalizeContactType } from '@/constants/contact-types';
import type { Contact } from '@/types';

export type ContactSection = {
  title: string;
  data: Contact[];
};

export function filterContacts(
  contacts: Contact[],
  query: string,
  typeFilter: string | null,
): Contact[] {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedTypeFilter = typeFilter
    ? normalizeContactType(typeFilter)
    : null;

  return contacts
    .filter((contact) => {
      const contactTypes = (contact.contactTypes ?? []).map(normalizeContactType);
      if (normalizedTypeFilter && !contactTypes.includes(normalizedTypeFilter)) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        contact.displayName,
        contact.companyName,
        contact.phone,
        contact.whatsapp,
        contact.email,
        ...contactTypes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    })
    .sort((a, b) => {
      if (a.isFavourite !== b.isFavourite) return a.isFavourite ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });
}

/** iOS Contacts–style A–Z sections (non-letters → #). */
export function groupContactsByLetter(contacts: Contact[]): ContactSection[] {
  const sorted = [...contacts].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
  const buckets = new Map<string, Contact[]>();

  for (const contact of sorted) {
    const first = contact.displayName.trim().charAt(0).toUpperCase();
    const key = first && /[A-Z]/.test(first) ? first : '#';
    const list = buckets.get(key);
    if (list) list.push(contact);
    else buckets.set(key, [contact]);
  }

  const letters = [...buckets.keys()].sort((a, b) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b);
  });

  return letters.map((title) => ({
    title,
    data: buckets.get(title)!,
  }));
}
