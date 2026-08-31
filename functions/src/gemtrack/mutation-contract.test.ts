import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canActOnAp,
  decideApStatusTransition,
  decideServiceCancellationRequest,
  decideServiceCancellationResponse,
  validateIdempotencyKey,
} from './mutation-contract';

const sender = 'qa-trader';
const receiver = 'qa-trader-b';
const outsider = 'qa-lapidary';

test('idempotency keys are bounded and reject unsafe or empty values', () => {
  assert.equal(validateIdempotencyKey('  mobile-request-01  '), 'mobile-request-01');
  assert.throws(() => validateIdempotencyKey(undefined));
  assert.throws(() => validateIdempotencyKey('contains whitespace'));
  assert.throws(() => validateIdempotencyKey('x'.repeat(129)));
});

test('AP ownership is role-specific and never grants outsider access', () => {
  const ap = { ownerUid: sender, senderUid: sender, receiverUid: receiver, status: 'pending' };

  assert.equal(canActOnAp('respond', ap, receiver), true);
  assert.equal(canActOnAp('payment-received', ap, sender), true);
  assert.equal(canActOnAp('delete', ap, receiver), true);
  assert.equal(canActOnAp('respond', ap, sender), false);
  assert.equal(canActOnAp('cancel', ap, outsider), false);
});

test('service owner cancellation is transition-or-replay by current state', () => {
  assert.deepEqual(
    decideServiceCancellationRequest(
      { ownerUid: sender, providerUid: 'qa-lapidary', status: 'in_progress' },
      sender,
    ),
    { kind: 'transition', status: 'cancellation_requested' },
  );
  assert.deepEqual(
    decideServiceCancellationRequest(
      { ownerUid: sender, providerUid: null, status: 'given' },
      sender,
    ),
    { kind: 'transition', status: 'cancelled' },
  );
  assert.deepEqual(
    decideServiceCancellationRequest(
      { ownerUid: sender, providerUid: 'qa-lapidary', status: 'cancellation_requested' },
      sender,
    ),
    { kind: 'replay', status: 'cancellation_requested' },
  );
  assert.equal(
    decideServiceCancellationRequest(
      { ownerUid: sender, providerUid: 'qa-lapidary', status: 'completed' },
      sender,
    ).kind,
    'reject',
  );
  assert.equal(
    decideServiceCancellationRequest(
      { ownerUid: sender, providerUid: 'qa-lapidary', status: 'given' },
      outsider,
    ).kind,
    'reject',
  );
});

test('service provider response replays the same action but rejects conflicts', () => {
  assert.deepEqual(
    decideServiceCancellationResponse(
      { providerUid: receiver, status: 'cancellation_requested' },
      receiver,
      'accepted',
    ),
    { kind: 'transition', status: 'cancelled' },
  );
  assert.deepEqual(
    decideServiceCancellationResponse(
      { providerUid: receiver, status: 'cancelled' },
      receiver,
      'accepted',
    ),
    { kind: 'replay', status: 'cancelled' },
  );
  assert.equal(
    decideServiceCancellationResponse(
      { providerUid: receiver, status: 'cancelled' },
      receiver,
      'rejected',
    ).kind,
    'reject',
  );
});

test('AP cancellation transitions preserve the legacy status contract and replay safe repeats', () => {
  assert.deepEqual(decideApStatusTransition('request-cancellation', 'accepted'), {
    kind: 'transition',
    status: 'cancellation_requested',
  });
  assert.deepEqual(decideApStatusTransition('request-cancellation', 'cancellation_requested'), {
    kind: 'replay',
    status: 'cancellation_requested',
  });
  assert.deepEqual(decideApStatusTransition('respond-cancellation-accepted', 'cancelled'), {
    kind: 'replay',
    status: 'cancelled',
  });
  assert.equal(decideApStatusTransition('respond-accepted', 'done').kind, 'reject');
});
