import { getApp, getApps } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';
import { getStorage } from '@react-native-firebase/storage';

export { firebaseConfig } from './firebase-config';

export const isFirebaseConfigured = getApps().some((app) => app.name === '[DEFAULT]');

export function getFirebaseAuth() {
  return getAuth(getApp());
}

export function getFirebaseDb() {
  return getFirestore(getApp());
}

export function getFirebaseStorage() {
  return getStorage(getApp());
}
