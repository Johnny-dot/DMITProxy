import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { dataDirectory } from './db.js';

export type MarketCategory = 'indices' | 'metals' | 'crypto' | 'forex';

export interface MarketAssetDefinition {
  id: string;
  symbol: string;
  upstreamSymbol: string;
  secondaryUpstreamSymbol?: string;
  combineMode?: 'multiply';
  category: MarketCategory;
  labelEn: string;
  labelZh: string;
  currency: string;
  decimals: number;
}

export interface MarketSnapshotItem {
  id: string;
  symbol: string;
  category: MarketCategory;
  labelEn: string;
  labelZh: string;
  currency: string;
  decimals: number;
  latest: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  updatedAt: number | null;
  marketOpen: boolean | null;
  status: 'ok' | 'error';
  error?: string;
}

export interface MarketChartPoint {
  label: string;
  datetime: string;
  value: number;
}

export interface MarketChartDetail {
  asset: MarketSnapshotItem;
  series: MarketChartPoint[];
  cachedAt: number;
  rangeLabel: string;
}

export interface MarketSnapshotPayload {
  provider: string;
  attributionUrl: string;
  ttlMinutes: number;
  cachedAt: number;
  items: MarketSnapshotItem[];
}

interface YahooChartMeta {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  regularMarketTime?: number;
  currentTradingPeriod?: {
    regular?: {
      start?: number;
      end?: number;
    };
  };
}

interface YahooChartQuote {
  close?: Array<number | null>;
}

interface YahooChartResult {
  meta?: YahooChartMeta;
  timestamp?: number[];
  indicators?: {
    quote?: YahooChartQuote[];
  };
}

interface YahooChartPayload {
  chart?: {
    result?: YahooChartResult[] | null;
    error?: {
      code?: string;
      description?: string;
    } | null;
  };
}

const YAHOO_FINANCE_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const MARKET_DATA_ATTRIBUTION_URL = 'https://finance.yahoo.com';
const MARKET_PROVIDER = 'Yahoo Finance';
const FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_MARKET_CACHE_TTL_MINUTES = 10;
const configuredCacheTtlMinutes = Number.parseInt(process.env.MARKET_CACHE_TTL_MINUTES ?? '', 10);
export const MARKET_CACHE_TTL_MINUTES =
  Number.isFinite(configuredCacheTtlMinutes) && configuredCacheTtlMinutes > 0
    ? Math.max(5, Math.min(15, configuredCacheTtlMinutes))
    : DEFAULT_MARKET_CACHE_TTL_MINUTES;
const MARKET_CACHE_TTL_MS = MARKET_CACHE_TTL_MINUTES * 60 * 1000;
const cacheDirectory = path.join(dataDirectory, 'market-cache');
const snapshotCachePath = path.join(cacheDirectory, 'snapshot.json');
const SNAPSHOT_RANGE = '5d';
const CHART_RANGE = '1mo';
const CHART_INTERVAL = '1d';
const REQUEST_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Prism',
};

export const MARKET_ASSETS: MarketAssetDefinition[] = [
  {
    id: 'nasdaq',
    symbol: 'NASDAQ',
    upstreamSymbol: '^IXIC',
    category: 'indices',
    labelEn: 'Nasdaq Composite',
    labelZh: '纳斯达克综指',
    currency: 'pts',
    decimals: 2,
  },
  {
    id: 'hsi',
    symbol: 'HSI',
    upstreamSymbol: '^HSI',
    category: 'indices',
    labelEn: 'Hang Seng',
    labelZh: '恒生指数',
    currency: 'pts',
    decimals: 2,
  },
  {
    id: 'sse',
    symbol: '000001.SS',
    upstreamSymbol: '000001.SS',
    category: 'indices',
    labelEn: 'SSE Composite',
    labelZh: '上证指数',
    currency: 'pts',
    decimals: 2,
  },
  {
    id: 'dax',
    symbol: 'DAX',
    upstreamSymbol: '^GDAXI',
    category: 'indices',
    labelEn: 'DAX',
    labelZh: 'DAX',
    currency: 'pts',
    decimals: 2,
  },
  {
    id: 'ftse',
    symbol: 'FTSE',
    upstreamSymbol: '^FTSE',
    category: 'indices',
    labelEn: 'FTSE 100',
    labelZh: 'FTSE 100',
    currency: 'pts',
    decimals: 2,
  },
  {
    id: 'fchi',
    symbol: 'FCHI',
    upstreamSymbol: '^FCHI',
    category: 'indices',
    labelEn: 'CAC 40',
    labelZh: 'CAC 40',
    currency: 'pts',
    decimals: 2,
  },
  {
    id: 'n225',
    symbol: 'N225',
    upstreamSymbol: '^N225',
    category: 'indices',
    labelEn: 'Nikkei 225',
    labelZh: 'Nikkei 225',
    currency: 'pts',
    decimals: 2,
  },
  {
    id: 'ks11',
    symbol: 'KS11',
    upstreamSymbol: '^KS11',
    category: 'indices',
    labelEn: 'KOSPI',
    labelZh: 'KOSPI',
    currency: 'pts',
    decimals: 2,
  },
  {
    id: 'stoxx50e',
    symbol: 'STOXX50E',
    upstreamSymbol: '^STOXX50E',
    category: 'indices',
    labelEn: 'Euro Stoxx 50',
    labelZh: 'Euro Stoxx 50',
    currency: 'pts',
    decimals: 2,
  },
  {
    id: 'gold',
    symbol: 'XAU/USD',
    upstreamSymbol: 'GC=F',
    category: 'metals',
    labelEn: 'Gold',
    labelZh: '黄金',
    currency: 'USD',
    decimals: 2,
  },
  {
    id: 'silver',
    symbol: 'XAG/USD',
    upstreamSymbol: 'SI=F',
    category: 'metals',
    labelEn: 'Silver',
    labelZh: '白银',
    currency: 'USD',
    decimals: 3,
  },
  {
    id: 'btc',
    symbol: 'BTC/USD',
    upstreamSymbol: 'BTC-USD',
    category: 'crypto',
    labelEn: 'Bitcoin',
    labelZh: '比特币',
    currency: 'USD',
    decimals: 2,
  },
  {
    id: 'eth',
    symbol: 'ETH/USD',
    upstreamSymbol: 'ETH-USD',
    category: 'crypto',
    labelEn: 'Ethereum',
    labelZh: '以太坊',
    currency: 'USD',
    decimals: 2,
  },
  {
    id: 'usd-cny',
    symbol: 'USD/CNY',
    upstreamSymbol: 'USDCNY=X',
    category: 'forex',
    labelEn: 'USD/CNY',
    labelZh: '美元/人民币',
    currency: 'CNY',
    decimals: 4,
  },
  {
    id: 'hkd-cny',
    symbol: 'HKD/CNY',
    upstreamSymbol: 'HKDCNY=X',
    category: 'forex',
    labelEn: 'HKD/CNY',
    labelZh: '港元/人民币',
    currency: 'CNY',
    decimals: 4,
  },
  {
    id: 'platinum',
    symbol: 'XPT/USD',
    upstreamSymbol: 'PL=F',
    category: 'metals',
    labelEn: 'Platinum',
    labelZh: '铂金',
    currency: 'USD',
    decimals: 2,
  },
  {
    id: 'palladium',
    symbol: 'XPD/USD',
    upstreamSymbol: 'PA=F',
    category: 'metals',
    labelEn: 'Palladium',
    labelZh: '钯金',
    currency: 'USD',
    decimals: 2,
  },
  {
    id: 'copper',
    symbol: 'COPPER',
    upstreamSymbol: 'HG=F',
    category: 'metals',
    labelEn: 'Copper',
    labelZh: '铜',
    currency: 'USD',
    decimals: 3,
  },
  {
    id: 'aluminum',
    symbol: 'ALUMINUM',
    upstreamSymbol: 'ALI=F',
    category: 'metals',
    labelEn: 'Aluminum',
    labelZh: '铝',
    currency: 'USD',
    decimals: 2,
  },
  {
    id: 'zinc',
    symbol: 'ZINC',
    upstreamSymbol: 'ZNC=F',
    category: 'metals',
    labelEn: 'Zinc',
    labelZh: '锌',
    currency: 'USD',
    decimals: 2,
  },
  {
    id: 'sol',
    symbol: 'SOL/USD',
    upstreamSymbol: 'SOL-USD',
    category: 'crypto',
    labelEn: 'Solana',
    labelZh: 'Solana',
    currency: 'USD',
    decimals: 2,
  },
  {
    id: 'xrp',
    symbol: 'XRP/USD',
    upstreamSymbol: 'XRP-USD',
    category: 'crypto',
    labelEn: 'XRP',
    labelZh: 'XRP',
    currency: 'USD',
    decimals: 4,
  },
  {
    id: 'bnb',
    symbol: 'BNB/USD',
    upstreamSymbol: 'BNB-USD',
    category: 'crypto',
    labelEn: 'BNB',
    labelZh: 'BNB',
    currency: 'USD',
    decimals: 2,
  },
  {
    id: 'ada',
    symbol: 'ADA/USD',
    upstreamSymbol: 'ADA-USD',
    category: 'crypto',
    labelEn: 'Cardano',
    labelZh: 'Cardano',
    currency: 'USD',
    decimals: 4,
  },
  {
    id: 'doge',
    symbol: 'DOGE/USD',
    upstreamSymbol: 'DOGE-USD',
    category: 'crypto',
    labelEn: 'Dogecoin',
    labelZh: '狗狗币',
    currency: 'USD',
    decimals: 4,
  },
  {
    id: 'eur-cny',
    symbol: 'EUR/CNY',
    upstreamSymbol: 'EURCNY=X',
    category: 'forex',
    labelEn: 'EUR/CNY',
    labelZh: '欧元/人民币',
    currency: 'CNY',
    decimals: 4,
  },
  {
    id: 'gbp-cny',
    symbol: 'GBP/CNY',
    upstreamSymbol: 'GBPCNY=X',
    category: 'forex',
    labelEn: 'GBP/CNY',
    labelZh: '英镑/人民币',
    currency: 'CNY',
    decimals: 4,
  },
  {
    id: 'jpy-cny',
    symbol: 'JPY/CNY',
    upstreamSymbol: 'JPYCNY=X',
    category: 'forex',
    labelEn: 'JPY/CNY',
    labelZh: '日元/人民币',
    currency: 'CNY',
    decimals: 4,
  },
  {
    id: 'krw-cny',
    symbol: 'KRW/CNY',
    upstreamSymbol: 'KRWCNY=X',
    category: 'forex',
    labelEn: 'KRW/CNY',
    labelZh: '韩元/人民币',
    currency: 'CNY',
    decimals: 4,
  },
  {
    id: 'try-cny',
    symbol: 'TRY/CNY',
    upstreamSymbol: 'TRYUSD=X',
    secondaryUpstreamSymbol: 'USDCNY=X',
    combineMode: 'multiply',
    category: 'forex',
    labelEn: 'TRY/CNY',
    labelZh: '土耳其里拉/人民币',
    currency: 'CNY',
    decimals: 4,
  },
] as const;

export const DEFAULT_MARKET_ASSET_ID = MARKET_ASSETS[0].id;

const assetById = new Map(MARKET_ASSETS.map((asset) => [asset.id, asset]));
const assetBySymbol = new Map(MARKET_ASSETS.map((asset) => [asset.symbol, asset]));
let inflightSnapshot: Promise<MarketSnapshotPayload> | null = null;
const inflightCharts = new Map<string, Promise<MarketChartDetail>>();

export class MarketDataError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

function ensureCacheDirectory() {
  if (!fs.existsSync(cacheDirectory)) {
    fs.mkdirSync(cacheDirectory, { recursive: true });
  }
}

function getChartCachePath(assetId: string) {
  return path.join(cacheDirectory, `${assetId}-chart.json`);
}

function isFresh(cachedAt: number) {
  return Date.now() - cachedAt < MARKET_CACHE_TTL_MS;
}

function readCacheFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function deleteCacheFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore cache cleanup failures
  }
}

async function writeCacheFile(filePath: string, payload: unknown) {
  ensureCacheDirectory();
  const tmp = `${filePath}.tmp`;
  await fsPromises.writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8');
  await fsPromises.rename(tmp, filePath);
}

function formatChartLabel(datetime: string) {
  if (datetime.length >= 10) return datetime.slice(5, 10);
  return datetime;
}

function toIsoDate(timestampSeconds: number) {
  return new Date(timestampSeconds * 1000).toISOString().slice(0, 10);
}

function buildErrorSnapshotItem(asset: MarketAssetDefinition, error: string): MarketSnapshotItem {
  return {
    id: asset.id,
    symbol: asset.symbol,
    category: asset.category,
    labelEn: asset.labelEn,
    labelZh: asset.labelZh,
    currency: asset.currency,
    decimals: asset.decimals,
    latest: null,
    previousClose: null,
    change: null,
    changePercent: null,
    updatedAt: null,
    marketOpen: null,
    status: 'error',
    error,
  };
}

async function fetchYahooChartBySymbol(
  upstreamSymbol: string,
  range: string,
): Promise<YahooChartResult> {
  const response = await fetch(
    `${YAHOO_FINANCE_BASE_URL}/${encodeURIComponent(upstreamSymbol)}?interval=${CHART_INTERVAL}&range=${range}`,
    {
      headers: REQUEST_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    },
  );

  const text = await response.text();
  let payload: YahooChartPayload;

  try {
    payload = text ? (JSON.parse(text) as YahooChartPayload) : {};
  } catch {
    throw new MarketDataError(
      `Market data provider returned invalid JSON (HTTP ${response.status}).`,
    );
  }

  if (!response.ok) {
    const message =
      payload.chart?.error?.description || `Market data provider returned HTTP ${response.status}.`;
    throw new MarketDataError(message, response.status);
  }

  const chartError = payload.chart?.error;
  if (chartError?.description) {
    throw new MarketDataError(chartError.description, 502);
  }

  const result = payload.chart?.result?.[0];
  if (!result) {
    throw new MarketDataError('Upstream market data is empty.', 502);
  }

  return result;
}

function combineNumbers(
  left: number | null,
  right: number | null,
  mode: MarketAssetDefinition['combineMode'],
) {
  if (left === null || right === null) return null;
  if (mode === 'multiply') return left * right;
  return null;
}

function combineTradingPeriod(
  left?: YahooChartMeta['currentTradingPeriod'],
  right?: YahooChartMeta['currentTradingPeriod'],
) {
  const leftRegular = left?.regular;
  const rightRegular = right?.regular;
  if (!leftRegular?.start || !leftRegular?.end) return right;
  if (!rightRegular?.start || !rightRegular?.end) return left;

  const start = Math.max(leftRegular.start, rightRegular.start);
  const end = Math.min(leftRegular.end, rightRegular.end);
  if (start >= end) return left;

  return { regular: { start, end } };
}

function combineChartSeries(
  left: MarketChartPoint[],
  right: MarketChartPoint[],
  mode: MarketAssetDefinition['combineMode'],
) {
  const rightByDate = new Map(right.map((point) => [point.datetime, point]));

  return left
    .map((point) => {
      const rightPoint = rightByDate.get(point.datetime);
      if (!rightPoint) return null;

      const value = combineNumbers(point.value, rightPoint.value, mode);
      if (value === null) return null;

      return {
        ...point,
        value,
      };
    })
    .filter((point): point is MarketChartPoint => point !== null);
}

function toTimestampSeconds(datetime: string) {
  return Math.floor(Date.parse(`${datetime}T00:00:00.000Z`) / 1000);
}

function combineYahooChartResults(
  primary: YahooChartResult,
  secondary: YahooChartResult,
  mode: NonNullable<MarketAssetDefinition['combineMode']>,
): YahooChartResult {
  const primarySeries = buildSeries(primary);
  const secondarySeries = buildSeries(secondary);
  const combinedSeries = combineChartSeries(primarySeries, secondarySeries, mode);

  return {
    meta: {
      regularMarketPrice:
        combineNumbers(
          getLatestPrice(primary, primarySeries),
          getLatestPrice(secondary, secondarySeries),
          mode,
        ) ?? undefined,
      chartPreviousClose:
        combineNumbers(
          getPreviousClose(primary, primarySeries),
          getPreviousClose(secondary, secondarySeries),
          mode,
        ) ?? undefined,
      regularMarketTime: Math.max(
        primary.meta?.regularMarketTime ?? 0,
        secondary.meta?.regularMarketTime ?? 0,
      ),
      currentTradingPeriod: combineTradingPeriod(
        primary.meta?.currentTradingPeriod,
        secondary.meta?.currentTradingPeriod,
      ),
    },
    timestamp: combinedSeries.map((point) => toTimestampSeconds(point.datetime)),
    indicators: {
      quote: [
        {
          close: combinedSeries.map((point) => point.value),
        },
      ],
    },
  };
}

async function fetchYahooChart(
  asset: MarketAssetDefinition,
  range: string,
): Promise<YahooChartResult> {
  if (!asset.secondaryUpstreamSymbol || !asset.combineMode) {
    return fetchYahooChartBySymbol(asset.upstreamSymbol, range);
  }

  const [primary, secondary] = await Promise.all([
    fetchYahooChartBySymbol(asset.upstreamSymbol, range),
    fetchYahooChartBySymbol(asset.secondaryUpstreamSymbol, range),
  ]);

  return combineYahooChartResults(primary, secondary, asset.combineMode);
}

function buildSeries(result: YahooChartResult): MarketChartPoint[] {
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];

  return timestamps
    .map((timestamp, index) => {
      const close = closes[index];
      if (typeof close !== 'number' || !Number.isFinite(close)) return null;
      const datetime = toIsoDate(timestamp);
      return {
        label: formatChartLabel(datetime),
        datetime,
        value: close,
      };
    })
    .filter((point): point is MarketChartPoint => point !== null);
}

function getPreviousClose(result: YahooChartResult, series: MarketChartPoint[]) {
  const chartPreviousClose = result.meta?.chartPreviousClose;
  if (typeof chartPreviousClose === 'number' && Number.isFinite(chartPreviousClose)) {
    return chartPreviousClose;
  }
  return series.length > 1 ? (series[series.length - 2]?.value ?? null) : null;
}

function getLatestPrice(result: YahooChartResult, series: MarketChartPoint[]) {
  const regularMarketPrice = result.meta?.regularMarketPrice;
  if (typeof regularMarketPrice === 'number' && Number.isFinite(regularMarketPrice)) {
    return regularMarketPrice;
  }
  return series[series.length - 1]?.value ?? null;
}

function getUpdatedAt(result: YahooChartResult, series: MarketChartPoint[]) {
  const regularMarketTime = result.meta?.regularMarketTime;
  if (
    typeof regularMarketTime === 'number' &&
    Number.isFinite(regularMarketTime) &&
    regularMarketTime > 0
  ) {
    return regularMarketTime * 1000;
  }

  const lastPoint = series[series.length - 1];
  if (!lastPoint) return null;
  const parsed = Date.parse(lastPoint.datetime);
  return Number.isFinite(parsed) ? parsed : null;
}

function getMarketOpen(result: YahooChartResult) {
  const regular = result.meta?.currentTradingPeriod?.regular;
  if (!regular?.start || !regular?.end) return null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds >= regular.start && nowSeconds <= regular.end;
}

function buildSnapshotItem(
  asset: MarketAssetDefinition,
  result: YahooChartResult,
): MarketSnapshotItem {
  const series = buildSeries(result);
  const latest = getLatestPrice(result, series);
  const previousClose = getPreviousClose(result, series);
  const change = latest !== null && previousClose !== null ? latest - previousClose : null;
  const changePercent =
    change !== null && previousClose !== null && previousClose !== 0
      ? (change / previousClose) * 100
      : null;

  return {
    id: asset.id,
    symbol: asset.symbol,
    category: asset.category,
    labelEn: asset.labelEn,
    labelZh: asset.labelZh,
    currency: asset.currency,
    decimals: asset.decimals,
    latest,
    previousClose,
    change,
    changePercent,
    updatedAt: getUpdatedAt(result, series),
    marketOpen: getMarketOpen(result),
    status: latest === null ? 'error' : 'ok',
    error: latest === null ? 'Upstream market data is empty for this asset.' : undefined,
  };
}

function buildSnapshotPayload(items: MarketSnapshotItem[]): MarketSnapshotPayload {
  return {
    provider: MARKET_PROVIDER,
    attributionUrl: MARKET_DATA_ATTRIBUTION_URL,
    ttlMinutes: MARKET_CACHE_TTL_MINUTES,
    cachedAt: Date.now(),
    items,
  };
}

function isSnapshotItemCompatible(
  item: MarketSnapshotItem | null | undefined,
  asset: MarketAssetDefinition,
) {
  if (!item) return false;

  return (
    item.id === asset.id &&
    item.symbol === asset.symbol &&
    item.category === asset.category &&
    item.labelEn === asset.labelEn &&
    item.labelZh === asset.labelZh &&
    item.currency === asset.currency &&
    item.decimals === asset.decimals
  );
}

function isSnapshotPayloadCompatible(payload: MarketSnapshotPayload) {
  if (!Array.isArray(payload.items) || payload.items.length !== MARKET_ASSETS.length) {
    return false;
  }

  return MARKET_ASSETS.every((asset, index) =>
    isSnapshotItemCompatible(payload.items[index], asset),
  );
}

function isChartDetailCompatible(detail: MarketChartDetail, assetId: string) {
  const asset = assetById.get(assetId);
  if (!asset) return false;

  return (
    isSnapshotItemCompatible(detail.asset, asset) &&
    Array.isArray(detail.series) &&
    typeof detail.cachedAt === 'number' &&
    typeof detail.rangeLabel === 'string'
  );
}

async function fetchSnapshotPayload(): Promise<MarketSnapshotPayload> {
  const items = await Promise.all(
    MARKET_ASSETS.map(async (asset) => {
      try {
        const result = await fetchYahooChart(asset, SNAPSHOT_RANGE);
        return buildSnapshotItem(asset, result);
      } catch (error) {
        return buildErrorSnapshotItem(
          asset,
          error instanceof Error ? error.message : 'Failed to load upstream market data.',
        );
      }
    }),
  );

  return buildSnapshotPayload(items);
}

async function fetchChartDetail(assetId: string): Promise<MarketChartDetail> {
  const asset = assetById.get(assetId);
  if (!asset) {
    throw new MarketDataError('Unknown market asset.', 404);
  }

  const result = await fetchYahooChart(asset, CHART_RANGE);
  const series = buildSeries(result);
  if (series.length === 0) {
    throw new MarketDataError('Chart data is empty for this asset.', 502);
  }

  const snapshot = await getMarketSnapshot();
  const snapshotItem =
    snapshot.items.find((item) => item.id === assetId) ?? buildSnapshotItem(asset, result);

  return {
    asset: snapshotItem,
    series,
    cachedAt: Date.now(),
    rangeLabel: '1M',
  };
}

export function isMarketAssetId(value: unknown): value is string {
  return typeof value === 'string' && assetById.has(value);
}

export function getMarketAssetDefinition(assetId: string) {
  return assetById.get(assetId) ?? null;
}

export function getDefaultMarketAssetId() {
  return DEFAULT_MARKET_ASSET_ID;
}

export async function getMarketSnapshot(forceRefresh = false): Promise<MarketSnapshotPayload> {
  if (!forceRefresh) {
    const cached = readCacheFile<MarketSnapshotPayload>(snapshotCachePath);
    if (
      cached &&
      typeof cached.cachedAt === 'number' &&
      isFresh(cached.cachedAt) &&
      isSnapshotPayloadCompatible(cached)
    ) {
      return cached;
    }
    if (cached && !isSnapshotPayloadCompatible(cached)) {
      deleteCacheFile(snapshotCachePath);
    }
    if (inflightSnapshot) return inflightSnapshot;
  }

  const request = fetchSnapshotPayload()
    .then(async (payload) => {
      await writeCacheFile(snapshotCachePath, payload);
      return payload;
    })
    .finally(() => {
      inflightSnapshot = null;
    });

  inflightSnapshot = request;
  return request;
}

export async function getMarketChart(
  assetId: string,
  forceRefresh = false,
): Promise<MarketChartDetail> {
  if (!isMarketAssetId(assetId)) {
    throw new MarketDataError('Unknown market asset.', 404);
  }

  const cachePath = getChartCachePath(assetId);
  if (!forceRefresh) {
    const cached = readCacheFile<MarketChartDetail>(cachePath);
    if (
      cached &&
      typeof cached.cachedAt === 'number' &&
      isFresh(cached.cachedAt) &&
      isChartDetailCompatible(cached, assetId)
    ) {
      return cached;
    }
    if (cached && !isChartDetailCompatible(cached, assetId)) {
      deleteCacheFile(cachePath);
    }
    const inflight = inflightCharts.get(assetId);
    if (inflight) return inflight;
  }

  const request = fetchChartDetail(assetId)
    .then(async (detail) => {
      await writeCacheFile(cachePath, detail);
      return detail;
    })
    .finally(() => {
      inflightCharts.delete(assetId);
    });

  inflightCharts.set(assetId, request);
  return request;
}

export async function refreshMarketData(assetId?: string | null) {
  const snapshot = await getMarketSnapshot(true);
  const detail = assetId ? await getMarketChart(assetId, true) : null;
  return { snapshot, detail };
}

export function getMarketAssetsByCategory(category: MarketCategory) {
  return MARKET_ASSETS.filter((asset) => asset.category === category);
}

export function getMarketSymbolByAssetId(assetId: string) {
  return assetById.get(assetId)?.symbol ?? null;
}

export function getMarketAssetBySymbol(symbol: string) {
  return assetBySymbol.get(symbol) ?? null;
}
