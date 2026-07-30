/** Amount formatting helpers — commas as you type, no forced .00 / cents model. */

/** Parse a masked or plain amount string to a number (NaN if empty/invalid). */
export function parseAmountInput(value: string | null | undefined): number {
  const cleaned = String(value ?? '')
    .replace(/,/g, '')
    .trim();
  if (!cleaned || cleaned === '.') return Number.NaN;
  return Number(cleaned);
}

/**
 * Strip grouping commas and illegal chars; keep digits + at most one decimal point.
 * Does not pad trailing zeros — "12." and "12.5" stay as typed.
 */
export function toFaceAmount(input: string): string {
  const raw = String(input ?? '').replace(/,/g, '');
  let out = '';
  let seenDot = false;
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
      continue;
    }
    if (ch === '.' && !seenDot) {
      out += '.';
      seenDot = true;
    }
  }
  return out;
}

/**
 * Display amount with thousand separators. Preserves a trailing decimal point
 * and any fractional digits the user typed (no .00 padding).
 */
export function formatGroupedAmount(face: string): string {
  const cleaned = toFaceAmount(face);
  if (!cleaned) return '';

  const hasDot = cleaned.includes('.');
  const [intPart = '', decPart = ''] = cleaned.split('.');
  const intDigits = intPart.replace(/\D/g, '');
  // Allow ".5" while typing → show "0.5"; allow "12." while typing
  const intDisplay = intDigits === '' && hasDot ? '0' : intDigits;
  if (!intDisplay && !hasDot) return '';

  const grouped = intDisplay.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (!hasDot) return grouped;
  return `${grouped}.${decPart}`;
}
