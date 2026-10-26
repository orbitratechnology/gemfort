import { normalizePhoneNumber, normalizePhoneForStorage } from '../phone-utils';

describe('normalizePhoneNumber', () => {
  it('handles empty input', () => {
    expect(normalizePhoneNumber('')).toBe('');
    expect(normalizePhoneNumber('   ')).toBe('');
  });

  it('handles Sri Lankan numbers with country code', () => {
    expect(normalizePhoneNumber('+94771234567')).toBe('+94771234567');
    expect(normalizePhoneNumber('94771234567')).toBe('+94771234567');
  });

  it('handles Sri Lankan numbers with leading zero', () => {
    expect(normalizePhoneNumber('0771234567')).toBe('+94771234567');
    expect(normalizePhoneNumber('0711234567')).toBe('+94711234567');
  });

  it('handles bare Sri Lankan mobile numbers', () => {
    expect(normalizePhoneNumber('771234567')).toBe('+94771234567');
    expect(normalizePhoneNumber('711234567')).toBe('+94711234567');
  });

  it('handles trunk prefix bug (9407...)', () => {
    expect(normalizePhoneNumber('940771234567')).toBe('+94771234567');
  });

  it('adds + to international numbers', () => {
    expect(normalizePhoneNumber('11234567890')).toBe('+11234567890');
  });
});

describe('normalizePhoneForStorage', () => {
  it('returns null for null/undefined', () => {
    expect(normalizePhoneForStorage(null)).toBe(null);
    expect(normalizePhoneForStorage(undefined)).toBe(null);
  });

  it('returns null for empty/whitespace', () => {
    expect(normalizePhoneForStorage('')).toBe(null);
    expect(normalizePhoneForStorage('   ')).toBe(null);
  });

  it('normalizes valid numbers', () => {
    expect(normalizePhoneForStorage('0771234567')).toBe('+94771234567');
    expect(normalizePhoneForStorage('+94771234567')).toBe('+94771234567');
  });
});
