/**
 * Seed sample gem_news + exhibitions for UI development.
 * Usage: node scripts/seed-gem-news.mjs
 */
import { createHash } from 'node:crypto';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'gemfort',
  });
}

const db = getFirestore();

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

const now = Date.now();
const day = 86_400_000;

const articles = [
  {
    title: 'Sri Lanka gem exports strengthen amid jewellery demand',
    summary:
      'EDB highlights steady gem and jewellery export growth driven by coloured stones and polished jewellery.',
    url: 'https://www.srilankabusiness.com/news/gem-and-jewellery/sample-exports-2026',
    source: 'Sri Lanka EDB',
    sourceId: 'edb',
    region: 'local',
    topics: ['sri_lanka', 'trade_policy', 'market'],
    publishedAt: new Date(now - 1 * day),
  },
  {
    title: 'NGJA outlines licensing updates for traders',
    summary:
      'The Authority published guidance for gem dealer licensing renewals and documentation checks.',
    url: 'https://ngja.gov.lk/news-line/sample-licensing-2026',
    source: 'NGJA Newsline',
    sourceId: 'ngja',
    region: 'local',
    topics: ['sri_lanka', 'regulation'],
    publishedAt: new Date(now - 2 * day),
  },
  {
    title: 'Global coloured stone prices firm into mid-year',
    summary:
      'Jeweller Magazine reports firming sapphire and ruby demand across major trading hubs.',
    url: 'https://www.jewellermagazine.com/News/sample-coloured-stones-2026',
    source: 'Jeweller Magazine',
    sourceId: 'jeweller',
    region: 'global',
    topics: ['market', 'industry'],
    publishedAt: new Date(now - 3 * day),
  },
  {
    title: 'ICA members prepare for international gem shows',
    summary:
      'Industry associations urge early registration for Q3–Q4 coloured gemstone events worldwide.',
    url: 'https://www.gemstone.org/events/sample-ica-preview',
    source: 'Jeweller Magazine',
    sourceId: 'jeweller',
    region: 'global',
    topics: ['exhibitions', 'industry'],
    publishedAt: new Date(now - 4 * day),
  },
  {
    title: 'Colombo trade houses watch rupee and freight costs',
    summary:
      'Local dealers weigh currency moves and logistics costs when pricing rough and cut parcels.',
    url: 'https://www.srilankabusiness.com/news/gem-and-jewellery/sample-freight-2026',
    source: 'Sri Lanka EDB',
    sourceId: 'edb',
    region: 'local',
    topics: ['sri_lanka', 'market'],
    publishedAt: new Date(now - 5 * day),
  },
  {
    title: 'Lab-grown vs natural debate shifts B2B messaging',
    summary:
      'Retail and wholesale brands refine disclosure language as natural stone premiums hold in key categories.',
    url: 'https://www.jewellermagazine.com/News/sample-disclosure-2026',
    source: 'Jeweller Magazine',
    sourceId: 'jeweller',
    region: 'global',
    topics: ['industry', 'regulation'],
    publishedAt: new Date(now - 6 * day),
  },
];

const exhibitions = [
  {
    title: 'Gem Sri Lanka Fair',
    venue: 'BMICH, Colombo',
    city: 'Colombo',
    country: 'Sri Lanka',
    startDate: new Date(now + 45 * day),
    endDate: new Date(now + 48 * day),
    region: 'local',
    sourceUrl: 'https://gslfair.com/',
    sourceId: 'gslfair',
  },
  {
    title: 'FACETS Sri Lanka',
    venue: 'Colombo',
    city: 'Colombo',
    country: 'Sri Lanka',
    startDate: new Date(now + 90 * day),
    endDate: new Date(now + 93 * day),
    region: 'local',
    sourceUrl: 'https://ngja.gov.lk/facet/',
    sourceId: 'facets',
  },
  {
    title: 'ICA Congress & Events',
    venue: 'International venues',
    city: null,
    country: null,
    startDate: new Date(now + 120 * day),
    endDate: new Date(now + 123 * day),
    region: 'global',
    sourceUrl: 'https://www.gemstone.org/events',
    sourceId: 'ica',
  },
];

async function main() {
  for (const a of articles) {
    const id = sha256(a.url);
    await db.collection('gem_news').doc(id).set(
      {
        title: a.title,
        summary: a.summary,
        url: a.url,
        canonicalUrl: a.url,
        source: a.source,
        sourceId: a.sourceId,
        region: a.region,
        topics: a.topics,
        publishedAt: Timestamp.fromDate(a.publishedAt),
        scrapedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        imageUrl: null,
        language: 'en',
        isVisible: true,
      },
      { merge: true },
    );
    console.log('news', id.slice(0, 8), a.title);
  }

  for (const e of exhibitions) {
    const startIso = e.startDate.toISOString().slice(0, 10);
    const id = sha256(`${e.title.toLowerCase()}|${startIso}|${e.sourceId}`);
    await db.collection('exhibitions').doc(id).set(
      {
        title: e.title,
        venue: e.venue,
        city: e.city,
        country: e.country,
        startDate: Timestamp.fromDate(e.startDate),
        endDate: Timestamp.fromDate(e.endDate),
        updatedAt: FieldValue.serverTimestamp(),
        region: e.region,
        sourceUrl: e.sourceUrl,
        sourceId: e.sourceId,
        isVisible: true,
      },
      { merge: true },
    );
    console.log('show', id.slice(0, 8), e.title);
  }

  console.log('Seed complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
