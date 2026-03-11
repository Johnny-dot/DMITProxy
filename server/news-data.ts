import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { dataDirectory } from './db.js';

export type NewsTopicId = 'markets' | 'macro' | 'technology' | 'aiTalks' | 'crypto';

type NewsSourceKind = 'rss' | 'google';

interface NewsSourceDefinition {
  id: string;
  kind: NewsSourceKind;
  label: string;
  attributionUrl: string;
  url?: string;
  query?: string;
  sourceName?: string;
  sourceUrl?: string | null;
}

interface NewsTopicDefinition {
  id: NewsTopicId;
  labelEn: string;
  labelZh: string;
  descriptionEn: string;
  descriptionZh: string;
  sources: NewsSourceDefinition[];
  scoreItem?: (item: NewsHeadline) => number;
}

export interface NewsHeadline {
  id: string;
  topicId: NewsTopicId;
  title: string;
  summary: string | null;
  source: string;
  sourceUrl: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: number | null;
}

export interface NewsTopicFeed {
  id: NewsTopicId;
  labelEn: string;
  labelZh: string;
  descriptionEn: string;
  descriptionZh: string;
  status: 'ok' | 'error';
  error?: string;
  items: NewsHeadline[];
}

export interface NewsFeedPayload {
  provider: string;
  attributionUrl: string | null;
  cachedAt: number;
  ttlMinutes: number;
  topics: NewsTopicFeed[];
}

interface CachedNewsFeedPayload extends NewsFeedPayload {
  schemaVersion: number;
}

export class NewsFeedError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

const GOOGLE_NEWS_ATTRIBUTION_URL = 'https://news.google.com/';
const GOOGLE_NEWS_SEARCH_URL = 'https://news.google.com/rss/search';
const NEWS_PROVIDER = 'Curated multi-source feed';
const NEWS_CACHE_SCHEMA_VERSION = 2;
const DEFAULT_NEWS_CACHE_TTL_MINUTES = 15;
const DEFAULT_NEWS_ITEM_LIMIT = 8;
const configuredNewsCacheTtlMinutes = Number.parseInt(process.env.NEWS_CACHE_TTL_MINUTES ?? '', 10);
const configuredNewsItemLimit = Number.parseInt(process.env.NEWS_ITEM_LIMIT ?? '', 10);
const NEWS_CACHE_TTL_MINUTES =
  Number.isFinite(configuredNewsCacheTtlMinutes) && configuredNewsCacheTtlMinutes > 0
    ? Math.max(5, Math.min(30, configuredNewsCacheTtlMinutes))
    : DEFAULT_NEWS_CACHE_TTL_MINUTES;
const NEWS_ITEM_LIMIT =
  Number.isFinite(configuredNewsItemLimit) && configuredNewsItemLimit > 0
    ? Math.max(4, Math.min(12, configuredNewsItemLimit))
    : DEFAULT_NEWS_ITEM_LIMIT;
const NEWS_CACHE_TTL_MS = NEWS_CACHE_TTL_MINUTES * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const cacheDirectory = path.join(dataDirectory, 'news-cache');
const newsCachePath = path.join(cacheDirectory, 'feed.json');
const REQUEST_HEADERS = {
  Accept:
    'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, text/html;q=0.8, */*;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133 Safari/537.36 PrismNewsFeed/1.0',
};

const RSS_SOURCES = {
  marketwatchTop: {
    id: 'marketwatch-top',
    kind: 'rss',
    label: 'MarketWatch Top Stories',
    attributionUrl: 'https://www.marketwatch.com/rss/topstories',
    url: 'https://www.marketwatch.com/rss/topstories',
    sourceName: 'MarketWatch',
    sourceUrl: 'https://www.marketwatch.com',
  },
  cnbcTop: {
    id: 'cnbc-top',
    kind: 'rss',
    label: 'CNBC US Top News',
    attributionUrl: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    sourceName: 'CNBC',
    sourceUrl: 'https://www.cnbc.com',
  },
  cnbcFinance: {
    id: 'cnbc-finance',
    kind: 'rss',
    label: 'CNBC Finance',
    attributionUrl: 'https://www.cnbc.com/id/10000664/device/rss/rss.html',
    url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html',
    sourceName: 'CNBC',
    sourceUrl: 'https://www.cnbc.com',
  },
  cnbcTech: {
    id: 'cnbc-tech',
    kind: 'rss',
    label: 'CNBC Tech',
    attributionUrl: 'https://www.cnbc.com/id/19854910/device/rss/rss.html',
    url: 'https://www.cnbc.com/id/19854910/device/rss/rss.html',
    sourceName: 'CNBC',
    sourceUrl: 'https://www.cnbc.com',
  },
  theVerge: {
    id: 'the-verge',
    kind: 'rss',
    label: 'The Verge',
    attributionUrl: 'https://www.theverge.com/rss/index.xml',
    url: 'https://www.theverge.com/rss/index.xml',
    sourceName: 'The Verge',
    sourceUrl: 'https://www.theverge.com',
  },
  techCrunch: {
    id: 'techcrunch',
    kind: 'rss',
    label: 'TechCrunch',
    attributionUrl: 'https://techcrunch.com/feed/',
    url: 'https://techcrunch.com/feed/',
    sourceName: 'TechCrunch',
    sourceUrl: 'https://techcrunch.com',
  },
  ventureBeat: {
    id: 'venturebeat',
    kind: 'rss',
    label: 'VentureBeat',
    attributionUrl: 'https://feeds.feedburner.com/venturebeat/SZYF',
    url: 'https://feeds.feedburner.com/venturebeat/SZYF',
    sourceName: 'VentureBeat',
    sourceUrl: 'https://venturebeat.com',
  },
  coindesk: {
    id: 'coindesk',
    kind: 'rss',
    label: 'CoinDesk',
    attributionUrl: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    sourceName: 'CoinDesk',
    sourceUrl: 'https://www.coindesk.com',
  },
  lexFridmanPodcast: {
    id: 'lex-fridman-podcast',
    kind: 'rss',
    label: 'Lex Fridman Podcast',
    attributionUrl: 'https://lexfridman.com/feed/podcast/',
    url: 'https://lexfridman.com/feed/podcast/',
    sourceName: 'Lex Fridman Podcast',
    sourceUrl: 'https://lexfridman.com/podcast/',
  },
} satisfies Record<string, NewsSourceDefinition>;

function createGoogleNewsSource(id: string, label: string, query: string): NewsSourceDefinition {
  return {
    id,
    kind: 'google',
    label,
    attributionUrl: GOOGLE_NEWS_ATTRIBUTION_URL,
    query,
    sourceName: 'Google News',
    sourceUrl: GOOGLE_NEWS_ATTRIBUTION_URL,
  };
}

const AI_TALKS_PRIMARY_KEYWORDS =
  /\b(podcast|interview|conversation|fireside|transcript|chat|q&a)\b/i;
const AI_TALKS_BONUS_KEYWORDS =
  /full interview|podcast transcript|light cone|dwarkesh|lex fridman|hard fork|summit/i;
const AI_TALKS_PEOPLE_KEYWORDS =
  /sam altman|dario amodei|anthropic|demis hassabis|deepmind|mustafa suleyman|openai|boris cherny|claude code|sundar pichai|jensen huang/i;
const AI_TALKS_NOISE_KEYWORDS = /\b(opinion|editorial|review)\b/i;

function scoreAiTalkItem(item: NewsHeadline) {
  const haystack = `${item.title} ${item.summary ?? ''} ${item.source}`;
  let score = 0;

  if (AI_TALKS_PRIMARY_KEYWORDS.test(haystack)) score += 20;
  if (AI_TALKS_BONUS_KEYWORDS.test(haystack)) score += 12;
  if (AI_TALKS_PEOPLE_KEYWORDS.test(haystack)) score += 8;
  if (AI_TALKS_NOISE_KEYWORDS.test(haystack)) score -= 30;

  return score;
}

const NEWS_TOPICS: NewsTopicDefinition[] = [
  {
    id: 'markets',
    labelEn: 'Markets',
    labelZh: '\u5e02\u573a',
    descriptionEn: 'Broad market moves, major indices, and risk sentiment.',
    descriptionZh:
      '\u5927\u76d8\u8d70\u52bf\u3001\u4e3b\u8981\u6307\u6570\u548c\u98ce\u9669\u60c5\u7eea\u3002',
    sources: [
      RSS_SOURCES.marketwatchTop,
      RSS_SOURCES.cnbcFinance,
      createGoogleNewsSource(
        'google-markets',
        'Google News Markets',
        'stock market OR markets when:1d',
      ),
    ],
  },
  {
    id: 'macro',
    labelEn: 'Macro',
    labelZh: '\u5b8f\u89c2',
    descriptionEn: 'Rates, inflation, central banks, and macro policy headlines.',
    descriptionZh:
      '\u5229\u7387\u3001\u901a\u80c0\u3001\u592e\u884c\u548c\u5b8f\u89c2\u653f\u7b56\u3002',
    sources: [
      RSS_SOURCES.cnbcTop,
      RSS_SOURCES.cnbcFinance,
      createGoogleNewsSource(
        'google-macro',
        'Google News Macro',
        'fed OR inflation OR treasury yields when:1d',
      ),
    ],
  },
  {
    id: 'technology',
    labelEn: 'Technology',
    labelZh: '\u79d1\u6280',
    descriptionEn: 'AI, semis, and large-cap tech movers that affect sentiment.',
    descriptionZh:
      'AI\u3001\u534a\u5bfc\u4f53\u548c\u5f71\u54cd\u60c5\u7eea\u7684\u5927\u578b\u79d1\u6280\u80a1\u3002',
    sources: [
      RSS_SOURCES.theVerge,
      RSS_SOURCES.techCrunch,
      RSS_SOURCES.ventureBeat,
      RSS_SOURCES.cnbcTech,
    ],
  },
  {
    id: 'aiTalks',
    labelEn: 'AI talks',
    labelZh: 'AI \u8bbf\u8c08',
    descriptionEn:
      'Podcast episodes, interviews, and long-form conversations with AI company leaders.',
    descriptionZh:
      'AI \u516c\u53f8\u6838\u5fc3\u4eba\u7269\u7684\u64ad\u5ba2\u3001\u8bbf\u8c08\u548c\u957f\u5bf9\u8bdd\u5185\u5bb9\u3002',
    sources: [
      RSS_SOURCES.lexFridmanPodcast,
      createGoogleNewsSource(
        'google-ai-talks',
        'Google News AI Talks',
        '("Sam Altman" OR "Dario Amodei" OR "Demis Hassabis" OR "Sundar Pichai" OR "Mustafa Suleyman" OR "Boris Cherny" OR "Jensen Huang") (podcast OR interview OR conversation) AI when:30d',
      ),
    ],
    scoreItem: scoreAiTalkItem,
  },
  {
    id: 'crypto',
    labelEn: 'Crypto',
    labelZh: '\u52a0\u5bc6',
    descriptionEn: 'Bitcoin, Ethereum, ETFs, and crypto market structure.',
    descriptionZh:
      '\u6bd4\u7279\u5e01\u3001\u4ee5\u592a\u574a\u3001ETF \u548c\u52a0\u5bc6\u5e02\u573a\u7ed3\u6784\u3002',
    sources: [
      RSS_SOURCES.coindesk,
      createGoogleNewsSource(
        'google-crypto',
        'Google News Crypto',
        'bitcoin OR ethereum OR crypto market when:1d',
      ),
    ],
  },
];

let inflightFeed: Promise<NewsFeedPayload> | null = null;

function ensureCacheDirectory() {
  if (!fs.existsSync(cacheDirectory)) {
    fs.mkdirSync(cacheDirectory, { recursive: true });
  }
}

function isFresh(cachedAt: number) {
  return Date.now() - cachedAt < NEWS_CACHE_TTL_MS;
}

function readCacheFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function writeCacheFile(filePath: string, payload: unknown) {
  ensureCacheDirectory();
  const tmp = `${filePath}.tmp`;
  await fsPromises.writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8');
  await fsPromises.rename(tmp, filePath);
}

function readNewsCache() {
  const cached = readCacheFile<CachedNewsFeedPayload>(newsCachePath);
  if (!cached || cached.schemaVersion !== NEWS_CACHE_SCHEMA_VERSION) {
    return null;
  }
  return cached;
}

function buildGoogleNewsUrl(query: string) {
  const url = new URL(GOOGLE_NEWS_SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'en-US');
  url.searchParams.set('gl', 'US');
  url.searchParams.set('ceid', 'US:en');
  return url.toString();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function stripHtml(value: string) {
  return decodeXmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTagValue(block: string, tagName: string) {
  const pattern = new RegExp(
    `<${escapeRegExp(tagName)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRegExp(tagName)}>`,
    'i',
  );
  const match = block.match(pattern);
  return match ? decodeXmlEntities(match[1].trim()) : '';
}

function getSource(block: string) {
  const match = block.match(/<source(?:\s+url=(["'])(.*?)\1)?[^>]*>([\s\S]*?)<\/source>/i);
  return {
    sourceUrl: match?.[2] ? decodeXmlEntities(match[2].trim()) : null,
    sourceName: match?.[3] ? decodeXmlEntities(match[3].trim()) : '',
  };
}

function parseAttributes(fragment: string) {
  const attrs: Record<string, string> = {};
  for (const match of fragment.matchAll(/([:\w-]+)=(["'])(.*?)\2/g)) {
    attrs[match[1].toLowerCase()] = decodeXmlEntities(match[3]);
  }
  return attrs;
}

function getTagAttribute(block: string, tagName: string, attrName: string) {
  const pattern = new RegExp(`<${escapeRegExp(tagName)}\\b([^>]*)\\/?>`, 'gi');
  for (const match of block.matchAll(pattern)) {
    const attrs = parseAttributes(match[1]);
    const value = attrs[attrName.toLowerCase()];
    if (value) return value;
  }
  return '';
}

function getAtomLink(entryBlock: string) {
  const pattern = /<link\b([^>]*)\/?>/gi;
  let firstHref = '';

  for (const match of entryBlock.matchAll(pattern)) {
    const attrs = parseAttributes(match[1]);
    const href = attrs.href;
    if (!href) continue;
    if (!firstHref) firstHref = href;
    const rel = (attrs.rel ?? '').toLowerCase();
    if (!rel || rel === 'alternate') return href;
  }

  return firstHref;
}

function normalizeTitle(title: string, source: string) {
  if (!source) return title.trim();
  const suffix = ` - ${source}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title.trim();
}

function toTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveUrl(value: string, baseUrl?: string | null) {
  const candidate = decodeXmlEntities(value.trim());
  if (!candidate) return null;

  try {
    if (baseUrl) {
      return new URL(candidate, baseUrl).toString();
    }
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

function normalizeNewsUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = '';

    const transientParams = ['ceid', 'gl', 'hl', 'oc', 'mod', 'taid'];
    for (const key of transientParams) {
      url.searchParams.delete(key);
    }

    for (const key of Array.from(url.searchParams.keys())) {
      if (/^utm_/i.test(key)) {
        url.searchParams.delete(key);
      }
    }

    const normalizedPath = url.pathname.replace(/\/+$/, '') || '/';
    const normalizedSearch = url.searchParams.toString();
    return `${url.hostname.toLowerCase()}${normalizedPath.toLowerCase()}${
      normalizedSearch ? `?${normalizedSearch}` : ''
    }`;
  } catch {
    return value.trim().toLowerCase();
  }
}

function normalizeSummary(value: string, title: string) {
  const summary = stripHtml(value);
  if (!summary) return null;
  if (summary.toLowerCase() === title.trim().toLowerCase()) return null;
  return summary;
}

function extractImageFromHtml(value: string, baseUrl?: string | null) {
  for (const match of value.matchAll(/<img\b[^>]*\bsrc=(["'])(.*?)\1/gi)) {
    const imageUrl = resolveUrl(match[2], baseUrl);
    if (imageUrl) return imageUrl;
  }
  return null;
}

function extractImageUrl(block: string, htmlFragments: string[], baseUrl?: string | null) {
  for (const tagName of ['media:content', 'media:thumbnail', 'enclosure']) {
    const pattern = new RegExp(`<${escapeRegExp(tagName)}\\b([^>]*)\\/?>`, 'gi');
    for (const match of block.matchAll(pattern)) {
      const attrs = parseAttributes(match[1]);
      const type = (attrs.type ?? '').toLowerCase();
      const medium = (attrs.medium ?? '').toLowerCase();
      const url = attrs.url ?? attrs.href ?? '';

      if (!url) continue;
      if (tagName === 'enclosure' && type && !type.startsWith('image/')) continue;
      if (
        tagName !== 'enclosure' &&
        medium &&
        medium !== 'image' &&
        type &&
        !type.startsWith('image/')
      ) {
        continue;
      }

      const resolved = resolveUrl(url, baseUrl);
      if (resolved) return resolved;
    }
  }

  for (const fragment of htmlFragments) {
    const imageUrl = extractImageFromHtml(fragment, baseUrl);
    if (imageUrl) return imageUrl;
  }

  return null;
}

function createHeadlineId(topicId: NewsTopicId, sourceId: string, title: string, url: string) {
  return createHash('sha1')
    .update(`${topicId}:${sourceId}:${title}:${normalizeNewsUrl(url)}`)
    .digest('hex')
    .slice(0, 12);
}

function parseGoogleNewsItems(
  xml: string,
  topic: NewsTopicDefinition,
  source: NewsSourceDefinition,
) {
  const blocks = Array.from(xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)).map(
    (match) => match[1],
  );

  return blocks
    .map((block) => {
      const rawTitle = stripHtml(getTagValue(block, 'title'));
      const url = getTagValue(block, 'link');
      const publishedAt = toTimestamp(getTagValue(block, 'pubDate'));
      const { sourceName, sourceUrl } = getSource(block);
      const title = normalizeTitle(rawTitle, sourceName);
      if (!title || !url) return null;

      return {
        id: createHeadlineId(topic.id, source.id, title, url),
        topicId: topic.id,
        title,
        summary: null,
        source: sourceName || source.sourceName || 'Google News',
        sourceUrl: sourceUrl || source.sourceUrl || GOOGLE_NEWS_ATTRIBUTION_URL,
        url,
        imageUrl: null,
        publishedAt,
      } satisfies NewsHeadline;
    })
    .filter((item): item is NewsHeadline => item !== null);
}

function parseRssItems(xml: string, topic: NewsTopicDefinition, source: NewsSourceDefinition) {
  const blocks = Array.from(xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)).map(
    (match) => match[1],
  );

  return blocks
    .map((block) => {
      const rawTitle = stripHtml(getTagValue(block, 'title'));
      const url = getTagValue(block, 'link') || getTagAttribute(block, 'link', 'href');
      const description = getTagValue(block, 'description');
      const content = getTagValue(block, 'content:encoded');
      const publishedAt = toTimestamp(
        getTagValue(block, 'pubDate') ||
          getTagValue(block, 'dc:date') ||
          getTagValue(block, 'published'),
      );
      const { sourceName, sourceUrl } = getSource(block);
      const title = normalizeTitle(rawTitle, sourceName || source.sourceName || '');
      if (!title || !url) return null;

      const resolvedUrl = resolveUrl(url, source.attributionUrl) ?? url;
      return {
        id: createHeadlineId(topic.id, source.id, title, resolvedUrl),
        topicId: topic.id,
        title,
        summary: normalizeSummary(description || content, title),
        source: sourceName || source.sourceName || source.label,
        sourceUrl: sourceUrl || source.sourceUrl || source.attributionUrl,
        url: resolvedUrl,
        imageUrl: extractImageUrl(block, [content, description], resolvedUrl) ?? null,
        publishedAt,
      } satisfies NewsHeadline;
    })
    .filter((item): item is NewsHeadline => item !== null);
}

function parseAtomItems(xml: string, topic: NewsTopicDefinition, source: NewsSourceDefinition) {
  const blocks = Array.from(xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)).map(
    (match) => match[1],
  );

  return blocks
    .map((block) => {
      const rawTitle = stripHtml(getTagValue(block, 'title'));
      const url = getAtomLink(block);
      const summary = getTagValue(block, 'summary');
      const content = getTagValue(block, 'content');
      const publishedAt = toTimestamp(
        getTagValue(block, 'published') || getTagValue(block, 'updated'),
      );
      if (!rawTitle || !url) return null;

      const resolvedUrl = resolveUrl(url, source.attributionUrl) ?? url;
      return {
        id: createHeadlineId(topic.id, source.id, rawTitle, resolvedUrl),
        topicId: topic.id,
        title: rawTitle,
        summary: normalizeSummary(summary || content, rawTitle),
        source: source.sourceName || source.label,
        sourceUrl: source.sourceUrl || source.attributionUrl,
        url: resolvedUrl,
        imageUrl: extractImageUrl(block, [content, summary], resolvedUrl) ?? null,
        publishedAt,
      } satisfies NewsHeadline;
    })
    .filter((item): item is NewsHeadline => item !== null);
}

function parseItems(xml: string, topic: NewsTopicDefinition, source: NewsSourceDefinition) {
  if (source.kind === 'google') {
    return parseGoogleNewsItems(xml, topic, source);
  }

  if (/<entry\b/i.test(xml) && /<feed\b/i.test(xml)) {
    return parseAtomItems(xml, topic, source);
  }

  return parseRssItems(xml, topic, source);
}

function getDuplicateKey(item: NewsHeadline) {
  const normalizedSource = item.source.trim().toLowerCase();
  const normalizedTitle = item.title.trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalizedSource && normalizedTitle) {
    return `${normalizedSource}|${normalizedTitle}`;
  }
  return normalizeNewsUrl(item.url);
}

function itemCompletenessScore(item: NewsHeadline) {
  let score = 0;
  if (item.imageUrl) score += 4;
  if (item.summary) score += 2;
  if (item.publishedAt) score += 1;
  if (!item.url.includes('news.google.com/')) score += 1;
  return score;
}

function mergeDuplicateItems(existing: NewsHeadline, candidate: NewsHeadline) {
  const existingScore = itemCompletenessScore(existing);
  const candidateScore = itemCompletenessScore(candidate);
  const preferred =
    candidateScore > existingScore ||
    (candidateScore === existingScore && (candidate.publishedAt ?? 0) > (existing.publishedAt ?? 0))
      ? candidate
      : existing;
  const fallback = preferred === candidate ? existing : candidate;

  return {
    ...fallback,
    ...preferred,
    id: preferred.id,
    summary: preferred.summary ?? fallback.summary ?? null,
    imageUrl: preferred.imageUrl ?? fallback.imageUrl ?? null,
    publishedAt: preferred.publishedAt ?? fallback.publishedAt ?? null,
  } satisfies NewsHeadline;
}

function dedupeItems(items: NewsHeadline[]) {
  const deduped = new Map<string, NewsHeadline>();

  for (const item of items) {
    const key = getDuplicateKey(item);
    const existing = deduped.get(key);
    deduped.set(key, existing ? mergeDuplicateItems(existing, item) : item);
  }

  return Array.from(deduped.values());
}

function prioritizeItems(topic: NewsTopicDefinition, items: NewsHeadline[]) {
  const deduped = dedupeItems(items);
  const sorted = [...deduped].sort((left, right) => {
    if (topic.scoreItem) {
      const scoreDelta = topic.scoreItem(right) - topic.scoreItem(left);
      if (scoreDelta !== 0) return scoreDelta;
    }

    const publishedDelta = (right.publishedAt ?? 0) - (left.publishedAt ?? 0);
    if (publishedDelta !== 0) return publishedDelta;

    return itemCompletenessScore(right) - itemCompletenessScore(left);
  });

  return sorted.slice(0, NEWS_ITEM_LIMIT);
}

async function fetchSourceXml(source: NewsSourceDefinition) {
  const targetUrl =
    source.kind === 'google'
      ? buildGoogleNewsUrl(source.query ?? '')
      : (source.url ?? source.attributionUrl);

  const response = await fetch(targetUrl, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const xml = await response.text();
  if (!response.ok) {
    throw new NewsFeedError(`${source.label} returned HTTP ${response.status}.`, response.status);
  }

  return xml;
}

async function fetchSourceItems(topic: NewsTopicDefinition, source: NewsSourceDefinition) {
  const xml = await fetchSourceXml(source);
  const items = parseItems(xml, topic, source);
  if (items.length === 0) {
    throw new NewsFeedError(`${source.label} returned no visible headlines.`, 502);
  }
  return items;
}

async function fetchTopicFeed(topic: NewsTopicDefinition): Promise<NewsTopicFeed> {
  const results = await Promise.allSettled(
    topic.sources.map((source) => fetchSourceItems(topic, source)),
  );

  const items = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  const prioritized = prioritizeItems(topic, items);
  if (prioritized.length === 0) {
    throw new NewsFeedError('News feed returned no headlines.', 502);
  }

  return {
    id: topic.id,
    labelEn: topic.labelEn,
    labelZh: topic.labelZh,
    descriptionEn: topic.descriptionEn,
    descriptionZh: topic.descriptionZh,
    status: 'ok',
    items: prioritized,
  };
}

function resolveTopicFallback(
  previousFeed: NewsFeedPayload | null,
  topicId: NewsTopicId,
): NewsTopicFeed | null {
  const cachedTopic = previousFeed?.topics.find((topic) => topic.id === topicId);
  if (!cachedTopic || cachedTopic.items.length === 0) return null;

  return {
    ...cachedTopic,
    status: 'ok',
    error: undefined,
  };
}

async function fetchFeedPayload(
  previousFeed: NewsFeedPayload | null = null,
): Promise<NewsFeedPayload> {
  const topicResults = await Promise.all(
    NEWS_TOPICS.map(async (topic) => {
      try {
        return {
          topic: await fetchTopicFeed(topic),
          usedFallback: false,
        };
      } catch (error) {
        const fallback = resolveTopicFallback(previousFeed, topic.id);
        if (fallback) {
          return {
            topic: fallback,
            usedFallback: true,
          };
        }

        return {
          topic: {
            id: topic.id,
            labelEn: topic.labelEn,
            labelZh: topic.labelZh,
            descriptionEn: topic.descriptionEn,
            descriptionZh: topic.descriptionZh,
            status: 'error',
            error: error instanceof Error ? error.message : 'Failed to load feed',
            items: [],
          } satisfies NewsTopicFeed,
          usedFallback: false,
        };
      }
    }),
  );
  const topics = topicResults.map((result) => result.topic);

  return {
    provider: NEWS_PROVIDER,
    attributionUrl: null,
    cachedAt: topicResults.some((result) => !result.usedFallback && result.topic.status === 'ok')
      ? Date.now()
      : (previousFeed?.cachedAt ?? Date.now()),
    ttlMinutes: NEWS_CACHE_TTL_MINUTES,
    topics,
  };
}

export async function getNewsFeed(forceRefresh = false): Promise<NewsFeedPayload> {
  const cached = readNewsCache();

  if (!forceRefresh) {
    if (cached && typeof cached.cachedAt === 'number' && isFresh(cached.cachedAt)) {
      return cached;
    }
    if (inflightFeed) return inflightFeed;
  }

  const request = fetchFeedPayload(cached)
    .then(async (payload) => {
      await writeCacheFile(newsCachePath, {
        ...payload,
        schemaVersion: NEWS_CACHE_SCHEMA_VERSION,
      } satisfies CachedNewsFeedPayload);
      return payload;
    })
    .finally(() => {
      inflightFeed = null;
    });

  inflightFeed = request;
  return request;
}

export async function refreshNewsFeed() {
  const feed = await getNewsFeed(true);
  return { feed };
}
