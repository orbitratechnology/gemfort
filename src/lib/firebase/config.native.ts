import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';
import { getStorage } from '@react-native-firebase/storage';

export { firebaseConfig, isFirebaseConfigured } from './firebase-config';

export function getFirebaseAuth() {
  return getAuth(getApp());
}

export function getFirebaseDb() {
  return getFirestore(getApp());
}

export function getFirebaseStorage() {
  return getStorage(getApp());
}
