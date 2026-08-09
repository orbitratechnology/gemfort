import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { uploadBlobToStorage } from '@/lib/firebase/storage-upload';
import { setLoadingMessage } from '@/providers/loading-provider';

export type LocalMediaKind = 'image' | 'video' | 'file';

/** Local-only media selected by the user. Upload happens on form submit. */
export type LocalMedia = {
  uri: string;
  kind: LocalMediaKind;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
};

export type PickMediaOptions = {
  /** Default: images only. */
  allows?: 'images' | 'videos' | 'all' | 'documents' | 'imagesOrDocuments';
  /** Show the native crop, zoom, and positioning UI for a single image. */
  allowsEditing?: boolean;
  /** Crop ratio for Android's system editor. iOS always uses a square crop UI. */
  aspect?: [number, number];
  quality?: number;
  /** Max items when using pickLocalMediaMany. Default 10. */
  selectionLimit?: number;
};

function inferKind(mimeType?: string | null, allows?: PickMediaOptions['allows']): LocalMediaKind {
  if (allows === 'documents') return 'file';
  if (mimeType?.startsWith('video/')) return 'video';
  if (mimeType?.startsWith('image/')) return 'image';
  if (allows === 'videos') return 'video';
  return 'image';
}

function fileNameFromUri(uri: string): string {
  const cleaned = uri.split('?')[0] ?? uri;
  const parts = cleaned.split('/');
  return parts[parts.length - 1] || 'media';
}

function webpFileName(fileName: string | null | undefined, uri: string): string {
  const source = fileName ?? fileNameFromUri(uri);
  const stem = source.replace(/\.[^.]+$/, '') || 'image';
  return `${stem}.webp`;
}

/** Re-encode selected images locally before they leave the device. */
async function assetToLocalMedia(
  asset: ImagePicker.ImagePickerAsset,
  allows: PickMediaOptions['allows'],
): Promise<LocalMedia> {
  const kind = inferKind(asset.mimeType, allows);
  if (kind === 'image') {
    const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
    const renderedImage = await context.renderAsync();
    const webp = await renderedImage.saveAsync({
      format: ImageManipulator.SaveFormat.WEBP,
      // Expo documents 1 as its maximum-quality setting.
      compress: 1,
    });

    return {
      uri: webp.uri,
      kind,
      mimeType: 'image/webp',
      fileName: webpFileName(asset.fileName, asset.uri),
      fileSize: null,
      width: webp.width,
      height: webp.height,
    };
  }

  return {
    uri: asset.uri,
    kind,
    mimeType: asset.mimeType ?? null,
    fileName: asset.fileName ?? fileNameFromUri(asset.uri),
    fileSize: asset.fileSize ?? null,
    width: asset.width ?? null,
    height: asset.height ?? null,
  };
}

async function pickDocument(): Promise<LocalMedia | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: '*/*',
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    kind: 'file',
    mimeType: asset.mimeType ?? null,
    fileName: asset.name ?? fileNameFromUri(asset.uri),
    fileSize: asset.size ?? null,
  };
}

/** Pick media into local device storage only. Does not upload. */
export async function pickLocalMedia(options: PickMediaOptions = {}): Promise<LocalMedia | null> {
  const allows = options.allows ?? 'images';

  if (allows === 'documents') return pickDocument();

  if (allows === 'imagesOrDocuments') {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['image/*', 'application/pdf'],
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    if (!asset.mimeType?.startsWith('image/')) {
      return {
        uri: asset.uri,
        kind: 'file',
        mimeType: asset.mimeType ?? null,
        fileName: asset.name ?? fileNameFromUri(asset.uri),
        fileSize: asset.size ?? null,
      };
    }
    return assetToLocalMedia(
      {
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.name,
        fileSize: asset.size,
        width: 0,
        height: 0,
      },
      'images',
    );
  }

  const mediaTypes =
    allows === 'videos' ? (['videos'] as const) : allows === 'all' ? (['images', 'videos'] as const) : (['images'] as const);

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: [...mediaTypes],
    quality: options.quality ?? 1,
    allowsEditing: options.allowsEditing ?? allows === 'images',
    aspect: options.aspect,
  });

  if (result.canceled || !result.assets[0]) return null;
  return assetToLocalMedia(result.assets[0], allows);
}

/**
 * Pick one or more images/videos into local device storage. Does not upload.
 * First item is suitable as the album primary until the user reorders.
 */
export async function pickLocalMediaMany(
  options: PickMediaOptions = {},
): Promise<LocalMedia[]> {
  const allows = options.allows ?? 'images';
  if (allows === 'documents' || allows === 'imagesOrDocuments') {
    const one = await pickLocalMedia(options);
    return one ? [one] : [];
  }

  const mediaTypes =
    allows === 'videos'
      ? (['videos'] as const)
      : allows === 'all'
        ? (['images', 'videos'] as const)
        : (['images'] as const);

  const limit = Math.max(1, options.selectionLimit ?? 10);
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: [...mediaTypes],
    quality: options.quality ?? 1,
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: limit,
  });

  if (result.canceled || !result.assets?.length) return [];
  return Promise.all(result.assets.slice(0, limit).map((asset) => assetToLocalMedia(asset, allows)));
}

/** @deprecated Prefer pickLocalMedia + upload on submit. */
export async function pickImage(): Promise<string | null> {
  const media = await pickLocalMedia({ allows: 'images' });
  return media?.uri ?? null;
}

export async function uploadImage(localUri: string, storagePath: string): Promise<string> {
  return uploadBlobToStorage(localUri, storagePath);
}

/** Upload a previously picked local media file. Call this on form submit. */
export async function uploadLocalMedia(media: LocalMedia, storagePath: string): Promise<string> {
  setLoadingMessage(media.kind === 'image' ? 'Uploading photo…' : 'Uploading…');
  return uploadBlobToStorage(media.uri, storagePath, media.mimeType ?? undefined);
}

/** @deprecated Prefer pickLocalMedia then uploadLocalMedia on submit. */
export async function uploadPickedImage(storagePath: string): Promise<string | null> {
  const media = await pickLocalMedia({ allows: 'images' });
  if (!media) return null;
  return uploadLocalMedia(media, storagePath);
}

export function extensionForMedia(media: LocalMedia): string {
  if (media.kind === 'image') return 'webp';
  const fromName = media.fileName?.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (media.mimeType?.includes('pdf')) return 'pdf';
  if (media.kind === 'video') return 'mp4';
  return 'jpg';
}
