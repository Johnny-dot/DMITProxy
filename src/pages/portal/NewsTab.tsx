import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import { getNewsFeed, refreshNewsFeed } from '@/src/api/client';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { useI18n } from '@/src/context/I18nContext';
import type { NewsFeedPayload, NewsHeadline, NewsTopicFeed, NewsTopicId } from '@/src/types/news';
import { cn } from '@/src/utils/cn';

type NewsChannelId = 'all' | NewsTopicId;

interface FeedCardItem {
  headline: NewsHeadline;
  topic: NewsTopicFeed;
  topicPosition: number;
}

interface TopicStyle {
  avatarClass: string;
  badgeClass: string;
  coverStyles: string[];
  tintClass: string;
}

const CARD_HEIGHTS = [228, 292, 244, 316, 236, 276];
const IMAGE_ASPECT_RATIOS = ['4 / 5', '3 / 4', '1 / 1.14'];

const TOPIC_STYLES: Record<NewsTopicId, TopicStyle> = {
  markets: {
    avatarClass: 'border border-[#2d463c] bg-[#11241d] text-[#9fe0c2]',
    badgeClass: 'border border-[#35584b] bg-[#13271f] text-[#9fe0c2]',
    tintClass: 'text-[#9fe0c2]',
    coverStyles: [
      'radial-gradient(circle at 18% 16%, rgba(82, 214, 151, 0.38), transparent 38%), linear-gradient(160deg, #11161a 0%, #10251f 48%, #090d10 100%)',
      'radial-gradient(circle at 82% 12%, rgba(127, 255, 204, 0.22), transparent 28%), linear-gradient(180deg, #0b1115 0%, #132e26 56%, #0d1512 100%)',
      'radial-gradient(circle at 48% 18%, rgba(108, 226, 168, 0.28), transparent 34%), linear-gradient(135deg, #10161c 0%, #193126 52%, #0a0e12 100%)',
    ],
  },
  macro: {
    avatarClass: 'border border-[#5a4930] bg-[#271b13] text-[#f3c18a]',
    badgeClass: 'border border-[#6b5334] bg-[#261b13] text-[#f3c18a]',
    tintClass: 'text-[#f3c18a]',
    coverStyles: [
      'radial-gradient(circle at 22% 18%, rgba(255, 192, 118, 0.34), transparent 34%), linear-gradient(160deg, #15110f 0%, #32251d 46%, #0c0a09 100%)',
      'radial-gradient(circle at 78% 18%, rgba(240, 177, 102, 0.24), transparent 28%), linear-gradient(180deg, #130f0d 0%, #392a1d 54%, #0d0b09 100%)',
      'radial-gradient(circle at 52% 14%, rgba(255, 201, 136, 0.26), transparent 30%), linear-gradient(145deg, #151211 0%, #433121 50%, #0f0c0a 100%)',
    ],
  },
  technology: {
    avatarClass: 'border border-[#314866] bg-[#121d2a] text-[#a9cdf5]',
    badgeClass: 'border border-[#3c5d84] bg-[#122030] text-[#a9cdf5]',
    tintClass: 'text-[#a9cdf5]',
    coverStyles: [
      'radial-gradient(circle at 20% 20%, rgba(118, 177, 255, 0.34), transparent 38%), linear-gradient(155deg, #0e1218 0%, #14273a 48%, #090c11 100%)',
      'radial-gradient(circle at 80% 18%, rgba(132, 196, 255, 0.24), transparent 28%), linear-gradient(180deg, #0e1217 0%, #17324b 58%, #090d12 100%)',
      'radial-gradient(circle at 52% 16%, rgba(145, 195, 255, 0.24), transparent 32%), linear-gradient(140deg, #0d1117 0%, #1a3650 54%, #090d11 100%)',
    ],
  },
  aiTalks: {
    avatarClass: 'border border-[#6a3041] bg-[#26121a] text-[#ffb3c5]',
    badgeClass: 'border border-[#844156] bg-[#29131c] text-[#ffb3c5]',
    tintClass: 'text-[#ffb3c5]',
    coverStyles: [
      'radial-gradient(circle at 20% 18%, rgba(255, 115, 143, 0.38), transparent 36%), linear-gradient(160deg, #120e14 0%, #351622 50%, #0b0910 100%)',
      'radial-gradient(circle at 78% 16%, rgba(255, 126, 161, 0.24), transparent 28%), linear-gradient(180deg, #120d13 0%, #421724 56%, #0b0910 100%)',
      'radial-gradient(circle at 52% 14%, rgba(255, 143, 175, 0.24), transparent 32%), linear-gradient(140deg, #120d13 0%, #4a1b29 52%, #0b0910 100%)',
    ],
  },
  crypto: {
    avatarClass: 'border border-[#3f5a47] bg-[#142018] text-[#bde6a1]',
    badgeClass: 'border border-[#4c6f56] bg-[#16231a] text-[#bde6a1]',
    tintClass: 'text-[#bde6a1]',
    coverStyles: [
      'radial-gradient(circle at 18% 18%, rgba(188, 234, 118, 0.34), transparent 36%), linear-gradient(160deg, #10140f 0%, #1c2d18 50%, #090c09 100%)',
      'radial-gradient(circle at 82% 15%, rgba(191, 241, 124, 0.22), transparent 28%), linear-gradient(180deg, #10130f 0%, #24341d 56%, #090c09 100%)',
      'radial-gradient(circle at 52% 16%, rgba(186, 234, 122, 0.24), transparent 30%), linear-gradient(145deg, #10140f 0%, #2a3a21 52%, #090c09 100%)',
    ],
  },
};

function formatDateTime(value: number | null, locale: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function getSourceInitials(source: string) {
  const normalized = source
    .split(/[\s/._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('');
  return normalized || source.slice(0, 2).toUpperCase();
}

function buildFeedCards(feed: NewsFeedPayload | null, channelId: NewsChannelId): FeedCardItem[] {
  if (!feed) return [];

  if (channelId !== 'all') {
    const topic = feed.topics.find((item) => item.id === channelId);
    if (!topic) return [];
    return topic.items.map((headline, index) => ({
      headline,
      topic,
      topicPosition: index,
    }));
  }

  const topics = feed.topics.filter((topic) => topic.items.length > 0);
  const maxLength = topics.reduce((max, topic) => Math.max(max, topic.items.length), 0);
  const cards: FeedCardItem[] = [];

  for (let itemIndex = 0; itemIndex < maxLength; itemIndex += 1) {
    for (const topic of topics) {
      const headline = topic.items[itemIndex];
      if (!headline) continue;
      cards.push({
        headline,
        topic,
        topicPosition: itemIndex,
      });
    }
  }

  return cards;
}

export function NewsTab() {
  const { language } = useI18n();
  const isZh = language === 'zh-CN';
  const locale = isZh ? 'zh-CN' : 'en-US';

  const [newsFeed, setNewsFeed] = useState<NewsFeedPayload | null>(null);
  const [newsError, setNewsError] = useState('');
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [isRefreshingNews, setIsRefreshingNews] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState<NewsChannelId>('all');

  const applyNewsFeed = useCallback((feed: NewsFeedPayload) => {
    setNewsFeed(feed);
    setActiveChannelId((current) => {
      if (current === 'all') return current;
      return feed.topics.some((topic) => topic.id === current) ? current : 'all';
    });
  }, []);

  const loadNews = useCallback(async () => {
    setIsLoadingNews(true);
    setNewsError('');
    try {
      const data = await getNewsFeed();
      applyNewsFeed(data.feed);
    } catch (error) {
      setNewsError(
        error instanceof Error
          ? error.message
          : isZh
            ? '暂时无法加载资讯'
            : 'Failed to load news feed',
      );
    } finally {
      setIsLoadingNews(false);
    }
  }, [applyNewsFeed, isZh]);

  useEffect(() => {
    void loadNews();
  }, [loadNews]);

  async function handleRefreshNews() {
    setIsRefreshingNews(true);
    try {
      const data = await refreshNewsFeed();
      applyNewsFeed(data.feed);
      setNewsError('');
    } catch (error) {
      setNewsError(
        error instanceof Error
          ? error.message
          : isZh
            ? '刷新资讯失败'
            : 'Failed to refresh news feed',
      );
    } finally {
      setIsRefreshingNews(false);
    }
  }

  const channels = useMemo(
    () => [
      {
        id: 'all' as const,
        labelZh: '推荐',
        labelEn: 'Recommended',
        count: newsFeed?.topics.reduce((sum, topic) => sum + topic.items.length, 0) ?? 0,
      },
      ...((newsFeed?.topics ?? []).map((topic) => ({
        id: topic.id,
        labelZh: topic.labelZh,
        labelEn: topic.labelEn,
        count: topic.items.length,
      })) satisfies Array<{
        id: NewsTopicId;
        labelZh: string;
        labelEn: string;
        count: number;
      }>),
    ],
    [newsFeed?.topics],
  );

  const activeTopic = useMemo(
    () =>
      activeChannelId === 'all'
        ? null
        : (newsFeed?.topics.find((topic) => topic.id === activeChannelId) ?? null),
    [activeChannelId, newsFeed?.topics],
  );

  const feedCards = useMemo(
    () => buildFeedCards(newsFeed, activeChannelId),
    [activeChannelId, newsFeed],
  );

  const heroCopy = activeTopic
    ? isZh
      ? `${activeTopic.labelZh}频道，按内容流方式浏览。`
      : `${activeTopic.labelEn} stories in a scrolling feed.`
    : isZh
      ? '把多个资讯源混合成推荐流，优先显示真实封面和摘要。'
      : 'Blend multiple publishers into a recommendation feed with real covers and summaries.';

  if (isLoadingNews) {
    return (
      <div className="space-y-4" data-testid="portal-news-tab">
        <section className="overflow-hidden rounded-[34px] border border-[#191d26] bg-[#090b10] p-5 shadow-[0_26px_70px_rgba(0,0,0,0.24)] md:p-6">
          <div className="space-y-4">
            <Skeleton className="h-5 w-24 rounded-full bg-[rgba(255,255,255,0.08)]" />
            <Skeleton className="h-10 w-80 rounded-2xl bg-[rgba(255,255,255,0.1)]" />
            <Skeleton className="h-16 w-full rounded-[24px] bg-[rgba(255,255,255,0.08)]" />
            <div className="flex gap-2 overflow-hidden">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-11 w-24 rounded-full bg-[rgba(255,255,255,0.08)]"
                />
              ))}
            </div>
          </div>
        </section>
        <section className="columns-1 gap-4 md:columns-2 xl:columns-3 2xl:columns-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="mb-4 break-inside-avoid">
              <Skeleton
                className={cn(
                  'w-full rounded-[28px] bg-[linear-gradient(180deg,rgba(14,17,23,0.98),rgba(12,14,19,0.92))]',
                  index % 2 === 0 ? 'h-[320px]' : 'h-[260px]',
                )}
              />
            </div>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="portal-news-tab">
      <section className="overflow-hidden rounded-[34px] border border-[#191d26] bg-[#090b10] text-[#f7f8fb] shadow-[0_26px_70px_rgba(0,0,0,0.24)]">
        <div className="relative overflow-hidden p-5 md:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,90,123,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(77,171,255,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_58%)]" />
          <div className="relative space-y-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] px-3 py-1.5 text-[11px] uppercase tracking-[0.24em] text-[rgba(247,248,251,0.7)]">
                  <Sparkles className="h-3.5 w-3.5 text-[#ff6b88]" />
                  {isZh ? '资讯流' : 'News feed'}
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[#f7f8fb] md:text-[2.6rem]">
                    {isZh ? '像刷内容流一样看资讯。' : 'Browse news like a social feed.'}
                  </h2>
                  <p className="max-w-2xl text-sm leading-7 text-[rgba(247,248,251,0.68)] md:text-[15px]">
                    {heroCopy}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] px-3 py-2 text-xs text-[rgba(247,248,251,0.6)]">
                  {`${isZh ? '更新' : 'Updated'} ${formatDateTime(newsFeed?.cachedAt ?? null, locale)}`}
                </span>
                {newsFeed?.attributionUrl ? (
                  <a
                    href={newsFeed.attributionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] px-3 py-2 text-xs text-[rgba(247,248,251,0.72)] transition-colors hover:bg-[rgba(255,255,255,0.1)] hover:text-[#f7f8fb]"
                  >
                    {newsFeed.provider}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] px-3 py-2 text-xs text-[rgba(247,248,251,0.72)]">
                    {newsFeed?.provider}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void handleRefreshNews()}
                  disabled={isRefreshingNews}
                  className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.12)] bg-[#f7f8fb] px-4 py-2 text-sm font-medium text-[#0a0c10] transition-all hover:-translate-y-0.5 hover:bg-[rgba(247,248,251,0.92)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={cn('h-4 w-4', isRefreshingNews && 'animate-spin')} />
                  {isZh ? '刷新资讯' : 'Refresh'}
                </button>
              </div>
            </div>

            <div className="-mx-1 overflow-x-auto pb-1">
              <div className="flex min-w-max gap-2 px-1">
                {channels.map((channel) => {
                  const active = channel.id === activeChannelId;
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => setActiveChannelId(channel.id)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition-all',
                        active
                          ? 'border-transparent bg-[#f7f8fb] text-[#0a0c10] shadow-[0_10px_30px_rgba(255,255,255,0.1)]'
                          : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] text-[rgba(247,248,251,0.72)] hover:bg-[rgba(255,255,255,0.1)] hover:text-[#f7f8fb]',
                      )}
                    >
                      <span>{isZh ? channel.labelZh : channel.labelEn}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px]',
                          active
                            ? 'bg-[rgba(10,12,16,0.08)] text-[rgba(10,12,16,0.6)]'
                            : 'bg-[rgba(255,255,255,0.08)] text-[rgba(247,248,251,0.5)]',
                        )}
                      >
                        {channel.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {newsError && !newsFeed ? (
        <div className="rounded-[28px] border border-[#1b2029] bg-[#0d1016] p-4 text-sm text-[rgba(247,248,251,0.64)]">
          {newsError}
        </div>
      ) : null}

      {activeTopic?.status === 'error' ? (
        <div className="rounded-[28px] border border-[#1b2029] bg-[#0d1016] p-4 text-sm text-[rgba(247,248,251,0.64)]">
          {activeTopic.error ??
            (isZh
              ? '这个主题暂时没有抓到可显示的公开资讯。'
              : 'This topic did not return visible headlines right now.')}
        </div>
      ) : null}

      {feedCards.length > 0 ? (
        <section className="columns-1 gap-4 md:columns-2 xl:columns-3 2xl:columns-4">
          {feedCards.map((card, index) => {
            const style = TOPIC_STYLES[card.topic.id];
            const cardHeight = CARD_HEIGHTS[index % CARD_HEIGHTS.length];
            const coverStyle = style.coverStyles[index % style.coverStyles.length];
            const topicLabel = isZh ? card.topic.labelZh : card.topic.labelEn;
            const topicDescription = isZh ? card.topic.descriptionZh : card.topic.descriptionEn;
            const sourceInitials = getSourceInitials(card.headline.source);
            const excerpt = card.headline.summary ?? topicDescription;
            const hasImage = Boolean(card.headline.imageUrl);
            const imageAspectRatio = IMAGE_ASPECT_RATIOS[index % IMAGE_ASPECT_RATIOS.length];

            return (
              <article key={card.headline.id} className="mb-4 break-inside-avoid">
                <a
                  href={card.headline.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block overflow-hidden rounded-[28px] border border-[#1a1e28] bg-[#0d1016] text-[#f7f8fb] shadow-[0_18px_44px_rgba(0,0,0,0.24)] transition-all duration-200 hover:-translate-y-1 hover:border-[rgba(255,255,255,0.14)] hover:shadow-[0_28px_60px_rgba(0,0,0,0.34)]"
                >
                  {hasImage ? (
                    <>
                      <div className="relative overflow-hidden border-b border-[rgba(255,255,255,0.06)]">
                        <div style={{ aspectRatio: imageAspectRatio }}>
                          <img
                            src={card.headline.imageUrl ?? undefined}
                            alt={card.headline.title}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        </div>
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,10,14,0.04),transparent_30%,rgba(7,10,14,0.62)_100%)]" />
                        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.18em] uppercase backdrop-blur-sm',
                              style.badgeClass,
                            )}
                          >
                            {topicLabel}
                          </span>
                          <span className="rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(10,12,16,0.28)] px-2.5 py-1 text-[11px] text-[rgba(247,248,251,0.68)] backdrop-blur-sm">
                            {isZh
                              ? `第 ${card.topicPosition + 1} 条`
                              : `#${card.topicPosition + 1}`}
                          </span>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 space-y-2 p-4">
                          <p
                            className={cn(
                              'text-[11px] uppercase tracking-[0.24em]',
                              style.tintClass,
                            )}
                          >
                            {card.headline.source}
                          </p>
                          <h3 className="line-clamp-3 text-[1.24rem] font-semibold leading-[1.28] tracking-[-0.03em] text-[#f7f8fb]">
                            {card.headline.title}
                          </h3>
                        </div>
                      </div>

                      <div className="space-y-4 p-4">
                        <p className="line-clamp-3 text-sm leading-6 text-[rgba(247,248,251,0.68)]">
                          {excerpt}
                        </p>

                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                              style.avatarClass,
                            )}
                          >
                            {sourceInitials}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#f7f8fb]">
                              {card.headline.source}
                            </p>
                            <p className="truncate text-xs text-[rgba(247,248,251,0.48)]">
                              {card.headline.sourceUrl
                                ? card.headline.sourceUrl.replace(/^https?:\/\//, '')
                                : topicLabel}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-xs text-[rgba(247,248,251,0.56)]">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-1.5">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatDateTime(card.headline.publishedAt, locale)}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-1.5">
                            <ExternalLink className="h-3.5 w-3.5" />
                            {isZh
                              ? `同主题 ${card.topic.items.length}`
                              : `${card.topic.items.length} related`}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4 p-4">
                      <div
                        className="relative overflow-hidden rounded-[24px] border border-[rgba(255,255,255,0.06)] p-4"
                        style={{ minHeight: `${cardHeight}px`, backgroundImage: coverStyle }}
                      >
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_42%,rgba(0,0,0,0.28)_100%)]" />
                        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[rgba(255,255,255,0.1)] blur-3xl" />

                        <div className="relative flex h-full min-h-[inherit] flex-col">
                          <div className="flex items-start justify-between gap-3">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.18em] uppercase',
                                style.badgeClass,
                              )}
                            >
                              {topicLabel}
                            </span>
                            <span className="rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(10,12,16,0.18)] px-2.5 py-1 text-[11px] text-[rgba(247,248,251,0.64)]">
                              {isZh
                                ? `第 ${card.topicPosition + 1} 条`
                                : `#${card.topicPosition + 1}`}
                            </span>
                          </div>

                          <div className="mt-6 space-y-3">
                            <p
                              className={cn(
                                'text-[11px] uppercase tracking-[0.24em]',
                                style.tintClass,
                              )}
                            >
                              {card.headline.source}
                            </p>
                            <h3 className="line-clamp-4 text-[1.3rem] font-semibold leading-[1.28] tracking-[-0.03em] text-[#f7f8fb]">
                              {card.headline.title}
                            </h3>
                            <p className="line-clamp-5 text-sm leading-6 text-[rgba(247,248,251,0.7)]">
                              {excerpt}
                            </p>
                          </div>

                          <div className="mt-auto pt-6">
                            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(8,11,15,0.32)] px-3 py-2 text-xs text-[rgba(247,248,251,0.54)]">
                              <ExternalLink className="h-3.5 w-3.5" />
                              {card.headline.sourceUrl
                                ? card.headline.sourceUrl.replace(/^https?:\/\//, '')
                                : topicLabel}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                            style.avatarClass,
                          )}
                        >
                          {sourceInitials}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#f7f8fb]">
                            {card.headline.source}
                          </p>
                          <p className="truncate text-xs text-[rgba(247,248,251,0.48)]">
                            {card.headline.sourceUrl
                              ? card.headline.sourceUrl.replace(/^https?:\/\//, '')
                              : topicLabel}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs text-[rgba(247,248,251,0.56)]">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatDateTime(card.headline.publishedAt, locale)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-1.5">
                          <ExternalLink className="h-3.5 w-3.5" />
                          {isZh
                            ? `同主题 ${card.topic.items.length}`
                            : `${card.topic.items.length} related`}
                        </span>
                      </div>
                    </div>
                  )}
                </a>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="rounded-[28px] border border-[#1b2029] bg-[#0d1016] p-4 text-sm text-[rgba(247,248,251,0.64)]">
          {isZh
            ? '当前频道还没有可显示的资讯。'
            : 'There are no visible headlines in this channel right now.'}
        </div>
      )}
    </div>
  );
}
