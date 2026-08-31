const assert = require('node:assert/strict');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Refusing to run: FIRESTORE_EMULATOR_HOST is not set.');
}

const { db } = require('../functions/lib/admin');
const {
  recordApGemSaleForApi,
} = require('../functions/lib/gemtrack/ap-sale-api');
const { apSaleTransactionId } = require('../functions/lib/gemtrack/ap-financial-contract');

const ownerUid = 'phase8-owner';
const receiverUid = 'phase8-receiver';
const apId = 'phase8-ap-sale';
const gemId = 'phase8-gem-sale';
const now = new Date();

async function clearNotifications(referenceId) {
  const snapshot = await db
    .collection('notifications')
    .where('referenceId', '==', referenceId)
    .get();
  await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
}

async function run() {
  const eventId = apSaleTransactionId(apId, gemId);
  try {
    await clearNotifications(apId);
    await Promise.all([
      db.collection('gemtrack_ap_records').doc(apId).delete(),
      db.collection('gemtrack_gems').doc(gemId).delete(),
      db.collection('gemtrack_transactions').doc(eventId).delete(),
    ]);
    await db.doc('system/exchange_rates').set({
      base: 'LKR',
      rates: { LKR: 1, USD: 1 },
      updatedAt: now,
    });
    await db.collection('gemtrack_gems').doc(gemId).set({
      ownerUid,
      status: 'on_ap',
      currentApId: apId,
      updatedAt: now,
    });
    await db.collection('gemtrack_ap_records').doc(apId).set({
      ownerUid,
      senderUid: ownerUid,
      receiverUid,
      status: 'accepted',
      senderName: 'Phase 8 Sender',
      receiverName: 'Phase 8 Receiver',
      items: [
        {
          gemId,
          gemLabel: 'Phase 8 Gem',
          agreedPrice: 800,
          currency: 'LKR',
          lineStatus: 'held',
          soldPrice: null,
          soldToName: null,
          soldDate: null,
          ownerReceives: null,
          paymentDueDate: null,
        },
      ],
      updatedAt: now,
    });

    const results = await Promise.all([
      recordApGemSaleForApi(apId, receiverUid, {
        gemId,
        soldPrice: 1000,
        soldToName: 'Buyer',
        ownerReceives: 800,
      }),
      recordApGemSaleForApi(apId, receiverUid, {
        gemId,
        soldPrice: 1000,
        soldToName: ' Buyer ',
        ownerReceives: 800,
      }),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), ['sold', 'sold']);

    const [apSnap, gemSnap, eventSnap, notifications] = await Promise.all([
      db.collection('gemtrack_ap_records').doc(apId).get(),
      db.collection('gemtrack_gems').doc(gemId).get(),
      db.collection('gemtrack_transactions').doc(eventId).get(),
      db.collection('notifications').where('referenceId', '==', apId).get(),
    ]);
    const ap = apSnap.data();
    assert.equal(ap.items[0].lineStatus, 'sold');
    assert.equal(ap.items[0].soldPrice, 1000);
    assert.equal(gemSnap.data().status, 'sold');
    assert.equal(eventSnap.data().mutationFingerprint?.length, 64);
    assert.equal(
      notifications.docs.filter((doc) => doc.data().type === 'ap_gem_sold').length,
      1,
    );

    await assert.rejects(
      recordApGemSaleForApi(apId, receiverUid, {
        gemId,
        soldPrice: 1100,
        ownerReceives: 800,
      }),
      (error) => error?.code === 'failed-precondition',
    );
    const eventAfterConflict = await db.collection('gemtrack_transactions').doc(eventId).get();
    assert.equal(eventAfterConflict.data().amount, 1000);

    console.log('Phase 8 AP sale emulator tests passed.');
  } finally {
    await clearNotifications(apId);
    await Promise.all([
      db.collection('gemtrack_ap_records').doc(apId).delete(),
      db.collection('gemtrack_gems').doc(gemId).delete(),
      db.collection('gemtrack_transactions').doc(eventId).delete(),
      db.doc('system/exchange_rates').delete(),
    ]);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
