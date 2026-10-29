/**
 * One-time migration + data-hygiene pass for the 2026-10 backend audit.
 *
 *   node scripts/ops/migrate-audit-2026-10.cjs            # dry run (report only)
 *   node scripts/ops/migrate-audit-2026-10.cjs --apply    # write changes
 *
 * Uses Application Default Credentials for the `gemfort` project. Every step
 * is idempotent. Financial records and the admin audit log are never deleted:
 * orphans there are reported, not removed.
 */
const { initializeApp } = require('../../functions/node_modules/firebase-admin/lib/app');
const { getAuth } = require('../../functions/node_modules/firebase-admin/lib/auth');
const { getFirestore, Timestamp } = require('../../functions/node_modules/firebase-admin/lib/firestore');

const APPLY = process.argv.includes('--apply');
const PROJECT = process.env.GCLOUD_PROJECT || 'gemfort';
initializeApp({ projectId: PROJECT });
const db = getFirestore();
const DAY = 24 * 60 * 60 * 1000;

const report = {};
const note = (key, value) => {
  (report[key] ??= []).push(value);
};

async function commitInChunks(updates) {
  if (!APPLY) return;
  for (let i = 0; i < updates.length; i += 400) {
    const batch = db.batch();
    for (const [ref, data] of updates.slice(i, i + 400)) batch.update(ref, data);
    await batch.commit();
  }
}

async function exists(collection, id) {
  if (!id || typeof id !== 'string' || id.includes('/')) return false;
  return (await db.collection(collection).doc(id).get()).exists;
}

// H8: legacy idempotency records have no expiresAt, so the TTL policy never purges them.
async function backfillIdempotencyTtl() {
  const snap = await db.collection('gemfort_api_idempotency').get();
  const updates = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.expiresAt) continue;
    const base = data.updatedAt?.toMillis?.() ?? data.createdAt?.toMillis?.() ?? Date.now();
    updates.push([doc.ref, { expiresAt: Timestamp.fromMillis(base + 30 * DAY) }]);
    note('idempotency.expiresAtBackfilled', doc.id);
  }
  await commitInChunks(updates);
}

// M3: mark existing likes as counted and recount each business from the source of truth.
async function recountLikes() {
  const likes = await db.collection('likes').get();
  const counts = new Map();
  const updates = [];
  for (const doc of likes.docs) {
    const data = doc.data();
    const to = String(data.toBusinessId || '');
    if (!to) continue;
    const canonicalId = `${data.fromBusinessId}_${data.toBusinessId}`;
    if (doc.id !== canonicalId) note('likes.nonCanonicalId', doc.id);
    counts.set(to, (counts.get(to) ?? 0) + 1);
    if (data.counted !== true) updates.push([doc.ref, { counted: true }]);
  }
  const businesses = await db.collection('businesses').get();
  for (const doc of businesses.docs) {
    const current = Number(doc.data().badges?.likeCount ?? 0);
    const actual = counts.get(doc.id) ?? 0;
    if (current !== actual) {
      updates.push([doc.ref, { 'badges.likeCount': actual }]);
      note('likes.countCorrected', `${doc.id}: ${current} -> ${actual}`);
    }
  }
  await commitInChunks(updates);
}

// H2 + C3: APs need AP-level soldDate and settlement fields for the overdue check and balances.
async function backfillApSettlement() {
  const snap = await db.collection('gemtrack_ap_records').get();
  const updates = [];
  for (const doc of snap.docs) {
    const ap = doc.data();
    const sold = (ap.items ?? []).filter((item) => item.lineStatus === 'sold');
    const patch = {};
    if (!ap.soldDate && sold.length > 0) {
      const dates = sold.map((item) => item.soldDate).filter(Boolean).sort((a, b) => a.toMillis() - b.toMillis());
      if (dates[0]) patch.soldDate = dates[0];
    }
    if (ap.amountPaid == null && ap.status === 'done' && ap.paymentReceivedAt && ap.paymentAmount) {
      patch.amountPaid = ap.paymentAmount;
      patch.paymentSeq = 1;
      patch.balance = 0;
      patch.paymentStatus = 'paid';
    }
    if (Object.keys(patch).length > 0) {
      updates.push([doc.ref, patch]);
      note('ap.settlementBackfilled', `${doc.id}: ${Object.keys(patch).join(',')}`);
    }
  }
  await commitInChunks(updates);
}

// M8: references to records that no longer exist.
async function reportAndCleanOrphans() {
  const txns = await db.collection('gemtrack_transactions').get();
  for (const doc of txns.docs) {
    const t = doc.data();
    if (t.sourceType === 'ap' && t.sourceId && !(await exists('gemtrack_ap_records', t.sourceId))) {
      note('orphan.transactionMissingAp (kept: financial record)', `${doc.id} -> ${t.sourceId}`);
    }
    if (t.gemId && !(await exists('gemtrack_gems', t.gemId))) {
      note('orphan.transactionMissingGem (kept: financial record)', `${doc.id} -> ${t.gemId}`);
    }
  }

  const actions = await db.collection('admin_actions').get();
  for (const doc of actions.docs) {
    const a = doc.data();
    const businessId = a.targetBusinessId ?? (a.targetType === 'business' ? a.targetId : null);
    if (businessId && !(await exists('businesses', businessId))) {
      note('orphan.adminActionMissingBusiness (kept: immutable audit log)', `${doc.id} -> ${businessId}`);
    }
  }

  // Notifications are inbox items, not records: one pointing at a deleted AP
  // or service only produces a dead link, so it is removed.
  const refCollections = { ap: 'gemtrack_ap_records', service: 'gemtrack_services' };
  const notifications = await db.collection('notifications').get();
  const dead = [];
  for (const doc of notifications.docs) {
    const n = doc.data();
    const collection = refCollections[n.referenceType];
    if (collection && n.referenceId && !(await exists(collection, n.referenceId))) {
      dead.push(doc.ref);
      note('orphan.notificationDeleted', `${doc.id} -> ${n.referenceType}/${n.referenceId}`);
    }
  }
  if (APPLY) await Promise.all(dead.map((ref) => ref.delete()));

  const bootstrap = await db.doc('system/admin_bootstrap').get();
  const bootstrapUid = bootstrap.data()?.uid;
  if (bootstrapUid) {
    const authUser = await getAuth().getUser(bootstrapUid).catch(() => null);
    if (!authUser) note('stale.adminBootstrapUid (needs a decision: point at a live admin or remove)', bootstrapUid);
  }
}

async function main() {
  await backfillIdempotencyTtl();
  await recountLikes();
  await backfillApSettlement();
  await reportAndCleanOrphans();
  console.log(JSON.stringify({ project: PROJECT, applied: APPLY, report }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
