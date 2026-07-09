import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { uploadBlobToStorage } from '@/lib/firebase/storage-upload';

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
  allows?: 'images' | 'videos' | 'all' | 'documents';
  quality?: number;
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

/** Pick media into local device storage only. Does not upload. */
export async function pickLocalMedia(options: PickMediaOptions = {}): Promise<LocalMedia | null> {
  const allows = options.allows ?? 'images';

  if (allows === 'documents') {
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

  const mediaTypes =
    allows === 'videos' ? (['videos'] as const) : allows === 'all' ? (['images', 'videos'] as const) : (['images'] as const);

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: [...mediaTypes],
    quality: options.quality ?? 0.8,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    kind: inferKind(asset.mimeType, allows),
    mimeType: asset.mimeType ?? null,
    fileName: asset.fileName ?? fileNameFromUri(asset.uri),
    fileSize: asset.fileSize ?? null,
    width: asset.width ?? null,
    height: asset.height ?? null,
  };
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
  return uploadBlobToStorage(media.uri, storagePath);
}

/** @deprecated Prefer pickLocalMedia then uploadLocalMedia on submit. */
export async function uploadPickedImage(storagePath: string): Promise<string | null> {
  const media = await pickLocalMedia({ allows: 'images' });
  if (!media) return null;
  return uploadLocalMedia(media, storagePath);
}

export function extensionForMedia(media: LocalMedia): string {
  const fromName = media.fileName?.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (media.mimeType?.includes('png')) return 'png';
  if (media.mimeType?.includes('webp')) return 'webp';
  if (media.mimeType?.includes('pdf')) return 'pdf';
  if (media.kind === 'video') return 'mp4';
  return 'jpg';
}
