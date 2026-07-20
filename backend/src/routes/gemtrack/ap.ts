/**
 * GemTrack — AP (Approval / Consignment) lifecycle routes
 *
 * POST /api/v1/gemtrack/ap                          Create AP request
 * POST /api/v1/gemtrack/ap/:apId/respond            Accept or reject
 * POST /api/v1/gemtrack/ap/:apId/cancel             Cancel
 * POST /api/v1/gemtrack/ap/:apId/gems/:gemId/sell   Record gem sale
 * POST /api/v1/gemtrack/ap/:apId/gems/:gemId/return Return gem to owner
 * POST /api/v1/gemtrack/ap/:apId/payment/sent       Mark payment sent
 * POST /api/v1/gemtrack/ap/:apId/payment/received   Confirm payment received
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { requireAuth, type AuthVariables } from '../../middleware/auth.js';
import { requireActive } from '../../middleware/rbac.js';
import {
  createApRequest,
  respondApRequest,
  cancelApRequest,
  recordApGemSale,
  returnApGem,
  apPaymentSent,
  apPaymentReceived,
} from '../../services/gemtrack/ap-lifecycle.js';

const ap = new Hono<{ Variables: AuthVariables }>();

// All AP endpoints require auth + active account.
ap.use('*', requireAuth, requireActive);

// ─── Schema definitions ──────────────────────────────────────────────────────

const createApSchema = z.object({
  receiverContactId: z.string().min(1, 'receiverContactId is required'),
  receiverBusinessId: z.string().nullable().optional(),
  expectedDurationDays: z.number().int().min(1).max(365).optional().default(30),
  agreementNotes: z.string().max(1000).nullable().optional(),
  items: z
    .array(
      z.object({
        gemId: z.string().min(1),
        agreedPrice: z.number().positive(),
        currency: z.string().length(3).optional(),
      }),
    )
    .min(1, 'Provide at least one gem')
    .max(50),
});

const respondApSchema = z.object({
  action: z.enum(['accept', 'reject']),
  rejectionReason: z.string().max(500).nullable().optional(),
});

const recordSaleSchema = z.object({
  soldPrice: z.number().positive(),
  soldToName: z.string().min(1).max(200),
  ownerReceives: z.number().nonnegative(),
  commission: z.number().nonnegative(),
  currency: z.string().length(3).optional(),
});

const paymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).optional(),
  method: z.enum(['cash', 'transfer', 'cheque']).nullable().optional(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/gemtrack/ap:
 *   post:
 *     summary: Create AP request
 *     tags: [GemTrack - AP]
 *     security: [{ bearerAuth: [] }]
 */
ap.post('/', zValidator('json', createApSchema), async (c) => {
  const uid = c.get('uid');
  const body = c.req.valid('json');
  const result = await createApRequest({ uid, ...body });
  return c.json({ ok: true, ...result }, 201);
});

/**
 * @openapi
 * /api/v1/gemtrack/ap/{apId}/respond:
 *   post:
 *     summary: Accept or reject an AP request
 *     tags: [GemTrack - AP]
 *     security: [{ bearerAuth: [] }]
 */
ap.post('/:apId/respond', zValidator('json', respondApSchema), async (c) => {
  const uid = c.get('uid');
  const { apId } = c.req.param();
  const body = c.req.valid('json');
  await respondApRequest({ uid, apId, ...body });
  return c.json({ ok: true });
});

/**
 * @openapi
 * /api/v1/gemtrack/ap/{apId}/cancel:
 *   post:
 *     summary: Cancel an AP request
 *     tags: [GemTrack - AP]
 *     security: [{ bearerAuth: [] }]
 */
ap.post('/:apId/cancel', async (c) => {
  const uid = c.get('uid');
  const { apId } = c.req.param();
  await cancelApRequest(uid, apId);
  return c.json({ ok: true });
});

/**
 * @openapi
 * /api/v1/gemtrack/ap/{apId}/gems/{gemId}/sell:
 *   post:
 *     summary: Record a gem sale within an AP
 *     tags: [GemTrack - AP]
 *     security: [{ bearerAuth: [] }]
 */
ap.post('/:apId/gems/:gemId/sell', zValidator('json', recordSaleSchema), async (c) => {
  const uid = c.get('uid');
  const { apId, gemId } = c.req.param();
  const body = c.req.valid('json');
  await recordApGemSale({ uid, apId, gemId, ...body });
  return c.json({ ok: true });
});

/**
 * @openapi
 * /api/v1/gemtrack/ap/{apId}/gems/{gemId}/return:
 *   post:
 *     summary: Return a gem from an AP back to the owner
 *     tags: [GemTrack - AP]
 *     security: [{ bearerAuth: [] }]
 */
ap.post('/:apId/gems/:gemId/return', async (c) => {
  const uid = c.get('uid');
  const { apId, gemId } = c.req.param();
  await returnApGem(uid, apId, gemId);
  return c.json({ ok: true });
});

/**
 * @openapi
 * /api/v1/gemtrack/ap/{apId}/payment/sent:
 *   post:
 *     summary: Mark AP payment as sent (receiver → owner)
 *     tags: [GemTrack - AP]
 *     security: [{ bearerAuth: [] }]
 */
ap.post('/:apId/payment/sent', zValidator('json', paymentSchema), async (c) => {
  const uid = c.get('uid');
  const { apId } = c.req.param();
  const body = c.req.valid('json');
  await apPaymentSent({ uid, apId, ...body });
  return c.json({ ok: true });
});

/**
 * @openapi
 * /api/v1/gemtrack/ap/{apId}/payment/received:
 *   post:
 *     summary: Confirm AP payment received (owner confirms)
 *     tags: [GemTrack - AP]
 *     security: [{ bearerAuth: [] }]
 */
ap.post('/:apId/payment/received', zValidator('json', paymentSchema), async (c) => {
  const uid = c.get('uid');
  const { apId } = c.req.param();
  const body = c.req.valid('json');
  await apPaymentReceived({ uid, apId, ...body });
  return c.json({ ok: true });
});

export default ap;
