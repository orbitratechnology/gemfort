import { createHash } from 'node:crypto';
import { z } from 'zod';

import { NEWS_TOPIC_VALUES, type NewsRegion, type NewsTopic } from './sources';

export const extractedArticleSchema = z.object({
  title: z.string().trim().min(3).max(300),
  summary: z.string().trim().min(10).max(600),
  url: z.string().trim().url(),
  publishedAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  topics: z.array(z.enum(NEWS_TOPIC_VALUES as [NewsTopic, ...NewsTopic[]])).max(4).optional(),
  imageUrl: z.string().url().nullable().optional(),
});

export const extractedArticlesSchema = z.array(extractedArticleSchema).max(12);

export const extractedExhibitionSchema = z.object({
  title: z.string().trim().min(3).max(300),
  venue: z.string().trim().min(2).max(300),
  city: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const extractedExhibitionsSchema = z.array(extractedExhibitionSchema).max(20);

export type ExtractedArticle = z.infer<typeof extractedArticleSchema>;
export type ExtractedExhibition = z.infer<typeof extractedExhibitionSchema>;

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function canonicalizeUrl(raw: string, fallbackBase?: string): string {
  try {
    const parsed = new URL(raw, fallbackBase);
    parsed.hash = '';
    // Normalize trailing slash on pathname (except root)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return raw.trim();
  }
}

export function mergeTopics(
  extracted: NewsTopic[] | undefined,
  defaults: NewsTopic[],
): NewsTopic[] {
  const set = new Set<NewsTopic>([...(extracted ?? []), ...defaults]);
  return Array.from(set).slice(0, 4);
}

export function parseIsoDate(value: string): Date | null {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

export function articleDocId(canonicalUrl: string): string {
  return sha256Hex(canonicalUrl);
}

export function exhibitionDocId(
  title: string,
  startDate: string,
  sourceId: string,
): string {
  return sha256Hex(`${title.trim().toLowerCase()}|${startDate}|${sourceId}`);
}

export function assertRegion(region: NewsRegion): NewsRegion {
  return region === 'local' ? 'local' : 'global';
}
