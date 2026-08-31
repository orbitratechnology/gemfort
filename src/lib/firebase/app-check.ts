/**
 * Web fallback: native App Check is provided by app-check.native.ts.
 *
 * The API client intentionally treats a missing provider as unavailable so a
 * web or misconfigured build cannot silently call an App Check-protected API.
 */
export function initializeFirebaseAppCheck(): Promise<void> {
  return Promise.resolve();
}

export async function getFirebaseAppCheckToken(): Promise<string | null> {
  return null;
}
