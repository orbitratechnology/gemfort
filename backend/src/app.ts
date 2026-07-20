/**
 * GemFort API — Hono application factory.
 *
 * Assembles all middleware, routes, and the OpenAPI / Scalar docs UI.
 * Exported as a factory so it can be mounted on any adapter
 * (Node HTTP, Bun, Cloudflare Workers, etc.).
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { logger as honoLogger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { timing } from 'hono/timing';
import { HTTPException } from 'hono/http-exception';
import { swaggerUI } from '@hono/swagger-ui';

import { config } from './config.js';
import { logger } from './lib/logger.js';

import healthRoute from './routes/health.js';
import accountRoute from './routes/account.js';
import apRoute from './routes/gemtrack/ap.js';
import adminNewsRoute from './routes/admin/news.js';
import adminCronRoute from './routes/admin/cron.js';
import firestoreWebhooks from './routes/webhooks/firestore.js';
import authWebhooks from './routes/webhooks/auth.js';

export function createApp() {
  const app = new Hono();

  // ── Global middleware ────────────────────────────────────────────────────

  // Server-Timing header (adds latency data to responses for APM)
  app.use('*', timing());

  // Secure HTTP headers
  app.use('*', secureHeaders());

  // CORS — restrict in production, open in dev
  app.use(
    '*',
    cors({
      origin:
        config.corsOrigins.length > 0
          ? config.corsOrigins
          : config.env === 'production'
          ? []
          : '*',
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400,
    }),
  );

  // Request / response logging
  if (config.env !== 'test') {
    app.use('*', honoLogger());
  }

  // Pretty-print JSON in development
  if (config.env === 'development') {
    app.use('*', prettyJSON());
  }

  // ── Routes ───────────────────────────────────────────────────────────────

  // Health check (no auth)
  app.route('/health', healthRoute);

  // Swagger UI — only in non-production or when explicitly enabled
  if (config.env !== 'production') {
    app.get(
      '/docs',
      swaggerUI({ url: '/openapi.json' }),
    );
  }

  // OpenAPI spec JSON
  app.get('/openapi.json', (c) => c.json(openApiSpec()));

  // API v1
  app.route('/api/v1/account', accountRoute);
  app.route('/api/v1/gemtrack/ap', apRoute);
  app.route('/api/v1/admin/news', adminNewsRoute);
  app.route('/api/v1/admin/cron', adminCronRoute);

  // Firestore / Auth event webhooks (server-to-server, WEBHOOK_SECRET)
  app.route('/webhooks/firestore', firestoreWebhooks);
  app.route('/webhooks/auth', authWebhooks);

  // ── Global error handler ─────────────────────────────────────────────────

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      logger.warn('HTTP exception', { status: err.status, message: err.message, path: c.req.path });
      return c.json(
        { error: { code: err.status, message: err.message } },
        err.status,
      );
    }

    logger.error('Unhandled error', {
      path: c.req.path,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    return c.json(
      { error: { code: 500, message: 'An unexpected error occurred.' } },
      500,
    );
  });

  app.notFound((c) =>
    c.json({ error: { code: 404, message: `Route not found: ${c.req.method} ${c.req.path}` } }, 404),
  );

  return app;
}

// ─── OpenAPI spec ─────────────────────────────────────────────────────────────

function openApiSpec() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'GemFort API',
      version: '1.0.0',
      description: `
## GemFort REST API

Hono.js backend that replaces Firebase Cloud Functions.
All endpoints communicate directly with Firebase (Firestore, Auth, Storage, FCM)
using the Firebase Admin SDK.

### Authentication

All \`/api/v1/*\` endpoints require a valid **Firebase ID Token** in the
\`Authorization: Bearer <token>\` header.

Webhook endpoints (\`/webhooks/*\`) use a shared **WEBHOOK_SECRET**.
Cron endpoints (\`/api/v1/admin/cron/*\`) use a shared **CRON_SECRET**.

### Error format

\`\`\`json
{ "error": { "code": 400, "message": "Human-readable reason" } }
\`\`\`
      `.trim(),
      contact: { email: 'support@gemfort.app' },
      license: { name: 'Proprietary', url: 'https://gemfort.app' },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local development' },
      { url: 'https://api.gemfort.app', description: 'Production' },
    ],
    tags: [
      { name: 'Health', description: 'Liveness and readiness checks' },
      { name: 'Account', description: 'User account management' },
      { name: 'GemTrack - AP', description: 'AP (consignment) lifecycle operations' },
      { name: 'Admin - News', description: 'Admin-only news and exhibition management' },
      { name: 'Admin - Cron', description: 'Scheduled job trigger endpoints' },
      { name: 'Webhooks', description: 'Firestore and Auth event webhooks' },
    ],
    paths: {
      '/health': {
        get: {
          summary: 'Health check',
          tags: ['Health'],
          responses: {
            '200': {
              description: 'API is running',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
            },
          },
        },
      },
      '/api/v1/account': {
        delete: {
          summary: 'Delete my account',
          description: 'Permanently deletes all data owned by the authenticated user and removes the Firebase Auth record. Client must have recently re-authenticated.',
          tags: ['Account'],
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Account deleted',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/WipeResult' } } },
            },
            '401': { $ref: '#/components/responses/Unauthenticated' },
            '500': { $ref: '#/components/responses/InternalError' },
          },
        },
      },
      '/api/v1/gemtrack/ap': {
        post: {
          summary: 'Create AP request',
          description: 'Creates a new AP (approval/consignment) record and locks the selected gems. Notifies the AP holder.',
          tags: ['GemTrack - AP'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateApRequest' } } },
          },
          responses: {
            '201': {
              description: 'AP created',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ApCreatedResponse' } } },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthenticated' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '422': { $ref: '#/components/responses/UnprocessableEntity' },
          },
        },
      },
      '/api/v1/gemtrack/ap/{apId}/respond': {
        post: {
          summary: 'Respond to AP request',
          description: 'Accept or reject a pending AP request. Only the AP receiver can call this.',
          tags: ['GemTrack - AP'],
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/ApId' }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RespondApRequest' } } },
          },
          responses: {
            '200': { $ref: '#/components/responses/Ok' },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthenticated' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/api/v1/gemtrack/ap/{apId}/cancel': {
        post: {
          summary: 'Cancel AP request',
          description: 'Cancel a pending or accepted AP. Unlocks all held gems. Either party may cancel.',
          tags: ['GemTrack - AP'],
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/ApId' }],
          responses: {
            '200': { $ref: '#/components/responses/Ok' },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthenticated' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/api/v1/gemtrack/ap/{apId}/gems/{gemId}/sell': {
        post: {
          summary: 'Record AP gem sale',
          description: 'Mark a gem within an AP as sold. Only the AP receiver (holder) can call this.',
          tags: ['GemTrack - AP'],
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/ApId' }, { $ref: '#/components/parameters/GemId' }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RecordApGemSale' } } },
          },
          responses: {
            '200': { $ref: '#/components/responses/Ok' },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthenticated' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/api/v1/gemtrack/ap/{apId}/gems/{gemId}/return': {
        post: {
          summary: 'Return AP gem',
          description: 'Return a held gem from an AP back to the owner. Unlocks the gem.',
          tags: ['GemTrack - AP'],
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/ApId' }, { $ref: '#/components/parameters/GemId' }],
          responses: {
            '200': { $ref: '#/components/responses/Ok' },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthenticated' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/api/v1/gemtrack/ap/{apId}/payment/sent': {
        post: {
          summary: 'Mark AP payment sent',
          description: 'AP receiver marks that they have sent payment to the gem owner.',
          tags: ['GemTrack - AP'],
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/ApId' }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApPaymentRequest' } } },
          },
          responses: {
            '200': { $ref: '#/components/responses/Ok' },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthenticated' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/api/v1/gemtrack/ap/{apId}/payment/received': {
        post: {
          summary: 'Confirm AP payment received',
          description: 'Gem owner confirms receipt of payment. Closes the AP and records income/expense transactions.',
          tags: ['GemTrack - AP'],
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/ApId' }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApPaymentRequest' } } },
          },
          responses: {
            '200': { $ref: '#/components/responses/Ok' },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthenticated' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/api/v1/admin/news/sync': {
        post: {
          summary: 'Trigger news sync now (admin)',
          description: 'Admin-only. Immediately scrapes all news and exhibition sources and upserts to Firestore.',
          tags: ['Admin - News'],
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Sync results',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/NewsSyncResult' },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthenticated' },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
      },
      '/api/v1/admin/cron/daily-gemtrack-notifications': {
        post: {
          summary: 'Daily GemTrack notifications (cron)',
          description: 'Cron-triggered. Checks all active cheques, AP records, services, and receivables and creates notification documents.',
          tags: ['Admin - Cron'],
          security: [{ cronSecret: [] }],
          responses: {
            '200': {
              description: 'Notification results',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CronResult' },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthenticated' },
          },
        },
      },
      '/api/v1/admin/cron/sync-gem-news': {
        post: {
          summary: 'Sync gem news (cron)',
          tags: ['Admin - Cron'],
          security: [{ cronSecret: [] }],
          responses: { '200': { description: 'Sync summary' } },
        },
      },
      '/api/v1/admin/cron/sync-exhibitions': {
        post: {
          summary: 'Sync exhibitions (cron)',
          tags: ['Admin - Cron'],
          security: [{ cronSecret: [] }],
          responses: { '200': { description: 'Sync summary' } },
        },
      },
      '/webhooks/firestore/announcement-published': {
        post: {
          summary: 'Announcement published webhook',
          description: 'Called when a new announcement document is created. Broadcasts to all active users.',
          tags: ['Webhooks'],
          security: [{ webhookSecret: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatedWebhookPayload' } } } },
          responses: { '200': { $ref: '#/components/responses/Ok' } },
        },
      },
      '/webhooks/firestore/verification-status-changed': {
        post: { summary: 'Verification status changed webhook', tags: ['Webhooks'], security: [{ webhookSecret: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdatedWebhookPayload' } } } }, responses: { '200': { $ref: '#/components/responses/Ok' } } },
      },
      '/webhooks/firestore/report-resolved': {
        post: { summary: 'Report resolved webhook', tags: ['Webhooks'], security: [{ webhookSecret: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdatedWebhookPayload' } } } }, responses: { '200': { $ref: '#/components/responses/Ok' } } },
      },
      '/webhooks/firestore/user-account-action': {
        post: { summary: 'User account action webhook', tags: ['Webhooks'], security: [{ webhookSecret: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdatedWebhookPayload' } } } }, responses: { '200': { $ref: '#/components/responses/Ok' } } },
      },
      '/webhooks/firestore/cheque-bounced': {
        post: { summary: 'Cheque bounced webhook', tags: ['Webhooks'], security: [{ webhookSecret: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdatedWebhookPayload' } } } }, responses: { '200': { $ref: '#/components/responses/Ok' } } },
      },
      '/webhooks/firestore/service-request-created': {
        post: { summary: 'Service request created webhook', tags: ['Webhooks'], security: [{ webhookSecret: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatedWebhookPayload' } } } }, responses: { '200': { $ref: '#/components/responses/Ok' } } },
      },
      '/webhooks/firestore/service-request-updated': {
        post: { summary: 'Service request updated webhook', tags: ['Webhooks'], security: [{ webhookSecret: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdatedWebhookPayload' } } } }, responses: { '200': { $ref: '#/components/responses/Ok' } } },
      },
      '/webhooks/firestore/cert-request-created': {
        post: { summary: 'Cert request created webhook', tags: ['Webhooks'], security: [{ webhookSecret: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatedWebhookPayload' } } } }, responses: { '200': { $ref: '#/components/responses/Ok' } } },
      },
      '/webhooks/firestore/cert-request-updated': {
        post: { summary: 'Cert request updated webhook', tags: ['Webhooks'], security: [{ webhookSecret: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdatedWebhookPayload' } } } }, responses: { '200': { $ref: '#/components/responses/Ok' } } },
      },
      '/webhooks/firestore/notification-created': {
        post: { summary: 'Notification created webhook — dispatches FCM push', tags: ['Webhooks'], security: [{ webhookSecret: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatedWebhookPayload' } } } }, responses: { '200': { $ref: '#/components/responses/Ok' } } },
      },
      '/webhooks/auth/user-deleted': {
        post: {
          summary: 'Auth user deleted webhook',
          description: 'Safety-net: wipes residual Firestore/Storage data when a Firebase Auth user is deleted outside the normal account-deletion flow.',
          tags: ['Webhooks'],
          security: [{ webhookSecret: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UserDeletedPayload' } } },
          },
          responses: {
            '200': {
              description: 'Wipe complete',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/WipeResult' } } },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'Firebase ID Token', description: 'Firebase ID token obtained via Firebase Auth SDK.' },
        webhookSecret: { type: 'http', scheme: 'bearer', description: 'Shared WEBHOOK_SECRET for server-to-server webhook calls.' },
        cronSecret: { type: 'http', scheme: 'bearer', description: 'Shared CRON_SECRET for cron-triggered endpoints.' },
      },
      parameters: {
        ApId: { name: 'apId', in: 'path', required: true, schema: { type: 'string' }, description: 'Firestore document ID of the AP record.' },
        GemId: { name: 'gemId', in: 'path', required: true, schema: { type: 'string' }, description: 'Firestore document ID of the gem.' },
      },
      schemas: {
        HealthResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: true },
            service: { type: 'string', example: 'gemfort-api' },
            version: { type: 'string', example: '1.0.0' },
          },
        },
        OkResponse: {
          type: 'object',
          properties: { ok: { type: 'boolean', example: true } },
        },
        ErrorResponse: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'integer', example: 400 },
                message: { type: 'string', example: 'Human-readable reason.' },
              },
            },
          },
        },
        WipeResult: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            firestoreDeleted: { type: 'integer', description: 'Number of Firestore documents deleted.' },
            firestoreAnonymized: { type: 'integer', description: 'Number of cross-user references anonymised.' },
            storageDeleted: { type: 'integer', description: 'Number of Storage files deleted.' },
          },
        },
        CreateApRequest: {
          type: 'object',
          required: ['receiverContactId', 'items'],
          properties: {
            receiverContactId: { type: 'string', description: 'ID of the gemtrack_contacts document for the AP holder.' },
            receiverBusinessId: { type: 'string', nullable: true, description: 'Override the linked business ID from the contact.' },
            expectedDurationDays: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
            agreementNotes: { type: 'string', maxLength: 1000, nullable: true },
            items: {
              type: 'array',
              minItems: 1,
              maxItems: 50,
              items: {
                type: 'object',
                required: ['gemId', 'agreedPrice'],
                properties: {
                  gemId: { type: 'string' },
                  agreedPrice: { type: 'number', minimum: 0 },
                  currency: { type: 'string', minLength: 3, maxLength: 3, default: 'LKR' },
                },
              },
            },
          },
        },
        ApCreatedResponse: {
          type: 'object',
          properties: { ok: { type: 'boolean' }, apId: { type: 'string' } },
        },
        RespondApRequest: {
          type: 'object',
          required: ['action'],
          properties: {
            action: { type: 'string', enum: ['accept', 'reject'] },
            rejectionReason: { type: 'string', maxLength: 500, nullable: true },
          },
        },
        RecordApGemSale: {
          type: 'object',
          required: ['soldPrice', 'soldToName', 'ownerReceives', 'commission'],
          properties: {
            soldPrice: { type: 'number', minimum: 0 },
            soldToName: { type: 'string', maxLength: 200 },
            ownerReceives: { type: 'number', minimum: 0 },
            commission: { type: 'number', minimum: 0 },
            currency: { type: 'string', minLength: 3, maxLength: 3 },
          },
        },
        ApPaymentRequest: {
          type: 'object',
          required: ['amount'],
          properties: {
            amount: { type: 'number', minimum: 0 },
            currency: { type: 'string', minLength: 3, maxLength: 3 },
            method: { type: 'string', enum: ['cash', 'transfer', 'cheque'], nullable: true },
          },
        },
        NewsSyncResult: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            news: { type: 'object', properties: { written: { type: 'integer' }, failedSources: { type: 'integer' }, sources: { type: 'integer' } } },
            exhibitions: { type: 'object', properties: { written: { type: 'integer' }, failedSources: { type: 'integer' }, sources: { type: 'integer' } } },
          },
        },
        CronResult: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            owners: { type: 'integer' },
            created: { type: 'integer' },
          },
        },
        CreatedWebhookPayload: {
          type: 'object',
          required: ['documentId', 'data'],
          properties: {
            documentId: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
        UpdatedWebhookPayload: {
          type: 'object',
          required: ['documentId', 'before', 'after'],
          properties: {
            documentId: { type: 'string' },
            before: { type: 'object', additionalProperties: true },
            after: { type: 'object', additionalProperties: true },
          },
        },
        UserDeletedPayload: {
          type: 'object',
          required: ['uid'],
          properties: { uid: { type: 'string' } },
        },
      },
      responses: {
        Ok: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/OkResponse' } } } },
        BadRequest: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        Unauthenticated: { description: 'Missing or invalid authentication', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        Forbidden: { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        NotFound: { description: 'Resource not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        UnprocessableEntity: { description: 'Validation or business-logic error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        InternalError: { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      },
    },
  };
}
