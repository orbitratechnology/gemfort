import type { Contact } from '@/types';

export function filterContacts(
  contacts: Contact[],
  query: string,
  typeFilter: string | null,
): Contact[] {
  const normalizedQuery = query.trim().toLowerCase();

  return contacts
    .filter((contact) => {
      if (typeFilter && !(contact.contactTypes ?? []).includes(typeFilter)) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        contact.displayName,
        contact.companyName,
        contact.phone,
        contact.whatsapp,
        contact.email,
        ...(contact.contactTypes ?? []),
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
