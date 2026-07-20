/**
 * Wipes all Firestore documents and Storage files owned by / tied to a user.
 * Cross-user references are anonymised rather than deleted so related records
 * remain coherent.
 *
 * This is a best-effort, idempotent operation — partial failures are logged
 * and re-thrown so callers can surface them.
 */
import { FieldPath, type Query, type QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { db, storage } from '../../firebase.js';
import { logger } from '../../lib/logger.js';

const DELETED_UID = '__deleted__';
const BATCH_LIMIT = 400;

/** Collections that are wholly owned by a single user. */
const OWNED_BY_FIELD: Array<{ collection: string; field: string }> = [
  { collection: 'businesses', field: 'ownerUid' },
  { collection: 'gems', field: 'sellerUid' },
  { collection: 'verification_applications', field: 'applicantUid' },
  { collection: 'notifications', field: 'recipientUid' },
  { collection: 'reports', field: 'reporterUid' },
  { collection: 'endorsements', field: 'fromUid' },
  { collection: 'service_requests', field: 'traderUid' },
  { collection: 'service_requests', field: 'lapidaryUid' },
  { collection: 'certification_requests', field: 'traderUid' },
  { collection: 'certification_requests', field: 'labUid' },
  { collection: 'lapidary_jobs', field: 'lapidaryUid' },
  { collection: 'lapidary_jobs', field: 'traderUid' },
  { collection: 'certificates', field: 'labUid' },
  { collection: 'certificates', field: 'traderUid' },
  { collection: 'gemtrack_gems', field: 'ownerUid' },
  { collection: 'gemtrack_gem_costs', field: 'ownerUid' },
  { collection: 'gemtrack_gem_events', field: 'ownerUid' },
  { collection: 'gemtrack_gem_events', field: 'createdByUid' },
  { collection: 'gemtrack_services', field: 'ownerUid' },
  { collection: 'gemtrack_ap_records', field: 'ownerUid' },
  { collection: 'gemtrack_ap_payments', field: 'ownerUid' },
  { collection: 'gemtrack_cheques', field: 'ownerUid' },
  { collection: 'gemtrack_payments', field: 'ownerUid' },
  { collection: 'gemtrack_receivables', field: 'ownerUid' },
  { collection: 'gemtrack_payables', field: 'ownerUid' },
  { collection: 'gemtrack_transactions', field: 'ownerUid' },
  { collection: 'gemtrack_trips', field: 'ownerUid' },
  { collection: 'gemtrack_trip_expenses', field: 'ownerUid' },
  { collection: 'gemtrack_trip_gems', field: 'ownerUid' },
  { collection: 'gemtrack_contacts', field: 'ownerUid' },
  { collection: 'gemtrack_certificates', field: 'ownerUid' },
  { collection: 'company_members', field: 'userUid' },
  { collection: 'company_approvals', field: 'requestedByUid' },
  { collection: 'company_approvals', field: 'approverUid' },
];

/** Cross-user references: keep the doc, overwrite the uid field. */
const ANONYMIZE_FIELDS: Array<{ collection: string; field: string }> = [
  { collection: 'reports', field: 'reportedUserUid' },
];

/** Storage path prefixes to delete recursively. */
const STORAGE_PREFIXES = [
  'users',
  'verification',
  'businesses',
  'gemtrack_gems',
  'cheques',
  'certificates',
  'trips',
  'listings',
] as const;

async function deleteQueryInBatches(query: Query): Promise<number> {
  let deleted = 0;
  let cursor: QueryDocumentSnapshot | undefined;

  for (;;) {
    let page = query.orderBy(FieldPath.documentId()).limit(BATCH_LIMIT);
    if (cursor) page = page.startAfter(cursor);

    const snap = await page.get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    deleted += snap.size;
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < BATCH_LIMIT) break;
  }

  return deleted;
}

async function anonymizeQueryInBatches(query: Query, field: string): Promise<number> {
  let updated = 0;
  let cursor: QueryDocumentSnapshot | undefined;

  for (;;) {
    let page = query.orderBy(FieldPath.documentId()).limit(BATCH_LIMIT);
    if (cursor) page = page.startAfter(cursor);

    const snap = await page.get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) batch.update(doc.ref, { [field]: DELETED_UID });
    await batch.commit();
    updated += snap.size;
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < BATCH_LIMIT) break;
  }

  return updated;
}

async function deleteStoragePrefix(prefix: string): Promise<number> {
  const bucket = storage.bucket();
  const [files] = await bucket.getFiles({ prefix });
  if (!files.length) return 0;
  await Promise.all(files.map((f) => f.delete({ ignoreNotFound: true })));
  return files.length;
}

export type WipeSummary = {
  firestoreDeleted: number;
  firestoreAnonymized: number;
  storageDeleted: number;
};

/**
 * Delete or anonymize all data belonging to uid.
 * Also deletes the user's own `users/{uid}` document last.
 */
export async function wipeUserData(uid: string): Promise<WipeSummary> {
  let firestoreDeleted = 0;
  let firestoreAnonymized = 0;
  let storageDeleted = 0;

  // Delete user doc itself.
  try {
    await db.collection('users').doc(uid).delete();
    firestoreDeleted += 1;
  } catch (error) {
    logger.error('Failed to delete user doc', { uid, error });
    throw error;
  }

  // Delete owned documents.
  for (const { collection, field } of OWNED_BY_FIELD) {
    try {
      const n = await deleteQueryInBatches(db.collection(collection).where(field, '==', uid));
      if (n > 0) logger.info('Deleted owned docs', { collection, field, uid, n });
      firestoreDeleted += n;
    } catch (error) {
      logger.error('Failed deleting collection field', { collection, field, uid, error });
      throw error;
    }
  }

  // Anonymize cross-user references.
  for (const { collection, field } of ANONYMIZE_FIELDS) {
    try {
      const n = await anonymizeQueryInBatches(
        db.collection(collection).where(field, '==', uid),
        field,
      );
      if (n > 0) logger.info('Anonymized cross-user refs', { collection, field, uid, n });
      firestoreAnonymized += n;
    } catch (error) {
      logger.error('Failed anonymizing collection field', { collection, field, uid, error });
      throw error;
    }
  }

  // Delete Storage objects.
  for (const root of STORAGE_PREFIXES) {
    const prefix = `${root}/${uid}/`;
    try {
      const n = await deleteStoragePrefix(prefix);
      if (n > 0) logger.info('Deleted storage prefix', { prefix, uid, n });
      storageDeleted += n;
    } catch (error) {
      logger.error('Failed deleting storage prefix', { prefix, uid, error });
      throw error;
    }
  }

  logger.info('User data wipe complete', { uid, firestoreDeleted, firestoreAnonymized, storageDeleted });
  return { firestoreDeleted, firestoreAnonymized, storageDeleted };
}
