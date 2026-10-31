import { addYears, subYears } from 'date-fns';

import { SRI_LANKA_BANKS } from '@/constants/sri-lanka-banks';
import { getBranchById, getBranchesForBank } from '@/constants/sri-lanka-branches';

import { groupRows, type RecognizedText, type Row } from './layout';
import { findDates, findMoney, looksLikeAmountWords, wordsToAmount } from './values';

export type ChequeExtraction = {
  chequeNumber?: string;
  bankCode?: string;
  /** Branch name from the bank's branch list. */
  branch?: string;
  amount?: number;
  /** Date written on the cheque — the earliest it can be deposited. */
  date?: Date;
  /** "Pay ____" line. */
  payee?: string;
  /** Account holder printed above the signature. */
  drawer?: string;
};

const BANK_CODES = new Set(SRI_LANKA_BANKS.map((b) => b.code));

/** Words printed on cheque stationery that are never a person's name. */
const STATIONERY =
  /signature|signator|authori[sz]ed|please|sign\b|above|bank|branch|account|a\/c|payee|only|rupees|date|valid|months|crossed|negotiable|bearer|order|cheque|current|savings|plc|ltd\.?\s*bank|colombo|pay\b/i;

// ─── MICR line: ⑈000123⑈ 7010⑆123⑆ 0001234567⑈ ─────────────────────────────

type Micr = { chequeNumber: string; bankCode: string; branchCode: string; rowIndex: number };

/**
 * The MICR band holds cheque number (6), bank code (4) and branch code (3).
 * OCR turns the E-13B symbols into stray punctuation, so read digit runs and
 * anchor on a known LankaClear bank code.
 */
function readMicr(rows: Row[]): Micr | null {
  let best: (Micr & { score: number }) | null = null;
  rows.forEach((row, rowIndex) => {
    if (row.top < 0.55) return;
    const groups = row.text.split(/\D+/).filter(Boolean);
    const digits = groups.join('');
    if (digits.length < 13) return;
    // Index where each group starts inside `digits`.
    const starts = new Set<number>();
    let at = 0;
    for (const g of groups) {
      starts.add(at);
      at += g.length;
    }
    for (let i = 6; i + 7 <= digits.length; i++) {
      const bankCode = digits.slice(i, i + 4);
      if (!BANK_CODES.has(bankCode)) continue;
      let score = 1 + row.top;
      if (starts.has(i)) score += 2;
      if (starts.has(i - 6)) score += 2;
      if (starts.has(i + 4) || starts.has(i + 7)) score += 1;
      if (!best || score > best.score) {
        best = {
          chequeNumber: digits.slice(i - 6, i),
          bankCode,
          branchCode: digits.slice(i + 4, i + 7),
          rowIndex,
          score,
        };
      }
    }
  });
  return best;
}

// ─── Bank and branch by printed name ───────────────────────────────────────

function wordPattern(phrase: string): RegExp {
  const escaped = phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, 'i');
}

const BANK_ALIASES = SRI_LANKA_BANKS.map((bank) => {
  const core = bank.name.replace(/\b(plc|ltd|limited)\b\.?/gi, '').trim();
  const names = [core];
  // Acronyms like HNB / NTB / NDB are printed on cheques; skip generic ones.
  if (/^[A-Z]{3,5}$/.test(bank.shortName)) names.push(bank.shortName);
  return { code: bank.code, patterns: names.map(wordPattern) };
});

function bankFromText(rows: Row[]): string | undefined {
  for (const row of rows.slice(0, Math.ceil(rows.length / 2))) {
    const hit = BANK_ALIASES.find((b) => b.patterns.some((p) => p.test(row.text)));
    if (hit) return hit.code;
  }
  return undefined;
}

function branchFromText(bankCode: string, rows: Row[]): string | undefined {
  const branches = getBranchesForBank(bankCode)
    .filter((b) => b.name.trim().length >= 4)
    .sort((a, b) => b.name.length - a.name.length);
  for (const row of rows.slice(0, Math.ceil(rows.length / 2))) {
    const hit = branches.find((b) => wordPattern(b.name).test(row.text));
    if (hit) return hit.name;
  }
  return undefined;
}

// ─── Names ─────────────────────────────────────────────────────────────────

function cleanName(text: string): string | undefined {
  const name = text
    .replace(/^[\s:.\-–—_]+|[\s:.\-–—_]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return /[a-z]{2,}/i.test(name) && name.length >= 3 && name.length <= 80 ? name : undefined;
}

function readPayee(rows: Row[]): string | undefined {
  for (const row of rows) {
    const m = /\bpay\b[\s:.\-]*(.*?)(?:\bor\s+(?:bearer|order)\b.*)?$/i.exec(row.text);
    if (!m) continue;
    const name = cleanName(m[1].replace(/\b(?:bearer|order)\b/gi, ''));
    if (name && !looksLikeAmountWords(name)) return name;
  }
  return undefined;
}

/** Printed account holder: upper-case text right of centre, above the MICR band. */
function readDrawer(rows: Row[], micrRow: number | undefined): string | undefined {
  const floor = micrRow != null ? rows[micrRow].top : 0.92;
  const candidates = rows.filter(
    (r) =>
      r.top > 0.45 &&
      r.bottom <= floor + 0.01 &&
      r.left > 0.4 &&
      /[A-Z]{2,}/.test(r.text) &&
      r.text === r.text.toUpperCase() &&
      !/\d{3,}/.test(r.text) &&
      !STATIONERY.test(r.text.replace(/\((pvt|private)\)\s*ltd\.?|\bltd\.?$|\bplc$/gi, '')),
  );
  const company = candidates.find((r) => /\b(ltd|plc|\(pvt\)|private|limited|company|co\.)/i.test(r.text));
  const pick = company ?? candidates.at(-1);
  return pick ? cleanName(pick.text.replace(/^for\s+/i, '')) : undefined;
}

// ─── Amount and date ───────────────────────────────────────────────────────

function readAmount(rows: Row[], exclude: Set<number>, skipValues: Set<number>): number | undefined {
  let figures: { value: number; score: number } | undefined;
  rows.forEach((row, i) => {
    if (exclude.has(i)) return;
    for (const c of findMoney(row.text)) {
      if (skipValues.has(c.value)) continue;
      const digits = String(Math.trunc(c.value)).length;
      if (digits > 10 || (!c.hasGrouping && !c.currency && !c.hasSuffix && digits >= 8)) continue;
      let score = 0;
      if (c.currency) score += 3;
      if (c.hasSuffix) score += 2;
      if (c.hasDecimals) score += 1;
      if (c.hasGrouping) score += 1;
      if (row.left > 0.5 || row.right > 0.75) score += 1;
      if (row.top > 0.2 && row.top < 0.75) score += 1;
      if (!figures || score > figures.score || (score === figures.score && c.value > figures.value)) {
        figures = { value: c.value, score };
      }
    }
  });

  // Words may run over two rows; read each run of word rows together.
  let words: number | undefined;
  let run: string[] = [];
  const flush = () => {
    if (run.length) {
      const reading = wordsToAmount(run.join(' '));
      if (reading && (words === undefined || reading.value > words)) words = reading.value;
    }
    run = [];
  };
  rows.forEach((row, i) => {
    if (!exclude.has(i) && looksLikeAmountWords(row.text)) run.push(row.text);
    // The "Rs. 125,000/=" box often sits between two lines of words.
    else if (!/[a-z]{3,}/i.test(row.text.replace(/rs\.?|lkr/gi, ''))) return;
    else flush();
  });
  flush();

  if (figures && words !== undefined && Math.abs(figures.value - words) < 0.01) return figures.value;
  if (figures && figures.score >= 3) return figures.value;
  return words ?? (figures && figures.score >= 2 ? figures.value : undefined);
}

function readDate(rows: Row[], exclude: Set<number>, now: Date): { date: Date; rowIndex: number } | undefined {
  const window = { from: subYears(now, 1), to: addYears(now, 2) };
  // Date boxes sit in the top-right; look there first, then anywhere.
  const order = rows
    .map((row, i) => ({ row, i }))
    .filter(({ i }) => !exclude.has(i))
    .sort((a, b) => Number(b.row.top < 0.4 && b.row.right > 0.5) - Number(a.row.top < 0.4 && a.row.right > 0.5));
  for (const { row, i } of order) {
    const boxes = row.top < 0.35 && !/rs|,|\/[=-]/i.test(row.text);
    const dates = findDates(row.text, window, { digitBoxes: boxes });
    if (dates.length) return { date: dates[0], rowIndex: i };
  }
  return undefined;
}

/** Read the fields of a Sri Lankan (LankaClear) cheque from OCR output. */
export function extractCheque(ocr: RecognizedText, now = new Date()): ChequeExtraction {
  const rows = groupRows(ocr.lines);
  const result: ChequeExtraction = {};
  const exclude = new Set<number>();

  const micr = readMicr(rows);
  if (micr) {
    exclude.add(micr.rowIndex);
    result.chequeNumber = micr.chequeNumber;
    result.bankCode = micr.bankCode;
    result.branch = getBranchById(micr.bankCode, Number(micr.branchCode))?.name;
  }
  result.bankCode ??= bankFromText(rows);
  if (result.bankCode && !result.branch) result.branch = branchFromText(result.bankCode, rows);

  const dated = readDate(rows, exclude, now);
  if (dated) {
    result.date = dated.date;
    exclude.add(dated.rowIndex);
  }

  const skip = new Set<number>();
  if (result.chequeNumber) skip.add(Number(result.chequeNumber));
  result.amount = readAmount(rows, exclude, skip);
  result.payee = readPayee(rows);
  result.drawer = readDrawer(rows, micr?.rowIndex);

  return Object.fromEntries(Object.entries(result).filter(([, v]) => v !== undefined)) as ChequeExtraction;
}
