export const BASE_CURRENCY = "LKR";

/**
 * App currency catalog. `code` is what we store on documents.
 * China uses RMB (not ISO CNY) — open.er-api still keys rates as CNY; see API_CODE_ALIASES.
 */
export const SUPPORTED_CURRENCIES = [
  { code: "LKR", label: "Sri Lankan Rupee", symbol: "Rs" },
  { code: "RMB", label: "Chinese Renminbi", symbol: "¥" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$" },
  { code: "TZS", label: "Tanzanian Shilling", symbol: "TSh" },
  { code: "MGA", label: "Malagasy Ariary", symbol: "Ar" },
  { code: "IDR", label: "Indonesian Rupiah", symbol: "Rp" },
  { code: "AED", label: "UAE Dirham", symbol: "د.إ" },
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "THB", label: "Thai Baht", symbol: "฿" },
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
