import { getStorage } from 'firebase-admin/storage';
import {
  FieldPath,
  Timestamp,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';

import { db } from '../admin';
import { DELETED_UID, isLiveUid } from './deleted-uid';
import { mapWithConcurrency } from '../utils/concurrency';

const BATCH_LIMIT = 400;
const DELETE_CONCURRENCY = 20;

/**
 * Single-field queries that identify documents the user owns outright. No
 * other user relies on these, so they are deleted.
 */
const OWNED_BY_FIELD: Array<{ collection: string; field: string }> = [
  { collection: 'businesses', field: 'ownerUid' },
  { collection: 'gems', field: 'sellerUid' },
  { collection: 'verification_applications', field: 'applicantUid' },
  { collection: 'notifications', field: 'recipientUid' },
  { collection: 'reports', field: 'reporterUid' },
  { collection: 'likes', field: 'fromUid' },
  // Remove records created by app versions released before the Likes rename.
  { collection: 'endorsements', field: 'fromUid' },
  { collection: 'gemtrack_gems', field: 'ownerUid' },
  { collection: 'gemtrack_gem_costs', field: 'ownerUid' },
  { collection: 'gemtrack_cheques', field: 'ownerUid' },
  { collection: 'gemtrack_bills', field: 'ownerUid' },
  { collection: 'gemtrack_payments', field: 'ownerUid' },
  { collection: 'gemtrack_receivables', field: 'ownerUid' },
  { collection: 'gemtrack_payables', field: 'ownerUid' },
  { collection: 'gemtrack_transactions', field: 'ownerUid' },
  { collection: 'gemtrack_trips', field: 'ownerUid' },
  { collection: 'gemtrack_trip_expenses', field: 'ownerUid' },
  { collection: 'gemtrack_trip_gems', field: 'ownerUid' },
  { collection: 'gemtrack_contacts', field: 'ownerUid' },
  { collection: 'gemfort_api_idempotency', field: 'uid' },
  { collection: 'company_members', field: 'userUid' },
];

/**
 * Records shared between two or more users. When the deleting user is the
 * only live party the record is deleted; otherwise every party field that
 * holds their uid is replaced with DELETED_UID so the counterparty keeps their
 * AP history, payment trail, service jobs, and offers.
 */
const SHARED_BY_FIELDS: Array<{ collection: string; fields: string[] }> = [
  { collection: 'gemtrack_ap_records', fields: ['ownerUid', 'senderUid', 'receiverUid'] },
  {
    collection: 'gemtrack_ap_payments',
    fields: ['ownerUid', 'senderUid', 'receiverUid', 'actorUid'],
  },
  { collection: 'gemtrack_services', fields: ['ownerUid', 'providerUid'] },
  { collection: 'gemtrack_gem_events', fields: ['ownerUid', 'createdByUid'] },
  { collection: 'service_requests', fields: ['traderUid', 'lapidaryUid'] },
  { collection: 'lapidary_jobs', fields: ['traderUid', 'lapidaryUid'] },
  { collection: 'listing_offers', fields: ['buyerUid', 'sellerUid'] },
  { collection: 'company_approvals', fields: ['requestedByUid', 'approverUid'] },
];

/** Statuses that are still waiting on the deleted party and can never resolve. */
const ABANDONED_STATUS: Record<string, Record<string, string>> = {
  gemtrack_ap_records: { pending: 'cancelled' },
  listing_offers: { pending: 'withdrawn' },
};

/** Cross-user references to anonymize (keep the doc, strip the uid). */
const ANONYMIZE_FIELDS: Array<{ collection: string; field: string }> = [
  { collection: 'reports', field: 'reportedUserUid' },
  { collection: 'reports', field: 'adminUid' },
];

const STORAGE_PREFIXES = [
  'users',
  'verification',
  'businesses',
  'gemtrack_gems',
  'cheques',
  'receipts',
  'trips',
  'listings',
] as const;

async function deleteQueryInBatches(query: Query): Promise<number> {
  let deleted = 0;

  // A Firestore document deletion does not delete its subcollections. Use the
  // Admin SDK's recursive delete for every matched root document, then query
  // again for the next page. This deliberately runs only in this trusted
  // server environment, never on a device.
  for (;;) {
    const snap = await query.limit(BATCH_LIMIT).get();
    if (snap.empty) break;

    await mapWithConcurrency(snap.docs, DELETE_CONCURRENCY, (document) =>
      db.recursiveDelete(document.ref),
    );
    deleted += snap.size;
    if (snap.size < BATCH_LIMIT) break;
  }

  return deleted;
}

async function detachSharedQueryInBatches(
  collection: string,
  query: Query,
  uid: string,
  fields: string[],
): Promise<{ deleted: number; detached: number }> {
  let deleted = 0;
  let detached = 0;

  // Every processed document either disappears or stops matching the query
  // (its uid fields are rewritten), so re-querying from the start terminates.
  for (;;) {
    const snap = await query.limit(BATCH_LIMIT).get();
    if (snap.empty) break;

    const batch = db.batch();
    const toDelete: QueryDocumentSnapshot[] = [];
    const now = Timestamp.now();
    for (const doc of snap.docs) {
      const data = doc.data();
      const otherParties = fields
        .map((field) => data[field])
        .filter((value) => isLiveUid(value) && value !== uid);

      if (otherParties.length === 0) {
        toDelete.push(doc);
        deleted += 1;
        continue;
      }

      const update: Record<string, unknown> = {
        partyDeleted: true,
        partyDeletedAt: now,
        updatedAt: now,
      };
      for (const field of fields) {
        if (data[field] === uid) update[field] = DELETED_UID;
      }
      const nextStatus = ABANDONED_STATUS[collection]?.[data.status as string];
      if (nextStatus) update.status = nextStatus;
      batch.update(doc.ref, update);
      detached += 1;
    }
    await batch.commit();
    await mapWithConcurrency(toDelete, DELETE_CONCURRENCY, (document) =>
      db.recursiveDelete(document.ref),
    );
    if (snap.size < BATCH_LIMIT) break;
  }

  return { deleted, detached };
}

async function anonymizeQueryInBatches(
  query: Query,
  field: string,
): Promise<number> {
  let updated = 0;
  let cursor: QueryDocumentSnapshot | undefined;

  for (;;) {
    let page = query.orderBy(FieldPath.documentId()).limit(BATCH_LIMIT);
    if (cursor) page = page.startAfter(cursor);

    const snap = await page.get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.update(doc.ref, { [field]: DELETED_UID });
    }
    await batch.commit();
    updated += snap.size;
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < BATCH_LIMIT) break;
  }

  return updated;
}

async function deleteStoragePrefix(prefix: string): Promise<number> {
  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles({ prefix, autoPaginate: true });
  if (files.length === 0) return 0;

  // deleteFiles is convenient but can miss very large trees; chunk manually.
  let removed = 0;
  for (let i = 0; i < files.length; i += 100) {
    const chunk = files.slice(i, i + 100);
    await Promise.all(chunk.map((file) => file.delete({ ignoreNotFound: true })));
    removed += chunk.length;
  }
  return removed;
}

/**
 * Idempotent wipe of every known user-scoped Firestore + Storage artifact.
 * Safe to call more than once for the same uid.
 */
export async function wipeUserData(uid: string): Promise<{
  firestoreDeleted: number;
  firestoreAnonymized: number;
  storageDeleted: number;
}> {
  if (!uid || uid === DELETED_UID) {
    throw new Error('Invalid uid for wipeUserData');
  }

  let firestoreDeleted = 0;
  let firestoreAnonymized = 0;
  let storageDeleted = 0;

  // Profile doc (id == uid)
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    await db.recursiveDelete(userRef);
    firestoreDeleted += 1;
  }

  // Companies owned solely by this user (best-effort: doc id or owner field).
  const companyByOwner = await deleteQueryInBatches(
    db.collection('companies').where('ownerUid', '==', uid),
  );
  firestoreDeleted += companyByOwner;

  // Shared records first: an AP or service the user owns must be detached
  // (not deleted) when a counterparty still relies on it. Queries run one at
  // a time so a large account does not fan out dozens of parallel scans.
  for (const { collection, fields } of SHARED_BY_FIELDS) {
    for (const field of fields) {
      try {
        const { deleted, detached } = await detachSharedQueryInBatches(
          collection,
          db.collection(collection).where(field, '==', uid),
          uid,
          fields,
        );
        if (deleted > 0 || detached > 0) {
          logger.info('Processed shared docs', { collection, field, uid, deleted, detached });
        }
        firestoreDeleted += deleted;
        firestoreAnonymized += detached;
      } catch (error) {
        logger.error('Failed detaching shared collection field', {
          collection,
          field,
          uid,
          error,
        });
        throw error;
      }
    }
  }

  for (const { collection, field } of OWNED_BY_FIELD) {
    try {
      const n = await deleteQueryInBatches(
        db.collection(collection).where(field, '==', uid),
      );
      if (n > 0) {
        logger.info('Deleted owned docs', { collection, field, uid, n });
      }
      firestoreDeleted += n;
    } catch (error) {
      logger.error('Failed deleting collection field', {
        collection,
        field,
        uid,
        error,
      });
      throw error;
    }
  }

  for (const { collection, field } of ANONYMIZE_FIELDS) {
    try {
      const n = await anonymizeQueryInBatches(
        db.collection(collection).where(field, '==', uid),
        field,
      );
      if (n > 0) {
        logger.info('Anonymized cross-user refs', { collection, field, uid, n });
      }
      firestoreAnonymized += n;
    } catch (error) {
      logger.error('Failed anonymizing collection field', {
        collection,
        field,
        uid,
        error,
      });
      throw error;
    }
  }

  for (const root of STORAGE_PREFIXES) {
    const prefix = `${root}/${uid}/`;
    try {
      const n = await deleteStoragePrefix(prefix);
      if (n > 0) {
        logger.info('Deleted storage prefix', { prefix, uid, n });
      }
      storageDeleted += n;
    } catch (error) {
      logger.error('Failed deleting storage prefix', { prefix, uid, error });
      throw error;
    }
  }

  logger.info('User data wipe complete', {
    uid,
    firestoreDeleted,
    firestoreAnonymized,
    storageDeleted,
  });

  return { firestoreDeleted, firestoreAnonymized, storageDeleted };
}
