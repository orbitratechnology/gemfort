import { getDownloadURL, getStorage, putFile, ref } from '@react-native-firebase/storage';

export async function uploadBlobToStorage(
  localUri: string,
  storagePath: string,
): Promise<string> {
  const reference = ref(getStorage(), storagePath);
  await putFile(reference, localUri);
  return getDownloadURL(reference);
}
