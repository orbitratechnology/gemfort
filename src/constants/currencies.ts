export const BASE_CURRENCY = 'LKR';

export const SUPPORTED_CURRENCIES = [
  { code: 'LKR', label: 'Sri Lankan Rupee', symbol: 'Rs' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'THB', label: 'Thai Baht', symbol: '฿' },
  { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'CNY', label: 'Chinese Yuan', symbol: '¥' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]['code'];

/** Popular codes shown first in the currency picker (phone-field style). */
export const POPULAR_CURRENCY_CODES: CurrencyCode[] = [
  'LKR',
  'USD',
  'EUR',
  'GBP',
  'THB',
  'AED',
];

export function getCurrencyLabel(code: string): string {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.label ?? code;
}

export function getCurrencySymbol(code: string): string {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return SUPPORTED_CURRENCIES.some((c) => c.code === value);
}

export function resolveCurrencyCode(
  value: string | null | undefined,
  fallback: CurrencyCode = BASE_CURRENCY,
): CurrencyCode {
  if (value && isCurrencyCode(value)) return value;
  return fallback;
}
