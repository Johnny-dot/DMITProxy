import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { dataDirectory } from './db.js';

export type NewsTopicId = 'markets' | 'macro' | 'technology' | 'aiTalks' | 'crypto';

interface NewsTopicDefinition {
  id: NewsTopicId;
  labelEn: string;
  labelZh: string;
  descriptionEn: string;
  descriptionZh: string;
  query: string;
  scoreItem?: (item: NewsHeadline) => number;
}

export interface NewsHeadline {
  id: string;
  topicId: NewsTopicId;
  title: string;
  source: string;
  sourceUrl: string | null;
  url: string;
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
  attributionUrl: string;
  cachedAt: number;
  ttlMinutes: number;
  topics: NewsTopicFeed[];
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
const NEWS_PROVIDER = 'Google News RSS';
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
const cacheDirectory = path.join(dataDirectory, 'news-cache');
const newsCachePath = path.join(cacheDirectory, 'feed.json');
const REQUEST_HEADERS = {
  Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
  'User-Agent': 'Prism',
};

const AI_TALKS_PRIMARY_KEYWORDS =
  /\b(podcast|interview|conversation|fireside|transcript|chat|q&a)\b/i;
const AI_TALKS_BONUS_KEYWORDS =
  /full interview|podcast transcript|light cone|dwarkesh|lex fridman|hard fork|summit/i;
const AI_TALKS_PEOPLE_KEYWORDS =
  /sam altman|dario amodei|anthropic|demis hassabis|deepmind|mustafa suleyman|openai|boris cherny|claude code|sundar pichai|jensen huang/i;
const AI_TALKS_NOISE_KEYWORDS = /\b(opinion|editorial|review)\b/i;

function scoreAiTalkItem(item: NewsHeadline) {
  const haystack = `${item.title} ${item.source}`;
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
    labelZh: '市场',
    descriptionEn: 'Broad market moves, major indices, and risk sentiment.',
    descriptionZh: '大盘走势、主要指数和风险情绪。',
    query: 'stock market OR markets when:1d',
  },
  {
    id: 'macro',
    labelEn: 'Macro',
    labelZh: '宏观',
    descriptionEn: 'Rates, inflation, central banks, and macro policy headlines.',
    descriptionZh: '利率、通胀、央行和宏观政策。',
    query: 'fed OR inflation OR treasury yields when:1d',
  },
  {
    id: 'technology',
    labelEn: 'Technology',
    labelZh: '科技',
    descriptionEn: 'AI, semis, and large-cap tech movers that affect sentiment.',
    descriptionZh: 'AI、半导体和影响情绪的大型科技股。',
    query: 'AI OR semiconductors OR Nvidia OR big tech when:1d',
  },
  {
    id: 'aiTalks',
    labelEn: 'AI talks',
    labelZh: 'AI 访谈',
    descriptionEn:
      'Podcast episodes, interviews, and long-form conversations with AI company leaders.',
    descriptionZh: 'AI 公司核心人物的播客、访谈和长对话内容。',
    query:
      '("Sam Altman" OR "Dario Amodei" OR "Demis Hassabis" OR "Sundar Pichai" OR "Mustafa Suleyman" OR "Boris Cherny" OR "Jensen Huang") (podcast OR interview OR conversation) AI when:30d',
    scoreItem: scoreAiTalkItem,
  },
  {
    id: 'crypto',
    labelEn: 'Crypto',
    labelZh: '加密',
    descriptionEn: 'Bitcoin, Ethereum, ETFs, and crypto market structure.',
    descriptionZh: '比特币、以太坊、ETF 和加密市场结构。',
    query: 'bitcoin OR ethereum OR crypto market when:1d',
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

function writeCacheFile(filePath: string, payload: unknown) {
  ensureCacheDirectory();
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function buildGoogleNewsUrl(query: string) {
  const url = new URL(GOOGLE_NEWS_SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'en-US');
  url.searchParams.set('gl', 'US');
  url.searchParams.set('ceid', 'US:en');
  return url.toString();
}

function decodeXmlEntities(value: string) {
  return value
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
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = block.match(pattern);
  return match ? decodeXmlEntities(match[1].trim()) : '';
}

function getSource(block: string) {
  const match = block.match(/<source(?:\s+url="([^"]*)")?[^>]*>([\s\S]*?)<\/source>/i);
  return {
    sourceUrl: match?.[1] ? decodeXmlEntities(match[1].trim()) : null,
    sourceName: match?.[2] ? decodeXmlEntities(match[2].trim()) : '',
  };
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

function createHeadlineId(topicId: NewsTopicId, title: string, url: string) {
  return createHash('sha1').update(`${topicId}:${title}:${url}`).digest('hex').slice(0, 12);
}

function parseItems(xml: string, topic: NewsTopicDefinition): NewsHeadline[] {
  const blocks = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).map((match) => match[1]);

  return blocks
    .map((block) => {
      const rawTitle = stripHtml(getTagValue(block, 'title'));
      const url = getTagValue(block, 'link');
      const publishedAt = toTimestamp(getTagValue(block, 'pubDate'));
      const { sourceName, sourceUrl } = getSource(block);
      const title = normalizeTitle(rawTitle, sourceName);
      if (!title || !url) return null;

      return {
        id: createHeadlineId(topic.id, title, url),
        topicId: topic.id,
        title,
        source: sourceName || 'Google News',
        sourceUrl,
        url,
        publishedAt,
      } satisfies NewsHeadline;
    })
    .filter((item): item is NewsHeadline => item !== null);
}

function prioritizeItems(topic: NewsTopicDefinition, items: NewsHeadline[]) {
  if (!topic.scoreItem) {
    return items.slice(0, NEWS_ITEM_LIMIT);
  }

  return [...items]
    .sort((left, right) => {
      const scoreDelta = topic.scoreItem!(right) - topic.scoreItem!(left);
      if (scoreDelta !== 0) return scoreDelta;
      return (right.publishedAt ?? 0) - (left.publishedAt ?? 0);
    })
    .slice(0, NEWS_ITEM_LIMIT);
}

async function fetchTopicFeed(topic: NewsTopicDefinition): Promise<NewsTopicFeed> {
  const response = await fetch(buildGoogleNewsUrl(topic.query), {
    headers: REQUEST_HEADERS,
  });

  const xml = await response.text();
  if (!response.ok) {
    throw new NewsFeedError(`News provider returned HTTP ${response.status}.`, response.status);
  }

  const items = prioritizeItems(topic, parseItems(xml, topic));
  if (items.length === 0) {
    throw new NewsFeedError('News feed returned no headlines.', 502);
  }

  return {
    id: topic.id,
    labelEn: topic.labelEn,
    labelZh: topic.labelZh,
    descriptionEn: topic.descriptionEn,
    descriptionZh: topic.descriptionZh,
    status: 'ok',
    items,
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
    attributionUrl: GOOGLE_NEWS_ATTRIBUTION_URL,
    cachedAt: topicResults.some((result) => !result.usedFallback && result.topic.status === 'ok')
      ? Date.now()
      : (previousFeed?.cachedAt ?? Date.now()),
    ttlMinutes: NEWS_CACHE_TTL_MINUTES,
    topics,
  };
}

export async function getNewsFeed(forceRefresh = false): Promise<NewsFeedPayload> {
  const cached = readCacheFile<NewsFeedPayload>(newsCachePath);

  if (!forceRefresh) {
    if (cached && typeof cached.cachedAt === 'number' && isFresh(cached.cachedAt)) {
      return cached;
    }
    if (inflightFeed) return inflightFeed;
  }

  const request = fetchFeedPayload(cached)
    .then((payload) => {
      writeCacheFile(newsCachePath, payload);
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
