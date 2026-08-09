import { getDownloadURL, getStorage, putFile, ref } from '@react-native-firebase/storage';

export async function uploadBlobToStorage(
  localUri: string,
  storagePath: string,
  contentType?: string,
): Promise<string> {
  const reference = ref(getStorage(), storagePath);
  await putFile(reference, localUri, contentType ? { contentType } : undefined);
  return getDownloadURL(reference);
}
