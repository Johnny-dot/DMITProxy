import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface LoadedModules {
  cleanup: () => void;
  dbModule: typeof import('./db.js');
  newsModule: typeof import('./news-data.js');
}

const MARKETWATCH_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:media="http://search.yahoo.com/mrss/" version="2.0">
  <channel>
    <title>MarketWatch Top Stories</title>
    <item>
      <guid isPermaLink="false">mw-1</guid>
      <title>Market breadth improves as rate-cut hopes return</title>
      <description>Stocks rallied after softer inflation data calmed bond markets.</description>
      <link>https://www.marketwatch.com/story/market-breadth-improves-as-rate-cut-hopes-return?mod=mw_rss_topstories</link>
      <pubDate>Tue, 10 Mar 2026 09:48:00 GMT</pubDate>
      <media:content url="https://cdn.example.com/marketwatch.jpg" medium="image" type="image/jpeg" />
    </item>
  </channel>
</rss>`;

const CNBC_FINANCE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>CNBC Finance</title>
    <item>
      <title>Bond yields cool as traders await CPI follow-through</title>
      <description>Macro desks are watching the next inflation print.</description>
      <link>https://www.cnbc.com/2026/03/10/bond-yields-cool-as-traders-await-cpi-follow-through.html</link>
      <pubDate>Tue, 10 Mar 2026 08:10:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const CNBC_FINANCE_ARTICLE_HTML = `<!doctype html>
<html>
  <head>
    <meta property="og:image" content="https://cdn.example.com/cnbc-finance-og.jpg" />
  </head>
  <body></body>
</html>`;

const CNBC_TOP_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>CNBC Top</title>
    <item>
      <title>Fed officials keep macro focus on inflation progress</title>
      <description>Policy comments point to patience on rate cuts.</description>
      <link>https://www.cnbc.com/2026/03/10/fed-officials-keep-macro-focus-on-inflation-progress.html</link>
      <pubDate>Tue, 10 Mar 2026 07:30:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const CNBC_TOP_ARTICLE_HTML = `<!doctype html>
<html>
  <head>
    <meta property="og:image" content="https://cdn.example.com/cnbc-top-og.jpg" />
  </head>
  <body></body>
</html>`;

const CNBC_TECH_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>CNBC Tech</title>
    <item>
      <title>Big tech capex keeps climbing in the AI buildout</title>
      <description>Chip demand stays firm as hyperscalers spend.</description>
      <link>https://www.cnbc.com/2026/03/10/big-tech-capex-keeps-climbing-in-the-ai-buildout.html</link>
      <pubDate>Tue, 10 Mar 2026 06:45:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const CNBC_TECH_ARTICLE_HTML = `<!doctype html>
<html>
  <head>
    <meta property="og:image" content="https://cdn.example.com/cnbc-tech-og.jpg" />
  </head>
  <body></body>
</html>`;

const VERGE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>The Verge</title>
  <entry>
    <title type="html"><![CDATA[AI laptops are getting stranger]]></title>
    <link rel="alternate" type="text/html" href="https://www.theverge.com/2026/03/10/ai-laptops-are-getting-stranger" />
    <updated>2026-03-10T10:01:33+00:00</updated>
    <summary type="html"><![CDATA[Chip vendors are racing to explain new local AI features.]]></summary>
    <content type="html"><![CDATA[
      <figure>
        <img src="https://cdn.example.com/verge-cover.jpg" />
      </figure>
      <p>Chip vendors are racing to explain new local AI features.</p>
    ]]></content>
  </entry>
</feed>`;

const TECHCRUNCH_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>TechCrunch</title>
    <item>
      <title>Startups look for smaller AI deployment stacks</title>
      <description>Teams want cheaper inference and less operational drag.</description>
      <link>https://techcrunch.com/2026/03/10/startups-look-for-smaller-ai-deployment-stacks/</link>
      <pubDate>Tue, 10 Mar 2026 09:10:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const TECHCRUNCH_ARTICLE_HTML = `<!doctype html>
<html>
  <head>
    <meta property="og:image" content="https://cdn.example.com/techcrunch-og.jpg" />
  </head>
  <body></body>
</html>`;

const VENTUREBEAT_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>VentureBeat</title>
    <item>
      <title>Enterprise AI teams want fewer model vendors</title>
      <description><![CDATA[Procurement teams are simplifying their AI stack.]]></description>
      <content:encoded><![CDATA[
        <figure><img src="https://cdn.example.com/venturebeat-cover.jpg" /></figure>
        <p>Procurement teams are simplifying their AI stack.</p>
      ]]></content:encoded>
      <link>https://venturebeat.com/ai/enterprise-ai-teams-want-fewer-model-vendors/</link>
      <pubDate>Tue, 10 Mar 2026 00:13:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const COINDESK_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:media="http://search.yahoo.com/mrss/" version="2.0">
  <channel>
    <title>CoinDesk</title>
    <item>
      <title><![CDATA[Bitcoin ETF flows stabilize after volatile week]]></title>
      <link>https://www.coindesk.com/markets/2026/03/10/bitcoin-etf-flows-stabilize-after-volatile-week</link>
      <media:content url="https://cdn.example.com/coindesk-cover.jpg" type="image/jpeg" medium="image" />
      <pubDate>Tue, 10 Mar 2026 07:54:17 +0000</pubDate>
      <description><![CDATA[ETF demand steadied as traders recalibrated risk.]]></description>
    </item>
  </channel>
</rss>`;

const LEX_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Lex Fridman Podcast</title>
    <item>
      <title>Sam Altman: AI deployment, data centers, and product bets</title>
      <description><![CDATA[
        <img src="https://cdn.example.com/lex-cover.jpg" />
        A long-form conversation about scaling AI systems.
      ]]></description>
      <link>https://lexfridman.com/sam-altman-2026/</link>
      <pubDate>Sun, 01 Mar 2026 04:33:22 +0000</pubDate>
    </item>
  </channel>
</rss>`;

const HACKER_NEWS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Hacker News: Top Stories</title>
    <item>
      <title>Startups look for smaller AI deployment stacks</title>
      <description>Teams want cheaper inference and less operational drag.</description>
      <link>https://techcrunch.com/2026/03/10/startups-look-for-smaller-ai-deployment-stacks/</link>
      <pubDate>Tue, 10 Mar 2026 09:10:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const GOOGLE_MARKETS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>Oil dips as traders trim geopolitical premium - Reuters</title>
    <link>https://news.google.com/rss/articles/markets-1?oc=5</link>
    <pubDate>Tue, 10 Mar 2026 09:14:15 GMT</pubDate>
    <description><![CDATA[<a href="https://news.google.com/rss/articles/markets-1?oc=5">Oil dips as traders trim geopolitical premium</a>]]></description>
    <source url="https://www.reuters.com">Reuters</source>
  </item>
</channel></rss>`;

const GOOGLE_MACRO_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>Inflation expectations edge lower ahead of Fed comments - Bloomberg</title>
    <link>https://news.google.com/rss/articles/macro-1?oc=5</link>
    <pubDate>Tue, 10 Mar 2026 08:20:00 GMT</pubDate>
    <description><![CDATA[<a href="https://news.google.com/rss/articles/macro-1?oc=5">Inflation expectations edge lower ahead of Fed comments</a>]]></description>
    <source url="https://www.bloomberg.com">Bloomberg</source>
  </item>
</channel></rss>`;

const GOOGLE_AI_TALKS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>Dario Amodei on model safety and deployment - The Information</title>
    <link>https://news.google.com/rss/articles/ai-talks-1?oc=5</link>
    <pubDate>Tue, 10 Mar 2026 05:00:00 GMT</pubDate>
    <description><![CDATA[<a href="https://news.google.com/rss/articles/ai-talks-1?oc=5">Dario Amodei on model safety and deployment</a>]]></description>
    <source url="https://www.theinformation.com">The Information</source>
  </item>
</channel></rss>`;

const GOOGLE_CRYPTO_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>Ether options volume rises as ETFs prepare for the next catalyst - Yahoo Finance</title>
    <link>https://news.google.com/rss/articles/crypto-1?oc=5</link>
    <pubDate>Tue, 10 Mar 2026 06:12:00 GMT</pubDate>
    <description><![CDATA[<a href="https://news.google.com/rss/articles/crypto-1?oc=5">Ether options volume rises as ETFs prepare for the next catalyst</a>]]></description>
    <source url="https://finance.yahoo.com">Yahoo Finance</source>
  </item>
</channel></rss>`;

async function loadNewsModules(): Promise<LoadedModules> {
  const tempDir = path.resolve(
    '.tmp',
    `vitest-news-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  process.env.DATA_DIR = tempDir;
  process.env.NEWS_ITEM_LIMIT = '12';

  vi.resetModules();

  const dbModule = await import('./db.js');
  const newsModule = await import('./news-data.js');

  return {
    dbModule,
    newsModule,
    cleanup: () => {
      try {
        dbModule.db.close();
      } catch {
        // ignore close errors in cleanup
      }
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      delete process.env.DATA_DIR;
      delete process.env.NEWS_ITEM_LIMIT;
      vi.restoreAllMocks();
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

function createMockPlaywright(articles: string[]) {
  const leafLocator = {
    allTextContents: vi.fn().mockResolvedValue(articles),
  };
  const candidateLocator = {
    count: vi.fn().mockResolvedValue(1),
    nth: vi.fn().mockReturnValue({
      locator: vi.fn().mockReturnValue(leafLocator),
    }),
    allTextContents: vi.fn().mockResolvedValue(articles),
  };

  return {
    launchMock: vi.fn().mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          route: vi.fn().mockResolvedValue(undefined),
          goto: vi.fn().mockResolvedValue(undefined),
          waitForLoadState: vi.fn().mockResolvedValue(undefined),
          locator: vi.fn().mockReturnValue(candidateLocator),
          close: vi.fn().mockResolvedValue(undefined),
        }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };
}

describe('news data aggregation', () => {
  it('merges multiple sources, extracts covers and summaries, and serves from cache', async () => {
    const loaded = await loadNewsModules();

    try {
      const { newsModule } = loaded;
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);

        if (url.includes('marketwatch.com/rss/topstories')) {
          return new Response(MARKETWATCH_FEED, { status: 200 });
        }
        if (url.includes('engadget.com/rss.xml')) {
          return new Response(VERGE_FEED, { status: 200 });
        }
        if (url.includes('fastcompany.com/rss')) {
          return new Response(CNBC_TOP_FEED, { status: 200 });
        }
        if (url.includes('theguardian.com/technology/rss')) {
          return new Response(MARKETWATCH_FEED, { status: 200 });
        }
        if (url.includes('cnbc.com/id/10000664')) {
          return new Response(CNBC_FINANCE_FEED, { status: 200 });
        }
        if (url.includes('bond-yields-cool-as-traders-await-cpi-follow-through')) {
          return new Response(CNBC_FINANCE_ARTICLE_HTML, {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
        }
        if (url.includes('cnbc.com/id/100003114')) {
          return new Response(CNBC_TOP_FEED, { status: 200 });
        }
        if (url.includes('fed-officials-keep-macro-focus-on-inflation-progress')) {
          return new Response(CNBC_TOP_ARTICLE_HTML, {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
        }
        if (url.includes('cnbc.com/id/19854910')) {
          return new Response(CNBC_TECH_FEED, { status: 200 });
        }
        if (url.includes('big-tech-capex-keeps-climbing-in-the-ai-buildout')) {
          return new Response(CNBC_TECH_ARTICLE_HTML, {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
        }
        if (url.includes('theverge.com/rss/index.xml')) {
          return new Response(VERGE_FEED, { status: 200 });
        }
        if (url.includes('technologyreview.com/feed/')) {
          return new Response(VENTUREBEAT_FEED, { status: 200 });
        }
        if (url.includes('wired.com/feed/category/business/latest/rss')) {
          return new Response(CNBC_FINANCE_FEED, { status: 200 });
        }
        if (url.includes('wired.com/feed/tag/ai/latest/rss')) {
          return new Response(CNBC_TECH_FEED, { status: 200 });
        }
        if (url.includes('techcrunch.com/feed/')) {
          return new Response(TECHCRUNCH_FEED, { status: 200 });
        }
        if (url.includes('feeds.arstechnica.com/arstechnica/index')) {
          return new Response(VENTUREBEAT_FEED, { status: 200 });
        }
        if (url.includes('startups-look-for-smaller-ai-deployment-stacks')) {
          return new Response(TECHCRUNCH_ARTICLE_HTML, {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
        }
        if (url.includes('venturebeat')) {
          return new Response(VENTUREBEAT_FEED, { status: 200 });
        }
        if (url.includes('newscientist.com/subject/technology/feed/')) {
          return new Response(VERGE_FEED, { status: 200 });
        }
        if (url.includes('sciencedaily.com/rss/top/technology.xml')) {
          return new Response(MARKETWATCH_FEED, { status: 200 });
        }
        if (url.includes('sciencedaily.com/rss/computers_math/artificial_intelligence.xml')) {
          return new Response(TECHCRUNCH_FEED, { status: 200 });
        }
        if (url.includes('coindesk.com/arc/outboundfeeds/rss')) {
          return new Response(COINDESK_FEED, { status: 200 });
        }
        if (url.includes('lexfridman.com/feed/podcast/')) {
          return new Response(LEX_FEED, { status: 200 });
        }
        if (url.includes('news.ycombinator.com/rss')) {
          return new Response(HACKER_NEWS_FEED, { status: 200 });
        }
        if (url.includes('news.google.com/rss/search')) {
          if (url.includes(encodeURIComponent('stock market OR markets when:1d'))) {
            return new Response(GOOGLE_MARKETS_FEED, { status: 200 });
          }
          if (url.includes(encodeURIComponent('fed OR inflation OR treasury yields when:1d'))) {
            return new Response(GOOGLE_MACRO_FEED, { status: 200 });
          }
          if (url.includes(encodeURIComponent('bitcoin OR ethereum OR crypto market when:1d'))) {
            return new Response(GOOGLE_CRYPTO_FEED, { status: 200 });
          }
          return new Response(GOOGLE_AI_TALKS_FEED, { status: 200 });
        }

        return new Response('not found', { status: 404 });
      });

      const first = await newsModule.getNewsFeed(true);
      const second = await newsModule.getNewsFeed();

      expect(first.provider).toBe('Curated multi-source feed');
      expect(first.attributionUrl).toBeNull();
      expect(second.cachedAt).toBe(first.cachedAt);

      const markets = first.topics.find((topic) => topic.id === 'markets');
      const macro = first.topics.find((topic) => topic.id === 'macro');
      const technology = first.topics.find((topic) => topic.id === 'technology');
      const aiTalks = first.topics.find((topic) => topic.id === 'aiTalks');
      const crypto = first.topics.find((topic) => topic.id === 'crypto');

      expect(
        markets?.items.some(
          (item) =>
            item.source === 'Engadget' &&
            item.imageUrl === 'https://cdn.example.com/verge-cover.jpg',
        ),
      ).toBe(true);
      expect(markets?.labelZh).toBe('互联网');
      expect(
        macro?.items.some(
          (item) =>
            item.source === 'WIRED' &&
            item.imageUrl === 'https://cdn.example.com/cnbc-finance-og.jpg',
        ),
      ).toBe(true);
      expect(macro?.labelZh).toBe('商业');
      expect(
        technology?.items.some(
          (item) => item.imageUrl === 'https://cdn.example.com/venturebeat-cover.jpg',
        ),
      ).toBe(true);
      expect(
        technology?.items.some(
          (item) => item.imageUrl === 'https://cdn.example.com/techcrunch-og.jpg',
        ),
      ).toBe(true);
      expect(technology?.items.some((item) => item.summary?.includes('cheaper inference'))).toBe(
        true,
      );
      expect(aiTalks?.items.some((item) => item.source === 'Lex Fridman Podcast')).toBe(true);
      expect(
        aiTalks?.items.some((item) => item.imageUrl === 'https://cdn.example.com/lex-cover.jpg'),
      ).toBe(true);
      expect(crypto?.labelZh).toBe('前沿');
      expect(
        crypto?.items.some(
          (item) =>
            item.source === 'ScienceDaily' &&
            item.imageUrl === 'https://cdn.example.com/marketwatch.jpg',
        ),
      ).toBe(true);

      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes('startups-look-for-smaller-ai-deployment-stacks'),
        ),
      ).toBe(true);
      expect(fetchMock.mock.calls.length).toBeGreaterThan(14);
    } finally {
      loaded.cleanup();
    }
  });

  it('returns stale cache immediately and refreshes in the background', async () => {
    const loaded = await loadNewsModules();

    try {
      const { newsModule } = loaded;
      const staleCachedAt = Date.now() - 20 * 60 * 1000;
      const cacheDir = path.join(process.env.DATA_DIR!, 'news-cache');
      const cachePath = path.join(cacheDir, 'feed.json');

      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(
        cachePath,
        JSON.stringify(
          {
            schemaVersion: 6,
            provider: 'Curated multi-source feed',
            attributionUrl: null,
            cachedAt: staleCachedAt,
            ttlMinutes: 15,
            topics: [
              {
                id: 'markets',
                labelEn: 'Internet',
                labelZh: '浜掕仈缃?',
                descriptionEn: 'Cached topic',
                descriptionZh: 'Cached topic',
                status: 'ok',
                items: [],
              },
            ],
          },
          null,
          2,
        ),
        'utf8',
      );

      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(VERGE_FEED, { status: 200 }));

      const cached = await newsModule.getNewsFeed();
      expect(cached.cachedAt).toBe(staleCachedAt);

      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(fetchMock).toHaveBeenCalled();
      await newsModule.warmNewsFeed();
    } finally {
      loaded.cleanup();
    }
  });
});

describe('article content extraction', () => {
  it('caches successful article content responses', async () => {
    const { launchMock } = createMockPlaywright([]);

    vi.doMock('playwright', () => ({
      chromium: {
        launch: launchMock,
      },
    }));

    const loaded = await loadNewsModules();

    try {
      const { newsModule } = loaded;
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(
          new Response(
            `
              <article>
                <p>This is the first cached article paragraph, and it is long enough to look like real body copy rather than a teaser from a card. It keeps going with extra detail about the product launch, the market response, and the sources behind the report so the extraction path can safely treat it as part of the full story.</p>
                <p>This is the second cached article paragraph, with enough additional context to clear the extraction threshold and stay useful for the reader. It adds more specifics about why the company made the change, how customers reacted, and what analysts expect next over the coming weeks.</p>
                <p>This is the third cached article paragraph, which makes the final stored body look complete and avoids browser fallback. It deliberately includes more narrative detail about pricing, distribution, and the editorial conclusion so the cached body comfortably exceeds the minimum character threshold.</p>
              </article>
            `,
            {
              status: 200,
              headers: {
                'content-type': 'text/html; charset=utf-8',
              },
            },
          ),
        ),
      );

      const first = await newsModule.fetchArticleContent('https://example.com/cached-story');
      const second = await newsModule.fetchArticleContent('https://example.com/cached-story');

      expect(first.paragraphs).toHaveLength(3);
      expect(second.paragraphs).toEqual(first.paragraphs);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(launchMock).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('playwright');
      loaded.cleanup();
    }
  });

  it('filters boilerplate paragraphs from direct article HTML', async () => {
    const { launchMock } = createMockPlaywright([]);

    vi.doMock('playwright', () => ({
      chromium: {
        launch: launchMock,
      },
    }));

    const loaded = await loadNewsModules();

    try {
      const { newsModule } = loaded;
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          `
            <article>
              <p>Posts from this topic will be added to your daily email digest and your homepage feed.</p>
              <p>This is the first full article paragraph, and it contains enough words to clear the extraction threshold cleanly while still reading like an actual news story instead of a teaser sentence pulled from a card summary. It keeps going long enough to make the direct extraction path trustworthy.</p>
              <p>If you buy something from a Verge link, Vox Media may earn a commission. See our ethics statement.</p>
              <p>This is the second article paragraph, with enough detail to prove the normal fetch path still returns a readable body after we strip the promo and follow widgets. It deliberately adds more text so the combined article body comfortably exceeds the minimum character threshold.</p>
              <p>This is the third article paragraph, which should remain after boilerplate removal and avoid browser fallback entirely. It also includes extra narrative detail about the product, the recommendation, and why the discount matters, purely to make the test body long enough to be treated as complete content.</p>
              <p>Sign up for Verge Deals to get deals on products we’ve tested sent to your inbox weekly.</p>
            </article>
          `,
          {
            status: 200,
            headers: {
              'content-type': 'text/html; charset=utf-8',
            },
          },
        ),
      );

      const result = await newsModule.fetchArticleContent('https://example.com/direct-story');

      expect(result.paragraphs).toHaveLength(3);
      expect(result.paragraphs[0]).toContain('first full article paragraph');
      expect(result.paragraphs[2]).toContain('third article paragraph');
      expect(launchMock).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('playwright');
      loaded.cleanup();
    }
  });

  it('falls back to the browser when direct fetch is blocked', async () => {
    const { launchMock } = createMockPlaywright([
      '彭博社报道表示，过去的几周里，中国出现了科技巨头和消费群众一同涌向AI智能体软件OpenClaw的空前盛况。',
      '然而外国技术的迅速普及，引起了官员们的注意，据知情人士对彭博社透露，北京中央政府周三11日警告国有企业和机构不要在办公电脑上安装此软件。',
      '中国正成为人工智能领域的全球领跑者之一，并大力推动人工智能融入经济各个层面，旨在变革各行各业乃至人们的日常生活。',
    ]);

    vi.doMock('playwright', () => ({
      chromium: {
        launch: launchMock,
      },
    }));

    const loaded = await loadNewsModules();

    try {
      const { newsModule } = loaded;
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Access denied'));

      const result = await newsModule.fetchArticleContent('https://www.rfi.fr/cn/story');

      expect(result.paragraphs).toHaveLength(3);
      expect(result.paragraphs[0]).toContain('OpenClaw');
      expect(launchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.doUnmock('playwright');
      loaded.cleanup();
    }
  });

  it('falls back to the browser when fetch only extracts a teaser', async () => {
    const { launchMock } = createMockPlaywright([
      'Posts from this author will be added to your daily email digest and your homepage feed.',
      'This is the first complete paragraph from the rendered article, and it should win over the teaser that came back from raw HTML.',
      'This is the second complete paragraph, which proves the browser fallback can recover the rest of the article body.',
      'This is the third paragraph, long enough to satisfy the quality threshold and avoid returning just a single intro line.',
      'Sign up for Verge Deals to get deals on products we’ve tested sent to your inbox weekly.',
    ]);

    vi.doMock('playwright', () => ({
      chromium: {
        launch: launchMock,
      },
    }));

    const loaded = await loadNewsModules();

    try {
      const { newsModule } = loaded;
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          '<article><p>This teaser paragraph is intentionally long enough to pass the basic filter, but it is still not the full story body that the reader expects to see.</p></article>',
          {
            status: 200,
            headers: {
              'content-type': 'text/html; charset=utf-8',
            },
          },
        ),
      );

      const result = await newsModule.fetchArticleContent('https://example.com/story');

      expect(result.paragraphs).toHaveLength(3);
      expect(result.paragraphs[0]).toContain('first complete paragraph');
      expect(launchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.doUnmock('playwright');
      loaded.cleanup();
    }
  });
});
