import * as ImagePicker from 'expo-image-picker';
import { Platform, TurboModuleRegistry } from 'react-native';

import { runExternalActivity } from '@/lib/app-lifecycle/external-activity';
import { localImageFromUri, type LocalMedia } from '@/lib/firebase/storage-service';

/**
 * Native document scanning (VisionKit on iOS, ML Kit Document Scanner on
 * Android) via react-native-document-scanner-plugin: edge detection, crop and
 * perspective correction, multi-page.
 *
 * The package looks its TurboModule up with `getEnforcing` at import time, so
 * it is only required once the module is known to exist. Builds made before
 * the plugin was added fall back to a plain camera capture.
 */
export function isDocumentScannerAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return TurboModuleRegistry.get('DocumentScanner') != null;
  } catch {
    return false;
  }
}

/** Take one photo with the camera (used for gems and as the scan fallback). */
export async function capturePhoto(): Promise<LocalMedia | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera access is needed to capture. Enable it in Settings.');
  }
  const result = await runExternalActivity(() =>
    ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }),
  );
  if (result.canceled || !result.assets[0]) return null;
  return localImageFromUri(result.assets[0].uri, result.assets[0].fileName);
}

/**
 * Scan flat documents (cheques, bills, receipts, visas, tickets). Returns cropped,
 * de-skewed page images, or an empty array if the user cancels.
 */
export async function scanDocuments(options: { maxPages?: number } = {}): Promise<LocalMedia[]> {
  if (!isDocumentScannerAvailable()) {
    const photo = await capturePhoto();
    return photo ? [photo] : [];
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded lazily; see above
  const scanner = require('react-native-document-scanner-plugin') as typeof import('react-native-document-scanner-plugin');
  const result = await runExternalActivity(() =>
    scanner.default.scanDocument({
      croppedImageQuality: 95,
      maxNumDocuments: options.maxPages ?? 1,
      responseType: scanner.ResponseType.ImageFilePath,
    }),
  );
  if (result.status !== scanner.ScanDocumentResponseStatus.Success) return [];
  const pages = (result.scannedImages ?? []).slice(0, options.maxPages ?? 1);
  return Promise.all(pages.map((uri, i) => localImageFromUri(uri, `scan-${i + 1}.jpg`)));
}

/** Image MIME type from a local file URI's extension (scans are re-encoded as WebP). */
export function mimeFromUri(uri: string): string {
  const ext = uri.split('?')[0]?.split('.').pop()?.toLowerCase();
  if (ext === 'webp') return 'image/webp';
  if (ext === 'png') return 'image/png';
  if (ext === 'heic' || ext === 'heif') return `image/${ext}`;
  return 'image/jpeg';
}
