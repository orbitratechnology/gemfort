import assert from 'node:assert/strict';
import test from 'node:test';

import {
  apPaymentEventId,
  apPaymentExpenseTransactionId,
  apPaymentIncomeTransactionId,
  apPaymentReceivedFingerprint,
  apPaymentSentFingerprint,
  apSaleFingerprint,
  apSaleTransactionId,
  deterministicApEventId,
} from './ap-financial-contract';

test('AP event IDs are deterministic, bounded, and namespaced', () => {
  const first = apSaleTransactionId('ap/legacy-looking-id', 'gem/one');
  assert.equal(first, apSaleTransactionId('ap/legacy-looking-id', 'gem/one'));
  assert.match(first, /^api-ap-sale-[a-f0-9]{40}$/);
  assert.notEqual(first, apPaymentEventId('ap/legacy-looking-id', 'sent'));
  assert.equal(
    deterministicApEventId('income', 'ap-1', 'payment-received'),
    apPaymentIncomeTransactionId('ap-1'),
  );
  assert.notEqual(apPaymentIncomeTransactionId('ap-1'), apPaymentExpenseTransactionId('ap-1'));
});

test('sale fingerprints normalize equivalent user input but reject changed money', () => {
  const first = apSaleFingerprint({
    gemId: 'gem-1',
    soldPrice: 1000,
    soldToName: '  Buyer  ',
    paymentDueDateIso: '2026-08-20',
    ownerReceives: 800,
    currency: 'usd',
  });
  const equivalent = apSaleFingerprint({
    gemId: 'gem-1',
    soldPrice: 1000,
    soldToName: 'Buyer',
    paymentDueDateIso: '2026-08-20T00:00:00.000Z',
    ownerReceives: 800,
    currency: 'USD',
  });
  assert.equal(first, equivalent);
  assert.notEqual(
    first,
    apSaleFingerprint({
      gemId: 'gem-1',
      soldPrice: 1001,
      ownerReceives: 800,
      currency: 'USD',
    }),
  );
});

test('payment fingerprints distinguish event type and receipt details', () => {
  const sent = apPaymentSentFingerprint({ method: 'transfer', amount: 500 });
  assert.equal(sent, apPaymentSentFingerprint({ method: 'transfer', amount: 500 }));
  assert.notEqual(sent, apPaymentSentFingerprint({ method: 'cash', amount: 500 }));
  assert.notEqual(
    apPaymentReceivedFingerprint({ method: 'transfer', amount: 500, currency: 'LKR' }),
    apPaymentReceivedFingerprint({ method: 'transfer', amount: 500, currency: 'USD' }),
  );
});
