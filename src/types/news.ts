export type NewsTopicId = 'markets' | 'macro' | 'technology' | 'crypto';

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

export interface NewsFeedResponse {
  feed: NewsFeedPayload;
}

export interface NewsRefreshResponse {
  ok: boolean;
  feed: NewsFeedPayload;
}
