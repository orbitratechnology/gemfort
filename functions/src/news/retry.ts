import { logger } from 'firebase-functions';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function errorDetails(error: unknown): {
  name?: string;
  status?: number;
  message: string;
} {
  if (error instanceof Error) {
    const withStatus = error as Error & { status?: number; code?: number };
    return {
      name: error.name,
      status: withStatus.status ?? withStatus.code,
      message: error.message,
    };
  }
  return { message: String(error) };
}

function isRetryable(error: unknown): boolean {
  const details = errorDetails(error);
  const status = details.status;
  if (status === 429 || status === 500 || status === 503 || status === 504) {
    return true;
  }
  const msg = details.message.toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('rate') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('too many')
  );
}

/** Retry transient API failures (especially Gemini/Firecrawl 429). */
export async function withRetries<T>(
  label: string,
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 2500;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const details = errorDetails(error);
      if (!isRetryable(error) || attempt === attempts) {
        throw error;
      }
      const delay = baseDelayMs * 2 ** (attempt - 1);
      logger.warn('Retrying after API error', {
        label,
        attempt,
        delayMs: delay,
        ...details,
      });
      await sleep(delay);
    }
  }
  throw lastError;
}
