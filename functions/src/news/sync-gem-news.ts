import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { db } from '../admin';
import { REGION } from '../config';
import { scrapeMarkdown } from './firecrawl';
import { extractArticlesFromMarkdown } from './gemini';
import {
  articleDocId,
  assertRegion,
  canonicalizeUrl,
  mergeTopics,
  parseIsoDate,
} from './schemas';
import { errorDetails, sleep } from './retry';
import { NEWS_SOURCES } from './sources';

export const geminiApiKey = defineSecret('GEMINI_API_KEY');
export const firecrawlApiKey = defineSecret('FIRECRAWL_API_KEY');

function assertUsableSecret(name: string, value: string) {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed === 'placeholder-set-me' ||
    trimmed.startsWith('YOUR_')
  ) {
    throw new Error(
      `${name} is missing or still a placeholder. Set a real key in Secret Manager.`,
    );
  }
}

async function syncNewsOnce(geminiKey: string, firecrawlKey: string) {
  assertUsableSecret('GEMINI_API_KEY', geminiKey);
  assertUsableSecret('FIRECRAWL_API_KEY', firecrawlKey);

  let written = 0;
  let failedSources = 0;

  for (let i = 0; i < NEWS_SOURCES.length; i++) {
    const source = NEWS_SOURCES[i]!;
    if (i > 0) {
      // Space requests to avoid Gemini/Firecrawl free-tier 429s.
      await sleep(8000);
    }
    try {
      const markdown = await scrapeMarkdown(firecrawlKey, source.url);
      if (!markdown) {
        failedSources += 1;
        logger.warn('News source skipped (no markdown)', { sourceId: source.id });
        continue;
      }

      const articles = await extractArticlesFromMarkdown(
        geminiKey,
        markdown,
        source.label,
      );

      let sourceWrites = 0;
      for (const article of articles) {
        const canonicalUrl = canonicalizeUrl(article.url, source.url);
        const published = parseIsoDate(article.publishedAt);
        if (!published) continue;

        const id = articleDocId(canonicalUrl);
        const ref = db.collection('gem_news').doc(id);
        await ref.set(
          {
            title: article.title,
            summary: article.summary,
            url: canonicalUrl,
            canonicalUrl,
            source: source.label,
            sourceId: source.id,
            region: assertRegion(source.region),
            topics: mergeTopics(article.topics, source.defaultTopics),
            publishedAt: Timestamp.fromDate(published),
            scrapedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            imageUrl: article.imageUrl ?? null,
            language: 'en',
            isVisible: true,
          },
          { merge: true },
        );
        sourceWrites += 1;
      }

      if (articles.length === 0) {
        failedSources += 1;
        logger.warn('News source produced no articles', { sourceId: source.id });
      } else {
        written += sourceWrites;
        logger.info('News source synced', {
          sourceId: source.id,
          extracted: articles.length,
          written: sourceWrites,
        });
      }
    } catch (error) {
      failedSources += 1;
      logger.error('News source sync failed', {
        sourceId: source.id,
        ...errorDetails(error),
      });
    }
  }

  return { written, failedSources, sources: NEWS_SOURCES.length };
}

export const syncGemNews = onSchedule(
  {
    schedule: 'every 6 hours',
    region: REGION,
    timeoutSeconds: 540,
    memory: '1GiB',
    secrets: [geminiApiKey, firecrawlApiKey],
  },
  async () => {
    const summary = await syncNewsOnce(
      geminiApiKey.value(),
      firecrawlApiKey.value(),
    );
    logger.info('syncGemNews finished', summary);
  },
);

/** Manual refresh (signed-in admin). */
export const runNewsSyncNow = onCall(
  {
    region: REGION,
    timeoutSeconds: 540,
    memory: '1GiB',
    secrets: [geminiApiKey, firecrawlApiKey],
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const userSnap = await db.collection('users').doc(request.auth.uid).get();
    if (userSnap.data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin only.');
    }
    return syncNewsOnce(geminiApiKey.value(), firecrawlApiKey.value());
  },
);
