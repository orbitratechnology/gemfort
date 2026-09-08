const assert = require('node:assert/strict');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Refusing to run: FIRESTORE_EMULATOR_HOST is not set.');
}

const { db } = require('../functions/lib/admin');
const {
  requestServiceCancellationForApi,
  respondServiceCancellationForApi,
} = require('../functions/lib/gemtrack/service-cancellation-api');

// Use a plain Date so the fixture does not mix the root app's firebase-admin
// package with the Functions workspace's firebase-admin package.
const now = new Date();
const ownerUid = 'phase6-owner';
const providerUid = 'phase6-provider';

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

async function seedService(serviceId, gemId, provider) {
  await db.collection('gemtrack_gems').doc(gemId).set({
    ownerUid,
    status: 'with_cutter',
    currentHolderContactId: 'phase6-contact',
    updatedAt: now,
  });
  await db.collection('gemtrack_services').doc(serviceId).set({
    ownerUid,
    gemId,
    serviceType: 'cutting',
    providerUid: provider ? providerUid : null,
    providerName: provider ? 'Phase 6 Provider' : null,
    status: 'in_progress',
    updatedAt: now,
  });
}

async function readStatus(serviceId, gemId) {
  const [service, gem] = await Promise.all([
    db.collection('gemtrack_services').doc(serviceId).get(),
    db.collection('gemtrack_gems').doc(gemId).get(),
  ]);
  return { service: service.data(), gem: gem.data() };
}

async function run() {
  const localServiceId = 'phase6-service-local';
  const localGemId = 'phase6-gem-local';
  const providerServiceId = 'phase6-service-provider';
  const providerGemId = 'phase6-gem-provider';
  const rejectServiceId = 'phase6-service-reject';
  const rejectGemId = 'phase6-gem-reject';
  const serviceIds = [localServiceId, providerServiceId, rejectServiceId];
  const gemIds = [localGemId, providerGemId, rejectGemId];

  try {
    await Promise.all(serviceIds.map(clearNotifications));
    await Promise.all(serviceIds.map((id) => db.collection('gemtrack_services').doc(id).delete()));
    await Promise.all(gemIds.map((id) => db.collection('gemtrack_gems').doc(id).delete()));

    await seedService(localServiceId, localGemId, false);
    const localResults = await Promise.all([
      requestServiceCancellationForApi(localServiceId, ownerUid),
      requestServiceCancellationForApi(localServiceId, ownerUid),
    ]);
    assert.deepEqual(localResults.map((result) => result.status).sort(), ['cancelled', 'cancelled']);
    const localState = await readStatus(localServiceId, localGemId);
    assert.equal(localState.service.status, 'cancelled');
    assert.equal(localState.gem.status, 'ready_for_sale');
    assert.equal(await countNotifications(localServiceId, 'service_cancellation_requested'), 0);

    await seedService(providerServiceId, providerGemId, true);
    const providerRequest = await requestServiceCancellationForApi(providerServiceId, ownerUid);
    assert.equal(providerRequest.status, 'cancellation_requested');
    assert.equal(
      await countNotifications(providerServiceId, 'service_cancellation_requested'),
      1,
    );
    const providerResponses = await Promise.all([
      respondServiceCancellationForApi(providerServiceId, providerUid, 'accepted'),
      respondServiceCancellationForApi(providerServiceId, providerUid, 'accepted'),
    ]);
    assert.deepEqual(
      providerResponses.map((result) => result.status).sort(),
      ['cancelled', 'cancelled'],
    );
    const providerState = await readStatus(providerServiceId, providerGemId);
    assert.equal(providerState.service.status, 'cancelled');
    assert.equal(providerState.gem.status, 'ready_for_sale');
    assert.equal(
      await countNotifications(providerServiceId, 'service_cancellation_accepted'),
      1,
    );

    await seedService(rejectServiceId, rejectGemId, true);
    await requestServiceCancellationForApi(rejectServiceId, ownerUid);
    const rejected = await respondServiceCancellationForApi(
      rejectServiceId,
      providerUid,
      'rejected',
    );
    assert.equal(rejected.status, 'in_progress');
    const rejectState = await readStatus(rejectServiceId, rejectGemId);
    assert.equal(rejectState.service.status, 'in_progress');
    assert.equal(rejectState.gem.status, 'with_cutter');
    assert.equal(
      await countNotifications(rejectServiceId, 'service_cancellation_rejected'),
      1,
    );

    console.log('Phase 6 service cancellation emulator tests passed.');
  } finally {
    await Promise.all(serviceIds.map(clearNotifications));
    await Promise.all(serviceIds.map((id) => db.collection('gemtrack_services').doc(id).delete()));
    await Promise.all(gemIds.map((id) => db.collection('gemtrack_gems').doc(id).delete()));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
