/**
 * Static Sri Lankan bank directory for app-wide selection.
 *
 * Bank codes & names sourced from:
 * - https://github.com/samma89/Sri-Lanka-Bank-and-Branch-List (banks.json)
 * - https://ceylonexchange.com.au/bank-codes-for-sri-lankan-banks/
 *
 * Logos: optional public website domain → Clearbit / Google favicon (graceful fallback).
 */

export type SriLankaBank = {
  /** CEFTS / LankaClear bank code */
  code: string;
  name: string;
  /** Short label for chips / compact UI */
  shortName: string;
  /** Public website host for logo favicon lookup */
  domain?: string;
};

/** Primary retail / finance institutions used in GemFort pickers. */
export const SRI_LANKA_BANKS: readonly SriLankaBank[] = [
  { code: '7010', name: 'Bank of Ceylon', shortName: 'BOC', domain: 'boc.lk' },
  { code: '7038', name: 'Standard Chartered Bank', shortName: 'SCB', domain: 'sc.com' },
  { code: '7047', name: 'Citi Bank', shortName: 'Citi', domain: 'citigroup.com' },
  { code: '7056', name: 'Commercial Bank PLC', shortName: 'ComBank', domain: 'combank.net' },
  { code: '7074', name: 'Habib Bank Ltd', shortName: 'HBL', domain: 'hbl.com' },
  { code: '7083', name: 'Hatton National Bank PLC', shortName: 'HNB', domain: 'hnb.net' },
  { code: '7092', name: 'Hongkong Shanghai Bank', shortName: 'HSBC', domain: 'hsbc.lk' },
  { code: '7108', name: 'Indian Bank', shortName: 'Indian Bank', domain: 'indianbank.in' },
  { code: '7117', name: 'Indian Overseas Bank', shortName: 'IOB', domain: 'iob.in' },
  { code: '7135', name: 'Peoples Bank', shortName: 'People\'s', domain: 'peoplesbank.lk' },
  { code: '7144', name: 'State Bank of India', shortName: 'SBI', domain: 'sbi.co.in' },
  { code: '7162', name: 'Nations Trust Bank PLC', shortName: 'NTB', domain: 'nationstrust.com' },
  { code: '7205', name: 'Deutsche Bank', shortName: 'DB', domain: 'db.com' },
  { code: '7214', name: 'National Development Bank PLC', shortName: 'NDB', domain: 'ndbbank.com' },
  { code: '7269', name: 'MCB Bank Ltd', shortName: 'MCB', domain: 'mcb.com.pk' },
  { code: '7278', name: 'Sampath Bank PLC', shortName: 'Sampath', domain: 'sampath.lk' },
  { code: '7287', name: 'Seylan Bank PLC', shortName: 'Seylan', domain: 'seylan.lk' },
  { code: '7296', name: 'Public Bank', shortName: 'Public Bank', domain: 'publicbank.com.my' },
  { code: '7302', name: 'Union Bank of Colombo PLC', shortName: 'Union Bank', domain: 'unionb.com' },
  {
    code: '7311',
    name: 'Pan Asia Banking Corporation PLC',
    shortName: 'PABC',
    domain: 'pabcobank.com',
  },
  { code: '7384', name: 'ICICI Bank Ltd', shortName: 'ICICI', domain: 'icicibank.com' },
  { code: '7454', name: 'DFCC Bank PLC', shortName: 'DFCC', domain: 'dfcc.lk' },
  { code: '7463', name: 'Amana Bank PLC', shortName: 'Amana', domain: 'amanabank.lk' },
  { code: '7472', name: 'Axis Bank', shortName: 'Axis', domain: 'axisbank.com' },
  { code: '7481', name: 'Cargills Bank Limited', shortName: 'Cargills', domain: 'cargillsbank.com' },
  { code: '7719', name: 'National Savings Bank', shortName: 'NSB', domain: 'nsb.lk' },
  { code: '7728', name: 'Sanasa Development Bank', shortName: 'SDB', domain: 'sdb.lk' },
  { code: '7737', name: 'HDFC Bank', shortName: 'HDFC', domain: 'hdfc.lk' },
  {
    code: '7746',
    name: 'Citizen Development Business Finance PLC',
    shortName: 'CDB',
    domain: 'cdb.lk',
  },
  { code: '7755', name: 'Regional Development Bank', shortName: 'RDB', domain: 'rdb.lk' },
  {
    code: '7764',
    name: 'State Mortgage & Investment Bank',
    shortName: 'SMIB',
    domain: 'smib.lk',
  },
  { code: '7773', name: 'LB Finance PLC', shortName: 'LB Finance', domain: 'lbfinance.lk' },
  {
    code: '7782',
    name: 'Senkadagala Finance PLC',
    shortName: 'Senkadagala',
    domain: 'senfin.com',
  },
  {
    code: '7807',
    name: 'Commercial Leasing and Finance',
    shortName: 'CLC',
    domain: 'clc.lk',
  },
  { code: '7816', name: 'Vallibel Finance PLC', shortName: 'Vallibel', domain: 'vallibelfinance.com' },
  { code: '7825', name: 'Central Finance PLC', shortName: 'CF', domain: 'cf.lk' },
  { code: '7834', name: 'Kanrich Finance Limited', shortName: 'Kanrich' },
  { code: '7852', name: 'Alliance Finance Company PLC', shortName: 'Alliance', domain: 'alliancefinance.lk' },
  { code: '7861', name: 'LOLC Finance PLC', shortName: 'LOLC', domain: 'lolcfinance.lk' },
  {
    code: '7870',
    name: 'Commercial Credit & Finance PLC',
    shortName: 'CCF',
    domain: 'comcredit.lk',
  },
  {
    code: '7898',
    name: 'Merchant Bank of Sri Lanka & Finance PLC',
    shortName: 'MBSL',
    domain: 'mbslbank.com',
  },
  {
    code: '7904',
    name: 'HNB Grameen Finance Limited',
    shortName: 'HNB Grameen',
    domain: 'hnb.net',
  },
  {
    code: '7913',
    name: 'Mercantile Investment and Finance PLC',
    shortName: 'MI',
    domain: 'mi.com.lk',
  },
  {
    code: '7922',
    name: "People's Leasing & Finance PLC",
    shortName: 'PLC',
    domain: 'plc.lk',
  },
  {
    code: '8004',
    name: 'Central Bank of Sri Lanka',
    shortName: 'CBSL',
    domain: 'cbsl.gov.lk',
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

/** Logo URLs when a domain is known (try in order; UI falls back to initials). */
export function bankLogoUrls(bank: SriLankaBank, size = 128): string[] {
  if (!bank.domain) return [];
  const host = encodeURIComponent(bank.domain);
  return [
    `https://icons.duckduckgo.com/ip3/${bank.domain}.ico`,
    `https://www.google.com/s2/favicons?domain=${host}&sz=${size}`,
  ];
}

/** @deprecated Prefer bankLogoUrls — single URL for simple call sites. */
export function bankLogoUrl(bank: SriLankaBank, size = 128): string | null {
  return bankLogoUrls(bank, size)[0] ?? null;
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
