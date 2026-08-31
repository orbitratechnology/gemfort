import { Hono } from 'hono';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';

import { db } from '../admin';
import {
  requestApCancellationForApi,
  respondApCancellationForApi,
  type ApCancellationResult,
} from '../gemtrack/ap-cancellation-api';
import {
  parseRecordApGemSaleInput,
  recordApGemSaleForApi,
  type RecordApGemSaleResult,
} from '../gemtrack/ap-sale-api';
import {
  apPaymentReceivedForApi,
  apPaymentSentForApi,
  parseApPaymentReceivedInput,
  parseApPaymentSentInput,
  type ApPaymentResult,
} from '../gemtrack/ap-payment-api';
import {
  createFlightBookingLinkForApi,
  getFlightPriceCalendarForApi,
  searchFlightsForApi,
} from '../flights';
import {
  firecrawlApiKey,
  geminiApiKey,
  syncNewsOnce,
  type NewsSyncSummary,
} from '../news/sync-gem-news';
import {
  requestServiceCancellationForApi,
  respondServiceCancellationForApi,
  type ServiceCancellationResult,
} from '../gemtrack/service-cancellation-api';
import { validateIdempotencyKey } from '../gemtrack/mutation-contract';
import { apiErrorResponse, ApiError, toApiError } from './errors';
import {
  requireFirebaseAppCheck,
  requireFirebaseAuth,
  type AppCheckMode,
  type VerifyAppCheckToken,
  type VerifyIdToken,
} from './middleware';
import type { ApiEnv } from './types';

export type ApiAppOptions = {
  verifyIdToken?: VerifyIdToken;
  verifyAppCheck?: VerifyAppCheckToken;
  appCheckMode?: AppCheckMode;
  verifyAdmin?: (uid: string) => Promise<boolean>;
  syncNews?: () => Promise<NewsSyncSummary>;
  requestServiceCancellation?: (
    serviceId: string,
    uid: string,
  ) => Promise<ServiceCancellationResult>;
  respondServiceCancellation?: (
    serviceId: string,
    uid: string,
    action: 'accepted' | 'rejected',
  ) => Promise<ServiceCancellationResult>;
  requestApCancellation?: (apId: string, uid: string) => Promise<ApCancellationResult>;
  respondApCancellation?: (
    apId: string,
    uid: string,
    action: 'accepted' | 'rejected',
  ) => Promise<ApCancellationResult>;
  recordApGemSale?: (
    apId: string,
    uid: string,
    input: ReturnType<typeof parseRecordApGemSaleInput>,
  ) => Promise<RecordApGemSaleResult>;
  apPaymentSent?: (
    apId: string,
    uid: string,
    input: ReturnType<typeof parseApPaymentSentInput>,
  ) => Promise<ApPaymentResult>;
  apPaymentReceived?: (
    apId: string,
    uid: string,
    input: ReturnType<typeof parseApPaymentReceivedInput>,
  ) => Promise<ApPaymentResult>;
};

async function defaultVerifyAdmin(uid: string): Promise<boolean> {
  const snapshot = await db.collection('users').doc(uid).get();
  return snapshot.data()?.role === 'admin';
}

function defaultSyncNews(): Promise<NewsSyncSummary> {
  return syncNewsOnce(geminiApiKey.value(), firecrawlApiKey.value());
}

/**
 * Framework boundary for the future consolidated API.
 *
 * This app is exported through the isolated gemfortApi deployment adapter;
 * legacy callable and trigger exports remain separate.
 */
export function createApiApp(options: ApiAppOptions = {}) {
  const app = new Hono<ApiEnv>();

  app.use('*', requestId());
  app.use('*', secureHeaders());

  app.get('/healthz', (c) => {
    return c.json({
      ok: true as const,
      service: 'gemfort-api',
      requestId: c.get('requestId'),
    });
  });

  app.get('/readyz', (c) => {
    return c.json({
      ok: true as const,
      service: 'gemfort-api',
      checks: { process: true as const },
      requestId: c.get('requestId'),
    });
  });

  const auth = requireFirebaseAuth(options.verifyIdToken);
  const appCheck = requireFirebaseAppCheck({
    mode: options.appCheckMode ?? 'enforce',
    verifyToken: options.verifyAppCheck,
  });
  const verifyAdmin = options.verifyAdmin ?? defaultVerifyAdmin;
  const runNewsSync = options.syncNews ?? defaultSyncNews;
  const requestServiceCancellation =
    options.requestServiceCancellation ?? requestServiceCancellationForApi;
  const respondServiceCancellation =
    options.respondServiceCancellation ?? respondServiceCancellationForApi;
  const requestApCancellation = options.requestApCancellation ?? requestApCancellationForApi;
  const respondApCancellation = options.respondApCancellation ?? respondApCancellationForApi;
  const recordApGemSale = options.recordApGemSale ?? recordApGemSaleForApi;
  const apPaymentSent = options.apPaymentSent ?? apPaymentSentForApi;
  const apPaymentReceived = options.apPaymentReceived ?? apPaymentReceivedForApi;

  function requireIdempotencyKey(c: { req: { header(name: string): string | undefined } }) {
    try {
      validateIdempotencyKey(c.req.header('Idempotency-Key'));
    } catch (error) {
      throw new ApiError(
        'invalid-argument',
        error instanceof Error ? error.message : 'A valid Idempotency-Key is required.',
      );
    }
  }

  app.post('/v1/flights/search', auth, appCheck, async (c) => {
    let input: unknown;
    try {
      input = await c.req.json();
    } catch {
      throw new ApiError('invalid-argument', 'Request body must be valid JSON.');
    }

    const result = await searchFlightsForApi(input);
    return c.json({
      data: result,
      meta: { requestId: c.get('requestId') },
    });
  });

  app.post('/v1/flights/calendar', auth, appCheck, async (c) => {
    let input: unknown;
    try {
      input = await c.req.json();
    } catch {
      throw new ApiError('invalid-argument', 'Request body must be valid JSON.');
    }

    const result = await getFlightPriceCalendarForApi(input);
    return c.json({
      data: result,
      meta: { requestId: c.get('requestId') },
    });
  });

  app.post('/v1/flights/booking-link', auth, appCheck, async (c) => {
    let input: unknown;
    try {
      input = await c.req.json();
    } catch {
      throw new ApiError('invalid-argument', 'Request body must be valid JSON.');
    }

    const result = await createFlightBookingLinkForApi(input);
    return c.json({
      data: result,
      meta: { requestId: c.get('requestId') },
    });
  });

  app.post('/v1/admin/news/sync', auth, appCheck, async (c) => {
    const user = c.get('user');
    if (!user || !(await verifyAdmin(user.uid))) {
      throw new ApiError('permission-denied', 'Admin only.');
    }

    const result = await runNewsSync();
    return c.json({
      data: result,
      meta: { requestId: c.get('requestId') },
    });
  });

  app.post('/v1/services/:serviceId/cancellation', auth, appCheck, async (c) => {
    requireIdempotencyKey(c);
    const user = c.get('user');
    if (!user) throw new ApiError('unauthenticated', 'Sign in to continue.');

    const result = await requestServiceCancellation(c.req.param('serviceId'), user.uid);
    return c.json({
      data: result,
      meta: { requestId: c.get('requestId') },
    });
  });

  app.post('/v1/services/:serviceId/cancellation/respond', auth, appCheck, async (c) => {
    requireIdempotencyKey(c);
    const user = c.get('user');
    if (!user) throw new ApiError('unauthenticated', 'Sign in to continue.');

    let input: unknown;
    try {
      input = await c.req.json();
    } catch {
      throw new ApiError('invalid-argument', 'Request body must be valid JSON.');
    }
    const action =
      typeof input === 'object' && input !== null && 'action' in input
        ? (input as { action?: unknown }).action
        : undefined;
    if (action !== 'accepted' && action !== 'rejected') {
      throw new ApiError('invalid-argument', 'action must be accepted or rejected.');
    }

    const result = await respondServiceCancellation(
      c.req.param('serviceId'),
      user.uid,
      action,
    );
    return c.json({
      data: result,
      meta: { requestId: c.get('requestId') },
    });
  });

  app.post('/v1/ap/:apId/cancellation', auth, appCheck, async (c) => {
    requireIdempotencyKey(c);
    const user = c.get('user');
    if (!user) throw new ApiError('unauthenticated', 'Sign in to continue.');

    const result = await requestApCancellation(c.req.param('apId'), user.uid);
    return c.json({
      data: result,
      meta: { requestId: c.get('requestId') },
    });
  });

  app.post('/v1/ap/:apId/cancellation/respond', auth, appCheck, async (c) => {
    requireIdempotencyKey(c);
    const user = c.get('user');
    if (!user) throw new ApiError('unauthenticated', 'Sign in to continue.');

    let input: unknown;
    try {
      input = await c.req.json();
    } catch {
      throw new ApiError('invalid-argument', 'Request body must be valid JSON.');
    }
    const action =
      typeof input === 'object' && input !== null && 'action' in input
        ? (input as { action?: unknown }).action
        : undefined;
    if (action !== 'accepted' && action !== 'rejected') {
      throw new ApiError('invalid-argument', 'action must be accepted or rejected.');
    }

    const result = await respondApCancellation(c.req.param('apId'), user.uid, action);
    return c.json({
      data: result,
      meta: { requestId: c.get('requestId') },
    });
  });

  app.post('/v1/ap/:apId/sale', auth, appCheck, async (c) => {
    requireIdempotencyKey(c);
    const user = c.get('user');
    if (!user) throw new ApiError('unauthenticated', 'Sign in to continue.');

    let input: unknown;
    try {
      input = await c.req.json();
    } catch {
      throw new ApiError('invalid-argument', 'Request body must be valid JSON.');
    }
    const result = await recordApGemSale(c.req.param('apId'), user.uid, parseRecordApGemSaleInput(input));
    return c.json({
      data: result,
      meta: { requestId: c.get('requestId') },
    });
  });

  app.post('/v1/ap/:apId/payment-sent', auth, appCheck, async (c) => {
    requireIdempotencyKey(c);
    const user = c.get('user');
    if (!user) throw new ApiError('unauthenticated', 'Sign in to continue.');

    let input: unknown;
    try {
      input = await c.req.json();
    } catch {
      throw new ApiError('invalid-argument', 'Request body must be valid JSON.');
    }
    const result = await apPaymentSent(
      c.req.param('apId'),
      user.uid,
      parseApPaymentSentInput(input),
    );
    return c.json({
      data: result,
      meta: { requestId: c.get('requestId') },
    });
  });

  app.post('/v1/ap/:apId/payment-received', auth, appCheck, async (c) => {
    requireIdempotencyKey(c);
    const user = c.get('user');
    if (!user) throw new ApiError('unauthenticated', 'Sign in to continue.');

    let input: unknown;
    try {
      input = await c.req.json();
    } catch {
      throw new ApiError('invalid-argument', 'Request body must be valid JSON.');
    }
    const result = await apPaymentReceived(
      c.req.param('apId'),
      user.uid,
      parseApPaymentReceivedInput(input),
    );
    return c.json({
      data: result,
      meta: { requestId: c.get('requestId') },
    });
  });

  app.notFound((c) => {
    return c.json(
      {
        error: {
          code: 'not-found',
          message: 'Route not found.',
          requestId: c.get('requestId'),
        },
      },
      404,
    );
  });

  app.onError((error, c) => {
    const apiError = toApiError(error);
    if (apiError.code === 'internal') {
      console.error('gemfort-api-unhandled-error', {
        requestId: c.get('requestId'),
        message: error instanceof Error ? error.message : 'unknown error',
      });
    }
    return apiErrorResponse(c, apiError);
  });

  return app;
}

export const apiApp = createApiApp();
export type ApiApp = typeof apiApp;
export default apiApp;
