/** Normalize Sri Lankan and international numbers to E.164 for Firebase Phone Auth. */
export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return phone.trim();

  if (digits.startsWith('94')) return `+${digits}`;
  if (digits.startsWith('0')) return `+94${digits.slice(1)}`;
  if (phone.trim().startsWith('+')) return `+${digits}`;
  return `+${digits}`;
}
