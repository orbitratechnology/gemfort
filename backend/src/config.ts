/**
 * Runtime configuration loaded from environment variables.
 * All values are validated at startup so the server fails fast on misconfiguration.
 */

function require(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required environment variable: ${key}`);
  return v;
}

function optional(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

export const config = {
  /** HTTP server port. */
  port: Number(optional('PORT', '3000')),

  /** "development" | "production" | "test" */
  env: optional('NODE_ENV', 'development') as 'development' | 'production' | 'test',

  firebase: {
    /** GCS bucket name (no gs:// prefix). */
    storageBucket: optional('FIREBASE_STORAGE_BUCKET', 'gemfort.firebasestorage.app'),
    projectId: optional('FIREBASE_PROJECT_ID'),
    clientEmail: optional('FIREBASE_CLIENT_EMAIL'),
    /** May include literal \n sequences — normalised at init time. */
    privateKey: optional('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  },

  /**
   * Shared secret for Firestore / Auth webhook calls.
   * Callers must set: Authorization: Bearer <WEBHOOK_SECRET>
   */
  webhookSecret: optional('WEBHOOK_SECRET'),

  /**
   * Shared secret for cron-job trigger endpoints.
   * Callers must set: Authorization: Bearer <CRON_SECRET>
   */
  cronSecret: optional('CRON_SECRET'),

  news: {
    geminiApiKey: optional('GEMINI_API_KEY'),
    firecrawlApiKey: optional('FIRECRAWL_API_KEY'),
  },

  /** Comma-separated allowed CORS origins. Empty = allow all (dev only). */
  corsOrigins: optional('CORS_ORIGINS')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
} as const;

/** GemTrack business-logic constants — keep in sync with Cloud Functions config. */
export const AP_PAYMENT_OVERDUE_DAYS = 14;
export const DUE_SOON_DAYS = 3;
export const REGION = 'asia-south1';
