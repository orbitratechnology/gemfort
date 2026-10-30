import { addYears, subYears } from 'date-fns';

import type { CurrencyCode } from '@/constants/currencies';

import { groupRows, type RecognizedText, type Row } from './layout';
import { findDates, findMoney, type MoneyCandidate } from './values';

/** Fields read from a bill, invoice or till receipt. */
export type ReceiptExtraction = {
  amount?: number;
  currency?: CurrencyCode;
  /** Issue / purchase date. */
  date?: Date;
  /** Payment due date (invoices). */
  dueDate?: Date;
  /** Business name at the top. */
  merchant?: string;
  /** Invoice / bill / receipt number. */
  reference?: string;
};

const STRONG_TOTAL =
  /grand\s*total|net\s*(total|amount|payable)|total\s*(amount|payable|due|lkr|rs)|amount\s*(due|payable)|balance\s*(due|payable)|to\s*pay\b/i;
const TOTAL = /\btota[l1]\b/i;
const NOT_TOTAL = /sub\s*-?\s*tota[l1]|tota[l1]\s*(items?|qty|quantity|discount|savings?|tax|vat|weight|pcs)|no\.?\s*of\s*items/i;

const DATE_LABEL = /\b(date|dated|dt)\b/i;
const DUE_LABEL = /due\s*(date|on|by)|payment\s*due|pay\s*by|payable\s*(on|by|before)/i;
const REFERENCE =
  /\b(?:invoice|inv|bill|receipt|rcpt|ref(?:erence)?|order)\s*(?:no\.?|number|num|#)?\s*[:#.\-]?\s*([A-Z0-9][A-Z0-9\-/]{2,})/i;

/** Lines in a letterhead that are contact details, not the business name. */
const NOT_MERCHANT =
  /\d{4,}|tel|phone|mobile|fax|e-?mail|www\.|@|\.com|\.lk|road|\brd\b|street|mawatha|lane|colombo|no\.\s*\d|vat|tin\b|reg\b|invoice|receipt|bill\b|tax|date|cashier|welcome|thank|customer|address/i;

function pickAmount(rows: Row[]): { candidate: MoneyCandidate; row: Row } | undefined {
  const labelled = (pattern: RegExp, priority: number) =>
    rows.flatMap((row, i) => {
      if (!pattern.test(row.text) || NOT_TOTAL.test(row.text)) return [];
      // Value on the same row, else directly underneath the label.
      let money = findMoney(row.text.replace(pattern, ' '));
      if (!money.length && rows[i + 1]) money = findMoney(rows[i + 1].text);
      const candidate = money.at(-1);
      return candidate ? [{ candidate, row, priority }] : [];
    });

  const hits = [...labelled(STRONG_TOTAL, 2), ...labelled(TOTAL, 1)].sort(
    (a, b) => b.priority - a.priority || b.candidate.value - a.candidate.value,
  );
  if (hits[0]) return hits[0];

  // No label: largest figure that looks like money.
  const loose = rows
    .flatMap((row) => findMoney(row.text).map((candidate) => ({ candidate, row })))
    .filter(({ candidate: c }) => c.hasDecimals || c.currency || c.hasSuffix)
    .sort((a, b) => b.candidate.value - a.candidate.value);
  return loose[0];
}

function pickCurrency(rows: Row[], amountRow?: Row): CurrencyCode | undefined {
  const fromAmountRow = amountRow && findMoney(amountRow.text).find((c) => c.currency)?.currency;
  if (fromAmountRow) return fromAmountRow;
  const counts = new Map<CurrencyCode, number>();
  for (const row of rows) {
    for (const c of findMoney(row.text)) {
      if (c.currency) counts.set(c.currency, (counts.get(c.currency) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function pickMerchant(rows: Row[]): string | undefined {
  const top = rows.filter((r) => r.top < 0.3).slice(0, 6);
  const named = top.filter((r) => {
    const t = r.text.trim();
    return t.length >= 3 && t.length <= 48 && /[a-z]{3,}/i.test(t) && !NOT_MERCHANT.test(t);
  });
  // The business name is usually the largest type in the header.
  const best = [...named].sort((a, b) => b.height - a.height)[0];
  return best?.text.replace(/\s{2,}/g, ' ').trim();
}

/** Read total, dates, business and reference from a bill or receipt. */
export function extractReceipt(ocr: RecognizedText, now = new Date()): ReceiptExtraction {
  const rows = groupRows(ocr.lines);
  const window = { from: subYears(now, 3), to: addYears(now, 2) };
  const result: ReceiptExtraction = {};

  const amount = pickAmount(rows);
  if (amount) result.amount = amount.candidate.value;
  result.currency = amount?.candidate.currency ?? pickCurrency(rows, amount?.row);

  const dueRow = rows.findIndex((r) => DUE_LABEL.test(r.text));
  if (dueRow >= 0) {
    result.dueDate =
      findDates(rows[dueRow].text, window)[0] ?? (rows[dueRow + 1] && findDates(rows[dueRow + 1].text, window)[0]);
  }
  const dateRow = rows.find((r, i) => i !== dueRow && DATE_LABEL.test(r.text) && findDates(r.text, window).length);
  result.date =
    (dateRow && findDates(dateRow.text, window)[0]) ??
    rows.filter((_, i) => i !== dueRow).flatMap((r) => findDates(r.text, window))[0];

  result.merchant = pickMerchant(rows);
  for (const row of rows) {
    const m = REFERENCE.exec(row.text);
    if (m && /\d/.test(m[1])) {
      result.reference = m[1];
      break;
    }
  }

  return Object.fromEntries(Object.entries(result).filter(([, v]) => v !== undefined)) as ReceiptExtraction;
}
