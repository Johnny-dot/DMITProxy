import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Clock3, ExternalLink, Loader2, X } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/utils/cn';
import { getArticleContent } from '@/src/api/client';
import type { ArticleContent } from '@/src/api/portal';
import type { NewsNoteView } from './news-feed-model';
import { TOPIC_TONES, formatNewsDateTime } from './news-visuals';
import { NewsSourceAvatar } from './NewsSourceAvatar';

const GLASS_BLUR_STYLE: React.CSSProperties = {
  backdropFilter: 'blur(var(--glass-blur)) saturate(185%)',
  WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(185%)',
};

const GLASS_BLUR_SOFT_STYLE: React.CSSProperties = {
  backdropFilter: 'blur(var(--glass-blur-soft)) saturate(180%)',
  WebkitBackdropFilter: 'blur(var(--glass-blur-soft)) saturate(180%)',
};

const ARTICLE_SHELL_STYLE: React.CSSProperties = {
  ...GLASS_BLUR_STYLE,
  background:
    'linear-gradient(180deg, var(--glass-specular) 0%, rgba(255,255,255,0.06) 22%, rgba(255,255,255,0.01) 100%), linear-gradient(135deg, color-mix(in srgb, var(--surface-card-strong) 88%, var(--surface-inline) 12%) 0%, color-mix(in srgb, var(--surface-card) 78%, var(--surface-panel) 22%) 100%)',
  boxShadow:
    'inset 0 1px 0 var(--glass-edge), inset 0 -1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(255,255,255,0.08), var(--shadow-strong)',
};

const MAIN_PANE_STYLE: React.CSSProperties = {
  ...GLASS_BLUR_SOFT_STYLE,
  background:
    'radial-gradient(circle at top left, var(--page-glow-2) 0%, transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.03) 100%), linear-gradient(135deg, color-mix(in srgb, var(--surface-card-strong) 82%, transparent 18%) 0%, color-mix(in srgb, var(--surface-panel) 70%, transparent 30%) 100%)',
};

const ASIDE_PANE_STYLE: React.CSSProperties = {
  ...GLASS_BLUR_SOFT_STYLE,
  background:
    'radial-gradient(circle at bottom right, var(--page-glow-3) 0%, transparent 42%), linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.02) 100%), linear-gradient(135deg, color-mix(in srgb, var(--surface-card-strong) 84%, transparent 16%) 0%, color-mix(in srgb, var(--surface-panel) 66%, var(--page-bg-deep) 34%) 100%)',
};

const READING_WELL_STYLE: React.CSSProperties = {
  ...GLASS_BLUR_SOFT_STYLE,
  background:
    'radial-gradient(circle at top right, var(--page-glow-2) 0%, transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 100%), linear-gradient(135deg, color-mix(in srgb, var(--surface-card-strong) 78%, var(--surface-inline) 22%) 0%, color-mix(in srgb, var(--surface-panel) 68%, transparent 32%) 100%)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.26), inset 0 -1px 0 rgba(255,255,255,0.04), 0 20px 46px rgba(53,74,105,0.12)',
};

const DETAIL_CARD_STYLE: React.CSSProperties = {
  ...GLASS_BLUR_SOFT_STYLE,
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 100%), linear-gradient(135deg, color-mix(in srgb, var(--surface-card-strong) 82%, var(--surface-inline) 18%) 0%, color-mix(in srgb, var(--surface-card) 70%, transparent 30%) 100%)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(255,255,255,0.04), 0 12px 28px rgba(53,74,105,0.1)',
};

interface NewsDetailModalProps {
  note: NewsNoteView | null;
  locale: string;
  isZh: boolean;
  onClose: () => void;
}

export function NewsDetailModal({ note, locale, isZh, onClose }: NewsDetailModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!note) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    previousFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const moveFocusInside = () => {
      const first = panelRef.current?.querySelector<HTMLElement>(focusableSelector);
      (first ?? panelRef.current)?.focus({ preventScroll: true });
    };
    // Defer one frame so the panel and its content have mounted.
    const focusHandle = window.setTimeout(moveFocusInside, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusables: HTMLElement[] = (
        Array.from(panelRef.current.querySelectorAll(focusableSelector)) as HTMLElement[]
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(focusHandle);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, [note, onClose]);

  const prefersExpandedSurface = Boolean(
    note && note.cardLayout === 'image' && note.headline.imageUrl,
  );

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
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 z-[100] p-3 sm:p-6 xl:p-10 focus:outline-none"
          >
            <div className="flex h-full items-stretch justify-center">
              <DetailSurface
                note={note}
                locale={locale}
                isZh={isZh}
                onClose={onClose}
                prefersExpandedSurface={prefersExpandedSurface}
                titleId={titleId}
              />
            </div>
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
  prefersExpandedSurface,
  titleId,
}: {
  note: NewsNoteView;
  locale: string;
  isZh: boolean;
  onClose: () => void;
  prefersExpandedSurface: boolean;
  titleId: string;
}) {
  const tone = TOPIC_TONES[note.topic.id];
  const publishedLabel = formatNewsDateTime(note.headline.publishedAt, locale);
  const sourceLabel = note.sourceDomain || note.authorName;
  const topicLabel = isZh ? note.topic.labelZh : note.topic.labelEn;
  const hasHeroImage = note.cardLayout === 'image' && Boolean(note.headline.imageUrl);

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
    <div
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'flex w-full flex-col overflow-hidden rounded-[28px] border border-[color:color-mix(in_srgb,var(--border-strong)_62%,var(--border-subtle)_38%)] shadow-[var(--shadow-strong)] sm:rounded-[34px]',
        'h-full sm:h-[calc(100vh-3rem)] lg:h-[calc(100vh-5rem)] xl:h-[calc(100vh-6rem)] xl:max-h-[860px]',
        prefersExpandedSurface
          ? 'max-w-[1260px] 2xl:max-w-[1360px]'
          : 'max-w-[1020px] xl:max-w-[1100px]',
      )}
      style={ARTICLE_SHELL_STYLE}
    >
      <div
        className="flex items-center justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--border-strong)_48%,var(--border-subtle)_52%)] bg-[color:color-mix(in_srgb,var(--surface-card)_76%,var(--surface-inline)_24%)] px-3 py-2.5 sm:px-5 sm:py-3"
        style={GLASS_BLUR_SOFT_STYLE}
      >
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
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 sm:h-10 sm:w-10"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div
          className="min-h-0 min-w-0 flex flex-col xl:border-r xl:border-[color:color-mix(in_srgb,var(--border-strong)_42%,var(--border-subtle)_58%)]"
          style={MAIN_PANE_STYLE}
        >
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
            <article
              className={cn(
                'mx-auto flex min-w-0 w-full flex-col gap-5 p-4 sm:gap-6 sm:p-8',
                hasHeroImage ? 'max-w-4xl' : 'max-w-[920px]',
              )}
            >
              <div className="space-y-4 border-b border-[color:color-mix(in_srgb,var(--border-strong)_40%,var(--border-subtle)_60%)] pb-5 sm:pb-6">
                <h2
                  id={titleId}
                  className="max-w-[20ch] break-words text-[1.72rem] font-semibold leading-[1.01] tracking-[-0.055em] text-[var(--text-primary)] sm:text-[2.3rem] lg:text-[2.7rem]"
                >
                  {note.title}
                </h2>

                {note.excerpt ? (
                  <p className="max-w-[66ch] break-words text-[15px] font-medium leading-8 tracking-[-0.012em] text-[color:color-mix(in_srgb,var(--text-primary)_82%,var(--text-secondary)_18%)] [overflow-wrap:anywhere] sm:text-[16px]">
                    {note.excerpt}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[var(--text-tertiary)]">
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

              {hasHeroImage ? (
                <figure
                  className="overflow-hidden rounded-[28px] border border-[color:color-mix(in_srgb,var(--border-strong)_42%,var(--border-subtle)_58%)] bg-[var(--surface-panel)] shadow-[0_16px_40px_rgba(53,74,105,0.12)] sm:rounded-[32px]"
                  style={GLASS_BLUR_SOFT_STYLE}
                >
                  <div className="flex min-h-[220px] items-center justify-center bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-panel-strong)_74%,var(--surface-card)_26%)_0%,color-mix(in_srgb,var(--surface-panel)_88%,transparent_12%)_100%)] p-3 sm:min-h-[260px] sm:p-5">
                    <img
                      src={note.headline.imageUrl}
                      alt={note.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="max-h-[44vh] w-full rounded-[22px] object-contain sm:max-h-[58vh] sm:rounded-[24px]"
                    />
                  </div>
                </figure>
              ) : null}

              {isLoadingContent ? (
                <ReadingWell className="flex items-center gap-3 px-5 py-5 text-sm text-[var(--text-tertiary)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isZh ? '正在加载完整内容…' : 'Loading full article…'}
                </ReadingWell>
              ) : displayParagraphs ? (
                <ReadingWell className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
                  {displayParagraphs.map((paragraph, index) => (
                    <p
                      key={index}
                      className="max-w-[68ch] break-words text-[16px] leading-[1.95] tracking-[-0.015em] text-[color:color-mix(in_srgb,var(--text-primary)_86%,var(--text-secondary)_14%)] [overflow-wrap:anywhere]"
                    >
                      {paragraph}
                    </p>
                  ))}
                </ReadingWell>
              ) : (
                <DetailBlocks note={note} isZh={isZh} />
              )}

              {note.tags.length > 0 ? (
                <div className="space-y-2 xl:hidden">
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
              ) : null}
            </article>
          </div>

          <div
            className="border-t border-[color:color-mix(in_srgb,var(--border-strong)_36%,var(--border-subtle)_64%)] bg-[color:color-mix(in_srgb,var(--surface-card)_84%,var(--surface-panel)_16%)] p-3 sm:p-4 xl:hidden"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            <OriginalArticleLink note={note} isZh={isZh} />
          </div>
        </div>

        <aside
          className="hidden min-h-0 overflow-y-auto p-4 sm:p-5 xl:block"
          style={ASIDE_PANE_STYLE}
        >
          <div className="space-y-5">
            <div
              className="rounded-[24px] border border-[color:color-mix(in_srgb,var(--border-strong)_32%,var(--border-subtle)_68%)] p-4"
              style={DETAIL_CARD_STYLE}
            >
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

            <div
              className="rounded-[24px] border border-[color:color-mix(in_srgb,var(--border-strong)_32%,var(--border-subtle)_68%)] px-4 py-4 text-sm"
              style={DETAIL_CARD_STYLE}
            >
              <div className="flex items-center justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--border-strong)_32%,var(--border-subtle)_68%)] pb-3">
                <span className="text-[var(--text-tertiary)]">
                  {isZh ? '发布时间' : 'Published'}
                </span>
                <span className="text-right text-[var(--text-secondary)]">{publishedLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--border-strong)_32%,var(--border-subtle)_68%)] py-3">
                <span className="text-[var(--text-tertiary)]">{isZh ? '来源' : 'Source'}</span>
                <span className="text-right text-[var(--text-secondary)]">{note.authorName}</span>
              </div>
              <div className="flex items-center justify-between gap-3 pt-3">
                <span className="text-[var(--text-tertiary)]">{isZh ? '域名' : 'Domain'}</span>
                <span className="text-right text-[var(--text-secondary)]">{sourceLabel}</span>
              </div>
            </div>

            <OriginalArticleLink note={note} isZh={isZh} />

            {note.tags.length > 0 ? (
              <div
                className="space-y-2 rounded-[24px] border border-[color:color-mix(in_srgb,var(--border-strong)_32%,var(--border-subtle)_68%)] p-4"
                style={DETAIL_CARD_STYLE}
              >
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
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ReadingWell({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-[28px] border border-[color:color-mix(in_srgb,var(--border-strong)_38%,var(--border-subtle)_62%)]',
        className,
      )}
      style={READING_WELL_STYLE}
    >
      {children}
    </div>
  );
}

function OriginalArticleLink({ note, isZh }: { note: NewsNoteView; isZh: boolean }) {
  return (
    <a
      href={note.headline.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--accent-border)] bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-4 text-sm font-medium text-[var(--accent-contrast)] shadow-[0_16px_34px_rgba(77,124,255,0.24)] transition-all hover:-translate-y-0.5 hover:brightness-[1.03]"
    >
      <ExternalLink className="h-4 w-4" />
      {isZh ? '查看原文' : 'Open original'}
    </a>
  );
}

function DetailBlocks({ note, isZh }: { note: NewsNoteView; isZh: boolean }) {
  if (note.detailBlocks.length === 0) {
    return (
      <ReadingWell className="px-5 py-5 text-sm leading-7 text-[color:color-mix(in_srgb,var(--text-primary)_80%,var(--text-secondary)_20%)]">
        {isZh
          ? '当前来源没有返回足够干净的摘要文本，请直接打开原文查看完整内容。'
          : 'No clean summary was available from this source. Open the original for the full article.'}
      </ReadingWell>
    );
  }

  return (
    <ReadingWell className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
      {note.detailBlocks.map((block) => (
        <p
          key={block.id}
          className={cn(
            'max-w-[68ch] break-words text-[16px] leading-[1.95] tracking-[-0.015em] text-[color:color-mix(in_srgb,var(--text-primary)_86%,var(--text-secondary)_14%)] [overflow-wrap:anywhere]',
            block.type === 'quote' &&
              'rounded-[22px] border border-[color:color-mix(in_srgb,var(--border-strong)_30%,var(--border-subtle)_70%)] bg-[color:color-mix(in_srgb,var(--surface-panel)_90%,var(--surface-inline)_10%)] px-4 py-4 text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]',
          )}
        >
          {block.content}
        </p>
      ))}
    </ReadingWell>
  );
}
