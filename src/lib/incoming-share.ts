import type { ResolvedSharePayload, SharePayload } from 'expo-sharing';

/**
 * Helpers for inbound share-to-app (expo-sharing → handle-share → add forms).
 * Collections already exist: gemtrack_cheques, gemtrack_bills, gemtrack_contacts.
 */

export type ParsedShareText = {
  raw: string;
  phone: string | null;
  email: string | null;
  /** Digits-only amount string suitable for form fields (e.g. "15000.50"). */
  amount: string | null;
  displayName: string | null;
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
/** Sri Lanka / intl phone fragments */
const PHONE_RE =
  /(?:\+?94|0)?[\s.-]?(?:7\d{8}|11\d{7}|\d{9,12})|(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,6}/;
const AMOUNT_RE =
  /(?:(?:lkr|rs\.?|usd|\$|€)\s*)?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i;

function cleanPhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('94') && digits.length >= 11) return `+${digits}`;
  if (digits.startsWith('0') && digits.length >= 10) return digits;
  return digits;
}

function looksLikeName(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 60) return false;
  if (EMAIL_RE.test(t) || PHONE_RE.test(t) || AMOUNT_RE.test(t)) return false;
  if (/https?:\/\//i.test(t)) return false;
  // Letters (incl. Latin accents), spaces, common name punctuation
  return (
    /^[A-Za-z\u00C0-\u024F\s.'’&\-]+$/.test(t) &&
    /[A-Za-z\u00C0-\u024F]{2}/.test(t)
  );
}

/** Pull contact/money hints from shared plain text (WhatsApp, Notes, SMS). */
export function parseSharedText(text: string): ParsedShareText {
  const raw = text.trim();
  if (!raw) {
    return { raw: '', phone: null, email: null, amount: null, displayName: null };
  }

  const emailMatch = raw.match(EMAIL_RE);
  const phoneMatch = raw.match(PHONE_RE);
  const amountMatch = raw.match(AMOUNT_RE);

  let displayName: string | null = null;
  const firstLine = raw.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
  if (firstLine && looksLikeName(firstLine)) {
    displayName = firstLine;
  } else {
    // "Name: Foo" / "Contact: Foo"
    const labeled = raw.match(
      /(?:name|contact|from|to)\s*[:\-–]\s*([^\n,;]{2,60})/i,
    );
    if (labeled?.[1] && looksLikeName(labeled[1])) {
      displayName = labeled[1].trim();
    }
  }

  return {
    raw,
    phone: phoneMatch ? cleanPhone(phoneMatch[0]) : null,
    email: emailMatch?.[0] ?? null,
    amount: amountMatch?.[1]?.replace(/,/g, '') ?? null,
    displayName,
  };
}

export function collectShareTexts(
  resolved: ResolvedSharePayload[],
  raw: SharePayload[],
): string {
  const fromResolved = resolved
    .filter((p) => p.contentType === 'text' || p.shareType === 'text')
    .map((p) => ('value' in p ? String(p.value ?? '') : ''))
    .filter(Boolean);

  const fromRaw = raw
    .filter((p) => (p.shareType ?? 'text') === 'text' || p.shareType === 'url')
    .map((p) => p.value?.trim() ?? '')
    .filter(Boolean);

  const urls = resolved
    .filter((p) => p.shareType === 'url' || p.contentType === 'website')
    .map((p) => p.value || p.contentUri || '')
    .filter(Boolean);

  return [...new Set([...fromResolved, ...fromRaw, ...urls])]
    .join('\n')
    .trim();
}

export function collectImageUris(resolved: ResolvedSharePayload[]): string[] {
  return resolved
    .filter((p) => p.contentType === 'image' && p.contentUri)
    .map((p) => p.contentUri!)
    .filter(Boolean);
}

export function collectFileUris(resolved: ResolvedSharePayload[]): {
  uri: string;
  name: string | null;
  mimeType: string | null;
}[] {
  return resolved
    .filter(
      (p) =>
        p.contentUri &&
        (p.contentType === 'file' ||
          p.contentMimeType?.includes('pdf') ||
          p.contentType === 'website'),
    )
    .map((p) => ({
      uri: p.contentUri!,
      name: p.originalName,
      mimeType: p.contentMimeType,
    }));
}

/** Encode params safely for expo-router (avoid oversized JSON in query). */
export function encodeShareParam(value: string): string {
  return encodeURIComponent(value);
}

export function decodeShareParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) value = value[0];
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
