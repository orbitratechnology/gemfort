/**
 * Money, number-word and date readers shared by the document parsers. All
 * pure functions over OCR text, tolerant of the usual OCR slips.
 */

import { isValid } from 'date-fns';

import type { CurrencyCode } from '@/constants/currencies';

// ─── Money in figures ──────────────────────────────────────────────────────

export type MoneyCandidate = {
  value: number;
  raw: string;
  currency: CurrencyCode | null;
  hasDecimals: boolean;
  hasGrouping: boolean;
  /** Sri Lankan "/=" or "/-" after the figure. */
  hasSuffix: boolean;
  index: number;
};

const CURRENCY_MARKERS: { pattern: RegExp; code: CurrencyCode }[] = [
  { pattern: /^(?:rs|lkr|slr)$/i, code: 'LKR' },
  { pattern: /^(?:usd|us\$|\$)$/i, code: 'USD' },
  { pattern: /^(?:eur|€)$/i, code: 'EUR' },
  { pattern: /^(?:gbp|£)$/i, code: 'GBP' },
  { pattern: /^(?:aud|a\$)$/i, code: 'AUD' },
  { pattern: /^(?:sgd|s\$)$/i, code: 'SGD' },
  { pattern: /^(?:aed)$/i, code: 'AED' },
  { pattern: /^(?:thb|฿)$/i, code: 'THB' },
  { pattern: /^(?:rmb|cny|¥)$/i, code: 'RMB' },
  { pattern: /^(?:idr|rp)$/i, code: 'IDR' },
  { pattern: /^(?:tzs|tsh)$/i, code: 'TZS' },
  { pattern: /^(?:mga)$/i, code: 'MGA' },
];

export function currencyFromMarker(marker: string | undefined): CurrencyCode | null {
  if (!marker) return null;
  const m = marker.replace(/\.$/, '');
  return CURRENCY_MARKERS.find((c) => c.pattern.test(m))?.code ?? null;
}

/** Fix letters OCR commonly confuses with digits, only inside numeric runs. */
export function normalizeDigits(text: string): string {
  return text.replace(/[\dOoIl|,.]+/g, (run) =>
    /\d/.test(run) ? run.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1') : run,
  );
}

const MONEY_RE =
  /(rs\.?|lkr|slr|usd|us\$|eur|gbp|aud|sgd|aed|thb|rmb|cny|idr|tzs|mga|[$€£¥฿])?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(\s*\/\s*[=\-]|\s*=)?/gi;

/** Every figure in `text` that could be an amount of money. */
export function findMoney(text: string): MoneyCandidate[] {
  const normalized = normalizeDigits(text);
  const out: MoneyCandidate[] = [];
  for (const m of normalized.matchAll(MONEY_RE)) {
    const digits = m[2];
    // Skip digits glued to letters (codes like "INV2041", "A12").
    const before = normalized[m.index! + m[0].indexOf(digits) - 1];
    if (before && /[a-z]/i.test(before) && !m[1]) continue;
    const value = Number(digits.replace(/,/g, ''));
    if (!Number.isFinite(value) || value <= 0) continue;
    out.push({
      value,
      raw: m[0].trim(),
      currency: currencyFromMarker(m[1]),
      hasDecimals: /\.\d{1,2}$/.test(digits),
      hasGrouping: digits.includes(','),
      hasSuffix: !!m[3],
      index: m.index!,
    });
  }
  return out;
}

// ─── Money in words ────────────────────────────────────────────────────────

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = {
  thousand: 1_000, lakh: 100_000, lakhs: 100_000, lac: 100_000, lacs: 100_000,
  million: 1_000_000, millions: 1_000_000, crore: 10_000_000, billion: 1_000_000_000,
};
/** Common misspellings on handwritten cheques. */
const ALIASES: Record<string, string> = {
  fourty: 'forty', ninty: 'ninety', nineth: 'nine', twelth: 'twelve', thousands: 'thousand',
  hundreds: 'hundred', laks: 'lakh', lakhs: 'lakhs', lakshs: 'lakhs', millon: 'million',
};
const FILLER = new Set(['and', 'rupees', 'rupee', 'rs', 'only', 'cents', 'cent', 'lkr', 'sri', 'lankan', 'of', 'the']);
const VOCAB = [...Object.keys(UNITS), ...Object.keys(SCALES), 'hundred'];

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Closest number word, allowing small OCR / spelling errors. */
function numberWord(token: string): string | null {
  if (UNITS[token] !== undefined || SCALES[token] || token === 'hundred') return token;
  if (ALIASES[token]) return ALIASES[token];
  if (token.length < 4) return null;
  const allowed = token.length >= 7 ? 2 : 1;
  let best: string | null = null;
  let bestDist = allowed + 1;
  for (const word of VOCAB) {
    const d = editDistance(token, word);
    if (d < bestDist) {
      best = word;
      bestDist = d;
    }
  }
  return best;
}

export type WordsReading = { value: number; numberWords: number; tokens: number };

/**
 * Read an amount written in words ("Rupees One Lakh Twenty Five Thousand
 * and Cents Fifty Only"). Returns null when no number words are present.
 */
export function wordsToAmount(text: string): WordsReading | null {
  const tokens = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  let total = 0;
  let current = 0;
  let cents = 0;
  let inCents = false;
  let numberWords = 0;

  for (const raw of tokens) {
    if (raw === 'cents' || raw === 'cent') {
      total += current;
      current = 0;
      inCents = true;
      continue;
    }
    if (FILLER.has(raw)) continue;
    const word = numberWord(raw);
    if (!word) continue;
    numberWords += 1;
    if (UNITS[word] !== undefined) {
      if (inCents) cents += UNITS[word];
      else current += UNITS[word];
    } else if (word === 'hundred') {
      current = (current || 1) * 100;
    } else if (SCALES[word]) {
      total += (current || 1) * SCALES[word];
      current = 0;
    }
  }
  if (numberWords === 0) return null;
  const value = total + current + (cents > 0 && cents < 100 ? cents / 100 : 0);
  return value > 0 ? { value, numberWords, tokens: tokens.length } : null;
}

/** True when most words in `text` are number words or amount filler. */
export function looksLikeAmountWords(text: string): boolean {
  const tokens = text.toLowerCase().split(/[^a-z]+/).filter((t) => t.length > 1);
  if (tokens.length === 0) return false;
  const hits = tokens.filter((t) => FILLER.has(t) || numberWord(t)).length;
  return tokens.some((t) => numberWord(t)) && hits / tokens.length >= 0.6;
}

// ─── Dates ─────────────────────────────────────────────────────────────────

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function makeDate(year: number, month: number, day: number): Date | null {
  const y = year < 100 ? 2000 + year : year;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(y, month - 1, day);
  if (!isValid(d) || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

function monthIndex(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
}

export type DateWindow = { from: Date; to: Date };

function inWindow(d: Date, w: DateWindow): boolean {
  return d >= w.from && d <= w.to;
}

/**
 * Dates in `text`, day-first (Sri Lankan order) unless only month-first is
 * valid. `digitBoxes` also reads 8 bare digits as DDMMYYYY — cheque date boxes.
 */
export function findDates(
  text: string,
  window: DateWindow,
  options: { digitBoxes?: boolean } = {},
): Date[] {
  const s = normalizeDigits(text);
  const found: Date[] = [];
  const push = (d: Date | null) => {
    if (d && inWindow(d, window) && !found.some((f) => f.getTime() === d.getTime())) found.push(d);
  };

  for (const m of s.matchAll(/\b(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})\b/g)) {
    push(makeDate(+m[1], +m[2], +m[3]));
  }
  for (const m of s.matchAll(/\b(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4}|\d{2})\b/g)) {
    const a = +m[1];
    const b = +m[2];
    const y = +m[3];
    push(a > 12 || b <= 12 ? makeDate(y, b, a) : makeDate(y, a, b));
  }
  for (const m of s.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?[\s\-.]+([a-z]{3,9})\.?[\s\-.,]+(\d{4}|\d{2})\b/gi)) {
    const month = monthIndex(m[2]);
    if (month > 0) push(makeDate(+m[3], month, +m[1]));
  }
  for (const m of s.matchAll(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi)) {
    const month = monthIndex(m[1]);
    if (month > 0) push(makeDate(+m[3], month, +m[2]));
  }
  if (options.digitBoxes && found.length === 0) {
    // "1 5 1 1 2 0 2 6" or "15112026" in DD MM YYYY boxes.
    const digits = s.replace(/[^\d]/g, '');
    for (let i = 0; i + 8 <= digits.length; i++) {
      const chunk = digits.slice(i, i + 8);
      push(makeDate(+chunk.slice(4), +chunk.slice(2, 4), +chunk.slice(0, 2)));
    }
  }
  return found;
}
