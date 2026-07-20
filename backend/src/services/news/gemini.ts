import { GoogleGenAI, Type } from '@google/genai';

import { logger } from '../../lib/logger.js';
import { errorDetails, withRetries } from './retry.js';
import { extractedArticlesSchema, extractedExhibitionsSchema } from './schemas.js';
import type { ExtractedArticle, ExtractedExhibition } from './schemas.js';
import { GEMINI_MODEL, NEWS_TOPIC_VALUES } from './sources.js';

function parseJsonPayload(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    const withoutFence = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    return JSON.parse(withoutFence);
  }
  return JSON.parse(trimmed);
}

/**
 * Use Gemini to extract structured news articles from scraped Markdown.
 */
export async function extractArticlesFromMarkdown(
  apiKey: string,
  markdown: string,
  sourceLabel: string,
): Promise<ExtractedArticle[]> {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await withRetries(
      `gemini-articles:${sourceLabel}`,
      () =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `You extract gem & jewellery industry news for traders in Sri Lanka and globally.
Source page: ${sourceLabel}

From the markdown below, extract up to 8 of the most recent relevant articles.
Prefer gem, jewellery, trade, export, regulation, and exhibition stories.
For each article provide an accurate absolute URL if present in the markdown.
Write a single clear summary sentence (max 40 words).
Assign 1-3 topics from: ${NEWS_TOPIC_VALUES.join(', ')}.

Markdown:
${markdown}`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  url: { type: Type.STRING },
                  publishedAt: { type: Type.STRING, description: 'YYYY-MM-DD' },
                  topics: { type: Type.ARRAY, items: { type: Type.STRING } },
                  imageUrl: { type: Type.STRING, nullable: true },
                },
                required: ['title', 'summary', 'url', 'publishedAt'],
              },
            },
          },
        }),
      { attempts: 5, baseDelayMs: 4000 },
    );

    const text = response.text;
    if (!text) {
      logger.warn('Gemini returned empty article response', { sourceLabel });
      return [];
    }

    const parsed = parseJsonPayload(text);
    const result = extractedArticlesSchema.safeParse(parsed);
    if (!result.success) {
      logger.warn('Gemini article JSON failed Zod', {
        sourceLabel,
        issues: result.error.issues.slice(0, 5),
      });
      return [];
    }
    return result.data;
  } catch (error) {
    logger.error('Gemini article extraction failed', { sourceLabel, ...errorDetails(error) });
    return [];
  }
}

/**
 * Use Gemini to extract structured exhibition events from scraped Markdown.
 */
export async function extractExhibitionsFromMarkdown(
  apiKey: string,
  markdown: string,
  sourceLabel: string,
): Promise<ExtractedExhibition[]> {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await withRetries(
      `gemini-exhibitions:${sourceLabel}`,
      () =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `You extract gem and jewellery exhibition / trade show events.
Source: ${sourceLabel}

From the markdown below extract up to 10 upcoming events.
Only include events with clear start and end dates.
Use YYYY-MM-DD for dates. Estimate missing end date as start + 3 days.

Markdown:
${markdown}`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  url: { type: Type.STRING },
                  city: { type: Type.STRING, nullable: true },
                  country: { type: Type.STRING, nullable: true },
                  startDate: { type: Type.STRING },
                  endDate: { type: Type.STRING },
                },
                required: ['name', 'startDate', 'endDate'],
              },
            },
          },
        }),
      { attempts: 5, baseDelayMs: 4000 },
    );

    const text = response.text;
    if (!text) {
      logger.warn('Gemini returned empty exhibition response', { sourceLabel });
      return [];
    }

    const parsed = parseJsonPayload(text);
    const result = extractedExhibitionsSchema.safeParse(parsed);
    if (!result.success) {
      logger.warn('Gemini exhibition JSON failed Zod', {
        sourceLabel,
        issues: result.error.issues.slice(0, 5),
      });
      return [];
    }
    return result.data;
  } catch (error) {
    logger.error('Gemini exhibition extraction failed', { sourceLabel, ...errorDetails(error) });
    return [];
  }
}
