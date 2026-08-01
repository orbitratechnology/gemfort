import { getFirebaseDb } from "@/lib/firebase/config";
import {
  collection,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
} from "@/lib/firebase/db";

/** RNFB `updateDoc` is overloaded; avoid `Parameters<>` picking the FieldPath form. */
type DocFields = Record<string, unknown>;

/**
 * Write promises resolve on **server ACK**, not local cache. Offline they hang.
 * Drop them — persistence already applied the change locally.
 *
 * @see https://github.com/firebase/firebase-js-sdk/issues/6515
 */
export function forgetSync(synced: Promise<unknown>): void {
  void synced.catch(() => {
    // Sync errors surface when connectivity returns.
  });
}

/**
 * Create a doc. Firestore generates the id offline via `doc(collection())`.
 * Do not await the write — returns the id immediately.
 *
 * @see https://firebase.google.com/docs/firestore/manage-data/add-data#add_a_document
 */
export function queueDocCreate(
  collectionPath: string,
  data: DocFields,
): string {
  const ref = doc(collection(getFirebaseDb(), collectionPath));
  forgetSync(setDoc(ref, data));
  return ref.id;
}

/** Queue `setDoc` on a known id. Does not await server ACK. */
export function queueDocSet(
  collectionPath: string,
  docId: string,
  data: DocFields,
): void {
  forgetSync(setDoc(doc(getFirebaseDb(), collectionPath, docId), data));
}

/** Queue `updateDoc`. Does not await server ACK. */
export function queueDocUpdate(
  collectionPath: string,
  docId: string,
  data: DocFields,
): void {
  forgetSync(updateDoc(doc(getFirebaseDb(), collectionPath, docId), data));
}

/** Queue `deleteDoc`. Does not await server ACK. */
export function queueDocDelete(collectionPath: string, docId: string): void {
  forgetSync(deleteDoc(doc(getFirebaseDb(), collectionPath, docId)));
}
