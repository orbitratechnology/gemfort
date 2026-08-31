import { callApi } from '@/lib/api/api-client';
import {
  apPaymentReceivedViaApi,
  apPaymentSentViaApi,
  recordApGemSaleViaApi,
  requestApCancellationViaApi,
  respondApCancellationViaApi,
} from '../ap-api';

jest.mock('@/lib/api/api-client', () => ({
  callApi: jest.fn(),
  isGemfortApApiCanaryEnabled: jest.fn(),
}));

const mockedCallApi = callApi as jest.MockedFunction<typeof callApi>;

describe('AP API mutation transport', () => {
  beforeEach(() => {
    mockedCallApi.mockReset();
    mockedCallApi.mockResolvedValue({ ok: true });
  });

  it('uses the API cancellation request route and an idempotency key', async () => {
    await requestApCancellationViaApi('ap/unsafe?not-used');

    expect(mockedCallApi).toHaveBeenCalledWith(
      '/v1/ap/ap%2Funsafe%3Fnot-used/cancellation',
      {},
      expect.objectContaining({
        retryAuthOn401: true,
        idempotencyKey: expect.stringMatching(/^mobile-ap-cancel-request-/),
      }),
    );
  });

  it('maps cancellation responses, sale, and both payment payloads', async () => {
    await respondApCancellationViaApi('ap-1', 'accepted');
    await recordApGemSaleViaApi({
      apId: 'ap-1',
      gemId: 'gem-1',
      soldPrice: 500,
      soldToName: 'Buyer',
      paymentDueDateIso: null,
      ownerReceives: 400,
    });
    await apPaymentSentViaApi({
      apId: 'ap-1',
      method: 'transfer',
      amount: 400,
      chequeId: null,
      receiptUrl: null,
    });
    await apPaymentReceivedViaApi({
      apId: 'ap-1',
      method: 'transfer',
      chequeId: null,
      receiptUrl: null,
    });

    expect(mockedCallApi).toHaveBeenNthCalledWith(
      1,
      '/v1/ap/ap-1/cancellation/respond',
      { action: 'accepted' },
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^mobile-ap-cancel-accepted-/),
      }),
    );
    expect(mockedCallApi).toHaveBeenNthCalledWith(
      2,
      '/v1/ap/ap-1/sale',
      {
        gemId: 'gem-1',
        soldPrice: 500,
        soldToName: 'Buyer',
        paymentDueDateIso: null,
        ownerReceives: 400,
      },
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^mobile-ap-sale-/),
      }),
    );
    expect(mockedCallApi).toHaveBeenNthCalledWith(
      3,
      '/v1/ap/ap-1/payment-sent',
      {
        method: 'transfer',
        amount: 400,
        chequeId: null,
        receiptUrl: null,
      },
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^mobile-ap-payment-sent-/),
      }),
    );
    expect(mockedCallApi).toHaveBeenNthCalledWith(
      4,
      '/v1/ap/ap-1/payment-received',
      {
        method: 'transfer',
        chequeId: null,
        receiptUrl: null,
      },
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^mobile-ap-payment-received-/),
      }),
    );
  });
});
