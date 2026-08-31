const assert = require('node:assert/strict');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Refusing to run: FIRESTORE_EMULATOR_HOST is not set.');
}

const { db } = require('../functions/lib/admin');
const {
  requestApCancellationForApi,
  respondApCancellationForApi,
} = require('../functions/lib/gemtrack/ap-cancellation-api');

const ownerUid = 'phase7-owner';
const receiverUid = 'phase7-receiver';
const now = new Date();

async function clearNotifications(referenceId) {
  const snapshot = await db
    .collection('notifications')
    .where('referenceId', '==', referenceId)
    .get();
  await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
}

async function countNotifications(referenceId, type) {
  const snapshot = await db
    .collection('notifications')
    .where('referenceId', '==', referenceId)
    .get();
  return snapshot.docs.filter((doc) => doc.data().type === type).length;
}

async function seedAp(apId, gemIds) {
  await Promise.all(
    gemIds.map((gemId) =>
      db.collection('gemtrack_gems').doc(gemId).set({
        ownerUid,
        status: 'with_cutter',
        currentHolderContactId: 'phase7-contact',
        updatedAt: now,
      }),
    ),
  );
  await db.collection('gemtrack_ap_records').doc(apId).set({
    ownerUid,
    senderUid: ownerUid,
    receiverUid,
    status: 'accepted',
    senderName: 'Phase 7 Sender',
    receiverName: 'Phase 7 Receiver',
    items: gemIds.map((gemId) => ({ gemId, lineStatus: 'held' })),
    updatedAt: now,
  });
}

async function readApState(apId, gemIds) {
  const [ap, ...gems] = await Promise.all([
    db.collection('gemtrack_ap_records').doc(apId).get(),
    ...gemIds.map((gemId) => db.collection('gemtrack_gems').doc(gemId).get()),
  ]);
  return { ap: ap.data(), gems: gems.map((gem) => gem.data()) };
}

async function run() {
  const acceptedApId = 'phase7-ap-accepted';
  const acceptedGemIds = ['phase7-gem-a', 'phase7-gem-b'];
  const rejectedApId = 'phase7-ap-rejected';
  const rejectedGemIds = ['phase7-gem-rejected'];
  const apIds = [acceptedApId, rejectedApId];
  const gemIds = [...acceptedGemIds, ...rejectedGemIds];

  try {
    await Promise.all(apIds.map(clearNotifications));
    await Promise.all(apIds.map((id) => db.collection('gemtrack_ap_records').doc(id).delete()));
    await Promise.all(gemIds.map((id) => db.collection('gemtrack_gems').doc(id).delete()));

    await seedAp(acceptedApId, acceptedGemIds);
    await assert.rejects(
      requestApCancellationForApi(acceptedApId, 'phase7-outsider'),
      (error) => error?.code === 'permission-denied',
    );
    const requestResults = await Promise.all([
      requestApCancellationForApi(acceptedApId, ownerUid),
      requestApCancellationForApi(acceptedApId, ownerUid),
    ]);
    assert.deepEqual(
      requestResults.map((result) => result.status).sort(),
      ['cancellation_requested', 'cancellation_requested'],
    );
    assert.equal(
      await countNotifications(acceptedApId, 'ap_cancellation_requested'),
      1,
    );

    const acceptResults = await Promise.all([
      respondApCancellationForApi(acceptedApId, receiverUid, 'accepted'),
      respondApCancellationForApi(acceptedApId, receiverUid, 'accepted'),
    ]);
    assert.deepEqual(
      acceptResults.map((result) => result.status).sort(),
      ['cancelled', 'cancelled'],
    );
    const acceptedState = await readApState(acceptedApId, acceptedGemIds);
    assert.equal(acceptedState.ap.status, 'cancelled');
    assert.deepEqual(
      acceptedState.gems.map((gem) => gem.status),
      ['ready_for_sale', 'ready_for_sale'],
    );
    assert.equal(
      await countNotifications(acceptedApId, 'ap_cancellation_accepted'),
      1,
    );

    await seedAp(rejectedApId, rejectedGemIds);
    await requestApCancellationForApi(rejectedApId, ownerUid);
    const rejectResults = await Promise.all([
      respondApCancellationForApi(rejectedApId, receiverUid, 'rejected'),
      respondApCancellationForApi(rejectedApId, receiverUid, 'rejected'),
    ]);
    assert.deepEqual(
      rejectResults.map((result) => result.status).sort(),
      ['accepted', 'accepted'],
    );
    const rejectedState = await readApState(rejectedApId, rejectedGemIds);
    assert.equal(rejectedState.ap.status, 'accepted');
    assert.equal(rejectedState.gems[0].status, 'with_cutter');
    assert.equal(
      await countNotifications(rejectedApId, 'ap_cancellation_rejected'),
      1,
    );

    console.log('Phase 7 AP cancellation emulator tests passed.');
  } finally {
    await Promise.all(apIds.map(clearNotifications));
    await Promise.all(apIds.map((id) => db.collection('gemtrack_ap_records').doc(id).delete()));
    await Promise.all(gemIds.map((id) => db.collection('gemtrack_gems').doc(id).delete()));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
