import Firecrawl from '@mendable/firecrawl-js';

import { logger } from '../../lib/logger.js';
import { withRetries, errorDetails } from './retry.js';

/**
 * Scrape a URL via Firecrawl and return the page content as Markdown.
 * Returns null if scraping fails or yields no content.
 * Truncates at 80 000 chars to stay within Gemini prompt limits.
 */
export async function scrapeMarkdown(apiKey: string, url: string): Promise<string | null> {
  const app = new Firecrawl({ apiKey });
  try {
    const result = await withRetries(`firecrawl:${url}`, () =>
      app.scrape(url, { formats: ['markdown'], onlyMainContent: true }),
    );

    const markdown =
      typeof result === 'object' && result !== null && 'markdown' in result
        ? String((result as { markdown?: unknown }).markdown ?? '')
        : '';

    if (!markdown.trim()) {
      logger.warn('Firecrawl returned empty markdown', { url });
      return null;
    }

    return markdown.length > 80_000 ? markdown.slice(0, 80_000) : markdown;
  } catch (error) {
    logger.error('Firecrawl scrape failed', { url, ...errorDetails(error) });
    return null;
  }
}
