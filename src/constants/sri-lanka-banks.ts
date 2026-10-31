/**
 * Static Sri Lankan bank list for app-wide selection.
 *
 * Bank codes & names sourced from:
 * - https://github.com/samma89/Sri-Lanka-Bank-and-Branch-List (banks.json)
 * - https://ceylonexchange.com.au/bank-codes-for-sri-lankan-banks/
 *
 * Logos are bundled per bank code in `bank-logos.ts`.
 */

export type SriLankaBank = {
  /** CEFTS / LankaClear bank code */
  code: string;
  name: string;
  /** Short label for chips / compact UI */
  shortName: string;
};

/** Primary retail / finance institutions used in GemFort pickers. */
export const SRI_LANKA_BANKS: readonly SriLankaBank[] = [
  { code: '7010', name: 'Bank of Ceylon', shortName: 'BOC' },
  { code: '7038', name: 'Standard Chartered Bank', shortName: 'SCB' },
  { code: '7047', name: 'Citi Bank', shortName: 'Citi' },
  { code: '7056', name: 'Commercial Bank PLC', shortName: 'ComBank' },
  { code: '7074', name: 'Habib Bank Ltd', shortName: 'HBL' },
  { code: '7083', name: 'Hatton National Bank PLC', shortName: 'HNB' },
  { code: '7092', name: 'Hongkong Shanghai Bank', shortName: 'HSBC' },
  { code: '7108', name: 'Indian Bank', shortName: 'Indian Bank' },
  { code: '7117', name: 'Indian Overseas Bank', shortName: 'IOB' },
  { code: '7135', name: 'Peoples Bank', shortName: 'People\'s' },
  { code: '7144', name: 'State Bank of India', shortName: 'SBI' },
  { code: '7162', name: 'Nations Trust Bank PLC', shortName: 'NTB' },
  { code: '7205', name: 'Deutsche Bank', shortName: 'DB' },
  { code: '7214', name: 'National Development Bank PLC', shortName: 'NDB' },
  { code: '7269', name: 'MCB Bank Ltd', shortName: 'MCB' },
  { code: '7278', name: 'Sampath Bank PLC', shortName: 'Sampath' },
  { code: '7287', name: 'Seylan Bank PLC', shortName: 'Seylan' },
  { code: '7296', name: 'Public Bank', shortName: 'Public Bank' },
  { code: '7302', name: 'Union Bank of Colombo PLC', shortName: 'Union Bank' },
  {
    code: '7311',
    name: 'Pan Asia Banking Corporation PLC',
    shortName: 'PABC',
  },
  { code: '7384', name: 'ICICI Bank Ltd', shortName: 'ICICI' },
  { code: '7454', name: 'DFCC Bank PLC', shortName: 'DFCC' },
  { code: '7463', name: 'Amana Bank PLC', shortName: 'Amana' },
  { code: '7472', name: 'Axis Bank', shortName: 'Axis' },
  { code: '7481', name: 'Cargills Bank Limited', shortName: 'Cargills' },
  { code: '7719', name: 'National Savings Bank', shortName: 'NSB' },
  { code: '7728', name: 'Sanasa Development Bank', shortName: 'SDB' },
  { code: '7737', name: 'HDFC Bank', shortName: 'HDFC' },
  {
    code: '7746',
    name: 'Citizen Development Business Finance PLC',
    shortName: 'CDB',
  },
  { code: '7755', name: 'Regional Development Bank', shortName: 'RDB' },
  {
    code: '7764',
    name: 'State Mortgage & Investment Bank',
    shortName: 'SMIB',
  },
  { code: '7773', name: 'LB Finance PLC', shortName: 'LB Finance' },
  {
    code: '7782',
    name: 'Senkadagala Finance PLC',
    shortName: 'Senkadagala',
  },
  {
    code: '7807',
    name: 'Commercial Leasing and Finance',
    shortName: 'CLC',
  },
  { code: '7816', name: 'Vallibel Finance PLC', shortName: 'Vallibel' },
  { code: '7825', name: 'Central Finance PLC', shortName: 'CF' },
  { code: '7834', name: 'Kanrich Finance Limited', shortName: 'Kanrich' },
  { code: '7852', name: 'Alliance Finance Company PLC', shortName: 'Alliance' },
  { code: '7861', name: 'LOLC Finance PLC', shortName: 'LOLC' },
  {
    code: '7870',
    name: 'Commercial Credit & Finance PLC',
    shortName: 'CCF',
  },
  {
    code: '7898',
    name: 'Merchant Bank of Sri Lanka & Finance PLC',
    shortName: 'MBSL',
  },
  {
    code: '7904',
    name: 'HNB Grameen Finance Limited',
    shortName: 'HNB Grameen',
  },
  {
    code: '7913',
    name: 'Mercantile Investment and Finance PLC',
    shortName: 'MI',
  },
  {
    code: '7922',
    name: "People's Leasing & Finance PLC",
    shortName: 'PLC',
  },
  {
    code: '8004',
    name: 'Central Bank of Sri Lanka',
    shortName: 'CBSL',
  },
] as const;

export function getBankByCode(code: string | null | undefined): SriLankaBank | undefined {
  if (!code) return undefined;
  return SRI_LANKA_BANKS.find((b) => b.code === code);
}

export function getBankByName(name: string | null | undefined): SriLankaBank | undefined {
  if (!name?.trim()) return undefined;
  const q = name.trim().toLowerCase();
  return (
    SRI_LANKA_BANKS.find((b) => b.name.toLowerCase() === q) ??
    SRI_LANKA_BANKS.find((b) => b.shortName.toLowerCase() === q) ??
    SRI_LANKA_BANKS.find((b) => b.name.toLowerCase().includes(q) || q.includes(b.shortName.toLowerCase()))
  );
}

export function filterBanks(query: string): SriLankaBank[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...SRI_LANKA_BANKS];
  return SRI_LANKA_BANKS.filter(
    (b) =>
      b.name.toLowerCase().includes(q) ||
      b.shortName.toLowerCase().includes(q) ||
      b.code.includes(q),
  );
}
