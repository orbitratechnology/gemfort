import { enableNetwork } from '@react-native-firebase/firestore';

import { getFirebaseDb } from '@/lib/firebase/config';

let warmUpPromise: Promise<void> | null = null;

/**
 * Completes RNFB's one-time native Firestore init before concurrent reads.
 * Avoids "settings can no longer be changed" when auth + queries race on Android.
 */
export function warmUpFirestore(): Promise<void> {
  if (!warmUpPromise) {
    warmUpPromise = enableNetwork(getFirebaseDb())
      .then(() => undefined)
      .catch(() => undefined);
  }
  return warmUpPromise;
}

/** @deprecated Use warmUpFirestore() — kept for callers that expect a sync hook. */
export function initializeFirebase(): void {
  void warmUpFirestore();
}
