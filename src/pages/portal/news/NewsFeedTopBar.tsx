import React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/src/utils/cn';
import type { NewsChannel, NewsChannelId } from './news-feed-model';

interface NewsFeedTopBarProps {
  channels: NewsChannel[];
  activeChannelId: NewsChannelId;
  updatedLabel?: string;
  isRefreshing: boolean;
  isZh: boolean;
  onChannelChange: (channelId: NewsChannelId) => void;
  onRefresh: () => void;
}

export function NewsFeedTopBar({
  channels,
  activeChannelId,
  updatedLabel,
  isRefreshing,
  isZh,
  onChannelChange,
  onRefresh,
}: NewsFeedTopBarProps) {
  return (
    <section className="sticky top-0 z-20 -mx-4 border-b border-[var(--border-subtle)] bg-[var(--surface-card)] sm:mx-0 sm:rounded-[24px] sm:border">
      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-2.5">
        <div
          className="-mx-1 flex-1 overflow-x-auto overscroll-x-contain px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            maskImage:
              'linear-gradient(to right, transparent 0, #000 12px, #000 calc(100% - 24px), transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0, #000 12px, #000 calc(100% - 24px), transparent 100%)',
          }}
        >
          <div className="flex min-w-max gap-1.5">
            {channels.map((channel) => {
              const active = channel.id === activeChannelId;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => onChannelChange(channel.id)}
                  className={cn(
                    'inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-all sm:min-h-8 sm:py-1.5',
                    active
                      ? 'bg-[var(--text-primary)] text-[var(--surface-card)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-panel)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {isZh ? channel.labelZh : channel.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {updatedLabel ? (
            <span className="hidden rounded-full bg-[var(--surface-panel)] px-3 py-1 text-[11px] text-[var(--text-tertiary)] lg:inline-flex">
              {updatedLabel}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={isZh ? '刷新' : 'Refresh'}
            title={isZh ? '刷新' : 'Refresh'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--surface-card)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-65 sm:h-9 sm:w-9"
          >
            <RefreshCw
              className={cn('h-4 w-4 sm:h-3.5 sm:w-3.5', isRefreshing && 'animate-spin')}
            />
          </button>
        </div>
      </div>
    </section>
  );
}
