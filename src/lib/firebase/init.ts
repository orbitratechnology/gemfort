/** Web: Firestore needs no native warm-up. */
export function warmUpFirestore(): Promise<void> {
  return Promise.resolve();
}

export function initializeFirebase(): void {
  // no-op
}
