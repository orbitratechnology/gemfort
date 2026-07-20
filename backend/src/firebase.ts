/**
 * Firebase Admin SDK singleton.
 * Supports two init strategies:
 *   1. GOOGLE_APPLICATION_CREDENTIALS env var → ADC (recommended for Cloud Run / GKE).
 *   2. Explicit FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';

import { config } from './config.js';

if (!getApps().length) {
  const { projectId, clientEmail, privateKey, storageBucket } = config.firebase;

  if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket,
    });
  } else {
    // Fall back to ADC — works in GCP environments and when
    // GOOGLE_APPLICATION_CREDENTIALS points to a service-account file.
    initializeApp({ storageBucket });
  }
}

export const db = getFirestore();
export const auth = getAuth();
export const messaging = getMessaging();
export const storage = getStorage();

export { Timestamp };
