import { calcWeightLossPercent } from '@/lib/utils';

/** Mirrors marketplace-service fetchBusinesses ranking (featured → verified → name). */
function rankBusinesses<T extends { isFeatured?: boolean; badges?: { isVerified?: boolean }; businessName: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;
    if (a.badges?.isVerified && !b.badges?.isVerified) return -1;
    if (!a.badges?.isVerified && b.badges?.isVerified) return 1;
    return a.businessName.localeCompare(b.businessName);
  });
}

describe('directory ranking', () => {
  it('puts featured before verified-only before unverified, then A–Z', () => {
    const ranked = rankBusinesses([
      { businessName: 'Zebra Gems', badges: { isVerified: true } },
      { businessName: 'Alpha Unverified', badges: { isVerified: false } },
      { businessName: 'Featured House', isFeatured: true, badges: { isVerified: true } },
      { businessName: 'Beta Verified', badges: { isVerified: true } },
    ]);
    expect(ranked.map((b) => b.businessName)).toEqual([
      'Featured House',
      'Beta Verified',
      'Zebra Gems',
      'Alpha Unverified',
    ]);
  });
});

describe('calcWeightLossPercent', () => {
  it('computes cutting loss from before/after carat', () => {
    expect(calcWeightLossPercent(3.2, 2.8)).toBe(12.5);
  });
});
