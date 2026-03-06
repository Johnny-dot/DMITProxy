import React from 'react';
import { useI18n } from '@/src/context/I18nContext';
import { Button } from '@/src/components/ui/Button';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { cn } from '@/src/utils/cn';
import { formatTraffic } from '@/src/utils/xuiClients';
import type { PortalSettings, UserInfo, PortalTab, ClientStats } from './types';
import { toMillis } from './types';

interface HomeTabProps {
  isAdminView: boolean;
  context: { user: UserInfo; settings: PortalSettings } | null;
  effectiveSettings: PortalSettings | null;
  hasSubscription: boolean;
  subscriptionUniversalUrl: string;
  clientStats?: ClientStats;
  isStatsLoading?: boolean;
  onCopy: (text: string, key: string) => void;
  onSetSection: (tab: PortalTab) => void;
  onNavigate: (path: string) => void;
}

export function HomeTab({
  isAdminView,
  context,
  effectiveSettings,
  hasSubscription,
  subscriptionUniversalUrl,
  clientStats,
  isStatsLoading,
  onCopy,
  onSetSection,
  onNavigate,
}: HomeTabProps) {
  const { language } = useI18n();
  const isZh = language === 'zh-CN';

  const latestAnnouncement = effectiveSettings?.announcementActive
    ? effectiveSettings.announcementText.trim()
    : '';
  const supportContact = effectiveSettings?.supportTelegram ?? '';

  const formatDateTime = (value: number) =>
    new Date(toMillis(value)).toLocaleString(isZh ? 'zh-CN' : 'en-US', { hour12: false });

  if (isAdminView) {
    return (
      <section className="grid gap-6 md:grid-cols-2">
        <div
          className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4"
          data-testid="subscription-home-account-status"
        >
          <h2 className="text-lg font-semibold">{isZh ? '管理视图' : 'Management overview'}</h2>
          <div className="space-y-2 text-sm">
            <p className="text-zinc-300">
              <span className="text-zinc-500">{isZh ? '当前身份：' : 'Current role: '}</span>
              {isZh ? '管理员' : 'Administrator'}
            </p>
            <p className="text-zinc-300">
              <span className="text-zinc-500">{isZh ? '入口：' : 'Workspace: '}</span>
              {isZh ? '统一用户中心' : 'Unified user center'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => onSetSection('management')}>
              {isZh ? '打开管理功能' : 'Open management'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate('/settings')}>
              {isZh ? '进入设置' : 'Open settings'}
            </Button>
          </div>
        </div>

        <AdminMessagesCard
          isZh={isZh}
          latestAnnouncement={latestAnnouncement}
          supportContact={supportContact}
          onViewAll={() => onSetSection('notifications')}
        />
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 md:grid-cols-2">
        <div
          className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4"
          data-testid="subscription-home-account-status"
        >
          <h2 className="text-lg font-semibold">{isZh ? '账户状态' : 'Account status'}</h2>
          <div className="space-y-2 text-sm">
            <p className="text-zinc-300">
              <span className="text-zinc-500">{isZh ? '用户名：' : 'Username: '}</span>
              {context?.user.username}
            </p>
            <p className="text-zinc-300">
              <span className="text-zinc-500">{isZh ? '创建时间：' : 'Created at: '}</span>
              {context ? formatDateTime(context.user.createdAt) : '-'}
            </p>
            <p
              className={`font-medium ${hasSubscription ? 'text-emerald-300' : 'text-amber-300'}`}
              data-testid="subscription-home-status"
            >
              {hasSubscription
                ? isZh
                  ? '订阅已就绪，可随时导入客户端。'
                  : 'Subscription is active and ready to import.'
                : isZh
                  ? '订阅尚未分配，请联系管理员。'
                  : 'Subscription is not assigned yet. Contact your admin.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onSetSection('subscription');
                onCopy(subscriptionUniversalUrl, 'home-universal');
              }}
              disabled={!hasSubscription}
            >
              {isZh ? '复制通用订阅' : 'Copy Universal Link'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onSetSection('subscription')}>
              {isZh ? '打开订阅中心' : 'Open Subscription Center'}
            </Button>
          </div>
        </div>

        <AdminMessagesCard
          isZh={isZh}
          latestAnnouncement={latestAnnouncement}
          supportContact={supportContact}
          onViewAll={() => onSetSection('notifications')}
        />
      </section>

      {/* Traffic stats — only for users with a subscription */}
      {hasSubscription && (
        <TrafficStatsCard isZh={isZh} stats={clientStats} isLoading={isStatsLoading} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared card used by both admin and user home views
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Traffic stats card
// ---------------------------------------------------------------------------

function TrafficStatsCard({
  isZh,
  stats,
  isLoading,
}: {
  isZh: boolean;
  stats?: ClientStats;
  isLoading?: boolean;
}) {
  const trafficUsed = stats ? stats.up + stats.down : 0;
  const usagePercent =
    stats && stats.total > 0 ? Math.min((trafficUsed / stats.total) * 100, 100) : 0;

  const formatExpiry = (ms: number) => {
    if (ms === 0) return isZh ? '永不到期' : 'Never';
    return new Date(ms).toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpired = stats && stats.expiryTime > 0 && stats.expiryTime < Date.now();

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-5">
      <h2 className="text-lg font-semibold">{isZh ? '使用情况' : 'Usage'}</h2>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-2 w-full" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      ) : !stats ? (
        <p className="text-sm text-zinc-500">
          {isZh ? '暂无使用数据，稍后再试。' : 'No usage data available yet.'}
        </p>
      ) : (
        <div className="space-y-4">
          {/* Traffic bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">{isZh ? '流量' : 'Traffic'}</span>
              <span className="font-medium text-zinc-200">
                {formatTraffic(trafficUsed)}
                {stats.total > 0 && (
                  <span className="text-zinc-500"> / {formatTraffic(stats.total)}</span>
                )}
              </span>
            </div>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  usagePercent < 50
                    ? 'bg-emerald-500'
                    : usagePercent < 80
                      ? 'bg-yellow-500'
                      : 'bg-red-500',
                )}
                style={{ width: `${stats.total > 0 ? usagePercent : 0}%` }}
              />
            </div>
            {stats.total === 0 && (
              <p className="text-xs text-zinc-500">{isZh ? '无限流量' : 'Unlimited traffic'}</p>
            )}
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-zinc-950/60 border border-white/5 p-3 space-y-1">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wide">
                {isZh ? '上传' : 'Upload'}
              </p>
              <p className="text-sm font-medium text-zinc-200">{formatTraffic(stats.up)}</p>
            </div>
            <div className="rounded-xl bg-zinc-950/60 border border-white/5 p-3 space-y-1">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wide">
                {isZh ? '下载' : 'Download'}
              </p>
              <p className="text-sm font-medium text-zinc-200">{formatTraffic(stats.down)}</p>
            </div>
            <div className="rounded-xl bg-zinc-950/60 border border-white/5 p-3 space-y-1">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wide">
                {isZh ? '到期' : 'Expires'}
              </p>
              <p
                className={cn('text-sm font-medium', isExpired ? 'text-red-400' : 'text-zinc-200')}
              >
                {formatExpiry(stats.expiryTime)}
              </p>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-zinc-500">
            <span>
              {isZh ? '协议：' : 'Protocol: '}
              <span className="text-zinc-300 font-medium uppercase">{stats.protocol}</span>
            </span>
            <span className={cn('font-medium', stats.enable ? 'text-emerald-400' : 'text-red-400')}>
              {stats.enable ? (isZh ? '● 已启用' : '● Active') : isZh ? '● 已禁用' : '● Disabled'}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared card used by both admin and user home views
// ---------------------------------------------------------------------------

function AdminMessagesCard({
  isZh,
  latestAnnouncement,
  supportContact,
  onViewAll,
}: {
  isZh: boolean;
  latestAnnouncement: string;
  supportContact: string;
  onViewAll: () => void;
}) {
  const hasContent = Boolean(latestAnnouncement || supportContact);

  return (
    <div
      className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4"
      data-testid="subscription-home-admin-messages"
    >
      <h2 className="text-lg font-semibold">{isZh ? '管理员消息' : 'Admin messages'}</h2>

      {hasContent ? (
        <div className="space-y-3">
          {latestAnnouncement && (
            <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-4 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {latestAnnouncement}
            </div>
          )}
          {supportContact && (
            <p className="text-sm text-zinc-300">
              <span className="text-zinc-500">{isZh ? '联系方式：' : 'Support: '}</span>
              {supportContact}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-600 italic">{isZh ? '暂无公告' : 'No announcements'}</p>
      )}

      <Button variant="outline" size="sm" onClick={onViewAll}>
        {isZh ? '查看全部通知' : 'View all notifications'}
      </Button>
    </div>
  );
}
