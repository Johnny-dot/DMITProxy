import React from 'react';
import { useI18n } from '@/src/context/I18nContext';
import { Button } from '@/src/components/ui/Button';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { cn } from '@/src/utils/cn';
import { formatTraffic } from '@/src/utils/xuiClients';
import type { NodeQualityProfile } from '@/src/types/nodeQuality';
import type { ClientStats, PortalSettings, PortalTab, UserInfo } from './types';
import { toMillis } from './types';
import { NodeQualityCard } from './NodeQualityCard';

interface HomeTabProps {
  isAdminView: boolean;
  context: { user: UserInfo; settings: PortalSettings } | null;
  effectiveSettings: PortalSettings | null;
  hasSubscription: boolean;
  subscriptionUniversalUrl: string;
  clientStats?: ClientStats;
  nodeQuality?: NodeQualityProfile | null;
  isStatsLoading?: boolean;
  onCopy: (text: string, key: string) => void;
  onSetSection: (tab: PortalTab) => void;
  onNavigate: (path: string) => void;
  showMessagesCard?: boolean;
}

export function HomeTab({
  isAdminView,
  context,
  effectiveSettings,
  hasSubscription,
  subscriptionUniversalUrl,
  clientStats,
  nodeQuality,
  isStatsLoading,
  onCopy,
  onSetSection,
  onNavigate,
  showMessagesCard = true,
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
      <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div
          className="surface-card space-y-6 p-6 md:p-7"
          data-testid="subscription-home-account-status"
        >
          <div className="space-y-3">
            <p className="section-kicker">{isZh ? '管理视图' : 'Management overview'}</p>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
              {isZh ? '统一用户中心与管理入口' : 'Unified user center with management access'}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-zinc-400">
              {isZh
                ? '管理员在这里可以快速切到用户管理、订阅交付和公告配置，同时保持与用户侧一致的产品语言。'
                : 'Admins can move between user management, subscription delivery, and announcements without leaving the same product rhythm.'}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="surface-panel p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                {isZh ? '当前角色' : 'Current role'}
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-50">
                {isZh ? '管理员' : 'Administrator'}
              </p>
            </div>
            <div className="surface-panel p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                {isZh ? '工作区' : 'Workspace'}
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-50">
                {isZh ? '统一用户中心' : 'Unified user center'}
              </p>
            </div>
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
      {showMessagesCard ? (
        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <OverviewCard
            context={context}
            hasSubscription={hasSubscription}
            subscriptionUniversalUrl={subscriptionUniversalUrl}
            onCopy={onCopy}
            onSetSection={onSetSection}
            formatDateTime={formatDateTime}
          />

          <AdminMessagesCard
            isZh={isZh}
            latestAnnouncement={latestAnnouncement}
            supportContact={supportContact}
            onViewAll={() => onSetSection('notifications')}
          />
        </section>
      ) : (
        <OverviewCard
          context={context}
          hasSubscription={hasSubscription}
          subscriptionUniversalUrl={subscriptionUniversalUrl}
          onCopy={onCopy}
          onSetSection={onSetSection}
          formatDateTime={formatDateTime}
        />
      )}

      {hasSubscription && (
        <TrafficStatsCard isZh={isZh} stats={clientStats} isLoading={isStatsLoading} />
      )}

      {hasSubscription && clientStats && (
        <NodeQualityCard
          isZh={isZh}
          inboundRemark={clientStats.inboundRemark}
          profile={nodeQuality}
        />
      )}
    </div>
  );
}

function OverviewCard({
  context,
  hasSubscription,
  subscriptionUniversalUrl,
  onCopy,
  onSetSection,
  formatDateTime,
}: {
  context: { user: UserInfo; settings: PortalSettings } | null;
  hasSubscription: boolean;
  subscriptionUniversalUrl: string;
  onCopy: (text: string, key: string) => void;
  onSetSection: (tab: PortalTab) => void;
  formatDateTime: (value: number) => string;
}) {
  const { language } = useI18n();
  const isZh = language === 'zh-CN';

  return (
    <section
      className="surface-card space-y-6 p-6 md:p-7"
      data-testid="subscription-home-account-status"
    >
      <div className="space-y-3">
        <p className="section-kicker">{isZh ? '账户概览' : 'Account overview'}</p>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
          {isZh
            ? '你的订阅与客户端入口都在这里。'
            : 'Your subscription and client entry stay here.'}
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-zinc-400">
          {isZh
            ? '注册完成后，你可以继续在这个页面查看订阅状态、复制链接、下载客户端。'
            : 'After onboarding, this page remains the quiet place to check status, copy links, and download clients.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="surface-panel p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            {isZh ? '用户名' : 'Username'}
          </p>
          <p className="mt-2 text-sm font-medium text-zinc-50">{context?.user.username ?? '-'}</p>
        </div>

        <div className="surface-panel p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            {isZh ? '创建时间' : 'Created at'}
          </p>
          <p className="mt-2 text-sm font-medium text-zinc-50">
            {context ? formatDateTime(context.user.createdAt) : '-'}
          </p>
        </div>
      </div>

      <div
        className={cn(
          'surface-panel p-4 text-sm font-medium',
          hasSubscription ? 'text-emerald-500' : 'text-amber-500',
        )}
        data-testid="subscription-home-status"
      >
        {hasSubscription
          ? isZh
            ? '订阅已就绪，可以随时复制并导入客户端。'
            : 'Your subscription is ready to copy and import.'
          : isZh
            ? '订阅尚未分配，请联系管理员。'
            : 'No subscription has been assigned yet. Contact your admin.'}
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
          {isZh ? '复制通用订阅' : 'Copy universal link'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => onSetSection('subscription')}>
          {isZh ? '打开订阅中心' : 'Open subscription center'}
        </Button>
      </div>
    </section>
  );
}

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
    if (ms === 0) return isZh ? '永不过期' : 'Never';
    return new Date(ms).toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpired = Boolean(stats && stats.expiryTime > 0 && stats.expiryTime < Date.now());

  return (
    <section className="surface-card space-y-5 p-6 md:p-7">
      <div className="space-y-2">
        <p className="section-kicker">{isZh ? '使用情况' : 'Usage'}</p>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
          {isZh ? '当前流量、到期时间与连接状态' : 'Traffic, expiry, and connection status'}
        </h2>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-2 w-full" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      ) : !stats ? (
        <p className="text-sm leading-6 text-zinc-500">
          {isZh ? '暂时没有可用的流量数据，请稍后再试。' : 'No usage data is available yet.'}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">{isZh ? '流量' : 'Traffic'}</span>
              <span className="font-medium text-zinc-50">
                {formatTraffic(trafficUsed)}
                {stats.total > 0 && (
                  <span className="text-zinc-500"> / {formatTraffic(stats.total)}</span>
                )}
              </span>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  usagePercent < 50
                    ? 'bg-emerald-500'
                    : usagePercent < 80
                      ? 'bg-amber-500'
                      : 'bg-red-500',
                )}
                style={{ width: `${stats.total > 0 ? usagePercent : 0}%` }}
              />
            </div>

            {stats.total === 0 && (
              <p className="text-xs text-zinc-500">{isZh ? '不限流量' : 'Unlimited traffic'}</p>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <MetricPanel label={isZh ? '上传' : 'Upload'} value={formatTraffic(stats.up)} />
            <MetricPanel label={isZh ? '下载' : 'Download'} value={formatTraffic(stats.down)} />
            <MetricPanel
              label={isZh ? '到期' : 'Expires'}
              value={formatExpiry(stats.expiryTime)}
              valueClassName={cn(isExpired && 'text-red-500')}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
            <span>
              {isZh ? '协议：' : 'Protocol: '}
              <span className="font-medium uppercase text-zinc-300">{stats.protocol}</span>
            </span>
            <span className={cn('font-medium', stats.enable ? 'text-emerald-500' : 'text-red-500')}>
              {stats.enable ? (isZh ? '已启用' : 'Active') : isZh ? '已停用' : 'Disabled'}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricPanel({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="surface-panel p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className={cn('mt-2 text-sm font-medium text-zinc-50', valueClassName)}>{value}</p>
    </div>
  );
}

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
      className="surface-card space-y-5 p-6 md:p-7"
      data-testid="subscription-home-admin-messages"
    >
      <div className="space-y-2">
        <p className="section-kicker">{isZh ? '管理员消息' : 'Admin messages'}</p>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
          {isZh ? '公告与支持联系方式' : 'Announcements and support contact'}
        </h2>
      </div>

      {hasContent ? (
        <div className="space-y-3">
          {latestAnnouncement && (
            <div className="surface-panel whitespace-pre-wrap p-4 text-sm leading-7 text-zinc-300">
              {latestAnnouncement}
            </div>
          )}

          {supportContact && (
            <div className="surface-panel p-4 text-sm leading-7 text-zinc-300">
              <span className="text-zinc-500">{isZh ? '支持方式：' : 'Support: '}</span>
              {supportContact}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm leading-6 text-zinc-500">
          {isZh ? '暂时没有新的公告。' : 'No announcements are available yet.'}
        </p>
      )}

      <Button variant="outline" size="sm" onClick={onViewAll}>
        {isZh ? '查看全部通知' : 'View all notifications'}
      </Button>
    </div>
  );
}
