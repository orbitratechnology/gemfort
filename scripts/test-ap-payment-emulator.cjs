const assert = require('node:assert/strict');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Refusing to run: FIRESTORE_EMULATOR_HOST is not set.');
}

const { db } = require('../functions/lib/admin');
const {
  apPaymentReceivedForApi,
  apPaymentSentForApi,
} = require('../functions/lib/gemtrack/ap-payment-api');
const {
  apPaymentEventId,
  apPaymentExpenseTransactionId,
  apPaymentIncomeTransactionId,
} = require('../functions/lib/gemtrack/ap-financial-contract');

const ownerUid = 'phase9-owner';
const receiverUid = 'phase9-receiver';
const apId = 'phase9-ap-payment';
const now = new Date();

async function clearNotifications(referenceId) {
  const snapshot = await db
    .collection('notifications')
    .where('referenceId', '==', referenceId)
    .get();
  await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
}

async function run() {
  const sentId = apPaymentEventId(apId, 'sent');
  const receivedId = apPaymentEventId(apId, 'received');
  const incomeId = apPaymentIncomeTransactionId(apId);
  const expenseId = apPaymentExpenseTransactionId(apId);
  const refs = [
    db.collection('gemtrack_ap_payments').doc(sentId),
    db.collection('gemtrack_ap_payments').doc(receivedId),
    db.collection('gemtrack_transactions').doc(incomeId),
    db.collection('gemtrack_transactions').doc(expenseId),
  ];

  try {
    await clearNotifications(apId);
    await Promise.all([
      db.collection('gemtrack_ap_records').doc(apId).delete(),
      ...refs.map((ref) => ref.delete()),
    ]);
    await db.doc('system/exchange_rates').set({
      base: 'LKR',
      rates: { LKR: 1, USD: 1 },
      updatedAt: now,
    });
    await db.collection('gemtrack_ap_records').doc(apId).set({
      ownerUid: ownerUid,
      senderUid: ownerUid,
      receiverUid,
      receiverContactId: 'phase9-contact',
      receiverName: 'Phase 9 Receiver',
      senderName: 'Phase 9 Sender',
      status: 'accepted',
      items: [
        {
          gemId: 'phase9-gem',
          gemLabel: 'Phase 9 Gem',
          agreedPrice: 800,
          currency: 'LKR',
          lineStatus: 'sold',
          soldPrice: 1000,
          ownerReceives: 800,
        },
      ],
      paymentMethod: null,
      paymentAmount: null,
      paymentChequeId: null,
      paymentReceiptUrl: null,
      updatedAt: now,
    });

    const sentResults = await Promise.all([
      apPaymentSentForApi(apId, receiverUid, { method: 'transfer', amount: 800 }),
      apPaymentSentForApi(apId, receiverUid, { method: 'transfer', amount: 800 }),
    ]);
    assert.deepEqual(
      sentResults.map((result) => result.status).sort(),
      ['payment_sent', 'payment_sent'],
    );
    const sentState = await db.collection('gemtrack_ap_records').doc(apId).get();
    assert.equal(sentState.data().status, 'payment_sent');
    assert.equal(sentState.data().paymentAmount, 800);
    assert.equal((await refs[0].get()).data().mutationFingerprint?.length, 64);

    const receivedResults = await Promise.all([
      apPaymentReceivedForApi(apId, ownerUid, { method: 'transfer' }),
      apPaymentReceivedForApi(apId, ownerUid, { method: 'transfer' }),
    ]);
    assert.deepEqual(
      receivedResults.map((result) => result.status).sort(),
      ['done', 'done'],
    );
    const [apSnap, receivedPayment, income, expense, notifications] = await Promise.all([
      db.collection('gemtrack_ap_records').doc(apId).get(),
      refs[1].get(),
      refs[2].get(),
      refs[3].get(),
      db.collection('notifications').where('referenceId', '==', apId).get(),
    ]);
    assert.equal(apSnap.data().status, 'done');
    assert.equal(receivedPayment.data().type, 'received');
    assert.equal(income.data().ownerUid, ownerUid);
    assert.equal(income.data().type, 'income');
    assert.equal(expense.data().ownerUid, receiverUid);
    assert.equal(expense.data().type, 'expense');
    assert.equal(receivedPayment.data().mutationFingerprint?.length, 64);
    assert.equal(
      notifications.docs.filter((doc) => doc.data().type === 'ap_payment_sent').length,
      1,
    );
    assert.equal(
      notifications.docs.filter((doc) => doc.data().type === 'ap_payment_received').length,
      1,
    );

    await assert.rejects(
      apPaymentReceivedForApi(apId, ownerUid, { method: 'cash' }),
      (error) => error?.code === 'failed-precondition',
    );
    assert.equal((await refs[2].get()).data().amount, 800);

    console.log('Phase 9 AP payment emulator tests passed.');
  } finally {
    await clearNotifications(apId);
    await Promise.all([
      db.collection('gemtrack_ap_records').doc(apId).delete(),
      ...refs.map((ref) => ref.delete()),
      db.doc('system/exchange_rates').delete(),
    ]);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
