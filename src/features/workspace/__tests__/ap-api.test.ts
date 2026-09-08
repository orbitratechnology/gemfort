import { callApi } from '@/lib/api/api-client';
import {
  apPaymentReceivedViaApi,
  apPaymentSentViaApi,
  cancelApRequestViaApi,
  createApRequestViaApi,
  deleteApRecordViaApi,
  recordApGemSaleViaApi,
  requestApCancellationViaApi,
  respondApCancellationViaApi,
  respondApRequestViaApi,
  returnApGemViaApi,
} from '../ap-api';

jest.mock('@/lib/api/api-client', () => ({
  callApi: jest.fn(),
}));

const mockedCallApi = callApi as jest.MockedFunction<typeof callApi>;

describe('AP API mutation transport', () => {
  beforeEach(() => {
    mockedCallApi.mockReset();
    mockedCallApi.mockResolvedValue({ apId: 'ap-1' } as never);
  });

  it('uses Hono routes for create, respond, cancel, return, and delete', async () => {
    await createApRequestViaApi({
      receiverContactId: 'contact-1',
      expectedDurationDays: 30,
      items: [{ gemId: 'gem-1', agreedPrice: 500 }],
    });
    await respondApRequestViaApi('ap-1', 'accepted');
    await cancelApRequestViaApi('ap-1');
    await returnApGemViaApi('ap-1', 'gem-1');
    await deleteApRecordViaApi('ap-1');

    expect(mockedCallApi).toHaveBeenNthCalledWith(
      1,
      '/v1/ap/requests',
      {
        receiverContactId: 'contact-1',
        expectedDurationDays: 30,
        items: [{ gemId: 'gem-1', agreedPrice: 500 }],
      },
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^mobile-ap-create-/),
      }),
    );
    expect(mockedCallApi).toHaveBeenNthCalledWith(
      2,
      '/v1/ap/requests/ap-1/respond',
      { action: 'accepted' },
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^mobile-ap-respond-accepted-/),
      }),
    );
    expect(mockedCallApi).toHaveBeenNthCalledWith(
      3,
      '/v1/ap/requests/ap-1/cancel',
      {},
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^mobile-ap-cancel-request-/),
      }),
    );
    expect(mockedCallApi).toHaveBeenNthCalledWith(
      4,
      '/v1/ap/ap-1/return',
      { gemId: 'gem-1' },
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^mobile-ap-return-/),
      }),
    );
    expect(mockedCallApi).toHaveBeenNthCalledWith(
      5,
      '/v1/ap/records/ap-1',
      undefined,
      expect.objectContaining({
        method: 'DELETE',
        idempotencyKey: expect.stringMatching(/^mobile-ap-delete-/),
      }),
    );
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
