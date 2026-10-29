import assert from 'node:assert/strict';
import test from 'node:test';

import { Timestamp } from 'firebase-admin/firestore';

import { apUnavailableReason, releaseGemFromApUpdate, snapshotGemForAp } from './ap-custody';

test('only gems in the owner\'s hands can go on AP', () => {
  assert.equal(apUnavailableReason({ status: 'polished' }), null);
  assert.equal(apUnavailableReason({ status: 'ready_for_sale' }), null);
  assert.equal(apUnavailableReason({ status: 'on_trip', custody: 'on_trip' }), null);

  assert.match(apUnavailableReason({ status: 'listed', outcome: 'listed', isListedOnMarketplace: true })!, /listed/);
  assert.match(apUnavailableReason({ status: 'with_cutter', custody: 'with_cutter' })!, /custody/);
  assert.match(apUnavailableReason({ status: 'on_ap', currentApId: 'ap-1' })!, /another AP/);
  assert.match(apUnavailableReason({ status: 'sold', outcome: 'sold' })!, /sold/);
  assert.match(apUnavailableReason({ status: 'polished', saleStatus: 'pending' })!, /transfer/);
});

test('releasing a gem restores the state captured when it was locked', () => {
  const now = Timestamp.fromMillis(0);
  const snapshot = snapshotGemForAp({
    status: 'on_trip',
    custody: 'on_trip',
    outcome: null,
    currentLocation: 'Trip',
  });
  assert.deepEqual(releaseGemFromApUpdate(snapshot, now), {
    status: 'on_trip',
    custody: 'on_trip',
    outcome: null,
    currentLocation: 'Trip',
    currentHolderContactId: null,
    currentApId: null,
    updatedAt: now,
  });
});

test('legacy AP lines without a snapshot fall back to ready_for_sale and keep outcome', () => {
  const update = releaseGemFromApUpdate(undefined, Timestamp.fromMillis(0));
  assert.equal(update.status, 'ready_for_sale');
  assert.equal('outcome' in update, false);
});
