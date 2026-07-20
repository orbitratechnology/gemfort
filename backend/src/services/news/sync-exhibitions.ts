/**
 * Exhibition sync service — scrapes configured exhibition listing pages via
 * Firecrawl, extracts structured event data with Gemini, and upserts to Firestore.
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { db } from '../../firebase.js';
import { logger } from '../../lib/logger.js';
import { scrapeMarkdown } from './firecrawl.js';
import { extractExhibitionsFromMarkdown } from './gemini.js';
import { errorDetails } from './retry.js';
import { EXHIBITION_SOURCES, type NewsRegion } from './sources.js';

export type ExhibitionSyncSummary = {
  written: number;
  failedSources: number;
  sources: number;
};

function assertRegion(v: string): NewsRegion {
  return v === 'local' || v === 'global' ? v : 'global';
}

/**
 * Run one full exhibition-sync cycle across all configured sources.
 */
export async function syncExhibitionsOnce(
  geminiApiKey: string,
  firecrawlApiKey: string,
): Promise<ExhibitionSyncSummary> {
  let written = 0;
  let failedSources = 0;

  for (const source of EXHIBITION_SOURCES) {
    try {
      const markdown = await scrapeMarkdown(firecrawlApiKey, source.url);
      if (!markdown) {
        failedSources += 1;
        continue;
      }

      const shows = await extractExhibitionsFromMarkdown(geminiApiKey, markdown, source.label);
      let sourceWrites = 0;

      for (const show of shows) {
        if (!show.name || !show.startDate || !show.endDate) continue;

        const start = new Date(show.startDate);
        const end = new Date(show.endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

        const docId = `${source.id}_${show.startDate}_${Buffer.from(show.name).toString('base64url').slice(0, 20)}`;

        await db.collection('exhibitions').doc(docId).set(
          {
            name: show.name,
            description: show.description ?? null,
            url: show.url ?? source.url,
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
      logger.error('Exhibition source sync failed', { sourceId: source.id, ...errorDetails(error) });
    }
  }

  return { written, failedSources, sources: EXHIBITION_SOURCES.length };
}
