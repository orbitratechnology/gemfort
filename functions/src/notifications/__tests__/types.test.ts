import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  priorityForType,
  PUSH_MANDATORY_TYPES,
} from '../types';

describe('priorityForType', () => {
  it('marks cheque bounce and account actions as high', () => {
    assert.equal(priorityForType('cheque_bounced'), 'high');
    assert.equal(priorityForType('account_suspended'), 'high');
    assert.equal(priorityForType('verification_revoked'), 'high');
  });

  it('marks overdue / maturing as medium', () => {
    assert.equal(priorityForType('ap_overdue'), 'medium');
    assert.equal(priorityForType('cheque_maturing_tomorrow'), 'medium');
  });

  it('defaults remaining types to low', () => {
    assert.equal(priorityForType('announcement_platform'), 'low');
    assert.equal(priorityForType('cert_ready'), 'low');
  });
});

describe('PUSH_MANDATORY_TYPES', () => {
  it('includes verification and account lifecycle pushes', () => {
    assert.equal(PUSH_MANDATORY_TYPES.has('verification_approved'), true);
    assert.equal(PUSH_MANDATORY_TYPES.has('account_banned'), true);
    assert.equal(PUSH_MANDATORY_TYPES.has('cheque_maturing_tomorrow'), false);
  });
});
