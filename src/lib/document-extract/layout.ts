import type { TextLine } from '../../../modules/text-recognition/src/TextRecognition.types';

export type { RecognizedText, TextLine } from '../../../modules/text-recognition/src/TextRecognition.types';

/** Lines that sit on the same visual row, left to right. */
export type Row = {
  text: string;
  lines: TextLine[];
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** Tallest line in the row — a proxy for font size. */
  height: number;
};

function centerY(line: TextLine): number {
  return line.frame.y + line.frame.height / 2;
}

/**
 * Group OCR lines into visual rows. OCR often splits one row (a printed label
 * and the handwriting after it, or digits in date boxes) into several lines;
 * joining them lets the parsers read "Rs. 125,000/=" or "1 5 1 1 2 0 2 6" whole.
 */
export function groupRows(lines: readonly TextLine[]): Row[] {
  const sorted = lines
    .filter((l) => l.text.trim().length > 0)
    .sort((a, b) => centerY(a) - centerY(b));
  const rows: { lines: TextLine[]; top: number; bottom: number }[] = [];

  for (const line of sorted) {
    const top = line.frame.y;
    const bottom = line.frame.y + line.frame.height;
    const c = centerY(line);
    // Same row when this line's centre falls inside the row's band.
    const row = rows.find((r) => c >= r.top && c <= r.bottom && Math.abs(c - (r.top + r.bottom) / 2) < line.frame.height);
    if (row) {
      row.lines.push(line);
      row.top = Math.min(row.top, top);
      row.bottom = Math.max(row.bottom, bottom);
    } else {
      rows.push({ lines: [line], top, bottom });
    }
  }

  return rows
    .map((r) => {
      const ordered = [...r.lines].sort((a, b) => a.frame.x - b.frame.x);
      return {
        text: ordered.map((l) => l.text.trim()).join(' '),
        lines: ordered,
        top: r.top,
        bottom: r.bottom,
        left: Math.min(...ordered.map((l) => l.frame.x)),
        right: Math.max(...ordered.map((l) => l.frame.x + l.frame.width)),
        height: Math.max(...ordered.map((l) => l.frame.height)),
      };
    })
    .sort((a, b) => a.top - b.top);
}
