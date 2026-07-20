/**
 * Gem news sync service — scrapes configured news sources via Firecrawl,
 * extracts structured articles with Gemini, and upserts to Firestore.
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { db } from '../../firebase.js';
import { logger } from '../../lib/logger.js';
import { scrapeMarkdown } from './firecrawl.js';
import { extractArticlesFromMarkdown } from './gemini.js';
import { errorDetails } from './retry.js';
import { NEWS_SOURCES } from './sources.js';

export type NewsSyncSummary = {
  written: number;
  failedSources: number;
  sources: number;
};

/**
 * Run one full news-sync cycle across all configured sources.
 */
export async function syncNewsOnce(
  geminiApiKey: string,
  firecrawlApiKey: string,
): Promise<NewsSyncSummary> {
  let written = 0;
  let failedSources = 0;

  for (const source of NEWS_SOURCES) {
    try {
      const markdown = await scrapeMarkdown(firecrawlApiKey, source.url);
      if (!markdown) {
        failedSources += 1;
        continue;
      }

      const articles = await extractArticlesFromMarkdown(geminiApiKey, markdown, source.label);
      let sourceWrites = 0;

      for (const article of articles) {
        if (!article.title || !article.url) continue;

        // Deduplicate by URL — use URL-safe hash as document ID.
        const docId = Buffer.from(article.url).toString('base64url').slice(0, 64);

        const data = {
          title: article.title,
          summary: article.summary,
          url: article.url,
          publishedAt: article.publishedAt
            ? Timestamp.fromDate(new Date(article.publishedAt))
            : null,
          topics: Array.isArray(article.topics)
            ? article.topics
            : source.defaultTopics,
          imageUrl: article.imageUrl ?? null,
          sourceId: source.id,
          sourceLabel: source.label,
          region: source.region,
          isVisible: true,
          updatedAt: FieldValue.serverTimestamp(),
        };

        await db.collection('news_articles').doc(docId).set(data, { merge: true });
        sourceWrites += 1;
      }

      written += sourceWrites;
      logger.info('News source synced', {
        sourceId: source.id,
        extracted: articles.length,
        written: sourceWrites,
      });
    } catch (error) {
      failedSources += 1;
      logger.error('News source sync failed', { sourceId: source.id, ...errorDetails(error) });
    }
  }

  return { written, failedSources, sources: NEWS_SOURCES.length };
}
