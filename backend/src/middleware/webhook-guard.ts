/**
 * Webhook authentication guard.
 *
 * Firestore / Auth event webhooks and cron endpoints are server-to-server calls.
 * They are protected with a shared secret passed as a Bearer token rather than
 * a Firebase ID token.
 *
 * Configure the secret in WEBHOOK_SECRET / CRON_SECRET env vars.
 */
import type { Context, Next } from 'hono';

import { config } from '../config.js';
import { unauthenticated, forbidden } from '../lib/errors.js';

function bearerToken(c: Context): string {
  const header = c.req.header('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) unauthenticated('Missing Bearer token.');
  return header.slice(7).trim();
}

/** Guard Firestore / Auth webhook routes with WEBHOOK_SECRET. */
export async function requireWebhookSecret(c: Context, next: Next) {
  if (!config.webhookSecret) {
    // In dev with no secret configured, allow through (log a warning).
    if (config.env !== 'production') {
      console.warn('[WARN] WEBHOOK_SECRET not set — skipping webhook auth (dev only).');
      await next();
      return;
    }
    forbidden('Webhook secret not configured on server.');
  }

  const token = bearerToken(c);
  if (token !== config.webhookSecret) {
    unauthenticated('Invalid webhook secret.');
  }

  await next();
}

/** Guard cron endpoints with CRON_SECRET. */
export async function requireCronSecret(c: Context, next: Next) {
  if (!config.cronSecret) {
    if (config.env !== 'production') {
      console.warn('[WARN] CRON_SECRET not set — skipping cron auth (dev only).');
      await next();
      return;
    }
    forbidden('Cron secret not configured on server.');
  }

  const token = bearerToken(c);
  if (token !== config.cronSecret) {
    unauthenticated('Invalid cron secret.');
  }

  await next();
}
