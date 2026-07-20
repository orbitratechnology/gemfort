/**
 * GemFort API — Node.js HTTP server entry point.
 *
 * Starts a standard Node.js HTTP server backed by the Hono app.
 * Swap this file for a Cloudflare Workers / Bun adapter if needed —
 * the app factory in `app.ts` is adapter-agnostic.
 */
import { serve } from '@hono/node-server';

// Firebase must initialise before routes are imported.
import './firebase.js';

import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';

const app = createApp();

const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  ({ address, port }) => {
    logger.info('GemFort API started', {
      url: `http://${address}:${port}`,
      env: config.env,
      docs: config.env !== 'production' ? `http://${address}:${port}/docs` : 'disabled',
    });
  },
);

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info(`Received ${signal} — shutting down gracefully`);
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
