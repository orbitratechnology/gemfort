import type { NewsRegion, NewsTopic } from '@/types';

export const NEWS_TOPICS: { id: NewsTopic; label: string }[] = [
  { id: 'market', label: 'Market' },
  { id: 'trade_policy', label: 'Trade policy' },
  { id: 'regulation', label: 'Regulation' },
  { id: 'exhibitions', label: 'Shows' },
  { id: 'industry', label: 'Industry' },
  { id: 'sri_lanka', label: 'Sri Lanka' },
];

export const NEWS_REGIONS: { id: NewsRegion | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'local', label: 'Local' },
  { id: 'global', label: 'Global' },
];

export const NEWS_TOPIC_IDS = NEWS_TOPICS.map((t) => t.id);
