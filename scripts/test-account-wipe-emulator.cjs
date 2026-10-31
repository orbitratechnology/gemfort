const assert = require('node:assert/strict');

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  throw new Error('Refusing to run: Firestore and Storage emulators must both be set.');
}

const { db } = require('../functions/lib/admin');
const { wipeUserData } = require('../functions/lib/account/wipe-user-data');

// C1: deleting user A must never delete user B's shared records. Shared docs
// are detached (A's uid replaced) and kept; A's own docs are deleted.
const A = 'wipe-user-a';
const B = 'wipe-user-b';

async function run() {
  const now = new Date();
  await Promise.all([
    db.collection('users').doc(A).set({ role: 'trader' }),
    db.collection('users').doc(B).set({ role: 'trader' }),
    // Shared: A gave B an accepted AP, with a payment event.
    db.collection('gemtrack_ap_records').doc('ap-shared').set({
      ownerUid: A, senderUid: A, receiverUid: B, status: 'accepted', items: [], updatedAt: now,
    }),
    db.collection('gemtrack_ap_payments').doc('pay-shared').set({
      apId: 'ap-shared', ownerUid: A, senderUid: A, receiverUid: B, actorUid: B, type: 'sent',
    }),
    // Shared: a pending AP from A to B can never resolve, so it is cancelled.
    db.collection('gemtrack_ap_records').doc('ap-pending').set({
      ownerUid: A, senderUid: A, receiverUid: B, status: 'pending', items: [], updatedAt: now,
    }),
    // Shared: B's service job where A was the lapidary.
    db.collection('gemtrack_services').doc('svc-shared').set({
      ownerUid: B, providerUid: A, status: 'in_progress', gemId: 'b-gem',
    }),
    // B's own ledger entry for the AP.
    db.collection('gemtrack_transactions').doc('b-txn').set({ ownerUid: B, sourceId: 'ap-shared', amount: 10 }),
    // A-only: an AP where both parties are A (self) and A's own records.
    db.collection('gemtrack_ap_records').doc('ap-solo').set({
      ownerUid: A, senderUid: A, receiverUid: A, status: 'done', items: [],
    }),
    db.collection('gemtrack_gems').doc('a-gem').set({ ownerUid: A }),
    db.collection('gemtrack_transactions').doc('a-txn').set({ ownerUid: A, amount: 5 }),
  ]);

  await wipeUserData(A);

  const get = (collection, id) => db.collection(collection).doc(id).get();
  const [apShared, payShared, apPending, svcShared, bTxn, apSolo, aGem, aTxn, aUser, bUser] =
    await Promise.all([
      get('gemtrack_ap_records', 'ap-shared'),
      get('gemtrack_ap_payments', 'pay-shared'),
      get('gemtrack_ap_records', 'ap-pending'),
      get('gemtrack_services', 'svc-shared'),
      get('gemtrack_transactions', 'b-txn'),
      get('gemtrack_ap_records', 'ap-solo'),
      get('gemtrack_gems', 'a-gem'),
      get('gemtrack_transactions', 'a-txn'),
      get('users', A),
      get('users', B),
    ]);

  assert.ok(apShared.exists, "B's AP survives A's deletion");
  assert.equal(apShared.data().senderUid, '__deleted__');
  assert.equal(apShared.data().ownerUid, '__deleted__');
  assert.equal(apShared.data().receiverUid, B);
  assert.equal(apShared.data().partyDeleted, true);
  assert.ok(payShared.exists, "B's AP payment history survives");
  assert.equal(payShared.data().actorUid, B);
  assert.equal(apPending.data().status, 'cancelled');
  assert.ok(svcShared.exists, "B's service job survives");
  assert.equal(svcShared.data().providerUid, '__deleted__');
  assert.ok(bTxn.exists, "B's ledger survives");
  assert.ok(bUser.exists);

  assert.equal(apSolo.exists, false, 'A-only shared-collection docs are deleted');
  assert.equal(aGem.exists, false);
  assert.equal(aTxn.exists, false);
  assert.equal(aUser.exists, false);

  // Idempotent: a second wipe (e.g. the Auth trigger) changes nothing for B.
  await wipeUserData(A);
  assert.ok((await get('gemtrack_ap_records', 'ap-shared')).exists);

  console.log('Account wipe emulator tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
