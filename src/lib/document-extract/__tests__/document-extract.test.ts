import { extractCheque } from '../cheque';
import type { RecognizedText, TextLine } from '../layout';
import { matchContact } from '../match-contact';
import { extractReceipt } from '../receipt';
import { findDates, findMoney, wordsToAmount } from '../values';

const NOW = new Date(2026, 9, 30);

function line(text: string, x: number, y: number, width = 0.2, height = 0.04): TextLine {
  return { text, confidence: 0.9, alternatives: [], frame: { x, y, width, height } };
}

function ocr(lines: TextLine[]): RecognizedText {
  return { width: 2000, height: 900, lines };
}

const ymd = (d: Date | undefined) =>
  d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : undefined;

describe('values', () => {
  it('reads Sri Lankan figures', () => {
    expect(findMoney('Rs. 125,000/=')[0]).toMatchObject({ value: 125000, currency: 'LKR', hasSuffix: true });
    expect(findMoney('LKR 1,25,000.50')[0]).toMatchObject({ value: 125000.5, hasDecimals: true });
    expect(findMoney('Total 1O,5OO.OO')[0].value).toBe(10500);
  });

  it('reads amounts in words, with OCR slips', () => {
    expect(wordsToAmount('Rupees One Hundred Twenty Five Thousand Only')?.value).toBe(125000);
    expect(wordsToAmount('One Lakh Fourty Thousand Five Hundred and Cents Fifty')?.value).toBe(140500.5);
    expect(wordsToAmount('Two Milion Thre Hundred Thousand only')?.value).toBe(2300000);
    expect(wordsToAmount('Pay cash')).toBeNull();
  });

  it('reads dates day-first, and cheque date boxes', () => {
    const w = { from: new Date(2025, 0, 1), to: new Date(2028, 0, 1) };
    expect(ymd(findDates('Date: 05/11/2026', w)[0])).toBe('2026-11-5');
    expect(ymd(findDates('11/25/2026', w)[0])).toBe('2026-11-25');
    expect(ymd(findDates('12 Oct 2026', w)[0])).toBe('2026-10-12');
    expect(ymd(findDates('2026-03-09', w)[0])).toBe('2026-3-9');
    expect(ymd(findDates('1 5 1 1 2 0 2 6', w, { digitBoxes: true })[0])).toBe('2026-11-15');
    expect(findDates('1 5 1 1 2 0 2 6', w)).toHaveLength(0);
  });
});

describe('extractCheque', () => {
  const cheque = ocr([
    line('BANK OF CEYLON', 0.05, 0.05, 0.3, 0.05),
    line('KANDY', 0.05, 0.11, 0.1, 0.03),
    line('1 5', 0.7, 0.07, 0.06),
    line('1 1', 0.77, 0.07, 0.06),
    line('2 0 2 6', 0.84, 0.07, 0.12),
    line('Pay', 0.05, 0.3, 0.05),
    line('Ruby Gems (Pvt) Ltd', 0.12, 0.29, 0.4, 0.05),
    line('or bearer', 0.8, 0.3, 0.12),
    line('Rupees', 0.05, 0.4, 0.08),
    line('One Hundred Twenty Five', 0.15, 0.39, 0.4, 0.05),
    line('Rs.', 0.7, 0.45, 0.05),
    line('125,000/=', 0.76, 0.45, 0.18, 0.05),
    line('Thousand Only', 0.05, 0.5, 0.25, 0.05),
    line('M.K. PERERA', 0.62, 0.7, 0.25),
    line('Authorised Signature', 0.62, 0.78, 0.25, 0.03),
    line('⑈123456⑈ 7010⑆002⑆ 0012345678⑈', 0.15, 0.9, 0.7),
  ]);

  it('reads every field', () => {
    const r = extractCheque(cheque, NOW);
    expect(r.chequeNumber).toBe('123456');
    expect(r.bankCode).toBe('7010');
    expect(r.branch).toBe('Kandy');
    expect(r.amount).toBe(125000);
    expect(ymd(r.date)).toBe('2026-11-15');
    expect(r.payee).toBe('Ruby Gems (Pvt) Ltd');
    expect(r.drawer).toBe('M.K. PERERA');
  });

  it('reads MICR when OCR mangles the symbols', () => {
    const r = extractCheque(ocr([line('"123456" 7278:007: 1029384756"', 0.1, 0.9, 0.7)]), NOW);
    expect(r).toMatchObject({ chequeNumber: '123456', bankCode: '7278', branch: 'Kandy Super' });
  });

  it('falls back to the amount in words and the printed bank name', () => {
    const r = extractCheque(
      ocr([
        line('Sampath Bank', 0.05, 0.05, 0.3),
        line('Rupees Two Lakh Fifty Thousand only', 0.05, 0.4, 0.6),
      ]),
      NOW,
    );
    expect(r.bankCode).toBe('7278');
    expect(r.amount).toBe(250000);
    expect(r.chequeNumber).toBeUndefined();
  });

  it('returns nothing for blank input', () => {
    expect(extractCheque(ocr([]), NOW)).toEqual({});
  });
});

describe('extractReceipt', () => {
  it('reads a till receipt', () => {
    const r = extractReceipt(
      ocr([
        line('Lanka Gem Tools', 0.3, 0.03, 0.4, 0.06),
        line('No. 12, Main Street, Ratnapura', 0.2, 0.1, 0.6, 0.03),
        line('Tel: 045 222 3344', 0.3, 0.14, 0.4, 0.03),
        line('Invoice No: INV-2041', 0.05, 0.2, 0.4, 0.03),
        line('Date: 28/10/2026', 0.55, 0.2, 0.4, 0.03),
        line('Polishing wheel 2 x 1,200.00', 0.05, 0.35, 0.8, 0.03),
        line('Sub Total', 0.05, 0.6, 0.3, 0.03),
        line('2,400.00', 0.7, 0.6, 0.2, 0.03),
        line('Grand Total', 0.05, 0.66, 0.3, 0.03),
        line('LKR 2,640.00', 0.65, 0.66, 0.25, 0.03),
      ]),
      NOW,
    );
    expect(r).toMatchObject({ amount: 2640, currency: 'LKR', merchant: 'Lanka Gem Tools', reference: 'INV-2041' });
    expect(ymd(r.date)).toBe('2026-10-28');
  });

  it('reads an invoice due date separately from the issue date', () => {
    const r = extractReceipt(
      ocr([
        line('Invoice Date 01 Oct 2026', 0.05, 0.1, 0.5, 0.03),
        line('Due Date 15 Nov 2026', 0.05, 0.15, 0.5, 0.03),
        line('Amount Due', 0.05, 0.7, 0.3, 0.03),
        line('USD 1,500.00', 0.6, 0.7, 0.3, 0.03),
      ]),
      NOW,
    );
    expect(r.amount).toBe(1500);
    expect(r.currency).toBe('USD');
    expect(ymd(r.date)).toBe('2026-10-1');
    expect(ymd(r.dueDate)).toBe('2026-11-15');
  });
});

describe('matchContact', () => {
  const contacts = [
    { id: 'a', displayName: 'Nimal Perera', companyName: 'Ruby Gems (Pvt) Ltd' },
    { id: 'b', displayName: 'Kamal Silva', companyName: null },
    { id: 'c', displayName: 'Sunil Perera', companyName: null },
  ];

  it('matches on company or display name', () => {
    expect(matchContact('RUBY GEMS (PVT) LTD', contacts)?.id).toBe('a');
    expect(matchContact('Kamal Silva', contacts)?.id).toBe('b');
  });

  it('refuses ambiguous or weak matches', () => {
    expect(matchContact('M.K. PERERA', contacts)).toBeUndefined();
    expect(matchContact('Someone Else', contacts)).toBeUndefined();
  });
});
