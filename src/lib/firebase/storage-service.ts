import * as ImagePicker from 'expo-image-picker';

import { uploadBlobToStorage } from '@/lib/firebase/storage-upload';

export async function pickImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

export async function uploadImage(
  localUri: string,
  storagePath: string,
): Promise<string> {
  return uploadBlobToStorage(localUri, storagePath);
}

export async function uploadPickedImage(
  storagePath: string,
): Promise<string | null> {
  const uri = await pickImage();
  if (!uri) return null;
  return uploadImage(uri, storagePath);
}
