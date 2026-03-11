import React from 'react';
import { Clock3 } from 'lucide-react';
import { cn } from '@/src/utils/cn';
import { TOPIC_TONES, formatNewsDateTime } from './news-visuals';
import type { NewsNoteView } from './news-feed-model';
import { NewsSourceAvatar } from './NewsSourceAvatar';

interface NewsNoteCardProps extends React.Attributes {
  note: NewsNoteView;
  locale: string;
  isZh: boolean;
  onOpen: (note: NewsNoteView) => void;
}

export function NewsNoteCard({ note, locale, isZh, onOpen }: NewsNoteCardProps) {
  const tone = TOPIC_TONES[note.topic.id];
  const summary = note.excerpt.trim();
  const publishedLabel = formatNewsDateTime(note.headline.publishedAt, locale);
  const sourceLabel = note.sourceDomain || note.authorName;

  return (
    <article className="break-inside-avoid">
      <button
        type="button"
        onClick={() => onOpen(note)}
        className="group block w-full overflow-hidden rounded-[20px] bg-[var(--surface-card)] text-left transition-all duration-200 hover:-translate-y-1 sm:rounded-[26px] sm:border sm:border-[var(--border-subtle)] sm:shadow-[var(--shadow-card)] sm:hover:shadow-[var(--shadow-strong)]"
      >
        {note.cardLayout === 'image' && note.headline.imageUrl ? (
          <div className="overflow-hidden">
            <div className="relative" style={{ aspectRatio: note.coverAspectRatio }}>
              <img
                src={note.headline.imageUrl}
                alt={note.title}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,12,0.03)_0%,rgba(8,10,12,0.08)_60%,rgba(8,10,12,0.18)_100%)]" />
              <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-2.5 sm:p-4">
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] uppercase backdrop-blur-sm sm:px-3 sm:text-[11px] sm:tracking-[0.16em]',
                    tone.chipClassName,
                  )}
                >
                  {isZh ? note.topic.labelZh : note.topic.labelEn}
                </span>
                <span className="hidden rounded-full bg-[rgba(16,18,20,0.55)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white backdrop-blur-sm sm:block">
                  {sourceLabel}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="flex min-h-[180px] flex-col justify-between p-4 sm:min-h-[220px] sm:p-5"
            style={{ backgroundImage: tone.textCoverStyle }}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.16em] uppercase',
                  tone.chipClassName,
                )}
              >
                {isZh ? note.topic.labelZh : note.topic.labelEn}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                {sourceLabel}
              </span>
            </div>

            <div className="mt-8 space-y-3">
              <h3 className="line-clamp-4 text-[1.18rem] font-semibold leading-[1.1] tracking-[-0.04em] text-[var(--text-primary)] sm:text-[1.48rem] sm:leading-[1.08] sm:tracking-[-0.045em]">
                {note.title}
              </h3>
              {summary ? (
                <p className="line-clamp-3 text-sm leading-7 text-[var(--text-secondary)]">
                  {summary}
                </p>
              ) : null}
            </div>
          </div>
        )}

        <div className="space-y-2 p-2.5 sm:space-y-3 sm:p-4">
          {note.cardLayout === 'image' ? (
            <div className="space-y-1 sm:space-y-2">
              <h3 className="line-clamp-2 text-[0.82rem] font-semibold leading-5 text-[var(--text-primary)] sm:text-[1.02rem] sm:leading-6">
                {note.title}
              </h3>
              {summary ? (
                <p className="hidden line-clamp-2 text-sm leading-6 text-[var(--text-secondary)] sm:block">
                  {summary}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex min-w-0 items-center gap-2">
            <NewsSourceAvatar
              sourceDomain={note.sourceDomain}
              authorName={note.authorName}
              sizeClassName="h-7 w-7 sm:h-9 sm:w-9"
              fallbackClassName={tone.avatarClassName}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[var(--text-primary)] sm:text-sm">
                {note.authorName}
              </p>
              <p className="hidden truncate text-xs text-[var(--text-tertiary)] sm:block">
                {note.authorHandle}
              </p>
            </div>
            {publishedLabel !== '--' ? (
              <span className="hidden shrink-0 items-center gap-1.5 text-xs text-[var(--text-tertiary)] sm:inline-flex">
                <Clock3 className={cn('h-3.5 w-3.5', tone.iconClassName)} />
                {publishedLabel}
              </span>
            ) : null}
          </div>

          <div className="hidden items-center justify-between gap-3 text-xs text-[var(--text-tertiary)] sm:flex">
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {note.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--surface-panel)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <span className="truncate text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              {sourceLabel}
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}
