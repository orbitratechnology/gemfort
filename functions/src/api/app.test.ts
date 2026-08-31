import assert from 'node:assert/strict';
import test from 'node:test';
import type { VerifyAppCheckTokenResponse } from 'firebase-admin/app-check';
import type { DecodedIdToken } from 'firebase-admin/auth';

import { apiApp, createApiApp } from './app';

const authenticatedApi = createApiApp({
  appCheckMode: 'enforce',
  verifyIdToken: async (token) => {
    assert.equal(token, 'id-token');
    return { uid: 'user-1' } as DecodedIdToken;
  },
  verifyAppCheck: async (token) => {
    assert.equal(token, 'app-check-token');
    return {
      appId: 'app-1',
      token: {} as VerifyAppCheckTokenResponse['token'],
    };
  },
});

test('health endpoint returns a request id and safe service metadata', async () => {
  const response = await apiApp.request('/healthz');
  const body = (await response.json()) as {
    ok: boolean;
    service: string;
    requestId: string;
  };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, 'gemfort-api');
  assert.ok(body.requestId.length > 0);
  assert.equal(response.headers.get('X-Request-ID'), body.requestId);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('readiness endpoint reports process readiness without touching Firebase', async () => {
  const response = await apiApp.request('/readyz');
  const body = (await response.json()) as {
    ok: boolean;
    service: string;
    checks: { process: boolean };
    requestId: string;
  };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, 'gemfort-api');
  assert.deepEqual(body.checks, { process: true });
  assert.ok(body.requestId.length > 0);
});

test('unknown routes use the canonical error envelope', async () => {
  const response = await apiApp.request('/not-a-route');
  const body = (await response.json()) as {
    error: { code: string; message: string; requestId: string };
  };

  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'not-found');
  assert.equal(body.error.message, 'Route not found.');
  assert.ok(body.error.requestId.length > 0);
});

test('protected routes reject requests without a Firebase ID token', async () => {
  const response = await authenticatedApi.request('/v1/flights/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Firebase-AppCheck': 'app-check-token',
    },
    body: '{}',
  });
  const body = (await response.json()) as { error: { code: string } };

  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'unauthenticated');
});

test('protected routes enforce App Check after Firebase Auth', async () => {
  const response = await authenticatedApi.request('/v1/flights/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer id-token',
    },
    body: '{}',
  });
  const body = (await response.json()) as { error: { code: string } };

  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'unauthenticated');
});

test('the migrated flight route preserves validation errors without calling the provider', async () => {
  const response = await authenticatedApi.request('/v1/flights/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer id-token',
      'X-Firebase-AppCheck': 'app-check-token',
    },
    body: JSON.stringify({
      origin: 'CMB',
      destination: 'CMB',
      departureAt: '2026-08-20',
      oneWay: true,
      direct: false,
      currency: 'USD',
    }),
  });
  const body = (await response.json()) as { error: { code: string; message: string } };

  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'invalid-argument');
  assert.equal(body.error.message, 'Origin and destination must be different.');
});

const adminApi = createApiApp({
  appCheckMode: 'enforce',
  verifyIdToken: async (token) => {
    assert.equal(token, 'id-token');
    return { uid: 'admin-1' } as DecodedIdToken;
  },
  verifyAppCheck: async (token) => {
    assert.equal(token, 'app-check-token');
    return {
      appId: 'app-1',
      token: {} as VerifyAppCheckTokenResponse['token'],
    };
  },
  verifyAdmin: async (uid) => {
    assert.equal(uid, 'admin-1');
    return true;
  },
  syncNews: async () => ({ written: 3, failedSources: 1, sources: 4 }),
});

const serviceApi = createApiApp({
  appCheckMode: 'enforce',
  verifyIdToken: async () => ({ uid: 'owner-1' }) as DecodedIdToken,
  verifyAppCheck: async () => ({
    appId: 'app-1',
    token: {} as VerifyAppCheckTokenResponse['token'],
  }),
  requestServiceCancellation: async (serviceId, uid) => {
    assert.equal(serviceId, 'service-1');
    assert.equal(uid, 'owner-1');
    return { ok: true, status: 'cancellation_requested' };
  },
  respondServiceCancellation: async (serviceId, uid, action) => {
    assert.equal(serviceId, 'service-1');
    assert.equal(uid, 'owner-1');
    assert.equal(action, 'accepted');
    return { ok: true, status: 'cancelled' };
  },
  requestApCancellation: async (apId, uid) => {
    assert.equal(apId, 'ap-1');
    assert.equal(uid, 'owner-1');
    return { ok: true, status: 'cancellation_requested' };
  },
  respondApCancellation: async (apId, uid, action) => {
    assert.equal(apId, 'ap-1');
    assert.equal(uid, 'owner-1');
    assert.equal(action, 'accepted');
    return { ok: true, status: 'cancelled' };
  },
  recordApGemSale: async (apId, uid, input) => {
    assert.equal(apId, 'ap-1');
    assert.equal(uid, 'owner-1');
    assert.equal(input.gemId, 'gem-1');
    assert.equal(input.soldPrice, 1000);
    return { ok: true, status: 'sold' };
  },
  apPaymentSent: async (apId, uid, input) => {
    assert.equal(apId, 'ap-1');
    assert.equal(uid, 'owner-1');
    assert.equal(input.method, 'transfer');
    return { ok: true, status: 'payment_sent' };
  },
  apPaymentReceived: async (apId, uid, input) => {
    assert.equal(apId, 'ap-1');
    assert.equal(uid, 'owner-1');
    assert.equal(input.method, 'transfer');
    return { ok: true, status: 'done' };
  },
});

test('the calendar route preserves validation errors without calling the provider', async () => {
  const response = await authenticatedApi.request('/v1/flights/calendar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer id-token',
      'X-Firebase-AppCheck': 'app-check-token',
    },
    body: JSON.stringify({
      origin: 'CMB',
      destination: 'CMB',
      departureAt: '2026-08-20',
      oneWay: true,
      direct: false,
      currency: 'USD',
    }),
  });
  const body = (await response.json()) as { error: { code: string; message: string } };

  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'invalid-argument');
  assert.equal(body.error.message, 'Origin and destination must be different.');
});

test('the booking-link route rejects untrusted provider hosts before using secrets', async () => {
  const response = await authenticatedApi.request('/v1/flights/booking-link', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer id-token',
      'X-Firebase-AppCheck': 'app-check-token',
    },
    body: JSON.stringify({ url: 'https://example.com/flight' }),
  });
  const body = (await response.json()) as { error: { code: string; message: string } };

  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'invalid-argument');
  assert.equal(body.error.message, 'Unsupported booking link.');
});

test('the admin news route verifies role before running the provider sync', async () => {
  const response = await adminApi.request('/v1/admin/news/sync', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer id-token',
      'X-Firebase-AppCheck': 'app-check-token',
    },
  });
  const body = (await response.json()) as {
    data: { written: number; failedSources: number; sources: number };
    meta: { requestId: string };
  };

  assert.equal(response.status, 200);
  assert.deepEqual(body.data, { written: 3, failedSources: 1, sources: 4 });
  assert.ok(body.meta.requestId.length > 0);
});

test('the admin news route rejects a non-admin before running the provider sync', async () => {
  let syncCalled = false;
  const nonAdminApi = createApiApp({
    appCheckMode: 'enforce',
    verifyIdToken: async () => ({ uid: 'trader-1' }) as DecodedIdToken,
    verifyAppCheck: async () => ({
      appId: 'app-1',
      token: {} as VerifyAppCheckTokenResponse['token'],
    }),
    verifyAdmin: async () => false,
    syncNews: async () => {
      syncCalled = true;
      return { written: 0, failedSources: 0, sources: 0 };
    },
  });

  const response = await nonAdminApi.request('/v1/admin/news/sync', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer id-token',
      'X-Firebase-AppCheck': 'app-check-token',
    },
  });
  const body = (await response.json()) as { error: { code: string; message: string } };

  assert.equal(response.status, 403);
  assert.equal(body.error.code, 'permission-denied');
  assert.equal(body.error.message, 'Admin only.');
  assert.equal(syncCalled, false);
});

test('service mutation routes require a bounded idempotency key', async () => {
  let called = false;
  const guardedApi = createApiApp({
    appCheckMode: 'enforce',
    verifyIdToken: async () => ({ uid: 'owner-1' }) as DecodedIdToken,
    verifyAppCheck: async () => ({
      appId: 'app-1',
      token: {} as VerifyAppCheckTokenResponse['token'],
    }),
    requestServiceCancellation: async () => {
      called = true;
      return { ok: true, status: 'cancelled' };
    },
  });

  const response = await guardedApi.request('/v1/services/service-1/cancellation', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer id-token',
      'X-Firebase-AppCheck': 'app-check-token',
    },
  });
  const body = (await response.json()) as { error: { code: string } };

  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'invalid-argument');
  assert.equal(called, false);
});

test('service cancellation routes pass verified identity and action to the handler', async () => {
  const requestResponse = await serviceApi.request('/v1/services/service-1/cancellation', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer id-token',
      'X-Firebase-AppCheck': 'app-check-token',
      'Idempotency-Key': 'service-cancel-1',
    },
  });
  const requestBody = (await requestResponse.json()) as {
    data: { ok: boolean; status: string };
  };
  assert.equal(requestResponse.status, 200);
  assert.deepEqual(requestBody.data, { ok: true, status: 'cancellation_requested' });

  const respondResponse = await serviceApi.request(
    '/v1/services/service-1/cancellation/respond',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer id-token',
        'X-Firebase-AppCheck': 'app-check-token',
        'Idempotency-Key': 'service-cancel-response-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'accepted' }),
    },
  );
  const respondBody = (await respondResponse.json()) as {
    data: { ok: boolean; status: string };
  };
  assert.equal(respondResponse.status, 200);
  assert.deepEqual(respondBody.data, { ok: true, status: 'cancelled' });

  const apRequestResponse = await serviceApi.request('/v1/ap/ap-1/cancellation', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer id-token',
      'X-Firebase-AppCheck': 'app-check-token',
      'Idempotency-Key': 'ap-cancel-1',
    },
  });
  const apRequestBody = (await apRequestResponse.json()) as {
    data: { ok: boolean; status: string };
  };
  assert.equal(apRequestResponse.status, 200);
  assert.deepEqual(apRequestBody.data, { ok: true, status: 'cancellation_requested' });

  const apRespondResponse = await serviceApi.request('/v1/ap/ap-1/cancellation/respond', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer id-token',
      'X-Firebase-AppCheck': 'app-check-token',
      'Idempotency-Key': 'ap-cancel-response-1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'accepted' }),
  });
  const apRespondBody = (await apRespondResponse.json()) as {
    data: { ok: boolean; status: string };
  };
  assert.equal(apRespondResponse.status, 200);
  assert.deepEqual(apRespondBody.data, { ok: true, status: 'cancelled' });

  const saleResponse = await serviceApi.request('/v1/ap/ap-1/sale', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer id-token',
      'X-Firebase-AppCheck': 'app-check-token',
      'Idempotency-Key': 'ap-sale-1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ gemId: 'gem-1', soldPrice: 1000 }),
  });
  const saleBody = (await saleResponse.json()) as {
    data: { ok: boolean; status: string };
  };
  assert.equal(saleResponse.status, 200);
  assert.deepEqual(saleBody.data, { ok: true, status: 'sold' });

  const paymentSentResponse = await serviceApi.request('/v1/ap/ap-1/payment-sent', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer id-token',
      'X-Firebase-AppCheck': 'app-check-token',
      'Idempotency-Key': 'ap-payment-sent-1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ method: 'transfer', amount: 800 }),
  });
  const paymentSentBody = (await paymentSentResponse.json()) as {
    data: { ok: boolean; status: string };
  };
  assert.equal(paymentSentResponse.status, 200);
  assert.deepEqual(paymentSentBody.data, { ok: true, status: 'payment_sent' });

  const paymentReceivedResponse = await serviceApi.request('/v1/ap/ap-1/payment-received', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer id-token',
      'X-Firebase-AppCheck': 'app-check-token',
      'Idempotency-Key': 'ap-payment-received-1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ method: 'transfer' }),
  });
  const paymentReceivedBody = (await paymentReceivedResponse.json()) as {
    data: { ok: boolean; status: string };
  };
  assert.equal(paymentReceivedResponse.status, 200);
  assert.deepEqual(paymentReceivedBody.data, { ok: true, status: 'done' });
});

test('service cancellation response rejects invalid actions before the handler', async () => {
  let called = false;
  const invalidActionApi = createApiApp({
    appCheckMode: 'enforce',
    verifyIdToken: async () => ({ uid: 'owner-1' }) as DecodedIdToken,
    verifyAppCheck: async () => ({
      appId: 'app-1',
      token: {} as VerifyAppCheckTokenResponse['token'],
    }),
    respondServiceCancellation: async () => {
      called = true;
      return { ok: true, status: 'cancelled' };
    },
  });

  const response = await invalidActionApi.request(
    '/v1/services/service-1/cancellation/respond',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer id-token',
        'X-Firebase-AppCheck': 'app-check-token',
        'Idempotency-Key': 'service-cancel-invalid-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'unknown' }),
    },
  );
  const body = (await response.json()) as { error: { code: string } };

  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'invalid-argument');
  assert.equal(called, false);
});
