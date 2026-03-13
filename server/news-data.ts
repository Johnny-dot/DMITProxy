import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { Browser } from 'playwright';
import { dataDirectory } from './db.js';

export type NewsTopicId = 'markets' | 'macro' | 'world' | 'technology' | 'aiTalks' | 'crypto';

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

export interface ArticleContent {
  paragraphs: string[];
}

interface CachedArticleContent extends ArticleContent {
  schemaVersion: number;
  url: string;
  cachedAt: number;
  ttlMinutes: number;
}

const GOOGLE_NEWS_ATTRIBUTION_URL = 'https://news.google.com/';
const GOOGLE_NEWS_SEARCH_URL = 'https://news.google.com/rss/search';
const NEWS_PROVIDER = 'Curated multi-source feed';
const NEWS_CACHE_SCHEMA_VERSION = 6;
const ARTICLE_CACHE_SCHEMA_VERSION = 1;
const DEFAULT_NEWS_CACHE_TTL_MINUTES = 15;
const DEFAULT_ARTICLE_CACHE_TTL_MINUTES = 24 * 60;
const DEFAULT_NEWS_ITEM_LIMIT = 28;
const configuredNewsCacheTtlMinutes = Number.parseInt(process.env.NEWS_CACHE_TTL_MINUTES ?? '', 10);
const configuredArticleCacheTtlMinutes = Number.parseInt(
  process.env.NEWS_ARTICLE_CACHE_TTL_MINUTES ?? '',
  10,
);
const configuredNewsItemLimit = Number.parseInt(process.env.NEWS_ITEM_LIMIT ?? '', 10);
const NEWS_CACHE_TTL_MINUTES =
  Number.isFinite(configuredNewsCacheTtlMinutes) && configuredNewsCacheTtlMinutes > 0
    ? Math.max(5, Math.min(30, configuredNewsCacheTtlMinutes))
    : DEFAULT_NEWS_CACHE_TTL_MINUTES;
const ARTICLE_CACHE_TTL_MINUTES =
  Number.isFinite(configuredArticleCacheTtlMinutes) && configuredArticleCacheTtlMinutes > 0
    ? Math.max(60, Math.min(7 * 24 * 60, configuredArticleCacheTtlMinutes))
    : DEFAULT_ARTICLE_CACHE_TTL_MINUTES;
const NEWS_ITEM_LIMIT =
  Number.isFinite(configuredNewsItemLimit) && configuredNewsItemLimit > 0
    ? Math.max(10, Math.min(40, configuredNewsItemLimit))
    : DEFAULT_NEWS_ITEM_LIMIT;
const NEWS_CACHE_TTL_MS = NEWS_CACHE_TTL_MINUTES * 60 * 1000;
const ARTICLE_CACHE_TTL_MS = ARTICLE_CACHE_TTL_MINUTES * 60 * 1000;
const NEWS_BACKGROUND_REFRESH_INTERVAL_MS = Math.max(
  60_000,
  NEWS_CACHE_TTL_MS - Math.min(60_000, Math.floor(NEWS_CACHE_TTL_MS / 3)),
);
const FETCH_TIMEOUT_MS = 15_000;
const ARTICLE_FETCH_TIMEOUT_MS = 8_000;
const ARTICLE_BROWSER_TIMEOUT_MS = 12_000;
const ARTICLE_IMAGE_ENRICH_LIMIT_PER_TOPIC = 8;
const ARTICLE_FETCH_CONCURRENCY = 8;
const ARTICLE_PARAGRAPH_LIMIT = 40;
const ARTICLE_FETCH_MIN_PARAGRAPHS = 3;
const ARTICLE_FETCH_MIN_CHARACTERS = 420;
const ARTICLE_PREWARM_LIMIT = 6;
const ARTICLE_PREWARM_CONCURRENCY = 2;
const ARTICLE_CACHE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const ARTICLE_CACHE_RETENTION_MS = Math.max(ARTICLE_CACHE_TTL_MS * 2, 24 * 60 * 60 * 1000);
const cacheDirectory = path.join(dataDirectory, 'news-cache');
const newsCachePath = path.join(cacheDirectory, 'feed.json');
const articleCacheDirectory = path.join(cacheDirectory, 'articles');
const REQUEST_HEADERS = {
  Accept:
    'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, text/html;q=0.8, */*;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133 Safari/537.36 PrismNewsFeed/1.0',
};
const ARTICLE_REQUEST_HEADERS = {
  ...REQUEST_HEADERS,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};
const CJK_TEXT_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const ARTICLE_BOILERPLATE_PATTERNS = [
  /^posts from this (?:author|topic) will be added to your daily email digest and your homepage feed\.?$/i,
  /^sign up for .+ sent to your inbox (?:weekly|daily)\.?$/i,
  /^if you buy something from (?:a|an) .+ link, .+ may earn a commission(?:\..*)?$/i,
  /^see our ethics statement\.?$/i,
  /^this story is part of .+$/i,
];

let articleBrowserPromise: Promise<Browser> | null = null;
const inflightArticleContent = new Map<string, Promise<ArticleContent>>();
const inflightArticlePrewarm = new Set<string>();
let lastArticleCacheCleanupAt = 0;

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
  cnnWorld: {
    id: 'cnn-world',
    kind: 'rss',
    label: 'CNN World',
    attributionUrl: 'http://rss.cnn.com/rss/edition.rss',
    url: 'http://rss.cnn.com/rss/edition.rss',
    sourceName: 'CNN',
    sourceUrl: 'https://www.cnn.com',
  },
  bbcChinese: {
    id: 'bbc-chinese',
    kind: 'rss',
    label: 'BBC Chinese',
    attributionUrl: 'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml',
    url: 'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml',
    sourceName: 'BBC Chinese',
    sourceUrl: 'https://www.bbc.com/zhongwen/simp',
  },
  rfiChinese: {
    id: 'rfi-chinese',
    kind: 'rss',
    label: 'RFI Chinese',
    attributionUrl: 'https://www.rfi.fr/cn/%E4%B8%AD%E5%9B%BD/rss',
    url: 'https://www.rfi.fr/cn/%E4%B8%AD%E5%9B%BD/rss',
    sourceName: 'RFI',
    sourceUrl: 'https://www.rfi.fr/cn/',
  },
  engadget: {
    id: 'engadget',
    kind: 'rss',
    label: 'Engadget',
    attributionUrl: 'https://www.engadget.com/rss.xml',
    url: 'https://www.engadget.com/rss.xml',
    sourceName: 'Engadget',
    sourceUrl: 'https://www.engadget.com',
  },
  arsTechnica: {
    id: 'ars-technica',
    kind: 'rss',
    label: 'Ars Technica',
    attributionUrl: 'https://feeds.arstechnica.com/arstechnica/index',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    sourceName: 'Ars Technica',
    sourceUrl: 'https://arstechnica.com',
  },
  fastCompany: {
    id: 'fast-company',
    kind: 'rss',
    label: 'Fast Company',
    attributionUrl: 'https://www.fastcompany.com/rss',
    url: 'https://www.fastcompany.com/rss',
    sourceName: 'Fast Company',
    sourceUrl: 'https://www.fastcompany.com',
  },
  mitTechnologyReview: {
    id: 'mit-technology-review',
    kind: 'rss',
    label: 'MIT Technology Review',
    attributionUrl: 'https://www.technologyreview.com/feed/',
    url: 'https://www.technologyreview.com/feed/',
    sourceName: 'MIT Technology Review',
    sourceUrl: 'https://www.technologyreview.com',
  },
  wiredBusiness: {
    id: 'wired-business',
    kind: 'rss',
    label: 'WIRED Business',
    attributionUrl: 'https://www.wired.com/feed/category/business/latest/rss',
    url: 'https://www.wired.com/feed/category/business/latest/rss',
    sourceName: 'WIRED',
    sourceUrl: 'https://www.wired.com',
  },
  wiredAi: {
    id: 'wired-ai',
    kind: 'rss',
    label: 'WIRED AI',
    attributionUrl: 'https://www.wired.com/feed/tag/ai/latest/rss',
    url: 'https://www.wired.com/feed/tag/ai/latest/rss',
    sourceName: 'WIRED',
    sourceUrl: 'https://www.wired.com',
  },
  guardianTechnology: {
    id: 'guardian-technology',
    kind: 'rss',
    label: 'The Guardian Technology',
    attributionUrl: 'https://www.theguardian.com/technology/rss',
    url: 'https://www.theguardian.com/technology/rss',
    sourceName: 'The Guardian',
    sourceUrl: 'https://www.theguardian.com/technology',
  },
  newScientistTechnology: {
    id: 'new-scientist-technology',
    kind: 'rss',
    label: 'New Scientist Technology',
    attributionUrl: 'https://www.newscientist.com/subject/technology/feed/',
    url: 'https://www.newscientist.com/subject/technology/feed/',
    sourceName: 'New Scientist',
    sourceUrl: 'https://www.newscientist.com/subject/technology/',
  },
  scienceDailyTechnology: {
    id: 'science-daily-technology',
    kind: 'rss',
    label: 'ScienceDaily Technology',
    attributionUrl: 'https://www.sciencedaily.com/rss/top/technology.xml',
    url: 'https://www.sciencedaily.com/rss/top/technology.xml',
    sourceName: 'ScienceDaily',
    sourceUrl: 'https://www.sciencedaily.com/news/computers_math/technology/',
  },
  scienceDailyAi: {
    id: 'science-daily-ai',
    kind: 'rss',
    label: 'ScienceDaily Artificial Intelligence',
    attributionUrl: 'https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml',
    url: 'https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml',
    sourceName: 'ScienceDaily',
    sourceUrl: 'https://www.sciencedaily.com/news/computers_math/artificial_intelligence/',
  },
  spaceCom: {
    id: 'space-com',
    kind: 'rss',
    label: 'Space.com',
    attributionUrl: 'https://www.space.com/feeds/all',
    url: 'https://www.space.com/feeds/all',
    sourceName: 'Space.com',
    sourceUrl: 'https://www.space.com/',
  },
  huggingFaceBlog: {
    id: 'huggingface-blog',
    kind: 'rss',
    label: 'Hugging Face Blog',
    attributionUrl: 'https://huggingface.co/blog/feed.xml',
    url: 'https://huggingface.co/blog/feed.xml',
    sourceName: 'Hugging Face',
    sourceUrl: 'https://huggingface.co/blog',
  },
  hackerNews: {
    id: 'hacker-news',
    kind: 'rss',
    label: 'Hacker News',
    attributionUrl: 'https://news.ycombinator.com/rss',
    url: 'https://news.ycombinator.com/rss',
    sourceName: 'Hacker News',
    sourceUrl: 'https://news.ycombinator.com',
  },
  natureNews: {
    id: 'nature-news',
    kind: 'rss',
    label: 'Nature News',
    attributionUrl: 'https://www.nature.com/nature.rss',
    url: 'https://www.nature.com/nature.rss',
    sourceName: 'Nature',
    sourceUrl: 'https://www.nature.com/news',
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
  /sam altman|dario amodei|anthropic|demis hassabis|deepmind|mustafa suleyman|openai|boris cherny|claude code|sundar pichai|jensen huang|kai-fu lee|liang wenfeng|deepseek|karpathy|ilya sutskever/i;
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
    labelEn: 'Internet',
    labelZh: '互联网',
    descriptionEn: 'Consumer apps, gadgets, platform updates, and internet culture.',
    descriptionZh: '消费级 App、设备、平台动态和互联网话题。',
    sources: [
      RSS_SOURCES.engadget,
      RSS_SOURCES.theVerge,
      RSS_SOURCES.guardianTechnology,
      RSS_SOURCES.fastCompany,
      createGoogleNewsSource(
        'google-internet-cn',
        'Google News Chinese Tech',
        '(ByteDance OR Tencent OR Alibaba OR Xiaomi OR "BYD" OR "CATL" OR Baidu OR Huawei) technology product when:7d',
      ),
    ],
  },
  {
    id: 'macro',
    labelEn: 'Business',
    labelZh: '商业',
    descriptionEn: 'Companies, strategy, chips, and the business side of technology.',
    descriptionZh: '公司策略、芯片产业、科技商业化和行业走向。',
    sources: [
      RSS_SOURCES.cnbcTop,
      RSS_SOURCES.wiredBusiness,
      RSS_SOURCES.mitTechnologyReview,
      RSS_SOURCES.techCrunch,
      createGoogleNewsSource(
        'google-business-ai',
        'Google News AI Business',
        '(OpenAI OR Anthropic OR DeepSeek OR "Google DeepMind" OR "xAI" OR "Mistral") funding OR launch OR partnership OR valuation when:14d',
      ),
    ],
  },
  {
    id: 'world',
    labelEn: 'Global',
    labelZh: '国际',
    descriptionEn:
      'International reporting, policy shifts, diplomacy, and China-facing coverage from global desks.',
    descriptionZh: '国际局势、政策变化、外交动态，以及全球媒体对中国与亚洲议题的报道。',
    sources: [
      RSS_SOURCES.cnnWorld,
      RSS_SOURCES.bbcChinese,
      RSS_SOURCES.rfiChinese,
      createGoogleNewsSource(
        'google-global-wires',
        'Google News Global Wires',
        '(site:reuters.com OR site:apnews.com OR site:cn.nytimes.com OR site:cn.wsj.com) (China OR Asia OR trade OR policy OR technology) when:7d',
      ),
      createGoogleNewsSource(
        'google-global-policy-watch',
        'Google News Policy Watch',
        'site:www.gov.cn (国务院 OR 政策 OR 要闻 OR 人工智能 OR 科技) when:30d',
      ),
    ],
  },
  {
    id: 'technology',
    labelEn: 'Technology',
    labelZh: '科技',
    descriptionEn: 'AI models, developer tools, hardware, and the tech stack moving fast.',
    descriptionZh: 'AI 模型、开发者工具、硬件和快速演进的科技赛道。',
    sources: [
      RSS_SOURCES.hackerNews,
      RSS_SOURCES.arsTechnica,
      RSS_SOURCES.ventureBeat,
      RSS_SOURCES.wiredAi,
      RSS_SOURCES.huggingFaceBlog,
      RSS_SOURCES.cnbcTech,
    ],
  },
  {
    id: 'aiTalks',
    labelEn: 'AI talks',
    labelZh: 'AI 访谈',
    descriptionEn:
      'Podcast episodes, interviews, and long-form conversations with AI company leaders.',
    descriptionZh: 'AI 公司核心人物的播客、访谈和长对话内容。',
    sources: [
      RSS_SOURCES.lexFridmanPodcast,
      createGoogleNewsSource(
        'google-ai-talks',
        'Google News AI Talks',
        '("Sam Altman" OR "Dario Amodei" OR "Demis Hassabis" OR "Sundar Pichai" OR "Jensen Huang" OR "Kai-Fu Lee" OR "Liang Wenfeng" OR "Andrej Karpathy" OR "Ilya Sutskever") (podcast OR interview OR conversation OR "in conversation") when:14d',
      ),
    ],
    scoreItem: scoreAiTalkItem,
  },
  {
    id: 'crypto',
    labelEn: 'Frontier',
    labelZh: '前沿',
    descriptionEn: 'Science, space, biology, robotics, and breakthroughs worth knowing about.',
    descriptionZh: '科学、太空、生物、机器人和那些值得关注的前沿突破。',
    sources: [
      RSS_SOURCES.natureNews,
      RSS_SOURCES.spaceCom,
      RSS_SOURCES.newScientistTechnology,
      RSS_SOURCES.scienceDailyTechnology,
      RSS_SOURCES.scienceDailyAi,
      createGoogleNewsSource(
        'google-frontier-natgeo',
        'Google News National Geographic',
        'site:nationalgeographic.com (science OR climate OR archaeology OR wildlife OR space) when:14d',
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

function ensureArticleCacheDirectory() {
  ensureCacheDirectory();
  if (!fs.existsSync(articleCacheDirectory)) {
    fs.mkdirSync(articleCacheDirectory, { recursive: true });
  }
}

function isFresh(cachedAt: number) {
  return Date.now() - cachedAt < NEWS_CACHE_TTL_MS;
}

function isArticleCacheFresh(cachedAt: number) {
  return Date.now() - cachedAt < ARTICLE_CACHE_TTL_MS;
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

function createArticleCachePath(url: string) {
  const hash = createHash('sha1').update(url).digest('hex');
  return path.join(articleCacheDirectory, `${hash}.json`);
}

function readArticleContentCache(url: string) {
  const cached = readCacheFile<CachedArticleContent>(createArticleCachePath(url));
  if (!cached || cached.schemaVersion !== ARTICLE_CACHE_SCHEMA_VERSION || cached.url !== url) {
    return null;
  }
  return cached;
}

async function writeArticleContentCache(url: string, content: ArticleContent) {
  if (content.paragraphs.length === 0) return;
  ensureArticleCacheDirectory();
  await writeCacheFile(createArticleCachePath(url), {
    schemaVersion: ARTICLE_CACHE_SCHEMA_VERSION,
    url,
    paragraphs: content.paragraphs,
    cachedAt: Date.now(),
    ttlMinutes: ARTICLE_CACHE_TTL_MINUTES,
  } satisfies CachedArticleContent);
}

async function cleanupExpiredArticleCache(force = false) {
  const now = Date.now();
  if (!force && now - lastArticleCacheCleanupAt < ARTICLE_CACHE_CLEANUP_INTERVAL_MS) {
    return;
  }
  lastArticleCacheCleanupAt = now;

  if (!fs.existsSync(articleCacheDirectory)) {
    return;
  }

  let files: string[] = [];
  try {
    files = await fsPromises.readdir(articleCacheDirectory);
  } catch {
    return;
  }

  await Promise.allSettled(
    files
      .filter((file) => file.endsWith('.json'))
      .map(async (file) => {
        const filePath = path.join(articleCacheDirectory, file);
        try {
          const stats = await fsPromises.stat(filePath);
          if (now - stats.mtimeMs > ARTICLE_CACHE_RETENTION_MS) {
            await fsPromises.unlink(filePath);
          }
        } catch {
          // ignore cache cleanup races
        }
      }),
  );
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
  const match = block.match(/<source\b(?:\s+url=(["'])(.*?)\1)?[^>]*>([\s\S]*?)<\/source>/i);
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

function isMediaAssetUrl(value: string | null) {
  if (!value) return false;
  return /\.(?:avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(value);
}

function resolveRssItemSource(
  itemSource: { sourceName: string; sourceUrl: string | null },
  fallbackSource: NewsSourceDefinition,
  baseUrl?: string | null,
) {
  const sourceName = itemSource.sourceName.trim();
  const resolvedSourceUrl = itemSource.sourceUrl
    ? (resolveUrl(itemSource.sourceUrl, baseUrl) ?? itemSource.sourceUrl)
    : null;

  if (sourceName && !isMediaAssetUrl(resolvedSourceUrl)) {
    return {
      sourceName,
      sourceUrl: resolvedSourceUrl,
    };
  }

  return {
    sourceName: fallbackSource.sourceName || fallbackSource.label,
    sourceUrl: fallbackSource.sourceUrl || fallbackSource.attributionUrl,
  };
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

function extractImageFromMetaTags(value: string, baseUrl?: string | null) {
  const preferredNames = [
    'og:image:secure_url',
    'og:image:url',
    'og:image',
    'twitter:image:src',
    'twitter:image',
  ];

  for (const tagName of preferredNames) {
    const metaPattern = /<meta\b([^>]*?)\/?>/gi;
    for (const match of value.matchAll(metaPattern)) {
      const attrs = parseAttributes(match[1]);
      const property = (attrs.property ?? attrs.name ?? '').toLowerCase();
      if (property !== tagName) continue;

      const content = attrs.content ?? attrs.href ?? '';
      const imageUrl = resolveUrl(content, baseUrl);
      if (imageUrl) return imageUrl;
    }
  }

  const linkPattern = /<link\b([^>]*?)\/?>/gi;
  for (const match of value.matchAll(linkPattern)) {
    const attrs = parseAttributes(match[1]);
    const rel = (attrs.rel ?? '').toLowerCase();
    if (rel !== 'image_src') continue;

    const href = attrs.href ?? '';
    const imageUrl = resolveUrl(href, baseUrl);
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

function isLikelyThumbnailImageUrl(value: string | null) {
  if (!value) return true;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;

  if (
    normalized.includes('/ace/ws/240/') ||
    normalized.includes('/news/tmb/') ||
    normalized.includes('/thumbnail/') ||
    normalized.includes('/thumb_') ||
    normalized.includes('/thumb/')
  ) {
    return true;
  }

  try {
    const url = new URL(value);
    const width = Number.parseInt(url.searchParams.get('width') ?? '', 10);
    if (Number.isFinite(width) && width > 0 && width < 480) {
      return true;
    }

    const resize = url.searchParams.get('resize') ?? '';
    if (resize) {
      const [resizeWidth] = resize
        .split(',')
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((part) => Number.isFinite(part) && part > 0);
      if (resizeWidth && resizeWidth < 480) {
        return true;
      }
    }
  } catch {
    return normalized.includes('thumbnail') || normalized.includes('thumb');
  }

  return false;
}

function shouldEnrichArticleImage(item: NewsHeadline) {
  if (!item.url) return false;

  try {
    const url = new URL(item.url);
    if (url.hostname.includes('news.google.com')) return false;
  } catch {
    return false;
  }

  return !item.imageUrl || isLikelyThumbnailImageUrl(item.imageUrl);
}

async function fetchArticleImageUrl(url: string) {
  try {
    const response = await fetch(url, {
      headers: ARTICLE_REQUEST_HEADERS,
      signal: AbortSignal.timeout(ARTICLE_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    if (
      contentType &&
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml+xml')
    ) {
      return null;
    }

    const html = await response.text();
    return extractImageFromMetaTags(html, url) ?? extractImageFromHtml(html, url);
  } catch {
    return null;
  }
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
      const resolvedSource = resolveRssItemSource(getSource(block), source, source.attributionUrl);
      const title = normalizeTitle(rawTitle, resolvedSource.sourceName);
      if (!title || !url) return null;

      const resolvedUrl = resolveUrl(url, source.attributionUrl) ?? url;
      return {
        id: createHeadlineId(topic.id, source.id, title, resolvedUrl),
        topicId: topic.id,
        title,
        summary: normalizeSummary(description || content, title),
        source: resolvedSource.sourceName,
        sourceUrl: resolvedSource.sourceUrl,
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

async function enrichTopicImages(topics: NewsTopicFeed[]) {
  const candidateUrls = new Set<string>();

  for (const topic of topics) {
    if (topic.status !== 'ok') continue;

    let selectedForTopic = 0;
    for (const item of topic.items) {
      if (!shouldEnrichArticleImage(item)) continue;

      candidateUrls.add(item.url);
      selectedForTopic += 1;
      if (selectedForTopic >= ARTICLE_IMAGE_ENRICH_LIMIT_PER_TOPIC) break;
    }
  }

  const urls = Array.from(candidateUrls);
  if (urls.length === 0) return topics;

  const imageByUrl = new Map<string, string>();
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < urls.length) {
      const index = currentIndex;
      currentIndex += 1;

      const articleUrl = urls[index];
      const imageUrl = await fetchArticleImageUrl(articleUrl);
      if (imageUrl) {
        imageByUrl.set(articleUrl, imageUrl);
      }
    }
  }

  const workers = Array.from({ length: Math.min(ARTICLE_FETCH_CONCURRENCY, urls.length) }, () =>
    worker(),
  );
  await Promise.all(workers);

  if (imageByUrl.size === 0) return topics;

  return topics.map((topic) => {
    if (topic.status !== 'ok') return topic;

    return {
      ...topic,
      items: topic.items.map((item) => {
        const imageUrl = imageByUrl.get(item.url);
        if (!imageUrl) return item;
        if (!item.imageUrl) return { ...item, imageUrl };
        if (isLikelyThumbnailImageUrl(item.imageUrl) && imageUrl !== item.imageUrl) {
          return { ...item, imageUrl };
        }
        return item;
      }),
    };
  });
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
  const topics = await enrichTopicImages(topicResults.map((result) => result.topic));

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

function queueFeedRefresh(previousFeed: NewsFeedPayload | null) {
  const request = fetchFeedPayload(previousFeed)
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

function triggerBackgroundFeedRefresh(reason: string) {
  void warmNewsFeed()
    .then((payload) =>
      prewarmFeedArticleContents(payload).catch((error) => {
        console.error(`[Prism] News article prewarm (${reason}) failed:`, error);
      }),
    )
    .catch((error) => {
      console.error(`[Prism] News background refresh (${reason}) failed:`, error);
    });
}

export function startNewsFeedBackgroundRefresh() {
  triggerBackgroundFeedRefresh('startup');

  const timer = setInterval(() => {
    triggerBackgroundFeedRefresh('interval');
  }, NEWS_BACKGROUND_REFRESH_INTERVAL_MS);
  timer.unref?.();

  return () => {
    clearInterval(timer);
  };
}

export async function warmNewsFeed(forceRefresh = false): Promise<NewsFeedPayload> {
  const cached = readNewsCache();
  if (inflightFeed) return inflightFeed;

  if (!forceRefresh) {
    if (cached && typeof cached.cachedAt === 'number' && isFresh(cached.cachedAt)) {
      return cached;
    }
  }

  return queueFeedRefresh(cached);
}

export async function getNewsFeed(forceRefresh = false): Promise<NewsFeedPayload> {
  if (forceRefresh) {
    return warmNewsFeed(true);
  }

  const cached = readNewsCache();
  if (cached) {
    if (typeof cached.cachedAt === 'number' && !isFresh(cached.cachedAt)) {
      triggerBackgroundFeedRefresh('stale-read');
    }
    return cached;
  }

  if (inflightFeed) return inflightFeed;
  return warmNewsFeed();
}

export async function refreshNewsFeed() {
  const feed = await warmNewsFeed(true);
  return { feed };
}

function extractArticleParagraphs(html: string): string[] {
  // Try to find main content container
  const containerPatterns = [
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<div\b[^>]+(?:class|id)=["'][^"']*\b(?:article[_-]?body|post[_-]?body|entry[_-]?content|article[_-]?content|story[_-]?body|post[_-]?content|content[_-]?body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ];

  let contentHtml = '';
  for (const pattern of containerPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      contentHtml = match[1];
      break;
    }
  }

  if (!contentHtml) contentHtml = html;

  const paragraphs: string[] = [];
  for (const match of contentHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = stripHtml(match[1]).trim();
    paragraphs.push(text);
    if (paragraphs.length >= ARTICLE_PARAGRAPH_LIMIT) break;
  }

  return normalizeArticleParagraphs(paragraphs);
}

function getArticleParagraphMinimumLength(text: string) {
  return CJK_TEXT_PATTERN.test(text) ? 22 : 45;
}

function isLikelyArticleBoilerplate(text: string) {
  return ARTICLE_BOILERPLATE_PATTERNS.some((pattern) => pattern.test(text));
}

function normalizeArticleParagraphs(paragraphs: string[]) {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const paragraph of paragraphs) {
    const text = paragraph.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (text.length < getArticleParagraphMinimumLength(text)) continue;
    if (isLikelyArticleBoilerplate(text)) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    normalized.push(text);
    if (normalized.length >= ARTICLE_PARAGRAPH_LIMIT) break;
  }

  return normalized;
}

function getArticleParagraphCharacterCount(paragraphs: string[]) {
  return paragraphs.reduce((total, paragraph) => total + paragraph.length, 0);
}

function shouldUseBrowserArticleFallback(paragraphs: string[]) {
  return (
    paragraphs.length < ARTICLE_FETCH_MIN_PARAGRAPHS ||
    getArticleParagraphCharacterCount(paragraphs) < ARTICLE_FETCH_MIN_CHARACTERS
  );
}

async function getArticleBrowser() {
  if (!articleBrowserPromise) {
    articleBrowserPromise = import('playwright')
      .then(({ chromium }) => chromium.launch({ headless: true }))
      .catch((error) => {
        articleBrowserPromise = null;
        throw error;
      });
  }

  return articleBrowserPromise;
}

async function extractArticleParagraphsWithBrowser(url: string) {
  const browser = await getArticleBrowser();
  const context = await browser.newContext({
    userAgent: ARTICLE_REQUEST_HEADERS['User-Agent'],
    locale: 'en-US',
    extraHTTPHeaders: {
      Accept: ARTICLE_REQUEST_HEADERS.Accept,
      'Accept-Language': ARTICLE_REQUEST_HEADERS['Accept-Language'],
      'Cache-Control': ARTICLE_REQUEST_HEADERS['Cache-Control'],
    },
  });
  const page = await context.newPage();

  try {
    await page.route('**/*', async (route) => {
      const type = route.request().resourceType();
      if (type === 'image' || type === 'font' || type === 'media') {
        await route.abort();
        return;
      }
      await route.continue();
    });

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: ARTICLE_BROWSER_TIMEOUT_MS,
    });
    await page.waitForLoadState('networkidle', { timeout: 2_500 }).catch(() => {});

    const selectors = [
      '[itemprop="articleBody"]',
      '[data-testid="article-body"]',
      '.article__body',
      '.article-body',
      '.article-content',
      '.entry-content',
      '.post-content',
      '.story-body',
      '.content-body',
      'article',
      'main',
      '[role="main"]',
    ];

    let bestParagraphs: string[] = [];
    let bestScore = 0;

    for (const selector of selectors) {
      const matches = await page.locator(selector).count();
      for (let index = 0; index < matches; index += 1) {
        const texts = await page
          .locator(selector)
          .nth(index)
          .locator('p')
          .allTextContents()
          .catch(() => []);
        const paragraphs = normalizeArticleParagraphs(texts);
        const score = getArticleParagraphCharacterCount(paragraphs);

        if (score > bestScore) {
          bestParagraphs = paragraphs;
          bestScore = score;
        }

        if (!shouldUseBrowserArticleFallback(paragraphs)) {
          return paragraphs;
        }
      }
    }

    if (bestParagraphs.length > 0) {
      return bestParagraphs;
    }

    const bodyParagraphs = normalizeArticleParagraphs(
      await page
        .locator('body p')
        .allTextContents()
        .catch(() => []),
    );
    return bodyParagraphs;
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

async function fetchArticleContentFromOrigin(
  url: string,
  options: { allowBrowserFallback?: boolean } = {},
): Promise<ArticleContent> {
  const allowBrowserFallback = options.allowBrowserFallback ?? true;
  let fetchError: Error | null = null;

  try {
    const response = await fetch(url, {
      headers: ARTICLE_REQUEST_HEADERS,
      signal: AbortSignal.timeout(ARTICLE_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new NewsFeedError(`Article returned HTTP ${response.status}`, response.status);
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return { paragraphs: [] };
    }

    const html = await response.text();
    const paragraphs = extractArticleParagraphs(html);
    if (!shouldUseBrowserArticleFallback(paragraphs)) {
      return { paragraphs };
    }

    if (!allowBrowserFallback) {
      return { paragraphs: [] };
    }
  } catch (error) {
    fetchError = error instanceof Error ? error : new Error('Failed to fetch article');
  }

  if (!allowBrowserFallback) {
    if (fetchError) {
      throw fetchError;
    }
    return { paragraphs: [] };
  }

  try {
    const browserParagraphs = await extractArticleParagraphsWithBrowser(url);
    if (browserParagraphs.length > 0) {
      return { paragraphs: browserParagraphs };
    }
  } catch (browserError) {
    if (fetchError) {
      throw fetchError;
    }
    if (browserError instanceof Error) {
      throw browserError;
    }
    throw new NewsFeedError('Failed to extract article content');
  }

  if (fetchError) {
    throw fetchError;
  }

  return { paragraphs: [] };
}

function getPrewarmCandidateUrls(feed: NewsFeedPayload) {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const topic of feed.topics) {
    for (const item of topic.items.slice(0, 2)) {
      const url = item.url?.trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
      if (urls.length >= ARTICLE_PREWARM_LIMIT) {
        return urls;
      }
    }
  }

  return urls;
}

async function prewarmSingleArticleContent(url: string) {
  if (inflightArticlePrewarm.has(url)) {
    return;
  }

  const cached = readArticleContentCache(url);
  if (cached && isArticleCacheFresh(cached.cachedAt)) {
    return;
  }

  inflightArticlePrewarm.add(url);
  try {
    const content = await fetchArticleContentFromOrigin(url, { allowBrowserFallback: false });
    if (content.paragraphs.length > 0) {
      await writeArticleContentCache(url, content);
    }
    await cleanupExpiredArticleCache();
  } catch {
    // ignore best-effort prewarm failures
  } finally {
    inflightArticlePrewarm.delete(url);
  }
}

async function prewarmFeedArticleContents(feed: NewsFeedPayload) {
  const urls = getPrewarmCandidateUrls(feed);
  if (urls.length === 0) {
    return;
  }

  for (let index = 0; index < urls.length; index += ARTICLE_PREWARM_CONCURRENCY) {
    const batch = urls.slice(index, index + ARTICLE_PREWARM_CONCURRENCY);
    await Promise.allSettled(batch.map((url) => prewarmSingleArticleContent(url)));
  }
}

function triggerBackgroundArticleRefresh(url: string) {
  void prewarmSingleArticleContent(url);
}

export async function fetchArticleContent(
  url: string,
  options: { forceRefresh?: boolean } = {},
): Promise<ArticleContent> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new NewsFeedError('Invalid article URL', 400);
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new NewsFeedError('Only http/https URLs are supported', 400);
  }

  if (parsedUrl.hostname.includes('news.google.com')) {
    return { paragraphs: [] };
  }

  if (!options.forceRefresh) {
    const cached = readArticleContentCache(url);
    if (cached) {
      if (isArticleCacheFresh(cached.cachedAt)) {
        return { paragraphs: cached.paragraphs };
      }
      if (cached.paragraphs.length > 0) {
        triggerBackgroundArticleRefresh(url);
        return { paragraphs: cached.paragraphs };
      }
    }
  }

  const inflight = inflightArticleContent.get(url);
  if (inflight && !options.forceRefresh) {
    return inflight;
  }

  const request = fetchArticleContentFromOrigin(url)
    .then(async (content) => {
      if (content.paragraphs.length > 0) {
        await writeArticleContentCache(url, content);
        await cleanupExpiredArticleCache();
      }
      return content;
    })
    .finally(() => {
      inflightArticleContent.delete(url);
    });

  inflightArticleContent.set(url, request);
  return request;
}
