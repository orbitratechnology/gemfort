import {
  collection,
  getDocs,
  getFirebaseDb,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from '@/lib/firebase/db';
import type { GemExhibition, GemNewsArticle, NewsRegion, NewsTopic } from '@/types';

export const NEWS_PAGE_SIZE = 15;

type QueryDoc = Awaited<ReturnType<typeof getDocs>>['docs'][number];

export type NewsCursor = QueryDoc | null;

export type NewsPage = {
  items: GemNewsArticle[];
  cursor: NewsCursor;
  hasMore: boolean;
};

export type NewsFeedFilters = {
  region?: NewsRegion | 'all';
  topic?: NewsTopic | null;
};

function mapNewsDoc(docSnap: QueryDoc): GemNewsArticle {
  return { id: docSnap.id, ...(docSnap.data() as object) } as GemNewsArticle;
}

function mapExhibitionDoc(docSnap: QueryDoc): GemExhibition {
  return { id: docSnap.id, ...(docSnap.data() as object) } as GemExhibition;
}

export async function fetchGemNewsPage(
  filters: NewsFeedFilters = {},
  cursor: NewsCursor = null,
  pageSize = NEWS_PAGE_SIZE,
): Promise<NewsPage> {
  const col = collection(getFirebaseDb(), 'gem_news');
  const region = filters.region && filters.region !== 'all' ? filters.region : null;
  const topic = filters.topic ?? null;

  let q;
  if (region && topic) {
    q = cursor
      ? query(
          col,
          where('isVisible', '==', true),
          where('region', '==', region),
          where('topics', 'array-contains', topic),
          orderBy('publishedAt', 'desc'),
          startAfter(cursor),
          limit(pageSize),
        )
      : query(
          col,
          where('isVisible', '==', true),
          where('region', '==', region),
          where('topics', 'array-contains', topic),
          orderBy('publishedAt', 'desc'),
          limit(pageSize),
        );
  } else if (region) {
    q = cursor
      ? query(
          col,
          where('isVisible', '==', true),
          where('region', '==', region),
          orderBy('publishedAt', 'desc'),
          startAfter(cursor),
          limit(pageSize),
        )
      : query(
          col,
          where('isVisible', '==', true),
          where('region', '==', region),
          orderBy('publishedAt', 'desc'),
          limit(pageSize),
        );
  } else if (topic) {
    q = cursor
      ? query(
          col,
          where('isVisible', '==', true),
          where('topics', 'array-contains', topic),
          orderBy('publishedAt', 'desc'),
          startAfter(cursor),
          limit(pageSize),
        )
      : query(
          col,
          where('isVisible', '==', true),
          where('topics', 'array-contains', topic),
          orderBy('publishedAt', 'desc'),
          limit(pageSize),
        );
  } else {
    q = cursor
      ? query(
          col,
          where('isVisible', '==', true),
          orderBy('publishedAt', 'desc'),
          startAfter(cursor),
          limit(pageSize),
        )
      : query(
          col,
          where('isVisible', '==', true),
          orderBy('publishedAt', 'desc'),
          limit(pageSize),
        );
  }

  const snap = await getDocs(q);
  const items = snap.docs.map(mapNewsDoc);
  const last = snap.docs[snap.docs.length - 1] ?? null;

  return {
    items,
    cursor: last,
    hasMore: snap.docs.length >= pageSize,
  };
}

export async function fetchGemNewsTeaser(
  region: NewsRegion,
  count = 3,
): Promise<GemNewsArticle[]> {
  const page = await fetchGemNewsPage({ region }, null, count);
  return page.items;
}

export async function fetchUpcomingExhibitions(
  region?: NewsRegion | 'all',
  count = 8,
): Promise<GemExhibition[]> {
  const col = collection(getFirebaseDb(), 'exhibitions');
  const q =
    region && region !== 'all'
      ? query(
          col,
          where('isVisible', '==', true),
          where('region', '==', region),
          orderBy('startDate', 'asc'),
          limit(count),
        )
      : query(
          col,
          where('isVisible', '==', true),
          orderBy('startDate', 'asc'),
          limit(count),
        );

  const snap = await getDocs(q);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return snap.docs
    .map(mapExhibitionDoc)
    .filter((show) => {
      const end = show.endDate?.toDate?.() ?? show.startDate?.toDate?.();
      return end ? end.getTime() >= todayStart.getTime() : true;
    });
}
