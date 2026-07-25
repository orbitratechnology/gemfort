import {
  normalizePhoneForStorage,
  normalizePhoneNumber,
} from '@/lib/firebase/phone-utils';

describe('normalizePhoneNumber', () => {
  it('keeps E.164 with country code 94', () => {
    expect(normalizePhoneNumber('+94771234567')).toBe('+94771234567');
    expect(normalizePhoneNumber('94771234567')).toBe('+94771234567');
  });

  it('converts local 0-prefix Sri Lankan numbers', () => {
    expect(normalizePhoneNumber('0771234567')).toBe('+94771234567');
    expect(normalizePhoneNumber('077 035 5887')).toBe('+94770355887');
  });

  it('strips trunk 0 after country code (+9407…)', () => {
    expect(normalizePhoneNumber('+940729067749')).toBe('+94729067749');
    expect(normalizePhoneNumber('940729067749')).toBe('+94729067749');
  });

  it('treats bare 9-digit SL mobiles as +94', () => {
    expect(normalizePhoneNumber('771234567')).toBe('+94771234567');
  });

  it('strips spaces and punctuation', () => {
    expect(normalizePhoneNumber('+94 77 123 4567')).toBe('+94771234567');
  });

  it('returns empty string when empty digits', () => {
    expect(normalizePhoneNumber('   ')).toBe('');
  });
});

describe('normalizePhoneForStorage', () => {
  it('returns null for empty values', () => {
    expect(normalizePhoneForStorage(null)).toBeNull();
    expect(normalizePhoneForStorage(undefined)).toBeNull();
    expect(normalizePhoneForStorage('')).toBeNull();
    expect(normalizePhoneForStorage('   ')).toBeNull();
  });

  it('returns E.164 for valid phones', () => {
    expect(normalizePhoneForStorage('0769067749')).toBe('+94769067749');
  });
});
