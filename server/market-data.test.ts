import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface LoadedModules {
  cleanup: () => void;
  dbModule: typeof import('./db.js');
  marketModule: typeof import('./market-data.js');
}

function buildYahooChartPayload(price: number, previousClose: number, timestamps?: number[]) {
  const chartTimestamps = timestamps ?? [1772668800, 1772755200, 1772841600];
  const closes = chartTimestamps.map((_, index) => previousClose + index);
  closes[closes.length - 1] = price;

  return {
    chart: {
      result: [
        {
          meta: {
            regularMarketPrice: price,
            chartPreviousClose: previousClose,
            regularMarketTime: chartTimestamps[chartTimestamps.length - 1],
            currentTradingPeriod: {
              regular: {
                start: chartTimestamps[chartTimestamps.length - 1] - 3600,
                end: chartTimestamps[chartTimestamps.length - 1] + 3600,
              },
            },
          },
          timestamp: chartTimestamps,
          indicators: {
            quote: [
              {
                close: closes,
              },
            ],
          },
        },
      ],
      error: null,
    },
  };
}

function buildYahooChartPayloadFromCloses(
  closes: number[],
  previousClose: number,
  timestamps?: number[],
) {
  const chartTimestamps = timestamps ?? closes.map((_, index) => 1772668800 + index * 86_400);

  return {
    chart: {
      result: [
        {
          meta: {
            regularMarketPrice: closes[closes.length - 1],
            chartPreviousClose: previousClose,
            regularMarketTime: chartTimestamps[chartTimestamps.length - 1],
            currentTradingPeriod: {
              regular: {
                start: chartTimestamps[chartTimestamps.length - 1] - 3600,
                end: chartTimestamps[chartTimestamps.length - 1] + 3600,
              },
            },
          },
          timestamp: chartTimestamps,
          indicators: {
            quote: [
              {
                close: closes,
              },
            ],
          },
        },
      ],
      error: null,
    },
  };
}

async function loadMarketModules(): Promise<LoadedModules> {
  const tempDir = path.resolve(
    '.tmp',
    `vitest-market-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  process.env.DATA_DIR = tempDir;
  delete process.env.MARKET_CACHE_TTL_MINUTES;

  vi.resetModules();

  const dbModule = await import('./db.js');
  const marketModule = await import('./market-data.js');

  return {
    dbModule,
    marketModule,
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
      delete process.env.MARKET_CACHE_TTL_MINUTES;
      vi.restoreAllMocks();
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

function getCompositeAssetCount(marketModule: LoadedModules['marketModule']) {
  return marketModule.MARKET_ASSETS.filter((asset) => asset.secondaryUpstreamSymbol).length;
}

function toSnapshotItem(
  asset: LoadedModules['marketModule']['MARKET_ASSETS'][number],
  latest = 100,
) {
  return {
    id: asset.id,
    symbol: asset.symbol,
    category: asset.category,
    labelEn: asset.labelEn,
    labelZh: asset.labelZh,
    currency: asset.currency,
    decimals: asset.decimals,
    latest,
    previousClose: latest - 1,
    change: 1,
    changePercent: 1,
    updatedAt: Date.now(),
    marketOpen: true,
    status: 'ok',
  };
}

describe('market data cache', () => {
  it('caches the market snapshot between calls', async () => {
    const loaded = await loadMarketModules();

    try {
      const { marketModule } = loaded;
      const compositeAssetCount = getCompositeAssetCount(marketModule);
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        const assetIndex = marketModule.MARKET_ASSETS.findIndex(
          (asset) =>
            (asset.secondaryUpstreamSymbol &&
              url.includes(encodeURIComponent(asset.secondaryUpstreamSymbol))) ||
            url.includes(encodeURIComponent(asset.upstreamSymbol)),
        );
        const index = assetIndex >= 0 ? assetIndex : 0;
        return new Response(JSON.stringify(buildYahooChartPayload(100 + index, 99 + index)), {
          status: 200,
        });
      });

      const first = await marketModule.getMarketSnapshot();
      const second = await marketModule.getMarketSnapshot();
      const third = await marketModule.getMarketSnapshot(true);

      expect(first.items).toHaveLength(30);
      expect(first.items[0]).toMatchObject({
        status: 'ok',
        latest: 100,
        previousClose: 99,
      });
      expect(second.cachedAt).toBe(first.cachedAt);
      expect(third.cachedAt).toBeGreaterThanOrEqual(first.cachedAt);
      expect(fetchMock).toHaveBeenCalledTimes(
        (marketModule.MARKET_ASSETS.length + compositeAssetCount) * 2,
      );
    } finally {
      loaded.cleanup();
    }
  });

  it('caches per-asset chart data and keeps series in chronological order', async () => {
    const loaded = await loadMarketModules();

    try {
      const { marketModule } = loaded;
      const compositeAssetCount = getCompositeAssetCount(marketModule);
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes(encodeURIComponent('BTC-USD'))) {
          return new Response(
            JSON.stringify(
              buildYahooChartPayload(67790.88, 68108.24, [1772668800, 1772755200, 1772841600]),
            ),
            { status: 200 },
          );
        }

        return new Response(JSON.stringify(buildYahooChartPayload(200, 198)), { status: 200 });
      });

      await marketModule.getMarketSnapshot(true);
      const first = await marketModule.getMarketChart('btc');
      const second = await marketModule.getMarketChart('btc');

      expect(first.asset.id).toBe('btc');
      expect(first.series.map((point) => point.datetime)).toEqual([
        '2026-03-05',
        '2026-03-06',
        '2026-03-07',
      ]);
      expect(second.cachedAt).toBe(first.cachedAt);
      expect(fetchMock).toHaveBeenCalledTimes(
        marketModule.MARKET_ASSETS.length + compositeAssetCount + 1,
      );
    } finally {
      loaded.cleanup();
    }
  });

  it('ignores stale snapshot cache when asset order changes', async () => {
    const loaded = await loadMarketModules();

    try {
      const { dbModule, marketModule } = loaded;
      const staleItems = [
        ...marketModule.MARKET_ASSETS.filter((asset) => asset.id === 'dax'),
        ...marketModule.MARKET_ASSETS.filter((asset) => asset.id !== 'dax'),
      ].map((asset, index) => toSnapshotItem(asset, 100 + index));

      const cacheDir = path.join(dbModule.dataDirectory, 'market-cache');
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(
        path.join(cacheDir, 'snapshot.json'),
        JSON.stringify({
          provider: 'Yahoo Finance',
          attributionUrl: 'https://finance.yahoo.com',
          ttlMinutes: 10,
          cachedAt: Date.now(),
          items: staleItems,
        }),
        'utf8',
      );

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        const assetIndex = marketModule.MARKET_ASSETS.findIndex(
          (asset) =>
            (asset.secondaryUpstreamSymbol &&
              url.includes(encodeURIComponent(asset.secondaryUpstreamSymbol))) ||
            url.includes(encodeURIComponent(asset.upstreamSymbol)),
        );
        const index = assetIndex >= 0 ? assetIndex : 0;
        return new Response(JSON.stringify(buildYahooChartPayload(100 + index, 99 + index)), {
          status: 200,
        });
      });

      const snapshot = await marketModule.getMarketSnapshot();

      expect(snapshot.items[0]?.id).toBe('nasdaq');
      expect(snapshot.items[1]?.id).toBe('hsi');
      expect(snapshot.items[2]?.id).toBe('sse');
      expect(fetchMock).toHaveBeenCalled();
    } finally {
      loaded.cleanup();
    }
  });

  it('builds TRY/CNY from TRY/USD and USD/CNY feeds', async () => {
    const loaded = await loadMarketModules();

    try {
      const { marketModule } = loaded;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);

        if (url.includes(encodeURIComponent('TRYUSD=X'))) {
          return new Response(
            JSON.stringify(
              buildYahooChartPayloadFromCloses(
                [0.0226, 0.0228, 0.0227],
                0.0228,
                [1772668800, 1772755200, 1772841600],
              ),
            ),
            { status: 200 },
          );
        }

        if (url.includes(encodeURIComponent('USDCNY=X'))) {
          return new Response(
            JSON.stringify(
              buildYahooChartPayloadFromCloses(
                [6.936, 6.95, 6.872],
                6.897,
                [1772668800, 1772755200, 1772841600],
              ),
            ),
            { status: 200 },
          );
        }

        return new Response(JSON.stringify(buildYahooChartPayload(200, 198)), { status: 200 });
      });

      await marketModule.getMarketSnapshot(true);
      const detail = await marketModule.getMarketChart('try-cny', true);

      expect(detail.asset).toMatchObject({
        id: 'try-cny',
        symbol: 'TRY/CNY',
        currency: 'CNY',
      });
      expect(detail.series).toHaveLength(3);
      expect(detail.series[0]?.value).toBeCloseTo(0.1567536, 8);
      expect(detail.series[1]?.value).toBeCloseTo(0.15846, 8);
      expect(detail.series[2]?.value).toBeCloseTo(0.1559944, 8);
    } finally {
      loaded.cleanup();
    }
  });
});
