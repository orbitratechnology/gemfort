/**
 * Normalize Sri Lankan and international numbers to E.164 for storage,
 * Firebase Phone Auth, and WhatsApp deep links.
 */
export function normalizePhoneNumber(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return '';

  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  // Fix +9407… / 9407… (country code + leftover national trunk 0)
  if (digits.startsWith('940') && digits.length >= 11) {
    digits = `94${digits.slice(3)}`;
  }

  if (digits.startsWith('94')) return `+${digits}`;
  if (digits.startsWith('0')) return `+94${digits.slice(1)}`;
  // Bare SL mobile (7xxxxxxxx)
  if (digits.length === 9 && digits.startsWith('7')) return `+94${digits}`;
  if (trimmed.startsWith('+')) return `+${digits}`;
  return `+${digits}`;
}

/** Normalize for storage; empty / whitespace → null. */
export function normalizePhoneForStorage(
  phone: string | null | undefined,
): string | null {
  if (phone == null) return null;
  const normalized = normalizePhoneNumber(phone);
  return normalized || null;
}
