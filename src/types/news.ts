export type NewsTopicId = 'markets' | 'macro' | 'world' | 'technology' | 'aiTalks' | 'crypto';
export type NewsCardLayout = 'image' | 'text';

export interface NewsHeadlineMetrics {
  likes: number;
  comments: number;
  saves: number;
}

export interface NewsDetailBlock {
  id: string;
  type: 'paragraph' | 'quote';
  content: string;
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
  authorName?: string | null;
  authorHandle?: string | null;
  authorAvatar?: string | null;
  tags?: string[];
  metrics?: NewsHeadlineMetrics;
  detailBlocks?: NewsDetailBlock[];
  cardLayout?: NewsCardLayout;
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

export interface NewsFeedResponse {
  feed: NewsFeedPayload;
}

export interface NewsRefreshResponse {
  ok: boolean;
  feed: NewsFeedPayload;
}
