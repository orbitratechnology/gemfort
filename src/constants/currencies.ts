export const BASE_CURRENCY = "LKR";

/**
 * App currency catalog. `code` is what we store on documents.
 * China uses RMB (not ISO CNY) — open.er-api still keys rates as CNY; see API_CODE_ALIASES.
 * `countryCode` is ISO 3166-1 alpha-2 (or `eu`) for flagcdn.
 */
export const SUPPORTED_CURRENCIES = [
  { code: "LKR", label: "Sri Lankan Rupee", symbol: "Rs", countryCode: "lk" },
  { code: "RMB", label: "Chinese Renminbi", symbol: "¥", countryCode: "cn" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$", countryCode: "au" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$", countryCode: "sg" },
  { code: "TZS", label: "Tanzanian Shilling", symbol: "TSh", countryCode: "tz" },
  { code: "MGA", label: "Malagasy Ariary", symbol: "Ar", countryCode: "mg" },
  { code: "IDR", label: "Indonesian Rupiah", symbol: "Rp", countryCode: "id" },
  { code: "AED", label: "UAE Dirham", symbol: "د.إ", countryCode: "ae" },
  { code: "USD", label: "US Dollar", symbol: "$", countryCode: "us" },
  { code: "EUR", label: "Euro", symbol: "€", countryCode: "eu" },
  { code: "GBP", label: "British Pound", symbol: "£", countryCode: "gb" },
  { code: "THB", label: "Thai Baht", symbol: "฿", countryCode: "th" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

/** Legacy / ISO aliases → app currency code */
const CODE_ALIASES: Record<string, CurrencyCode> = {
  CNY: "RMB",
  CNH: "RMB",
};

/**
 * Provider quote key for each app code (open.er-api uses ISO 4217).
 * Only list when it differs from the app `code`.
 */
export const API_CODE_ALIASES: Partial<Record<CurrencyCode, string>> = {
  RMB: "CNY",
};

/** Popular codes shown first in the currency picker (phone-field style). */
export const POPULAR_CURRENCY_CODES: CurrencyCode[] = [
  "LKR",
  "USD",
  "EUR",
  "GBP",
  "THB",
  "AED",
  "RMB",
];

export function getCurrencyLabel(code: string): string {
  const resolved = resolveCurrencyCode(code, BASE_CURRENCY);
  return SUPPORTED_CURRENCIES.find((c) => c.code === resolved)?.label ?? code;
}

export function getCurrencySymbol(code: string): string {
  const resolved = resolveCurrencyCode(code, BASE_CURRENCY);
  return SUPPORTED_CURRENCIES.find((c) => c.code === resolved)?.symbol ?? code;
}

/** Compact badge text, e.g. "¥ RMB" / "Rs LKR". */
export function getCurrencyBadge(code: string): string {
  const resolved = resolveCurrencyCode(code, BASE_CURRENCY);
  const symbol = getCurrencySymbol(resolved);
  return `${symbol} ${resolved}`;
}

/** ISO country / region code for the currency's flag (flagcdn). */
export function getCurrencyCountryCode(code: string): string | null {
  const resolved = resolveCurrencyCode(code, BASE_CURRENCY);
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code === resolved)?.countryCode ?? null
  );
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  if (SUPPORTED_CURRENCIES.some((c) => c.code === value)) return true;
  return value in CODE_ALIASES;
}

export function resolveCurrencyCode(
  value: string | null | undefined,
  fallback: CurrencyCode = BASE_CURRENCY,
): CurrencyCode {
  if (!value) return fallback;
  if (SUPPORTED_CURRENCIES.some((c) => c.code === value)) {
    return value as CurrencyCode;
  }
  const aliased = CODE_ALIASES[value];
  if (aliased) return aliased;
  return fallback;
}

/** ISO / provider key to read from an FX payload. */
export function getApiCurrencyCode(code: CurrencyCode): string {
  return API_CODE_ALIASES[code] ?? code;
}
