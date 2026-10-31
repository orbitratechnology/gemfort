import assert from 'node:assert/strict';
import test from 'node:test';

import {
  apBalance,
  apOwedAmount,
  apPaymentStatus,
  apSettlementStatus,
  type ApBalanceLine,
} from './ap-balance';

const RATES = { LKR: 1, USD: 1 / 300 };

const sold = (ownerReceives: number, currency = 'LKR'): ApBalanceLine => ({
  lineStatus: 'sold',
  agreedPrice: ownerReceives,
  ownerReceives,
  currency,
});
const held = (agreedPrice: number): ApBalanceLine => ({ lineStatus: 'held', agreedPrice, currency: 'LKR' });

test('a partial payment leaves the AP partial with the remaining balance', () => {
  const lines = [sold(10_000), sold(5_000)];
  const owed = apOwedAmount(lines, 'LKR', RATES);
  assert.equal(owed, 15_000);
  assert.equal(apBalance(owed, 1_500), 13_500);
  assert.equal(apSettlementStatus({ lines, owed, amountPaid: 1_500 }), 'partial');
  assert.equal(apPaymentStatus(owed, 1_500), 'partial');
});

test('an exact payment closes the AP only once nothing is held', () => {
  const allSold = [sold(10_000)];
  assert.equal(apSettlementStatus({ lines: allSold, owed: 10_000, amountPaid: 10_000 }), 'done');
  assert.equal(apPaymentStatus(10_000, 10_000), 'paid');

  const stillHolding = [sold(10_000), held(4_000)];
  assert.equal(
    apSettlementStatus({ lines: stillHolding, owed: 10_000, amountPaid: 10_000 }),
    'accepted',
  );
});

test('balance never goes negative from rounding and flags overpayment', () => {
  assert.equal(apBalance(100.004, 100), 0);
  assert.ok(apBalance(100, 150) < 0, 'overpayment surfaces as a negative balance');
});

test('same-currency lines are summed exactly; other currencies go through LKR', () => {
  const lines = [sold(100, 'USD'), sold(30_000, 'LKR')];
  assert.equal(apOwedAmount(lines, 'USD', RATES), 200);
  assert.equal(apOwedAmount(lines, 'LKR', RATES), 60_000);
});

test('held and returned lines are not owed', () => {
  const lines: ApBalanceLine[] = [held(1_000), { lineStatus: 'returned', agreedPrice: 2_000 }];
  assert.equal(apOwedAmount(lines, 'LKR', RATES), 0);
  assert.equal(apSettlementStatus({ lines: [{ lineStatus: 'returned', agreedPrice: 1 }], owed: 0, amountPaid: 0 }), 'done');
});

test('a missing exchange rate is a precondition failure, not a crash', () => {
  assert.throws(
    () => apOwedAmount([sold(10, 'EUR')], 'LKR', RATES),
    (error: unknown) => (error as { code?: string }).code === 'failed-precondition',
  );
});
