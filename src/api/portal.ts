import { localFetch } from './base';
import type { UserProfile, UserAvatarStyle } from '@/src/types/userProfile';
import type {
  MarketChartResponse,
  MarketRefreshResponse,
  MarketSnapshotResponse,
} from '@/src/types/market';
import type { NewsFeedResponse, NewsRefreshResponse } from '@/src/types/news';

export interface RefreshCurrentNodeQualityResult {
  stats: {
    inboundId: number;
    inboundRemark: string;
    protocol: string;
    up: number;
    down: number;
    total: number;
    expiryTime: number;
    enable: boolean;
  } | null;
  nodeQuality: import('@/src/types/nodeQuality').NodeQualityProfile | null;
}

export function getUserProfile(): Promise<UserProfile> {
  return localFetch<UserProfile>('/local/auth/profile', {
    fallbackError: 'Failed to load user profile',
  });
}

export async function updateUserProfile(payload: {
  displayName: string;
  avatarStyle: UserAvatarStyle;
}): Promise<UserProfile> {
  const data = await localFetch<{ ok: boolean; profile: UserProfile }>('/local/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
    fallbackError: 'Failed to save user profile',
  });
  return data.profile;
}

export function getMarketSnapshot(): Promise<MarketSnapshotResponse> {
  return localFetch<MarketSnapshotResponse>('/local/auth/portal/market', {
    fallbackError: 'Failed to load market snapshot',
  });
}

export function getMarketChart(assetId: string): Promise<MarketChartResponse> {
  return localFetch<MarketChartResponse>(
    `/local/auth/portal/market/${encodeURIComponent(assetId)}`,
    {
      fallbackError: 'Failed to load market chart',
    },
  );
}

export function refreshMarketSnapshot(assetId: string): Promise<MarketRefreshResponse> {
  return localFetch<MarketRefreshResponse>('/local/auth/portal/market/refresh', {
    method: 'POST',
    body: JSON.stringify({ assetId }),
    fallbackError: 'Failed to refresh market data',
  });
}

export function getNewsFeed(): Promise<NewsFeedResponse> {
  return localFetch<NewsFeedResponse>('/local/auth/portal/news', {
    fallbackError: 'Failed to load news feed',
  });
}

export function refreshNewsFeed(): Promise<NewsRefreshResponse> {
  return localFetch<NewsRefreshResponse>('/local/auth/portal/news/refresh', {
    method: 'POST',
    fallbackError: 'Failed to refresh news feed',
  });
}

export async function refreshCurrentNodeQuality(): Promise<RefreshCurrentNodeQualityResult> {
  return localFetch<RefreshCurrentNodeQualityResult>('/local/auth/portal/node-quality/refresh', {
    method: 'POST',
    fallbackError: 'Failed to refresh current node quality',
  });
}
