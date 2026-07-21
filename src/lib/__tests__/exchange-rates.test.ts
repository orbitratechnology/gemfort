import {
  convertFromBaseSync,
  convertToBaseSync,
  lkrPerUnit,
} from '@/lib/exchange-rates';

describe('exchange-rates', () => {
  // open.er-api shape: foreign units per 1 LKR
  const rates = { LKR: 1, USD: 0.003, EUR: 0.0025, GBP: 0.002 };

  describe('convertToBaseSync', () => {
    it('returns same amount for base currency', () => {
      expect(convertToBaseSync(1000, 'LKR', rates)).toBe(1000);
    });

    it('converts foreign face amount to LKR', () => {
      // 3 USD * (1/0.003) = 1000 LKR
      expect(convertToBaseSync(3, 'USD', rates)).toBe(1000);
    });

    it('throws when rate missing', () => {
      expect(() => convertToBaseSync(5, 'THB', rates)).toThrow(
        /Missing exchange rate/,
      );
    });
  });

  describe('convertFromBaseSync', () => {
    it('returns same amount for base currency', () => {
      expect(convertFromBaseSync(1000, 'LKR', rates)).toBe(1000);
    });

    it('converts LKR to foreign', () => {
      expect(convertFromBaseSync(1000, 'USD', rates)).toBe(3);
    });
  });

  describe('lkrPerUnit', () => {
    it('returns 1 for LKR', () => {
      expect(lkrPerUnit('LKR', rates)).toBe(1);
    });

    it('inverts foreign-per-LKR rate', () => {
      expect(lkrPerUnit('USD', rates)).toBeCloseTo(1 / 0.003);
    });
  });
});
