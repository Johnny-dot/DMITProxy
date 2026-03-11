import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getNewsFeed, refreshNewsFeed } from '@/src/api/client';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { useI18n } from '@/src/context/I18nContext';
import type { NewsFeedPayload, NewsTopicFeed } from '@/src/types/news';
import {
  buildFeedCards,
  buildNewsChannels,
  deriveNewsNote,
  type NewsChannelId,
  type NewsNoteView,
} from './news/news-feed-model';
import { NewsDetailModal } from './news/NewsDetailModal';
import { NewsFeedTopBar } from './news/NewsFeedTopBar';
import { NewsNoteCard } from './news/NewsNoteCard';
import { formatNewsDateTime } from './news/news-visuals';

function getNewsColumnCount(containerWidth: number) {
  if (containerWidth >= 1680) return 5;
  if (containerWidth >= 1180) return 4;
  if (containerWidth >= 860) return 3;
  return 2;
}

function parseAspectRatio(value: string) {
  const [width, height] = value.split('/').map((part) => Number.parseFloat(part.trim()));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 0.8;
  }
  return width / height;
}

function estimateNoteHeight(note: NewsNoteView, columnWidth: number) {
  const titleLines = Math.max(2, Math.min(5, Math.ceil(note.title.length / 22)));
  const excerptLines = note.excerpt
    ? Math.max(2, Math.min(5, Math.ceil(note.excerpt.length / 48)))
    : 0;

  if (note.cardLayout === 'image' && note.headline.imageUrl) {
    const aspectRatio = parseAspectRatio(note.coverAspectRatio);
    const coverHeight = columnWidth / Math.max(0.58, aspectRatio);
    return coverHeight + 146 + titleLines * 16 + excerptLines * 12;
  }

  return 230 + titleLines * 24 + excerptLines * 22;
}

function buildMasonryColumns(notes: NewsNoteView[], columnCount: number, containerWidth: number) {
  const columns = Array.from({ length: columnCount }, () => [] as NewsNoteView[]);
  const heights = Array.from({ length: columnCount }, () => 0);
  const gap = 16;
  const columnWidth = Math.max(220, (containerWidth - gap * (columnCount - 1)) / columnCount);

  for (const note of notes) {
    let targetColumn = 0;
    for (let index = 1; index < heights.length; index += 1) {
      if (heights[index] < heights[targetColumn]) {
        targetColumn = index;
      }
    }

    columns[targetColumn].push(note);
    heights[targetColumn] += estimateNoteHeight(note, columnWidth) + gap;
  }

  return columns;
}

function patchFeedDeck(current: NewsNoteView[], latest: NewsNoteView[]) {
  if (current.length === 0) return latest;

  const latestById = new Map(latest.map((note) => [note.id, note]));
  const merged = current.map((note) => latestById.get(note.id) ?? note);
  const seen = new Set(merged.map((note) => note.id));
  const additions = latest.filter((note) => !seen.has(note.id));
  return additions.length > 0 ? merged.concat(additions) : merged;
}

function replaceFeedDeckWithLatest(current: NewsNoteView[], latest: NewsNoteView[]) {
  if (current.length === 0) return latest;

  const latestIds = new Set(latest.map((note) => note.id));
  const backlog = current.filter((note) => !latestIds.has(note.id));
  return latest.concat(backlog);
}

function LoadingFeed() {
  return (
    <div className="space-y-4" data-testid="portal-news-tab">
      <section className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="space-y-4">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-8 w-72 rounded-2xl" />
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-24 rounded-full" />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="space-y-4">
            <Skeleton
              className={index % 3 === 0 ? 'h-[420px] rounded-[26px]' : 'h-[340px] rounded-[26px]'}
            />
          </div>
        ))}
      </section>
    </div>
  );
}

const INITIAL_VISIBLE_NOTE_COUNT = 18;
const LOAD_MORE_NOTE_BATCH = 12;
const PREFETCH_NOTE_THRESHOLD = 10;
const AUTO_REFRESH_COOLDOWN_MS = 8_000;

export function NewsTab() {
  const { language } = useI18n();
  const isZh = language === 'zh-CN';
  const locale = isZh ? 'zh-CN' : 'en-US';

  const [newsFeed, setNewsFeed] = useState<NewsFeedPayload | null>(null);
  const [newsError, setNewsError] = useState('');
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [isRefreshingNews, setIsRefreshingNews] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState<NewsChannelId>('all');
  const [openNote, setOpenNote] = useState<NewsNoteView | null>(null);
  const [feedDeck, setFeedDeck] = useState<NewsNoteView[]>([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_NOTE_COUNT);
  const [isContinuingFeed, setIsContinuingFeed] = useState(false);
  const [isPrefetchingFeed, setIsPrefetchingFeed] = useState(false);
  const [hasReachedLiveEdge, setHasReachedLiveEdge] = useState(false);
  const [masonryWidth, setMasonryWidth] = useState(0);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [masonryContainer, setMasonryContainer] = useState<HTMLDivElement | null>(null);
  const appendLockRef = useRef(false);
  const prefetchLockRef = useRef(false);
  const lastAutoRefreshAtRef = useRef(0);
  const scopeKeyRef = useRef<string>('all');
  const feedDeckRef = useRef<NewsNoteView[]>([]);
  const visibleCountRef = useRef(INITIAL_VISIBLE_NOTE_COUNT);

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
      setNewsError(error instanceof Error ? error.message : 'Failed to load discover feed');
    } finally {
      setIsLoadingNews(false);
    }
  }, [applyNewsFeed]);

  useEffect(() => {
    void loadNews();
  }, [loadNews]);

  const handleRefreshNews = useCallback(async () => {
    setIsRefreshingNews(true);
    setHasReachedLiveEdge(false);
    try {
      const data = await refreshNewsFeed();
      const nextChannelId =
        activeChannelId === 'all' || data.feed.topics.some((topic) => topic.id === activeChannelId)
          ? activeChannelId
          : 'all';
      const refreshedNotes = buildFeedCards(data.feed, nextChannelId).map(deriveNewsNote);

      applyNewsFeed(data.feed);
      setFeedDeck((current) => replaceFeedDeckWithLatest(current, refreshedNotes));
      setVisibleCount((current) =>
        current === 0 ? Math.min(INITIAL_VISIBLE_NOTE_COUNT, refreshedNotes.length) : current,
      );
      setNewsError('');
    } catch (error) {
      setNewsError(error instanceof Error ? error.message : 'Failed to refresh discover feed');
    } finally {
      setIsRefreshingNews(false);
    }
  }, [activeChannelId, applyNewsFeed]);

  const activeTopic = useMemo<NewsTopicFeed | null>(
    () =>
      activeChannelId === 'all'
        ? null
        : (newsFeed?.topics.find((topic) => topic.id === activeChannelId) ?? null),
    [activeChannelId, newsFeed?.topics],
  );

  const channels = useMemo(() => buildNewsChannels(newsFeed), [newsFeed]);
  const feedNotes = useMemo(
    () => buildFeedCards(newsFeed, activeChannelId).map(deriveNewsNote),
    [activeChannelId, newsFeed],
  );
  const scopeKey = activeChannelId;
  const visibleNotes = useMemo(() => feedDeck.slice(0, visibleCount), [feedDeck, visibleCount]);
  const masonryColumnCount = useMemo(() => getNewsColumnCount(masonryWidth), [masonryWidth]);
  const masonryColumns = useMemo(
    () => buildMasonryColumns(visibleNotes, masonryColumnCount, masonryWidth || 1440),
    [masonryColumnCount, masonryWidth, visibleNotes],
  );

  useEffect(() => {
    feedDeckRef.current = feedDeck;
  }, [feedDeck]);

  useEffect(() => {
    visibleCountRef.current = visibleCount;
  }, [visibleCount]);

  useEffect(() => {
    if (!openNote) return;
    if (feedDeck.some((note) => note.id === openNote.id)) return;
    setOpenNote(null);
  }, [feedDeck, openNote]);

  useEffect(() => {
    const previousScopeKey = scopeKeyRef.current;
    scopeKeyRef.current = scopeKey;

    if (previousScopeKey !== scopeKey) {
      setFeedDeck(feedNotes);
      setVisibleCount(Math.min(INITIAL_VISIBLE_NOTE_COUNT, feedNotes.length));
      setHasReachedLiveEdge(false);
      setIsContinuingFeed(false);
      setIsPrefetchingFeed(false);
      appendLockRef.current = false;
      prefetchLockRef.current = false;
      return;
    }

    setFeedDeck((current) => {
      if (current.length === 0) {
        return feedNotes;
      }

      const seen = new Set(current.map((note) => note.id));
      const additions = feedNotes.filter((note) => !seen.has(note.id));
      if (additions.length > 0) {
        setHasReachedLiveEdge(false);
      }
      return patchFeedDeck(current, feedNotes);
    });
    setVisibleCount((current) =>
      current === 0 ? Math.min(INITIAL_VISIBLE_NOTE_COUNT, feedNotes.length) : current,
    );
  }, [feedNotes, scopeKey]);

  const prefetchMoreNotes = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (prefetchLockRef.current || feedDeckRef.current.length === 0) {
        return 0;
      }

      const remainingNotes = feedDeckRef.current.length - visibleCountRef.current;
      if (!force && remainingNotes > PREFETCH_NOTE_THRESHOLD) {
        return 0;
      }

      const now = Date.now();
      if (now - lastAutoRefreshAtRef.current < AUTO_REFRESH_COOLDOWN_MS) {
        return 0;
      }

      prefetchLockRef.current = true;
      setIsPrefetchingFeed(true);

      try {
        lastAutoRefreshAtRef.current = now;
        const data = await refreshNewsFeed();
        applyNewsFeed(data.feed);
        setNewsError('');

        const refreshedNotes = buildFeedCards(data.feed, activeChannelId).map(deriveNewsNote);
        const seen = new Set(feedDeckRef.current.map((note) => note.id));
        const additions = refreshedNotes.filter((note) => !seen.has(note.id));

        if (additions.length === 0) {
          setFeedDeck((current) => patchFeedDeck(current, refreshedNotes));
          return 0;
        }

        setFeedDeck((current) => patchFeedDeck(current, refreshedNotes));
        setHasReachedLiveEdge(false);
        return additions.length;
      } catch (error) {
        setNewsError(error instanceof Error ? error.message : 'Failed to continue loading stories');
        return 0;
      } finally {
        setIsPrefetchingFeed(false);
        prefetchLockRef.current = false;
      }
    },
    [activeChannelId, applyNewsFeed],
  );

  const appendMoreNotes = useCallback(() => {
    if (appendLockRef.current || feedDeckRef.current.length === 0) return;

    appendLockRef.current = true;
    setIsContinuingFeed(true);

    void (async () => {
      try {
        const totalVisible = visibleCountRef.current;
        const totalDeckSize = feedDeckRef.current.length;

        if (totalVisible < totalDeckSize) {
          const nextVisibleCount = Math.min(totalDeckSize, totalVisible + LOAD_MORE_NOTE_BATCH);
          setHasReachedLiveEdge(false);
          setVisibleCount(nextVisibleCount);
          return;
        }

        const additions = await prefetchMoreNotes({ force: true });
        if (additions === 0) {
          setHasReachedLiveEdge(true);
          return;
        }

        setVisibleCount((current) => current + Math.min(LOAD_MORE_NOTE_BATCH, additions));
        setHasReachedLiveEdge(false);
      } finally {
        setIsContinuingFeed(false);
        window.setTimeout(() => {
          appendLockRef.current = false;
        }, 220);
      }
    })();
  }, [prefetchMoreNotes]);

  useEffect(() => {
    if (feedDeck.length === 0) return;
    if (feedDeck.length - visibleCount > PREFETCH_NOTE_THRESHOLD) return;
    void prefetchMoreNotes();
  }, [feedDeck.length, prefetchMoreNotes, visibleCount]);

  // Auto-retry when live edge is reached: silently check for new content every 25s
  useEffect(() => {
    if (!hasReachedLiveEdge) return;
    const timer = window.setTimeout(() => {
      appendLockRef.current = false;
      appendMoreNotes();
    }, 25_000);
    return () => window.clearTimeout(timer);
  }, [appendMoreNotes, hasReachedLiveEdge]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || feedDeck.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        appendMoreNotes();
      },
      {
        rootMargin: '720px 0px',
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [appendMoreNotes, feedDeck.length]);

  useEffect(() => {
    if (!masonryContainer) return;

    const updateWidth = () => {
      setMasonryWidth(masonryContainer.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(masonryContainer);
    window.addEventListener('resize', updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [masonryContainer]);

  const updatedLabel = newsFeed?.cachedAt
    ? isZh
      ? `更新于 ${formatNewsDateTime(newsFeed.cachedAt, locale)}`
      : `Updated ${formatNewsDateTime(newsFeed.cachedAt, locale)}`
    : isZh
      ? '资讯流持续更新中'
      : 'The discover feed keeps updating';

  if (isLoadingNews) {
    return <LoadingFeed />;
  }

  return (
    <div className="space-y-4" data-testid="portal-news-tab">
      <NewsFeedTopBar
        channels={channels}
        activeChannelId={activeChannelId}
        updatedLabel={updatedLabel}
        isRefreshing={isRefreshingNews}
        isZh={isZh}
        onChannelChange={setActiveChannelId}
        onRefresh={() => void handleRefreshNews()}
      />

      {newsError && !newsFeed ? (
        <div className="rounded-[26px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-sm text-[var(--danger)]">
          {newsError}
        </div>
      ) : null}

      {activeTopic?.status === 'error' ? (
        <div className="rounded-[26px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-sm text-[var(--text-secondary)]">
          {activeTopic.error ??
            (isZh
              ? '这个频道暂时没有可显示的公开内容。'
              : 'This channel did not return visible items right now.')}
        </div>
      ) : null}

      {newsError && newsFeed ? (
        <div className="rounded-[22px] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning)]">
          {newsError}
        </div>
      ) : null}

      {feedNotes.length > 0 ? (
        <>
          <section
            ref={setMasonryContainer}
            className="grid items-start gap-2.5 sm:gap-4"
            style={{ gridTemplateColumns: `repeat(${masonryColumnCount}, minmax(0, 1fr))` }}
          >
            {masonryColumns.map((column, columnIndex) => (
              <div key={`column-${columnIndex}`} className="space-y-2.5 sm:space-y-4">
                {column.map((note) => (
                  <React.Fragment key={note.id}>
                    <NewsNoteCard note={note} locale={locale} isZh={isZh} onOpen={setOpenNote} />
                  </React.Fragment>
                ))}
              </div>
            ))}
          </section>

          <div
            ref={loadMoreRef}
            className="rounded-[22px] bg-[var(--surface-panel)] px-4 py-3 text-sm text-[var(--text-secondary)]"
          >
            {isContinuingFeed || isPrefetchingFeed
              ? isZh
                ? '正在加载更多资讯...'
                : 'Loading more stories...'
              : hasReachedLiveEdge
                ? isZh
                  ? '已看完最新资讯，稍后自动检查新内容...'
                  : "You're up to date. Checking for new stories soon..."
                : isZh
                  ? '继续下滑加载更多'
                  : 'Keep scrolling for more'}
          </div>
        </>
      ) : (
        <div className="rounded-[26px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-sm text-[var(--text-secondary)]">
          {isZh
            ? '当前频道还没有可显示的资讯。'
            : 'There are no visible stories in this channel right now.'}
        </div>
      )}

      <NewsDetailModal
        note={openNote}
        locale={locale}
        isZh={isZh}
        onClose={() => setOpenNote(null)}
      />
    </div>
  );
}
