import { GoogleGenAI, Type } from '@google/genai';
import { logger } from 'firebase-functions';

import {
  extractedArticlesSchema,
  extractedExhibitionsSchema,
  type ExtractedArticle,
  type ExtractedExhibition,
} from './schemas';
import { errorDetails, withRetries } from './retry';
import { GEMINI_MODEL, NEWS_TOPIC_VALUES } from './sources';

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
                  publishedAt: {
                    type: Type.STRING,
                    description: 'YYYY-MM-DD; use best estimate if only month/year',
                  },
                  topics: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
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
    logger.error('Gemini article extract failed', {
      sourceLabel,
      ...errorDetails(error),
    });
    return [];
  }
}

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
          contents: `Extract upcoming or listed gem / jewellery exhibitions and trade shows from this page.
Source: ${sourceLabel}
Return up to 15 events with title, venue, optional city/country, and start/end dates as YYYY-MM-DD.
If only one date is known, use it for both start and end.
Ignore past events older than 1 year when dates are clear.

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
                  venue: { type: Type.STRING },
                  city: { type: Type.STRING, nullable: true },
                  country: { type: Type.STRING, nullable: true },
                  startDate: { type: Type.STRING },
                  endDate: { type: Type.STRING },
                },
                required: ['title', 'venue', 'startDate', 'endDate'],
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
    logger.error('Gemini exhibition extract failed', {
      sourceLabel,
      ...errorDetails(error),
    });
    return [];
  }
}
