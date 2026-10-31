import assert from 'node:assert/strict';
import test from 'node:test';

import { dailyDedupeKey } from './daily';

const DAY = 24 * 60 * 60 * 1000;

test('date-specific reminders get a new dedupe key every day', () => {
  const input = { recipientUid: 'u', type: 'cheque_maturing_tomorrow', title: '', message: '', referenceType: 'cheque', referenceId: 'c1' } as const;
  const today = new Date(Date.UTC(2026, 9, 29, 3));
  assert.notEqual(dailyDedupeKey(input, today), dailyDedupeKey(input, new Date(today.getTime() + DAY)));
  assert.equal(dailyDedupeKey(input, today), dailyDedupeKey(input, new Date(today.getTime() + 60_000)));
});

test('overdue reminders repeat weekly rather than once ever', () => {
  const input = { recipientUid: 'u', type: 'ap_payment_overdue', title: '', message: '', referenceType: 'ap', referenceId: 'ap1' } as const;
  const start = new Date(Date.UTC(2026, 9, 29, 3));
  const keys = new Set(Array.from({ length: 21 }, (_, i) => dailyDedupeKey(input, new Date(start.getTime() + i * DAY))));
  assert.ok(keys.size >= 3 && keys.size <= 4, `expected ~3 weekly buckets over 21 days, got ${keys.size}`);
});
