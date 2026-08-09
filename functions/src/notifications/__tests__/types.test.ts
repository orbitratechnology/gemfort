import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  notificationGroupKeyForType,
  notificationThreadIdForType,
  priorityForType,
  pushCategoryForType,
  pushChannelForType,
  PUSH_MANDATORY_TYPES,
} from '../types';
import { pickFcmRichImage } from '../push';

describe('priorityForType', () => {
  it('marks cheque bounce and account actions as high', () => {
    assert.equal(priorityForType('cheque_bounced'), 'high');
    assert.equal(priorityForType('account_suspended'), 'high');
    assert.equal(priorityForType('verification_revoked'), 'high');
  });

  it('marks overdue / maturing as medium', () => {
    assert.equal(priorityForType('ap_overdue'), 'medium');
    assert.equal(priorityForType('cheque_maturing_tomorrow'), 'medium');
    assert.equal(priorityForType('bill_due_today'), 'medium');
  });

  it('defaults remaining types to low', () => {
    assert.equal(priorityForType('announcement_platform'), 'low');
    assert.equal(priorityForType('cert_ready'), 'low');
  });
});

describe('notification grouping', () => {
  it('keeps related notifications in a stable category and native thread', () => {
    assert.equal(notificationGroupKeyForType('service_job_updated'), 'services');
    assert.equal(notificationGroupKeyForType('cert_ready'), 'certificates');
    assert.equal(notificationGroupKeyForType('bill_due_today'), 'finance');
    assert.equal(notificationThreadIdForType('service_job_updated'), 'gemfort.services');
  });
});

describe('pushCategoryForType', () => {
  it('maps interactive categories', () => {
    assert.equal(pushCategoryForType('ap_request_received'), 'ap_request');
    assert.equal(pushCategoryForType('ap_cancellation_requested'), 'ap_cancel');
    assert.equal(pushCategoryForType('listing_offer_received'), 'listing_offer');
    assert.equal(pushCategoryForType('cheque_maturing_tomorrow'), 'open_ref');
  });
});

describe('pushChannelForType', () => {
  it('maps channels by urgency', () => {
    assert.equal(pushChannelForType('cheque_bounced', 'high'), 'urgent');
    assert.equal(pushChannelForType('bill_due_today', 'medium'), 'alerts');
    assert.equal(pushChannelForType('announcement_platform', 'low'), 'default');
  });
});

describe('PUSH_MANDATORY_TYPES', () => {
  it('includes verification and account lifecycle pushes', () => {
    assert.equal(PUSH_MANDATORY_TYPES.has('verification_approved'), true);
    assert.equal(PUSH_MANDATORY_TYPES.has('account_banned'), true);
    assert.equal(PUSH_MANDATORY_TYPES.has('cheque_maturing_tomorrow'), false);
  });
});

describe('pickFcmRichImage', () => {
  it('prefers gem art, falls back to profile', () => {
    assert.equal(
      pickFcmRichImage('https://a/profile.jpg', 'https://a/gem.jpg'),
      'https://a/gem.jpg',
    );
    assert.equal(pickFcmRichImage('https://a/profile.jpg', null), 'https://a/profile.jpg');
    assert.equal(pickFcmRichImage(null, 'https://a/gem.jpg'), 'https://a/gem.jpg');
    assert.equal(pickFcmRichImage(null, null), null);
  });
});
