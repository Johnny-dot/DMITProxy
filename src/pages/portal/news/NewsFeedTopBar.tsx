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
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="-mx-1 flex-1 overflow-x-auto px-1">
          <div className="flex min-w-max gap-1.5">
            {channels.map((channel) => {
              const active = channel.id === activeChannelId;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => onChannelChange(channel.id)}
                  className={cn(
                    'inline-flex min-h-8 items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-all',
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
            title={isZh ? '鍒锋柊' : 'Refresh'}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--surface-card)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-65"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
          </button>
        </div>
      </div>
    </section>
  );
}
