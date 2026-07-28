/**
 * Web: RNFB is not used; persistence would be configured via
 * `initializeFirestore(app, { localCache: persistentLocalCache() })` if/when
 * a firebase JS web path is added. Native uses init.native.ts.
 */
export function warmUpFirestore(): Promise<void> {
  return Promise.resolve();
}

export function initializeFirebase(): void {
  // no-op
}
