export const BASE_CURRENCY = 'LKR';

export const SUPPORTED_CURRENCIES = [
  { code: 'LKR', label: 'Sri Lankan Rupee' },
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'THB', label: 'Thai Baht' },
  { code: 'CNY', label: 'Chinese Yuan' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'SGD', label: 'Singapore Dollar' },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]['code'];

export function getCurrencyLabel(code: string): string {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.label ?? code;
}
