import TextRecognition from '../../../modules/text-recognition/src/TextRecognitionModule';

import { extractCheque, type ChequeExtraction } from './cheque';
import type { RecognizedText } from './layout';
import { extractReceipt, type ReceiptExtraction } from './receipt';

export type { ChequeExtraction } from './cheque';
export type { ReceiptExtraction } from './receipt';
export { matchContact } from './match-contact';

/**
 * On-device OCR (Apple Vision / bundled ML Kit) — no network. Resolves null
 * when the native module is missing (web, or a build made before it existed).
 */
export async function recognizeText(uri: string): Promise<RecognizedText | null> {
  if (!TextRecognition) return null;
  return TextRecognition.recognizeAsync(uri);
}

export async function readCheque(uri: string): Promise<ChequeExtraction | null> {
  const ocr = await recognizeText(uri);
  return ocr ? extractCheque(ocr) : null;
}

export async function readReceipt(uri: string): Promise<ReceiptExtraction | null> {
  const ocr = await recognizeText(uri);
  return ocr ? extractReceipt(ocr) : null;
}
