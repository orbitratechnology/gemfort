/**
 * Device address-book access via Expo SDK 57 `expo-contacts` (Contact class API).
 * https://docs.expo.dev/versions/v57.0.0/sdk/contacts/
 */

import {
  Contact,
  ContactField,
  ContactsSortOrder,
  getPermissionsAsync,
  requestPermissionsAsync,
  type ContactsPermissionResponse,
} from 'expo-contacts';
import { Linking } from 'react-native';

const DEVICE_CONTACT_FIELDS = [
  ContactField.FULL_NAME,
  ContactField.GIVEN_NAME,
  ContactField.FAMILY_NAME,
  ContactField.COMPANY,
  ContactField.PHONES,
  ContactField.EMAILS,
  ContactField.THUMBNAIL,
  ContactField.IMAGE,
] as const;

export type DeviceContact = {
  id: string;
  displayName: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  /** Local file URI for thumbnail / full image (device only) */
  imageUri: string | null;
};

export type ContactsAccessState = {
  granted: boolean;
  canAskAgain: boolean;
  accessPrivileges: ContactsPermissionResponse['accessPrivileges'];
};

function digitsOnly(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/** Normalize for duplicate matching across formats (+94 / 0 / spaces). */
export function normalizePhoneKey(value: string | null | undefined): string | null {
  const digits = digitsOnly(value);
  if (digits.length < 7) return null;
  // Prefer last 9 digits for SL mobiles (7xxxxxxxx)
  if (digits.length >= 9) return digits.slice(-9);
  return digits;
}

function pickPrimaryPhone(
  phones: { number?: string | null }[] | undefined,
): string | null {
  if (!phones?.length) return null;
  const withNumber = phones.map((p) => p.number?.trim()).filter(Boolean) as string[];
  return withNumber[0] ?? null;
}

function pickPrimaryEmail(
  emails: { address?: string | null }[] | undefined,
): string | null {
  if (!emails?.length) return null;
  const withAddr = emails.map((e) => e.address?.trim()).filter(Boolean) as string[];
  return withAddr[0] ?? null;
}

function displayNameFromDetail(detail: {
  fullName?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  company?: string | null;
}): string {
  const full = detail.fullName?.trim();
  if (full) return full;
  const parts = [detail.givenName, detail.familyName].filter(Boolean).join(' ').trim();
  if (parts) return parts;
  return detail.company?.trim() || 'Unnamed contact';
}

export async function getContactsAccessState(): Promise<ContactsAccessState> {
  const current = await getPermissionsAsync();
  return {
    granted: current.granted,
    canAskAgain: current.canAskAgain,
    accessPrivileges: current.accessPrivileges,
  };
}

export async function ensureContactsPermission(): Promise<ContactsAccessState> {
  let status = await getPermissionsAsync();
  if (!status.granted) {
    status = await requestPermissionsAsync();
  }
  return {
    granted: status.granted,
    canAskAgain: status.canAskAgain,
    accessPrivileges: status.accessPrivileges,
  };
}

export async function openContactsSettings(): Promise<void> {
  await Linking.openSettings();
}

/** Present the native system contact picker (Expo recommended for single select). */
export async function presentDeviceContactPicker(): Promise<DeviceContact | null> {
  const access = await ensureContactsPermission();
  if (!access.granted) {
    throw new Error('Contacts permission is required to pick a contact.');
  }

  const selected = await Contact.presentPicker();
  if (!selected) return null;

  const details = await selected.getDetails([...DEVICE_CONTACT_FIELDS]);
  return mapDetailsToDeviceContact(selected.id, details);
}

/**
 * Load device contacts for browsing / multi-import.
 * Uses `Contact.getAllDetails` (bulk, field-limited) per Expo docs.
 */
export async function fetchDeviceContacts(options?: {
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<DeviceContact[]> {
  const access = await ensureContactsPermission();
  if (!access.granted) {
    throw new Error('Contacts permission is required to sync phone contacts.');
  }

  const details = await Contact.getAllDetails([...DEVICE_CONTACT_FIELDS], {
    name: options?.query?.trim() || undefined,
    limit: options?.limit,
    offset: options?.offset,
    sortOrder: ContactsSortOrder.GivenName,
  });

  return details
    .map((d) => mapDetailsToDeviceContact(d.id, d))
    .filter((c) => c.displayName.trim().length > 0)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function mapDetailsToDeviceContact(
  id: string,
  detail: {
    fullName?: string | null;
    givenName?: string | null;
    familyName?: string | null;
    company?: string | null;
    phones?: { number?: string | null }[];
    emails?: { address?: string | null }[];
    thumbnail?: string | null;
    image?: string | null;
  },
): DeviceContact {
  return {
    id,
    displayName: displayNameFromDetail(detail),
    companyName: detail.company?.trim() || null,
    phone: pickPrimaryPhone(detail.phones),
    email: pickPrimaryEmail(detail.emails),
    imageUri: detail.thumbnail || detail.image || null,
  };
}

/** iOS 18+ limited-access picker when the user only shared some contacts. */
export async function presentLimitedAccessPicker(): Promise<DeviceContact[]> {
  if (typeof Contact.presentAccessPicker !== 'function') return [];
  const picked = await Contact.presentAccessPicker();
  const out: DeviceContact[] = [];
  for (const c of picked) {
    const details = await c.getDetails([...DEVICE_CONTACT_FIELDS]);
    out.push(mapDetailsToDeviceContact(c.id, details));
  }
  return out;
}
