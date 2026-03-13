import type {
  NewsCardLayout,
  NewsDetailBlock,
  NewsFeedPayload,
  NewsHeadline,
  NewsHeadlineMetrics,
  NewsTopicFeed,
  NewsTopicId,
} from '@/src/types/news';

export type NewsChannelId = 'all' | NewsTopicId;
export type RecommendationMode = 'smart' | 'balanced' | 'markets';

export interface NewsChannel {
  id: NewsChannelId;
  labelZh: string;
  labelEn: string;
  count: number;
}

export interface FeedCardItem {
  headline: NewsHeadline;
  topic: NewsTopicFeed;
  topicPosition: number;
}

export interface NewsNoteView {
  id: string;
  headline: NewsHeadline;
  topic: NewsTopicFeed;
  topicPosition: number;
  cardLayout: NewsCardLayout;
  coverAspectRatio: string;
  title: string;
  excerpt: string;
  authorName: string;
  authorHandle: string;
  sourceDomain: string;
  metrics: NewsHeadlineMetrics;
  tags: string[];
  detailBlocks: NewsDetailBlock[];
}

export interface FeedBuildOptions {
  recommendationMode?: RecommendationMode;
}

const IMAGE_ASPECT_RATIOS = ['4 / 3', '5 / 4', '1 / 1', '3 / 2'];
const RECOMMENDATION_MODE_WEIGHTS: Record<RecommendationMode, Record<NewsTopicId, number>> = {
  smart: {
    technology: 1.44,
    aiTalks: 1.3,
    crypto: 1.08,
    world: 1.04,
    macro: 0.86,
    markets: 1.18,
  },
  balanced: {
    technology: 1,
    aiTalks: 1,
    crypto: 1,
    world: 1,
    macro: 1,
    markets: 1,
  },
  markets: {
    technology: 0.96,
    aiTalks: 0.82,
    crypto: 0.94,
    world: 0.95,
    macro: 1.16,
    markets: 1.3,
  },
};
function createSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickFromSeed<T>(items: T[], seed: number) {
  return items[seed % items.length];
}

function extractDomain(value: string | null) {
  if (!value) return '';
  const normalizeDomain = (domain: string) => {
    const parts = domain
      .replace(/^www\./, '')
      .split('.')
      .filter(Boolean);
    if (parts.length > 2) {
      return parts.slice(-2).join('.');
    }
    return parts.join('.');
  };

  try {
    return normalizeDomain(new URL(value).hostname);
  } catch {
    return normalizeDomain(value.replace(/^https?:\/\//, ''));
  }
}

function buildMetrics(headline: NewsHeadline): NewsHeadlineMetrics {
  if (headline.metrics) return headline.metrics;

  const seed = createSeed(headline.id);
  const freshnessWeight = headline.publishedAt
    ? Math.max(0.55, 1.35 - (Date.now() - headline.publishedAt) / (1000 * 60 * 60 * 24 * 5))
    : 0.85;

  const likes = Math.round((160 + (seed % 9200)) * freshnessWeight);
  const comments = Math.round((18 + (Math.floor(seed / 7) % 720)) * freshnessWeight);
  const saves = Math.round((24 + (Math.floor(seed / 13) % 1800)) * freshnessWeight);

  return {
    likes,
    comments,
    saves,
  };
}

function sanitizeTag(value: string) {
  const normalized = value
    .replace(/^[#@]+/, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((segment) =>
      segment === segment.toUpperCase() ? segment : segment[0]?.toUpperCase() + segment.slice(1),
    )
    .join('');

  if (/^\d+$/.test(normalized)) return '';
  return normalized;
}

function extractKeywordTags(title: string) {
  const keywordMatches = title.match(/\b[A-Z0-9][A-Z0-9.+-]{1,14}\b/g) ?? [];
  const tags: string[] = [];

  for (const match of keywordMatches) {
    const next = sanitizeTag(match);
    if (!next || tags.includes(next)) continue;
    tags.push(next);
    if (tags.length >= 3) break;
  }

  return tags;
}

function buildTags(headline: NewsHeadline, topic: NewsTopicFeed) {
  if (headline.tags?.length) return headline.tags.slice(0, 4);

  const tags = [topic.labelEn, headline.source, ...extractKeywordTags(headline.title)]
    .map(sanitizeTag)
    .filter(Boolean);

  return Array.from(new Set(tags)).slice(0, 4);
}

function splitSummaryIntoParagraphs(summary: string) {
  return summary
    .split(/(?<=[.!?])\s+|\n+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function createRecommendationKey(card: FeedCardItem) {
  return `${normalizeText(card.headline.source)}|${normalizeText(card.headline.title)}`;
}

function hasVisualCover(headline: NewsHeadline) {
  return Boolean(headline.imageUrl);
}

function getRecencyBoost(value: number | null) {
  if (!value) return 0;

  const ageHours = Math.max(0, (Date.now() - value) / (1000 * 60 * 60));
  if (ageHours <= 12) return 28;
  if (ageHours <= 24) return 22;
  if (ageHours <= 48) return 15;
  if (ageHours <= 96) return 9;
  if (ageHours <= 168) return 2;
  return -60; // >7 days: effectively excluded from recommendations
}

function getSourceBoost(source: string) {
  const normalized = normalizeText(source);
  if (
    normalized.includes('techcrunch') ||
    normalized.includes('the verge') ||
    normalized.includes('venturebeat') ||
    normalized.includes('hacker news') ||
    normalized.includes('cnbc') ||
    normalized.includes('engadget') ||
    normalized.includes('ars technica') ||
    normalized.includes('wired') ||
    normalized.includes('technology review') ||
    normalized.includes('new scientist') ||
    normalized.includes('hugging face') ||
    normalized.includes('nature') ||
    normalized.includes('bbc') ||
    normalized.includes('cnn')
  ) {
    return 5;
  }

  if (
    normalized.includes('bloomberg') ||
    normalized.includes('reuters') ||
    normalized.includes('associated press') ||
    normalized === 'ap' ||
    normalized.includes('new york times') ||
    normalized.includes('wall street journal') ||
    normalized.includes('rfi') ||
    normalized.includes('national geographic') ||
    normalized.includes('science daily') ||
    normalized.includes('fast company') ||
    normalized.includes('space.com')
  ) {
    return 3;
  }

  return 0;
}

function scoreRecommendation(card: FeedCardItem, recommendationMode: RecommendationMode) {
  const topicWeight = RECOMMENDATION_MODE_WEIGHTS[recommendationMode][card.topic.id] ?? 1;
  let score = topicWeight * 40;

  score += Math.max(0, 18 - card.topicPosition * 3.5);
  score += getRecencyBoost(card.headline.publishedAt);
  score += card.headline.imageUrl ? 18 : -7;
  score += card.headline.summary ? 6 : -2;
  score += getSourceBoost(card.headline.source);

  return score;
}

function buildRecommendedCards(feed: NewsFeedPayload, recommendationMode: RecommendationMode) {
  const topics = feed.topics.filter((topic) => topic.items.length > 0);
  const deduped = new Map<string, { card: FeedCardItem; score: number }>();

  for (const topic of topics) {
    for (const [index, headline] of topic.items.entries()) {
      const card = {
        headline,
        topic,
        topicPosition: index,
      } satisfies FeedCardItem;
      const score = scoreRecommendation(card, recommendationMode);
      const key = createRecommendationKey(card);
      const existing = deduped.get(key);

      if (!existing || score > existing.score) {
        deduped.set(key, { card, score });
      }
    }
  }

  const pool = Array.from(deduped.values());
  const selected: FeedCardItem[] = [];
  const topicCounts = new Map<NewsTopicId, number>();
  const sourceCounts = new Map<string, number>();
  let previousTopicId: NewsTopicId | null = null;

  while (pool.length > 0) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const [index, entry] of pool.entries()) {
      const topicPenalty = (topicCounts.get(entry.card.topic.id) ?? 0) * 7;
      const sourcePenalty = (sourceCounts.get(normalizeText(entry.card.headline.source)) ?? 0) * 5;
      const streakPenalty = previousTopicId === entry.card.topic.id ? 8 : 0;
      const adjustedScore = entry.score - topicPenalty - sourcePenalty - streakPenalty;

      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestIndex = index;
      }
    }

    const [next] = pool.splice(bestIndex, 1);
    if (!hasVisualCover(next.card.headline)) {
      continue;
    }

    selected.push(next.card);
    topicCounts.set(next.card.topic.id, (topicCounts.get(next.card.topic.id) ?? 0) + 1);

    const normalizedSource = normalizeText(next.card.headline.source);
    sourceCounts.set(normalizedSource, (sourceCounts.get(normalizedSource) ?? 0) + 1);
    previousTopicId = next.card.topic.id;
  }

  return selected;
}

function getReadableSummary(headline: NewsHeadline, topic: NewsTopicFeed) {
  const summary = headline.summary?.trim() ?? '';
  if (!summary) return '';

  const normalizedSummary = normalizeText(summary);
  const normalizedTopicDescription = normalizeText(topic.descriptionEn);
  const normalizedTitle = normalizeText(headline.title);

  if (normalizedSummary === normalizedTopicDescription || normalizedSummary === normalizedTitle) {
    return '';
  }

  return summary;
}

function truncateSummary(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function buildDetailBlocks(headline: NewsHeadline, topic: NewsTopicFeed): NewsDetailBlock[] {
  if (headline.detailBlocks?.length) return headline.detailBlocks;

  const blocks: NewsDetailBlock[] = [];
  const summaryParagraphs = splitSummaryIntoParagraphs(getReadableSummary(headline, topic));

  for (const [index, paragraph] of summaryParagraphs.entries()) {
    blocks.push({
      id: `${headline.id}-summary-${index}`,
      type: 'paragraph',
      content: paragraph,
    });
  }

  return blocks.slice(0, 3);
}

export function buildFeedCards(
  feed: NewsFeedPayload | null,
  channelId: NewsChannelId,
  options: FeedBuildOptions = {},
): FeedCardItem[] {
  if (!feed) return [];

  if (channelId !== 'all') {
    const topic = feed.topics.find((item) => item.id === channelId);
    if (!topic) return [];
    return topic.items
      .map((headline, index) => ({
        headline,
        topic,
        topicPosition: index,
      }))
      .filter((card) => hasVisualCover(card.headline));
  }

  return buildRecommendedCards(feed, options.recommendationMode ?? 'smart');
}

export function buildNewsChannels(feed: NewsFeedPayload | null): NewsChannel[] {
  return [
    {
      id: 'all',
      labelZh: '推荐',
      labelEn: 'For you',
      count:
        feed?.topics.reduce(
          (sum, topic) => sum + topic.items.filter((headline) => hasVisualCover(headline)).length,
          0,
        ) ?? 0,
    },
    ...((feed?.topics ?? []).map((topic) => ({
      id: topic.id,
      labelZh: topic.labelZh,
      labelEn: topic.labelEn,
      count: topic.items.filter((headline) => hasVisualCover(headline)).length,
    })) satisfies NewsChannel[]),
  ];
}

export function deriveNewsNote(card: FeedCardItem): NewsNoteView {
  const { headline, topic, topicPosition } = card;
  const seed = createSeed(`${headline.id}:${topicPosition}`);
  const cardLayout: NewsCardLayout = 'image';
  const sourceDomain = extractDomain(headline.sourceUrl ?? headline.url);
  const excerpt = truncateSummary(getReadableSummary(headline, topic), 220);

  return {
    id: headline.id,
    headline,
    topic,
    topicPosition,
    cardLayout,
    coverAspectRatio: pickFromSeed(IMAGE_ASPECT_RATIOS, seed),
    title: headline.title.trim(),
    excerpt,
    authorName: headline.authorName?.trim() || headline.source.trim(),
    authorHandle:
      headline.authorHandle?.trim() ||
      (sourceDomain ? `@${sourceDomain}` : `@${headline.source.trim().toLowerCase()}`),
    sourceDomain,
    metrics: buildMetrics(headline),
    tags: buildTags(headline, topic),
    detailBlocks: buildDetailBlocks(headline, topic),
  };
}
