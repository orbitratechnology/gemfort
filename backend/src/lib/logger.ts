/**
 * Structured JSON logger.
 * In production each log line is a JSON object so it ingests cleanly into
 * Cloud Logging / Datadog / etc. In development it prints readable text.
 */
import { config } from '../config.js';

type Level = 'debug' | 'info' | 'warn' | 'error';

function log(level: Level, message: string, data?: Record<string, unknown>): void {
  if (config.env === 'production') {
    console[level === 'debug' ? 'log' : level](
      JSON.stringify({ severity: level.toUpperCase(), message, ...data, timestamp: new Date().toISOString() }),
    );
  } else {
    const prefix = `[${level.toUpperCase()}]`;
    if (data && Object.keys(data).length) {
      console[level === 'debug' ? 'log' : level](prefix, message, data);
    } else {
      console[level === 'debug' ? 'log' : level](prefix, message);
    }
  }
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log('debug', msg, data),
  info: (msg: string, data?: Record<string, unknown>) => log('info', msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log('warn', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log('error', msg, data),
};
