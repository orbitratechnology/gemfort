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

// Gems are locked the way createApRequestForApi leaves them: pointing at the
// AP, with the pre-AP state captured on the line. The first line has a
// snapshot; later lines model APs created before snapshots existed.
async function seedAp(apId, gemIds) {
  await Promise.all(
    gemIds.map((gemId) =>
      db.collection('gemtrack_gems').doc(gemId).set({
        ownerUid,
        status: 'on_ap',
        custody: 'on_ap',
        currentApId: apId,
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
    items: gemIds.map((gemId, index) => ({
      gemId,
      lineStatus: 'held',
      ...(index === 0
        ? {
            previousGemState: {
              status: 'polished',
              custody: null,
              outcome: null,
              currentLocation: null,
              currentHolderContactId: null,
            },
          }
        : {}),
    })),
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
    // Snapshot line returns to its captured state; legacy line to ready_for_sale.
    assert.deepEqual(
      acceptedState.gems.map((gem) => gem.status),
      ['polished', 'ready_for_sale'],
    );
    assert.deepEqual(acceptedState.gems.map((gem) => gem.currentApId), [null, null]);
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
    assert.equal(rejectedState.gems[0].status, 'on_ap');
    assert.equal(rejectedState.gems[0].currentApId, rejectedApId);
    assert.equal(
      await countNotifications(rejectedApId, 'ap_cancellation_rejected'),
      1,
    );

    // C2: a line whose gem was never locked by this AP (e.g. another user's
    // gem id, or a gem since moved elsewhere) is skipped, not clobbered.
    const foreignApId = 'phase7-ap-foreign';
    const foreignGemId = 'phase7-gem-foreign';
    apIds.push(foreignApId);
    gemIds.push(foreignGemId);
    await seedAp(foreignApId, [foreignGemId]);
    await db.collection('gemtrack_gems').doc(foreignGemId).set({
      ownerUid: 'someone-else',
      status: 'listed',
      currentApId: null,
    });
    await requestApCancellationForApi(foreignApId, ownerUid);
    await respondApCancellationForApi(foreignApId, receiverUid, 'accepted');
    const foreignState = await readApState(foreignApId, [foreignGemId]);
    assert.equal(foreignState.ap.status, 'cancelled');
    assert.equal(foreignState.gems[0].status, 'listed');

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
