import storage from '@react-native-firebase/storage';

export async function uploadBlobToStorage(
  localUri: string,
  storagePath: string,
): Promise<string> {
  const reference = storage().ref(storagePath);
  await reference.putFile(localUri);
  return reference.getDownloadURL();
}
