import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { db } from '../admin';
import { REGION } from '../config';
import { scrapeMarkdown } from './firecrawl';
import { extractExhibitionsFromMarkdown } from './gemini';
import {
  assertRegion,
  exhibitionDocId,
  parseIsoDate,
} from './schemas';
import { errorDetails, sleep } from './retry';
import { EXHIBITION_SOURCES } from './sources';
import { firecrawlApiKey, geminiApiKey } from './sync-gem-news';

export async function syncExhibitionsOnce(
  geminiKey: string,
  firecrawlKey: string,
) {
  let written = 0;
  let failedSources = 0;

  for (let i = 0; i < EXHIBITION_SOURCES.length; i++) {
    const source = EXHIBITION_SOURCES[i]!;
    if (i > 0) await sleep(8000);
    try {
      const markdown = await scrapeMarkdown(firecrawlKey, source.url);
      if (!markdown) {
        failedSources += 1;
        logger.warn('Exhibition source skipped (no markdown)', {
          sourceId: source.id,
        });
        continue;
      }

      const shows = await extractExhibitionsFromMarkdown(
        geminiKey,
        markdown,
        source.label,
      );

      let sourceWrites = 0;
      for (const show of shows) {
        const start = parseIsoDate(show.startDate);
        const end = parseIsoDate(show.endDate) ?? start;
        if (!start || !end) continue;

        const id = exhibitionDocId(show.title, show.startDate, source.id);
        await db
          .collection('exhibitions')
          .doc(id)
          .set(
            {
              title: show.title,
              venue: show.venue,
              city: show.city ?? null,
              country: show.country ?? null,
              startDate: Timestamp.fromDate(start),
              endDate: Timestamp.fromDate(end),
              updatedAt: FieldValue.serverTimestamp(),
              region: assertRegion(source.region),
              sourceUrl: source.url,
              sourceId: source.id,
              isVisible: true,
            },
            { merge: true },
          );
        sourceWrites += 1;
      }

      written += sourceWrites;
      logger.info('Exhibition source synced', {
        sourceId: source.id,
        extracted: shows.length,
        written: sourceWrites,
      });
    } catch (error) {
      failedSources += 1;
      logger.error('Exhibition source sync failed', {
        sourceId: source.id,
        ...errorDetails(error),
      });
    }
  }

  return { written, failedSources, sources: EXHIBITION_SOURCES.length };
}

export const syncExhibitions = onSchedule(
  {
    schedule: 'every day 00:00',
    timeZone: 'Asia/Colombo',
    region: REGION,
    timeoutSeconds: 540,
    memory: '1GiB',
    secrets: [geminiApiKey, firecrawlApiKey],
  },
  async () => {
    const summary = await syncExhibitionsOnce(
      geminiApiKey.value(),
      firecrawlApiKey.value(),
    );
    logger.info('syncExhibitions finished', summary);
  },
);
