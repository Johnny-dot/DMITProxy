import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Clock3, ExternalLink, Loader2, X } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/utils/cn';
import { getArticleContent } from '@/src/api/client';
import type { ArticleContent } from '@/src/api/portal';
import type { NewsNoteView } from './news-feed-model';
import { TOPIC_TONES, formatNewsDateTime } from './news-visuals';
import { NewsSourceAvatar } from './NewsSourceAvatar';

interface NewsDetailModalProps {
  note: NewsNoteView | null;
  locale: string;
  isZh: boolean;
  onClose: () => void;
}

export function NewsDetailModal({ note, locale, isZh, onClose }: NewsDetailModalProps) {
  useEffect(() => {
    if (!note) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [note, onClose]);

  return (
    <AnimatePresence>
      {note ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 z-[95] bg-[color:var(--overlay)] backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-x-3 bottom-3 top-3 z-[100] sm:inset-x-6 sm:bottom-6 sm:top-6"
          >
            <DetailSurface note={note} locale={locale} isZh={isZh} onClose={onClose} />
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function DetailSurface({
  note,
  locale,
  isZh,
  onClose,
}: {
  note: NewsNoteView;
  locale: string;
  isZh: boolean;
  onClose: () => void;
}) {
  const tone = TOPIC_TONES[note.topic.id];
  const publishedLabel = formatNewsDateTime(note.headline.publishedAt, locale);
  const sourceLabel = note.sourceDomain || note.authorName;
  const topicLabel = isZh ? note.topic.labelZh : note.topic.labelEn;

  const [articleContent, setArticleContent] = useState<ArticleContent | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  useEffect(() => {
    setArticleContent(null);
    const url = note.headline.url;
    if (!url || url.includes('news.google.com')) return;

    setIsLoadingContent(true);
    getArticleContent(url)
      .then((content) => {
        setArticleContent(content);
      })
      .catch(() => {
        setArticleContent({ paragraphs: [] });
      })
      .finally(() => {
        setIsLoadingContent(false);
      });
  }, [note.headline.url]);

  const displayParagraphs =
    articleContent && articleContent.paragraphs.length > 0 ? articleContent.paragraphs : null;

  return (
    <div className="mx-auto flex h-full max-w-[1780px] flex-col overflow-hidden rounded-[34px] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-strong)]">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.16em] uppercase',
                tone.chipClassName,
              )}
            >
              {topicLabel}
            </span>
            <span className="truncate rounded-full bg-[var(--surface-panel)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              {sourceLabel}
            </span>
          </div>
          <p className="truncate text-xs text-[var(--text-tertiary)]">{note.authorHandle}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-h-0 overflow-y-auto border-b border-[var(--border-subtle)] xl:border-b-0 xl:border-r">
          <article className="mx-auto flex max-w-4xl flex-col gap-6 p-5 sm:p-8">
            <div className="space-y-4 border-b border-[var(--border-subtle)] pb-6">
              <h2 className="text-[2rem] font-semibold leading-[1.02] tracking-[-0.055em] text-[var(--text-primary)] sm:text-[2.8rem]">
                {note.title}
              </h2>

              {note.excerpt ? (
                <p className="max-w-3xl text-[15px] leading-8 text-[var(--text-secondary)] sm:text-base">
                  {note.excerpt}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-tertiary)]">
                {publishedLabel !== '--' ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5" />
                    {publishedLabel}
                  </span>
                ) : null}
                <span>
                  {isZh ? '来源' : 'Source'}: {note.authorName}
                </span>
              </div>
            </div>

            {note.cardLayout === 'image' && note.headline.imageUrl ? (
              <figure className="overflow-hidden rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-panel)]">
                <div className="flex min-h-[260px] items-center justify-center bg-[var(--surface-panel)] p-3 sm:p-5">
                  <img
                    src={note.headline.imageUrl}
                    alt={note.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="max-h-[58vh] w-full rounded-[22px] object-contain"
                  />
                </div>
              </figure>
            ) : null}

            {isLoadingContent ? (
              <div className="flex items-center gap-3 rounded-[24px] bg-[var(--surface-panel)] px-5 py-5 text-sm text-[var(--text-tertiary)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isZh ? '正在加载完整内容…' : 'Loading full article…'}
              </div>
            ) : displayParagraphs ? (
              <div className="space-y-4 text-[15px] leading-8 text-[var(--text-secondary)]">
                {displayParagraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            ) : (
              <DetailBlocks note={note} isZh={isZh} />
            )}
          </article>
        </div>

        <aside className="min-h-0 overflow-y-auto bg-[color:color-mix(in_srgb,var(--surface-card)_76%,var(--surface-panel)_24%)] p-4 sm:p-5">
          <div className="space-y-5">
            <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <div className="flex min-w-0 items-center gap-3">
                <NewsSourceAvatar
                  sourceDomain={note.sourceDomain}
                  authorName={note.authorName}
                  sizeClassName="h-11 w-11"
                  fallbackClassName={tone.avatarClassName}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {note.authorName}
                  </p>
                  <p className="truncate text-xs text-[var(--text-tertiary)]">
                    {note.sourceDomain || note.authorHandle}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-4 text-sm">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
                <span className="text-[var(--text-tertiary)]">
                  {isZh ? '发布时间' : 'Published'}
                </span>
                <span className="text-right text-[var(--text-secondary)]">{publishedLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] py-3">
                <span className="text-[var(--text-tertiary)]">{isZh ? '来源' : 'Source'}</span>
                <span className="text-right text-[var(--text-secondary)]">{note.authorName}</span>
              </div>
              <div className="flex items-center justify-between gap-3 pt-3">
                <span className="text-[var(--text-tertiary)]">{isZh ? '域名' : 'Domain'}</span>
                <span className="text-right text-[var(--text-secondary)]">{sourceLabel}</span>
              </div>
            </div>

            <a
              href={note.headline.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-contrast)] transition-all hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
            >
              <ExternalLink className="h-4 w-4" />
              {isZh ? '查看原文' : 'Open original'}
            </a>

            <div className="space-y-2 rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                {isZh ? '标签' : 'Tags'}
              </p>
              <div className="flex flex-wrap gap-2">
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[var(--surface-panel)] px-3 py-1.5 text-sm text-[var(--text-secondary)]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function DetailBlocks({ note, isZh }: { note: NewsNoteView; isZh: boolean }) {
  if (note.detailBlocks.length === 0) {
    return (
      <div className="rounded-[24px] bg-[var(--surface-panel)] px-5 py-5 text-sm leading-7 text-[var(--text-secondary)]">
        {isZh
          ? '当前来源没有返回足够干净的摘要文本，请直接打开原文查看完整内容。'
          : 'No clean summary was available from this source. Open the original for the full article.'}
      </div>
    );
  }

  return (
    <div className="space-y-4 text-[15px] leading-8 text-[var(--text-secondary)]">
      {note.detailBlocks.map((block) => (
        <p
          key={block.id}
          className={cn(
            block.type === 'quote' &&
              'rounded-[22px] bg-[var(--surface-panel)] px-4 py-4 text-[var(--text-primary)]',
          )}
        >
          {block.content}
        </p>
      ))}
    </div>
  );
}
