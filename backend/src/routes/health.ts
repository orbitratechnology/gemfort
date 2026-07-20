/**
 * Health check routes — unauthenticated, used by load balancers and uptime monitors.
 */
import { Hono } from 'hono';

const health = new Hono();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns 200 when the API is running. Used by load balancers.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: OK
 */
health.get('/', (c) => c.json({ ok: true, service: 'gemfort-api', version: '1.0.0' }));

export default health;
