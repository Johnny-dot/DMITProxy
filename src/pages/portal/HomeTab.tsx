import React from 'react';
import type { ServerStatus } from '@/src/api/xui';
import { useI18n } from '@/src/context/I18nContext';
import { Button } from '@/src/components/ui/Button';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { ServerStatusCard } from '@/src/components/status/ServerStatusCard';
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
  serverStatus?: ServerStatus | null;
  nodeQuality?: NodeQualityProfile | null;
  isStatsLoading?: boolean;
  onRefreshNodeQuality?: () => void;
  isRefreshingNodeQuality?: boolean;
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
  serverStatus,
  nodeQuality,
  isStatsLoading,
  onRefreshNodeQuality,
  isRefreshingNodeQuality,
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
                ? '管理员可以在同一套界面里快速切到用户管理、订阅交付和公告配置。'
                : 'Admins can move between user management, subscription delivery, and announcements in one place.'}
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
          actionLabel={isZh ? '查看全部通知' : 'View all notifications'}
          onAction={() => onSetSection('notifications')}
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

      {hasSubscription ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <TrafficStatsCard
            isZh={isZh}
            stats={clientStats}
            isLoading={isStatsLoading}
            className="min-w-0 h-full"
          />
          <ServerStatusCard
            serverStatus={serverStatus}
            isLoading={isStatsLoading}
            className="min-w-0 h-full"
          />
        </section>
      ) : (
        <ServerStatusCard serverStatus={serverStatus} isLoading={isStatsLoading} />
      )}

      {hasSubscription && clientStats && (
        <NodeQualityCard
          isZh={isZh}
          inboundRemark={clientStats.inboundRemark}
          profile={nodeQuality}
          onRefresh={onRefreshNodeQuality}
          isRefreshing={isRefreshingNodeQuality}
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
  const createdAtHelpText = isZh
    ? '这是你的账号创建时间。'
    : 'This is when your account was created.';

  return (
    <section
      className="surface-card space-y-6 p-6 md:p-7"
      data-testid="subscription-home-account-status"
    >
      <div className="space-y-3">
        <p className="section-kicker">{isZh ? '账户概览' : 'Account overview'}</p>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
          {isZh ? '你的账号和线路状态。' : 'Your account and route status.'}
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-zinc-400">
          {isZh
            ? '先看看订阅是否可用、流量还有多少，再继续复制链接或下载客户端。'
            : 'Check whether your subscription is ready and how much traffic is left before copying links or downloading a client.'}
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
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
            <span>{isZh ? '创建时间' : 'Created at'}</span>
            <InfoTooltip content={createdAtHelpText} />
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
            ? '订阅已经可用，可以直接复制并导入客户端。'
            : 'Your subscription is ready. You can copy it and import it now.'
          : isZh
            ? '订阅还在准备中，你可以先看看适合自己的客户端和导入步骤。'
            : 'Your subscription is still being prepared. You can still check the recommended client and import steps first.'}
      </div>
    </section>
  );
}

function TrafficStatsCard({
  isZh,
  stats,
  isLoading,
  className,
}: {
  isZh: boolean;
  stats?: ClientStats;
  isLoading?: boolean;
  className?: string;
}) {
  const trafficUsed = stats ? stats.up + stats.down : 0;
  const usagePercent =
    stats && stats.total > 0 ? Math.min((trafficUsed / stats.total) * 100, 100) : 0;
  const trafficHelpText = isZh
    ? '这里可以看已用流量和总量；如果显示不限，说明当前没有总流量上限。'
    : 'This compares your used traffic with the total. If it says Unlimited, there is no traffic cap right now.';
  const uploadHelpText = isZh ? '这是你已经上传的流量。' : 'This is the traffic you have uploaded.';
  const downloadHelpText = isZh
    ? '这是你已经下载的流量。'
    : 'This is the traffic you have downloaded.';
  const expiresHelpText = isZh
    ? '这是当前订阅的到期时间；如果显示 Never，说明暂时没有到期限制。'
    : 'This is when the current subscription expires. Never means there is no expiry limit right now.';
  const protocolHelpText = isZh
    ? '这是当前订阅使用的协议类型。'
    : 'This is the protocol used by the current subscription.';

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
    <section className={cn('surface-card space-y-5 p-6 md:p-7', className)}>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
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
              <span className="inline-flex items-center gap-1 text-zinc-400">
                <span>{isZh ? '流量' : 'Traffic'}</span>
                <InfoTooltip content={trafficHelpText} />
              </span>
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

          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            <MetricPanel
              label={isZh ? '上传' : 'Upload'}
              value={formatTraffic(stats.up)}
              helpContent={uploadHelpText}
            />
            <MetricPanel
              label={isZh ? '下载' : 'Download'}
              value={formatTraffic(stats.down)}
              helpContent={downloadHelpText}
            />
            <MetricPanel
              label={isZh ? '到期' : 'Expires'}
              value={formatExpiry(stats.expiryTime)}
              valueClassName={cn(isExpired && 'text-red-500')}
              helpContent={expiresHelpText}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <span>{isZh ? '协议：' : 'Protocol: '}</span>
              <InfoTooltip content={protocolHelpText} />
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
  helpContent,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  helpContent?: string;
}) {
  return (
    <div className="surface-panel p-4">
      <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
        <span>{label}</span>
        {helpContent ? <InfoTooltip content={helpContent} /> : null}
      </p>
      <p className={cn('mt-2 text-sm font-medium text-zinc-50', valueClassName)}>{value}</p>
    </div>
  );
}

function AdminMessagesCard({
  isZh,
  latestAnnouncement,
  supportContact,
  actionLabel,
  onAction,
}: {
  isZh: boolean;
  latestAnnouncement: string;
  supportContact: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const hasContent = Boolean(latestAnnouncement || supportContact);

  return (
    <div
      className="surface-card space-y-5 p-6 md:p-7"
      data-testid="subscription-home-admin-messages"
    >
      <div className="space-y-2">
        <p className="section-kicker">{isZh ? '最新说明' : 'Latest notes'}</p>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
          {isZh ? '公告与联系渠道' : 'Announcements and support'}
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
              <span className="text-zinc-500">{isZh ? '联系渠道：' : 'Contact: '}</span>
              {supportContact}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm leading-6 text-zinc-500">
          {isZh ? '暂时还没有新的说明。' : 'No new notes yet.'}
        </p>
      )}

      {actionLabel && onAction ? (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
