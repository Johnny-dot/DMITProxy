import React, { useState } from 'react';
import { ArrowRight, Check, Copy, Download } from 'lucide-react';
import type { ServerStatus } from '@/src/api/xui';
import { useI18n } from '@/src/context/I18nContext';
import { Button } from '@/src/components/ui/Button';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { cn } from '@/src/utils/cn';
import { formatTraffic } from '@/src/utils/xuiClients';
import type { NodeQualityProfile } from '@/src/types/nodeQuality';
import type { ClientStats, PortalSettings, PortalTab, PortalUsageSummary, UserInfo } from './types';
import { NodeQualityCard } from './NodeQualityCard';

interface HomeTabProps {
  isAdminView: boolean;
  context: { user: UserInfo; settings: PortalSettings } | null;
  effectiveSettings: PortalSettings | null;
  hasSubscription: boolean;
  subscriptionUniversalUrl: string;
  clientStats?: ClientStats;
  usageSummary?: PortalUsageSummary | null;
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
  usageSummary,
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
  const hasMessages = Boolean(latestAnnouncement || supportContact);

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
              {isZh ? '用户中心与管理入口' : 'User center with management access'}
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
      <MySubscriptionHero
        isZh={isZh}
        username={context?.user.username ?? ''}
        hasSubscription={hasSubscription}
        subscriptionUniversalUrl={subscriptionUniversalUrl}
        stats={clientStats}
        usageSummary={usageSummary}
        isLoading={isStatsLoading}
        onCopy={onCopy}
        onSetSection={onSetSection}
      />

      {showMessagesCard && hasMessages ? (
        <AdminMessagesCard
          isZh={isZh}
          latestAnnouncement={latestAnnouncement}
          supportContact={supportContact}
        />
      ) : null}

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

function formatExpiry(ms: number, isZh: boolean) {
  if (ms === 0) return isZh ? '永不过期' : 'Never';
  return new Date(ms).toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function daysUntilResetDay(resetDay: number): number {
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), resetDay);
  if (next <= todayUTC) {
    next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, resetDay);
  }
  return Math.round((next - todayUTC) / 86_400_000);
}

function MySubscriptionHero({
  isZh,
  username,
  hasSubscription,
  subscriptionUniversalUrl,
  stats,
  usageSummary,
  isLoading,
  onCopy,
  onSetSection,
}: {
  isZh: boolean;
  username: string;
  hasSubscription: boolean;
  subscriptionUniversalUrl: string;
  stats?: ClientStats;
  usageSummary?: PortalUsageSummary | null;
  isLoading?: boolean;
  onCopy: (text: string, key: string) => void;
  onSetSection: (tab: PortalTab) => void;
}) {
  const machineSummaryHelpText = isZh
    ? '这里显示的是 Prism 按整台机器汇总后的真实口径，不是 3X-UI 原生页面里按单个用户计算的“剩余”。'
    : 'These numbers come from Prism machine-wide accounting, not the single-user remaining quota shown by the native 3X-UI page.';

  const used = stats ? stats.up + stats.down : 0;
  const hasPool = Boolean(usageSummary && usageSummary.machineTotal > 0);

  let bigValue = '';
  let subtitle = '';
  let usedPercent = 0;
  let unlimited = false;

  if (hasPool && usageSummary) {
    const { machineRemaining, machineTotal, ownUsed } = usageSummary;
    bigValue = isZh
      ? `剩 ${formatTraffic(machineRemaining)}`
      : `${formatTraffic(machineRemaining)} left`;
    usedPercent = Math.min(
      Math.max(((machineTotal - machineRemaining) / machineTotal) * 100, 0),
      100,
    );
    subtitle = isZh
      ? `本机共享池 ${formatTraffic(machineTotal)} · 你已用 ${formatTraffic(ownUsed)}`
      : `Shared pool ${formatTraffic(machineTotal)} · you used ${formatTraffic(ownUsed)}`;
  } else if (stats && stats.total > 0) {
    const remaining = Math.max(stats.total - used, 0);
    bigValue = isZh ? `剩 ${formatTraffic(remaining)}` : `${formatTraffic(remaining)} left`;
    usedPercent = Math.min((used / stats.total) * 100, 100);
    subtitle = isZh
      ? `共 ${formatTraffic(stats.total)} · 已用 ${formatTraffic(used)}`
      : `Total ${formatTraffic(stats.total)} · used ${formatTraffic(used)}`;
  } else {
    unlimited = true;
    bigValue = isZh ? `已用 ${formatTraffic(used)}` : `${formatTraffic(used)} used`;
    subtitle = isZh ? '不限流量' : 'Unlimited traffic';
  }

  const resetDay = usageSummary?.resetDay ?? null;
  const resetText = resetDay
    ? isZh
      ? `每月 ${resetDay} 日 UTC 重置 · 约 ${daysUntilResetDay(resetDay)} 天后`
      : `Resets UTC day ${resetDay} · in ~${daysUntilResetDay(resetDay)}d`
    : null;

  const isExpired = Boolean(stats && stats.expiryTime > 0 && stats.expiryTime < Date.now());
  const expiryText = stats
    ? isZh
      ? `到期 ${formatExpiry(stats.expiryTime, isZh)}`
      : `Expires ${formatExpiry(stats.expiryTime, isZh)}`
    : null;

  const status: 'ready' | 'preparing' | 'disabled' = !hasSubscription
    ? 'preparing'
    : stats && !stats.enable
      ? 'disabled'
      : 'ready';
  const statusStyles: Record<typeof status, string> = {
    ready: 'bg-emerald-500/10 text-emerald-500',
    preparing: 'bg-amber-500/10 text-amber-500',
    disabled: 'bg-red-500/10 text-red-500',
  };
  const statusDot: Record<typeof status, string> = {
    ready: 'bg-emerald-500',
    preparing: 'bg-amber-500',
    disabled: 'bg-red-500',
  };
  const statusLabel: Record<typeof status, string> = {
    ready: isZh ? '可用' : 'Ready',
    preparing: isZh ? '准备中' : 'Preparing',
    disabled: isZh ? '已停用' : 'Disabled',
  };

  return (
    <section
      className="surface-card space-y-5 p-6 md:p-7"
      data-testid="subscription-home-account-status"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="section-kicker">{isZh ? '我的订阅' : 'My subscription'}</p>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
            {isZh ? '订阅与用量' : 'Your subscription'}
          </h2>
          {username ? <p className="text-xs text-zinc-500">{username}</p> : null}
        </div>
        <span
          data-testid="subscription-home-status"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
            statusStyles[status],
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', statusDot[status])} />
          {statusLabel[status]}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-4 w-64" />
        </div>
      ) : hasSubscription ? (
        <div className="space-y-5">
          <div className="surface-panel space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p className="text-3xl font-semibold tabular-nums text-zinc-50">{bigValue}</p>
              <div className="space-y-0.5 text-right text-xs text-zinc-500">
                {resetText ? <p>{resetText}</p> : null}
                {expiryText ? (
                  <p className={cn(isExpired && 'text-red-500')}>{expiryText}</p>
                ) : null}
              </div>
            </div>

            <p className="inline-flex items-center gap-1 text-xs text-zinc-500">
              <span>{subtitle}</span>
              {hasPool ? <InfoTooltip content={machineSummaryHelpText} /> : null}
            </p>

            {!unlimited ? (
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    usedPercent < 50
                      ? 'bg-emerald-500'
                      : usedPercent < 80
                        ? 'bg-amber-500'
                        : 'bg-red-500',
                  )}
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
            ) : null}
          </div>

          {stats ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
              <span>
                {isZh ? '上传' : 'Up'} {formatTraffic(stats.up)}
              </span>
              <span>
                {isZh ? '下载' : 'Down'} {formatTraffic(stats.down)}
              </span>
              <span className="inline-flex items-center gap-1">
                <span>{isZh ? '协议' : 'Protocol'}</span>
                <span className="font-medium uppercase text-zinc-300">{stats.protocol}</span>
              </span>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {subscriptionUniversalUrl ? (
              <CopyButton url={subscriptionUniversalUrl} isZh={isZh} onCopy={onCopy} />
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => onSetSection('setup')}
            >
              <Download className="h-4 w-4" />
              {isZh ? '下载客户端' : 'Download client'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="surface-panel p-4 text-sm font-medium text-amber-500">
            {isZh
              ? '订阅还在准备中，你可以先看看适合自己的客户端和导入步骤。'
              : 'Your subscription is still being prepared. You can still check the recommended client and import steps first.'}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => onSetSection('setup')}
          >
            {isZh ? '查看导入步骤' : 'View import steps'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </section>
  );
}

function CopyButton({
  url,
  isZh,
  onCopy,
}: {
  url: string;
  isZh: boolean;
  onCopy: (text: string, key: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      size="sm"
      className="gap-1.5"
      onClick={() => {
        onCopy(url, 'home-universal');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? (isZh ? '已复制' : 'Copied') : isZh ? '复制订阅' : 'Copy link'}
    </Button>
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
          {isZh ? '暂无新说明。' : 'No new notes yet.'}
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
