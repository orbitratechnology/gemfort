import Firecrawl from '@mendable/firecrawl-js';
import { logger } from 'firebase-functions';

import { errorDetails, withRetries } from './retry';

export async function scrapeMarkdown(
  apiKey: string,
  url: string,
): Promise<string | null> {
  const app = new Firecrawl({ apiKey });
  try {
    const result = await withRetries(`firecrawl:${url}`, () =>
      app.scrape(url, {
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    );
    const markdown =
      typeof result === 'object' && result !== null && 'markdown' in result
        ? String((result as { markdown?: unknown }).markdown ?? '')
        : '';
    if (!markdown.trim()) {
      logger.warn('Firecrawl returned empty markdown', { url });
      return null;
    }
    // Cap prompt size for Gemini
    return markdown.length > 80_000 ? markdown.slice(0, 80_000) : markdown;
  } catch (error) {
    logger.error('Firecrawl scrape failed', { url, ...errorDetails(error) });
    return null;
  }
}
