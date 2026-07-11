import { normalizePhoneNumber } from '@/lib/firebase/phone-utils';

describe('normalizePhoneNumber', () => {
  it('keeps E.164 with country code 94', () => {
    expect(normalizePhoneNumber('+94771234567')).toBe('+94771234567');
    expect(normalizePhoneNumber('94771234567')).toBe('+94771234567');
  });

  it('converts local 0-prefix Sri Lankan numbers', () => {
    expect(normalizePhoneNumber('0771234567')).toBe('+94771234567');
  });

  it('strips spaces and punctuation', () => {
    expect(normalizePhoneNumber('+94 77 123 4567')).toBe('+94771234567');
  });

  it('returns trimmed original when empty digits', () => {
    expect(normalizePhoneNumber('   ')).toBe('');
  });
});
