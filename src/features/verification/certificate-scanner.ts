import { DataScanner } from "react-native-data-scanner";

import { normalizeVerificationUrl } from "@/features/verification/verification-links";

export type CertificateScanResult =
  | { kind: "opened"; url: string; format: string }
  | { kind: "unrecognized"; value: string; format: string };

/** Scan every QR/barcode format supported by the native scanner. */
export async function scanCertificateBarcode(): Promise<CertificateScanResult> {
  const barcode = await DataScanner.scanBarcode({ enableAutoZoom: true });
  const url = normalizeVerificationUrl(barcode.value);

  if (!url) {
    return {
      kind: "unrecognized",
      value: barcode.value,
      format: barcode.format,
    };
  }

  return { kind: "opened", url, format: barcode.format };
}

export function isScannerCancellation(error: unknown): boolean {
  const details: string[] = [];

  if (error instanceof Error) {
    details.push(error.message);
  }

  if (typeof error === "object" && error !== null) {
    const errorLike = error as {
      code?: unknown;
      message?: unknown;
      reason?: unknown;
    };

    for (const value of [errorLike.code, errorLike.message, errorLike.reason]) {
      if (typeof value === "string" || typeof value === "number") {
        details.push(String(value));
      }
    }
  }

  details.push(String(error));

  return (
    details.some((detail) => /cancel|dismiss|abort/i.test(detail)) ||
    details.some((detail) => /released before scanning could start/i.test(detail)) ||
    (typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === 16)
  );
}
