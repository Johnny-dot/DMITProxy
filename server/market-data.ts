import fs from 'node:fs';
import path from 'node:path';
import { dataDirectory } from './db.js';

export type MarketCategory = 'indices' | 'metals' | 'crypto' | 'forex';

export interface MarketAssetDefinition {
  id: string;
  symbol: string;
  upstreamSymbol: string;
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
    id: 'usd-hkd',
    symbol: 'USD/HKD',
    upstreamSymbol: 'USDHKD=X',
    category: 'forex',
    labelEn: 'USD/HKD',
    labelZh: '美元/港元',
    currency: 'HKD',
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

function writeCacheFile(filePath: string, payload: unknown) {
  ensureCacheDirectory();
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
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

async function fetchYahooChart(
  asset: MarketAssetDefinition,
  range: string,
): Promise<YahooChartResult> {
  const response = await fetch(
    `${YAHOO_FINANCE_BASE_URL}/${encodeURIComponent(asset.upstreamSymbol)}?interval=${CHART_INTERVAL}&range=${range}`,
    {
      headers: REQUEST_HEADERS,
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
    if (cached && typeof cached.cachedAt === 'number' && isFresh(cached.cachedAt)) {
      return cached;
    }
    if (inflightSnapshot) return inflightSnapshot;
  }

  const request = fetchSnapshotPayload()
    .then((payload) => {
      writeCacheFile(snapshotCachePath, payload);
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
    if (cached && typeof cached.cachedAt === 'number' && isFresh(cached.cachedAt)) {
      return cached;
    }
    const inflight = inflightCharts.get(assetId);
    if (inflight) return inflight;
  }

  const request = fetchChartDetail(assetId)
    .then((detail) => {
      writeCacheFile(cachePath, detail);
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
