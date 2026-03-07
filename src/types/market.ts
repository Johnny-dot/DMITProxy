export type MarketCategory = 'indices' | 'metals' | 'crypto' | 'forex';

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

export interface MarketSnapshotResponse {
  snapshot: MarketSnapshotPayload;
  defaultAssetId: string;
}

export interface MarketChartResponse {
  detail: MarketChartDetail;
}

export interface MarketRefreshResponse {
  ok: boolean;
  snapshot: MarketSnapshotPayload;
  detail: MarketChartDetail | null;
}
