export type NewsRegion = 'local' | 'global';

export type NewsTopic =
  | 'market'
  | 'trade_policy'
  | 'regulation'
  | 'exhibitions'
  | 'industry'
  | 'sri_lanka';

export const NEWS_TOPIC_VALUES: NewsTopic[] = [
  'market',
  'trade_policy',
  'regulation',
  'exhibitions',
  'industry',
  'sri_lanka',
];

export type NewsSource = {
  id: string;
  label: string;
  url: string;
  region: NewsRegion;
  defaultTopics: NewsTopic[];
};

export type ExhibitionSource = {
  id: string;
  label: string;
  url: string;
  region: NewsRegion;
};

export const NEWS_SOURCES: NewsSource[] = [
  {
    id: 'edb',
    label: 'Sri Lanka EDB',
    url: 'https://www.srilankabusiness.com/news/gem-and-jewellery/',
    region: 'local',
    defaultTopics: ['sri_lanka', 'trade_policy', 'industry'],
  },
  {
    id: 'ngja',
    label: 'NGJA Newsline',
    url: 'https://ngja.gov.lk/news-line/',
    region: 'local',
    defaultTopics: ['sri_lanka', 'regulation', 'industry'],
  },
  {
    id: 'jeweller',
    label: 'Jeweller Magazine',
    url: 'https://www.jewellermagazine.com/News/',
    region: 'global',
    defaultTopics: ['market', 'industry'],
  },
];

export const EXHIBITION_SOURCES: ExhibitionSource[] = [
  {
    id: 'gslfair',
    label: 'Gem Sri Lanka',
    url: 'https://gslfair.com/',
    region: 'local',
  },
  {
    id: 'facets',
    label: 'FACETS Sri Lanka',
    url: 'https://ngja.gov.lk/facet/',
    region: 'local',
  },
  {
    id: 'ica',
    label: 'ICA Events',
    url: 'https://www.gemstone.org/events',
    region: 'global',
  },
];

export const GEMINI_MODEL = 'gemini-2.5-flash-lite';
