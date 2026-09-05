import { Hono } from 'hono';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';

import { deleteMyAccountForApi, type DeleteAccountResult } from '../account/delete-account-api';
import { linkVerifiedPhoneForApi } from '../auth/link-verified-phone';
import {
  cancelApRequestForApi,
  createApRequestForApi,
  deleteApRecordForApi,
  parseCreateApRequestInput,
  parseRespondApRequestInput,
  parseReturnApGemInput,
  respondApRequestForApi,
  returnApGemForApi,
  type ApLifecycleResult,
  type CreateApRequestInput,
} from './ap-request-api';
import {
  requestApCancellationForApi,
  respondApCancellationForApi,
  type ApCancellationResult,
} from '../gemtrack/ap-cancellation-api';
import { validateIdempotencyKey } from '../gemtrack/mutation-contract';
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
  requestServiceCancellationForApi,
  respondServiceCancellationForApi,
  type ServiceCancellationResult,
} from '../gemtrack/service-cancellation-api';
import { executeIdempotent, type MutationExecutor } from './idempotency';
import { apiErrorResponse, ApiError, toApiError } from './errors';
import {
  requireFirebaseAppCheck,
  requireFirebaseAuth,
  type AppCheckMode,
  type VerifyAppCheckToken,
  type VerifyIdToken,
} from './middleware';
import type { ApiEnv } from './types';

const MAX_JSON_BODY_BYTES = 64 * 1024;
const ALLOWED_CORS_ORIGINS = (process.env.GEMFORT_API_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const COMPAT_CALLABLES = new Set([
  'createApRequest',
  'respondApRequest',
  'cancelApRequest',
  'recordApGemSale',
  'returnApGem',
  'apPaymentSent',
  'apPaymentReceived',
  'requestApCancellation',
  'respondApCancellation',
  'deleteApRecord',
  'requestServiceCancellation',
  'respondServiceCancellation',
  'linkVerifiedPhone',
  'deleteMyAccount',
  'searchFlights',
  'getFlightPriceCalendar',
  'createFlightBookingLink',
]);

const COMPAT_MUTATIONS = new Set([
  'createApRequest',
  'respondApRequest',
  'cancelApRequest',
  'recordApGemSale',
  'returnApGem',
  'apPaymentSent',
  'apPaymentReceived',
  'requestApCancellation',
  'respondApCancellation',
  'deleteApRecord',
  'requestServiceCancellation',
  'respondServiceCancellation',
  'linkVerifiedPhone',
  'deleteMyAccount',
]);

type ApiContext = Context<ApiEnv>;
type CallableEnvelope = { data?: unknown };

export type ApiAppOptions = {
  verifyIdToken?: VerifyIdToken;
  verifyAppCheck?: VerifyAppCheckToken;
  appCheckMode?: AppCheckMode;
  createApRequest?: (
    uid: string,
    input: CreateApRequestInput,
    idempotencyKey?: string,
  ) => Promise<{ apId: string }>;
  respondApRequest?: (
    apId: string,
    uid: string,
    action: 'accepted' | 'rejected',
    rejectionReason?: string | null,
  ) => Promise<ApLifecycleResult>;
  cancelApRequest?: (apId: string, uid: string) => Promise<ApLifecycleResult>;
  returnApGem?: (apId: string, uid: string, gemId: string) => Promise<ApLifecycleResult>;
  deleteApRecord?: (apId: string, uid: string) => Promise<ApLifecycleResult>;
  linkVerifiedPhone?: (uid: string, token: unknown) => Promise<{ phoneNumber: string }>;
  deleteMyAccount?: (uid: string, authTime: number | undefined) => Promise<DeleteAccountResult>;
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
  executeMutation?: MutationExecutor;
};

function requireUser(c: ApiContext): NonNullable<ApiEnv['Variables']['user']> {
  const user = c.get('user');
  if (!user) throw new ApiError('unauthenticated', 'Sign in to continue.');
  return user;
}

async function readJson(c: ApiContext): Promise<unknown> {
  const contentType = c.req.header('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new ApiError('invalid-argument', 'Content-Type must be application/json.');
  }
  try {
    return await c.req.json();
  } catch {
    throw new ApiError('invalid-argument', 'Request body must be valid JSON.');
  }
}

function routeOf(c: ApiContext): string {
  return c.req.routePath || c.req.path;
}

function requiredRouteParam(c: ApiContext, name: string): string {
  const value = c.req.param(name);
  if (!value) throw new ApiError('invalid-argument', `${name} is required.`);
  return value;
}

function actionOf(value: unknown): 'accepted' | 'rejected' {
  if (value !== 'accepted' && value !== 'rejected') {
    throw new ApiError('invalid-argument', 'action must be accepted or rejected.');
  }
  return value;
}

function requiredStringField(value: unknown, name: string): string {
  if (!value || typeof value !== 'object' || typeof (value as Record<string, unknown>)[name] !== 'string') {
    throw new ApiError('invalid-argument', `${name} is required.`);
  }
  return (value as Record<string, string>)[name];
}

function requiredIdempotencyKey(c: ApiContext): string {
  try {
    return validateIdempotencyKey(c.req.header('Idempotency-Key'));
  } catch (error) {
    throw new ApiError(
      'invalid-argument',
      error instanceof Error ? error.message : 'A valid Idempotency-Key is required.',
    );
  }
}

function success<T>(c: ApiContext, data: T): Response {
  return c.json({ data, meta: { requestId: c.get('requestId') } });
}

function compatibilityError(c: ApiContext, error: unknown): Response {
  const apiError = toApiError(error);
  return c.json(
    {
      error: {
        status: apiError.code.toUpperCase().replaceAll('-', '_'),
        message: apiError.message,
        details: null,
      },
    },
    apiError.status,
  );
}

/**
 * One Hono boundary for all callable/API workloads. Legacy exports remain in
 * index.ts for rollback, while migrated mutations use API-owned handlers.
 */
export function createApiApp(options: ApiAppOptions = {}) {
  const app = new Hono<ApiEnv>();

  app.use('*', requestId({ limitLength: 128 }));
  app.use('*', secureHeaders());
  app.use(
    '/v1/*',
    cors({
      origin: (origin) => (ALLOWED_CORS_ORIGINS.includes(origin) ? origin : undefined),
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: [
        'Authorization',
        'Content-Type',
        'X-Firebase-AppCheck',
        'Idempotency-Key',
        'X-Request-Id',
      ],
      exposeHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );
  app.use(
    '/v1/*',
    bodyLimit({
      maxSize: MAX_JSON_BODY_BYTES,
      onError: (c) =>
        c.json(
          {
            error: {
              code: 'resource-exhausted',
              message: 'Request body is too large.',
              requestId: c.get('requestId'),
            },
          },
          429,
        ),
    }),
  );

  app.get('/healthz', (c) =>
    c.json({ ok: true as const, service: 'gemfort-api', requestId: c.get('requestId') }),
  );

  app.get('/readyz', (c) =>
    c.json({
      ok: true as const,
      service: 'gemfort-api',
      checks: { process: true as const },
      requestId: c.get('requestId'),
    }),
  );

  const auth = requireFirebaseAuth(options.verifyIdToken);
  const appCheck = requireFirebaseAppCheck({
    mode: options.appCheckMode ?? 'enforce',
    verifyToken: options.verifyAppCheck,
  });
  const createApRequest = options.createApRequest ?? createApRequestForApi;
  const respondApRequest = options.respondApRequest ?? respondApRequestForApi;
  const cancelApRequest = options.cancelApRequest ?? cancelApRequestForApi;
  const returnApGem = options.returnApGem ?? returnApGemForApi;
  const deleteApRecord = options.deleteApRecord ?? deleteApRecordForApi;
  const linkVerifiedPhone = options.linkVerifiedPhone ?? linkVerifiedPhoneForApi;
  const deleteMyAccount = options.deleteMyAccount ?? deleteMyAccountForApi;
  const requestServiceCancellation =
    options.requestServiceCancellation ?? requestServiceCancellationForApi;
  const respondServiceCancellation =
    options.respondServiceCancellation ?? respondServiceCancellationForApi;
  const requestApCancellation = options.requestApCancellation ?? requestApCancellationForApi;
  const respondApCancellation = options.respondApCancellation ?? respondApCancellationForApi;
  const recordApGemSale = options.recordApGemSale ?? recordApGemSaleForApi;
  const apPaymentSent = options.apPaymentSent ?? apPaymentSentForApi;
  const apPaymentReceived = options.apPaymentReceived ?? apPaymentReceivedForApi;
  const runMutation = options.executeMutation ?? executeIdempotent;

  const mutation = <T>(
    c: ApiContext,
    request: unknown,
    execute: (uid: string) => Promise<T>,
  ): Promise<T> => {
    const user = requireUser(c);
    const key = requiredIdempotencyKey(c);
    return runMutation({
      uid: user.uid,
      route: routeOf(c),
      key,
      request,
      execute: () => execute(user.uid),
    });
  };

  app.post('/v1/ap/requests', auth, appCheck, async (c) => {
    const input = parseCreateApRequestInput(await readJson(c));
    const idempotencyKey = requiredIdempotencyKey(c);
    return success(c, await mutation(c, input, (uid) => createApRequest(uid, input, idempotencyKey)));
  });

  app.post('/v1/ap/requests/:apId/respond', auth, appCheck, async (c) => {
    const input = parseRespondApRequestInput(await readJson(c));
    const apId = requiredRouteParam(c, 'apId');
    const data = await mutation(c, { apId, ...input }, (uid) =>
      respondApRequest(apId, uid, input.action, input.rejectionReason),
    );
    return success(c, data);
  });

  app.post('/v1/ap/requests/:apId/cancel', auth, appCheck, async (c) => {
    const apId = requiredRouteParam(c, 'apId');
    return success(c, await mutation(c, { apId }, (uid) => cancelApRequest(apId, uid)));
  });

  const saleHandler = async (c: ApiContext) => {
    const input = parseRecordApGemSaleInput(await readJson(c));
    const apId = requiredRouteParam(c, 'apId');
    return success(c, await mutation(c, { apId, input }, (uid) => recordApGemSale(apId, uid, input)));
  };
  app.post('/v1/ap/records/:apId/sale', auth, appCheck, saleHandler);
  app.post('/v1/ap/:apId/sale', auth, appCheck, saleHandler);

  const returnHandler = async (c: ApiContext) => {
    const input = parseReturnApGemInput(await readJson(c));
    const apId = requiredRouteParam(c, 'apId');
    return success(c, await mutation(c, { apId, ...input }, (uid) => returnApGem(apId, uid, input.gemId)));
  };
  app.post('/v1/ap/records/:apId/return', auth, appCheck, returnHandler);
  app.post('/v1/ap/:apId/return', auth, appCheck, returnHandler);

  const paymentSentHandler = async (c: ApiContext) => {
    const input = parseApPaymentSentInput(await readJson(c));
    const apId = requiredRouteParam(c, 'apId');
    return success(c, await mutation(c, { apId, input }, (uid) => apPaymentSent(apId, uid, input)));
  };
  app.post('/v1/ap/records/:apId/payment-sent', auth, appCheck, paymentSentHandler);
  app.post('/v1/ap/:apId/payment-sent', auth, appCheck, paymentSentHandler);

  const paymentReceivedHandler = async (c: ApiContext) => {
    const input = parseApPaymentReceivedInput(await readJson(c));
    const apId = requiredRouteParam(c, 'apId');
    return success(c, await mutation(c, { apId, input }, (uid) => apPaymentReceived(apId, uid, input)));
  };
  app.post('/v1/ap/records/:apId/payment-received', auth, appCheck, paymentReceivedHandler);
  app.post('/v1/ap/:apId/payment-received', auth, appCheck, paymentReceivedHandler);

  const apCancellationHandler = async (c: ApiContext) => {
    const apId = requiredRouteParam(c, 'apId');
    return success(c, await mutation(c, { apId }, (uid) => requestApCancellation(apId, uid)));
  };
  app.post('/v1/ap/records/:apId/cancellation', auth, appCheck, apCancellationHandler);
  app.post('/v1/ap/:apId/cancellation', auth, appCheck, apCancellationHandler);

  const apCancellationResponseHandler = async (c: ApiContext) => {
    const input = await readJson(c);
    if (!input || typeof input !== 'object') {
      throw new ApiError('invalid-argument', 'Request body must be a JSON object.');
    }
    const action = actionOf((input as { action?: unknown }).action);
    const apId = requiredRouteParam(c, 'apId');
    return success(c, await mutation(c, { apId, action }, (uid) =>
      respondApCancellation(apId, uid, action),
    ));
  };
  app.post('/v1/ap/records/:apId/cancellation/respond', auth, appCheck, apCancellationResponseHandler);
  app.post('/v1/ap/:apId/cancellation/respond', auth, appCheck, apCancellationResponseHandler);

  const deleteApHandler = async (c: ApiContext) => {
    const apId = requiredRouteParam(c, 'apId');
    return success(c, await mutation(c, { apId }, (uid) => deleteApRecord(apId, uid)));
  };
  app.delete('/v1/ap/records/:apId', auth, appCheck, deleteApHandler);

  app.post('/v1/services/:serviceId/cancellation', auth, appCheck, async (c) => {
    const serviceId = requiredRouteParam(c, 'serviceId');
    return success(c, await mutation(c, { serviceId }, (uid) =>
      requestServiceCancellation(serviceId, uid),
    ));
  });

  app.post('/v1/services/:serviceId/cancellation/respond', auth, appCheck, async (c) => {
    const input = await readJson(c);
    if (!input || typeof input !== 'object') {
      throw new ApiError('invalid-argument', 'Request body must be a JSON object.');
    }
    const action = actionOf((input as { action?: unknown }).action);
    const serviceId = requiredRouteParam(c, 'serviceId');
    return success(c, await mutation(c, { serviceId, action }, (uid) =>
      respondServiceCancellation(serviceId, uid, action),
    ));
  });

  app.post('/v1/auth/phone/link', auth, appCheck, async (c) => {
    const input = await readJson(c);
    if (!input || typeof input !== 'object') {
      throw new ApiError('invalid-argument', 'Request body must be a JSON object.');
    }
    const token = (input as { token?: unknown }).token;
    return success(c, await mutation(c, { token }, (uid) => linkVerifiedPhone(uid, token)));
  });

  app.delete('/v1/account', auth, appCheck, async (c) => {
    const user = requireUser(c);
    return success(c, await mutation(c, null, (uid) =>
      deleteMyAccount(uid, user.token.auth_time),
    ));
  });

  app.post('/v1/flights/search', auth, appCheck, async (c) =>
    success(c, await searchFlightsForApi(await readJson(c))),
  );

  app.post('/v1/flights/calendar', auth, appCheck, async (c) =>
    success(c, await getFlightPriceCalendarForApi(await readJson(c))),
  );

  app.post('/v1/flights/booking-link', auth, appCheck, async (c) =>
    success(c, await createFlightBookingLinkForApi(await readJson(c))),
  );

  app.post('/v1/compat/callable/:functionName', auth, appCheck, async (c) => {
    try {
      const functionName = c.req.param('functionName');
      if (!COMPAT_CALLABLES.has(functionName)) {
        throw new ApiError('not-found', 'Callable compatibility route not found.');
      }

      const envelope = (await readJson(c)) as CallableEnvelope;
      const data = envelope?.data;
      const user = requireUser(c);
      const idempotencyKey = COMPAT_MUTATIONS.has(functionName)
        ? requiredIdempotencyKey(c)
        : undefined;
      const execute = async () => {
          switch (functionName) {
            case 'createApRequest':
              return createApRequest(user.uid, parseCreateApRequestInput(data), idempotencyKey);
            case 'respondApRequest': {
              if (!data || typeof data !== 'object') throw new ApiError('invalid-argument', 'Request data must be an object.');
              const value = data as { apId?: unknown; action?: unknown; rejectionReason?: unknown };
              if (typeof value.apId !== 'string') throw new ApiError('invalid-argument', 'apId is required.');
              const parsed = parseRespondApRequestInput({ action: value.action, rejectionReason: value.rejectionReason });
              return respondApRequest(value.apId, user.uid, parsed.action, parsed.rejectionReason);
            }
            case 'cancelApRequest':
              return cancelApRequest(requiredStringField(data, 'apId'), user.uid);
            case 'recordApGemSale': {
              const value = { apId: requiredStringField(data, 'apId') };
              return recordApGemSale(value.apId, user.uid, parseRecordApGemSaleInput(data));
            }
            case 'returnApGem': {
              if (!data || typeof data !== 'object') throw new ApiError('invalid-argument', 'Request data must be an object.');
              const value = data as { apId?: unknown; gemId?: unknown };
              if (typeof value.apId !== 'string' || typeof value.gemId !== 'string') throw new ApiError('invalid-argument', 'apId and gemId are required.');
              return returnApGem(value.apId, user.uid, value.gemId);
            }
            case 'apPaymentSent': {
              const value = { apId: requiredStringField(data, 'apId') };
              return apPaymentSent(value.apId, user.uid, parseApPaymentSentInput(data));
            }
            case 'apPaymentReceived': {
              const value = { apId: requiredStringField(data, 'apId') };
              return apPaymentReceived(value.apId, user.uid, parseApPaymentReceivedInput(data));
            }
            case 'requestApCancellation':
              return requestApCancellation(requiredStringField(data, 'apId'), user.uid);
            case 'respondApCancellation': {
              if (!data || typeof data !== 'object') throw new ApiError('invalid-argument', 'Request data must be an object.');
              const value = data as { apId?: unknown; action?: unknown };
              if (typeof value.apId !== 'string') throw new ApiError('invalid-argument', 'apId is required.');
              return respondApCancellation(value.apId, user.uid, actionOf(value.action));
            }
            case 'deleteApRecord':
              return deleteApRecord(requiredStringField(data, 'apId'), user.uid);
            case 'requestServiceCancellation':
              return requestServiceCancellation(requiredStringField(data, 'serviceId'), user.uid);
            case 'respondServiceCancellation': {
              if (!data || typeof data !== 'object') throw new ApiError('invalid-argument', 'Request data must be an object.');
              const value = data as { serviceId?: unknown; action?: unknown };
              if (typeof value.serviceId !== 'string') throw new ApiError('invalid-argument', 'serviceId is required.');
              return respondServiceCancellation(value.serviceId, user.uid, actionOf(value.action));
            }
            case 'linkVerifiedPhone': {
              const token = data && typeof data === 'object' ? (data as { token?: unknown }).token : undefined;
              return linkVerifiedPhone(user.uid, token);
            }
            case 'deleteMyAccount':
              return deleteMyAccount(user.uid, user.token.auth_time);
            case 'searchFlights':
              return searchFlightsForApi(data);
            case 'getFlightPriceCalendar':
              return getFlightPriceCalendarForApi(data);
            case 'createFlightBookingLink':
              return createFlightBookingLinkForApi(data);
            default:
              throw new ApiError('not-found', 'Callable compatibility route not found.');
          }
      };
      const result = COMPAT_MUTATIONS.has(functionName)
        ? await runMutation({
            uid: user.uid,
            route: `${routeOf(c)}:${functionName}`,
            key: idempotencyKey,
            request: { functionName, data },
            execute,
          })
        : await execute();
      return c.json({ result });
    } catch (error) {
      return compatibilityError(c, error);
    }
  });

  app.notFound((c) =>
    c.json({
      error: {
        code: 'not-found',
        message: 'Route not found.',
        requestId: c.get('requestId'),
      },
    }, 404),
  );

  app.onError((error, c) => {
    const apiError = toApiError(error);
    if (apiError.code === 'internal') {
      console.error('gemfort-api-unhandled-error', {
        requestId: c.get('requestId'),
        route: c.req.routePath || c.req.path,
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
