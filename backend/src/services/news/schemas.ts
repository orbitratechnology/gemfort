import { z } from 'zod';
import { NEWS_TOPIC_VALUES } from './sources.js';

export const extractedArticleSchema = z.object({
  title: z.string(),
  summary: z.string(),
  url: z.string(),
  publishedAt: z.string(), // YYYY-MM-DD
  topics: z.array(z.enum(NEWS_TOPIC_VALUES as [string, ...string[]])).optional().default([]),
  imageUrl: z.string().nullable().optional(),
});

export const extractedArticlesSchema = z.array(extractedArticleSchema);
export type ExtractedArticle = z.infer<typeof extractedArticleSchema>;

export const extractedExhibitionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  url: z.string().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string(),   // YYYY-MM-DD
});

export const extractedExhibitionsSchema = z.array(extractedExhibitionSchema);
export type ExtractedExhibition = z.infer<typeof extractedExhibitionSchema>;
