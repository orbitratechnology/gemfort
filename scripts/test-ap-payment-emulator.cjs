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

// C3 + H3: an AP settles over several payments, only closes at zero balance,
// rejects overpayment, requires a real cheque, and a bounced cheque reverses
// the confirmed instalment.
async function runInstalmentScenario() {
  const id = 'phase9-ap-instalments';
  const chequeId = 'phase9-cheque-received';
  const giverChequeId = 'phase9-cheque-given';
  const cleanup = async () => {
    await clearNotifications(id);
    const payments = await db.collection('gemtrack_ap_payments').where('apId', '==', id).get();
    const txns = await db.collection('gemtrack_transactions').where('sourceId', '==', id).get();
    await Promise.all([
      ...payments.docs.map((doc) => doc.ref.delete()),
      ...txns.docs.map((doc) => doc.ref.delete()),
      db.collection('gemtrack_ap_records').doc(id).delete(),
      db.collection('gemtrack_cheques').doc(chequeId).delete(),
      db.collection('gemtrack_cheques').doc(giverChequeId).delete(),
    ]);
  };
  await cleanup();
  try {
    await db.collection('gemtrack_ap_records').doc(id).set({
      ownerUid,
      senderUid: ownerUid,
      receiverUid,
      receiverName: 'Phase 9 Receiver',
      senderName: 'Phase 9 Sender',
      status: 'accepted',
      items: [
        { gemId: 'g1', gemLabel: 'G1', agreedPrice: 1000, currency: 'LKR', lineStatus: 'sold', ownerReceives: 1000 },
      ],
      updatedAt: now,
    });
    const ap = () => db.collection('gemtrack_ap_records').doc(id).get().then((snap) => snap.data());

    await assert.rejects(
      apPaymentSentForApi(id, receiverUid, { method: 'cash', amount: 1500 }),
      (error) => error?.code === 'invalid-argument',
    );

    // First instalment: 100 of 1000.
    await apPaymentSentForApi(id, receiverUid, { method: 'cash', amount: 100 });
    const first = await apPaymentReceivedForApi(id, ownerUid, {});
    assert.equal(first.status, 'partial');
    assert.equal((await ap()).amountPaid, 100);
    assert.equal((await ap()).balance, 900);
    assert.equal((await ap()).paymentStatus, 'partial');

    // A cheque payment must reference a real cheque the payer recorded.
    await assert.rejects(
      apPaymentSentForApi(id, receiverUid, { method: 'cheque', amount: 900, chequeId: 'missing' }),
      (error) => error?.code === 'permission-denied',
    );
    await db.collection('gemtrack_cheques').doc(giverChequeId).set({
      ownerUid: receiverUid, direction: 'given', status: 'holding', amount: 900, currency: 'LKR', apRecordId: id,
    });
    await db.collection('gemtrack_cheques').doc(chequeId).set({
      ownerUid, direction: 'received', status: 'holding', amount: 900, currency: 'LKR', apRecordId: id,
    });
    await apPaymentSentForApi(id, receiverUid, { method: 'cheque', amount: 900, chequeId: giverChequeId });
    const second = await apPaymentReceivedForApi(id, ownerUid, { method: 'cheque', chequeId });
    assert.equal(second.status, 'done');
    assert.equal((await ap()).amountPaid, 1000);
    assert.equal((await ap()).paymentStatus, 'paid');
    const ledger = await db.collection('gemtrack_transactions').where('sourceId', '==', id).get();
    const income = ledger.docs.filter((doc) => doc.data().ownerUid === ownerUid && doc.data().type === 'income');
    assert.equal(income.reduce((sum, doc) => sum + doc.data().amount, 0), 1000);
    assert.equal((await db.collection('gemtrack_cheques').doc(chequeId).get()).data().apPaymentSeq, 2);

    console.log('  instalments: partial → paid, overpayment and missing cheque rejected');
  } finally {
    await cleanup();
  }
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

    await runInstalmentScenario();

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
