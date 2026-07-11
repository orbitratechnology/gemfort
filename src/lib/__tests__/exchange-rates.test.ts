import { convertToBaseSync } from '@/lib/exchange-rates';

describe('convertToBaseSync', () => {
  const rates = { LKR: 1, USD: 300, EUR: 320 };

  it('returns same amount for base currency', () => {
    expect(convertToBaseSync(1000, 'LKR', rates)).toBe(1000);
  });

  it('converts using provided rates', () => {
    expect(convertToBaseSync(2, 'USD', rates)).toBe(600);
  });

  it('falls back to amount when rate missing', () => {
    expect(convertToBaseSync(5, 'THB', rates)).toBe(5);
  });
});
