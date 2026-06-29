import React, { useState } from 'react';
import { ArrowRight, Check, ChevronDown, Copy, Download, QrCode } from 'lucide-react';
import type { ServerStatus } from '@/src/api/xui';
import { useI18n } from '@/src/context/I18nContext';
import { Button } from '@/src/components/ui/Button';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { cn } from '@/src/utils/cn';
import { formatTraffic } from '@/src/utils/xuiClients';
import { getFraudRiskMeta } from '@/src/utils/nodeQuality';
import type { NodeQualityProfile } from '@/src/types/nodeQuality';
import type { ClientStats, PortalSettings, PortalTab, PortalUsageSummary, UserInfo } from './types';
import { NodeQualityCard } from './NodeQualityCard';
import { QrCodeCanvas } from './SubscriptionTabCards';

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
  // Route detail is heavy on a phone — start collapsed there, expanded on desktop.
  const [showRouteDetail, setShowRouteDetail] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024,
  );

  const latestAnnouncement = effectiveSettings?.announcementActive
    ? effectiveSettings.announcementText.trim()
    : '';
  const supportContact = effectiveSettings?.supportTelegram ?? '';
  const showAnnouncement = showMessagesCard && Boolean(latestAnnouncement || supportContact);

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

      {hasSubscription || showAnnouncement ? (
        <section
          className={cn('grid gap-6', hasSubscription && showAnnouncement && 'xl:grid-cols-2')}
        >
          {hasSubscription ? (
            <UsageDetailCard
              isZh={isZh}
              stats={clientStats}
              usageSummary={usageSummary}
              isLoading={isStatsLoading}
            />
          ) : null}
          {showAnnouncement ? (
            <AdminMessagesCard
              isZh={isZh}
              latestAnnouncement={latestAnnouncement}
              supportContact={supportContact}
            />
          ) : null}
        </section>
      ) : null}

      {hasSubscription && clientStats ? (
        <div className="space-y-3">
          <RouteStatusPill
            isZh={isZh}
            profile={nodeQuality}
            expanded={showRouteDetail}
            onToggle={() => setShowRouteDetail((value) => !value)}
          />
          {showRouteDetail ? (
            <NodeQualityCard
              isZh={isZh}
              inboundRemark={clientStats.inboundRemark}
              profile={nodeQuality}
              onRefresh={onRefreshNodeQuality}
              isRefreshing={isRefreshingNodeQuality}
            />
          ) : null}
        </div>
      ) : null}
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

function formatSyncTime(ms: number | null | undefined, isZh: boolean): string {
  if (!ms) return isZh ? '实时估算' : 'Live estimate';
  const ageMs = Math.max(0, Date.now() - ms);
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return isZh ? '刚刚同步' : 'Just synced';
  if (minutes < 60) return isZh ? `${minutes} 分钟前` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return isZh ? `${hours} 小时前` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return isZh ? `${days} 天前` : `${days}d ago`;
}

const STATUS_BORDER = {
  ready: 'border-emerald-500/30',
  preparing: 'border-amber-500/30',
  disabled: 'border-red-500/30',
} as const;
const STATUS_PILL = {
  ready: 'bg-emerald-500/10 text-emerald-500',
  preparing: 'bg-amber-500/10 text-amber-500',
  disabled: 'bg-red-500/10 text-red-500',
} as const;
const STATUS_DOT = {
  ready: 'bg-emerald-500',
  preparing: 'bg-amber-500',
  disabled: 'bg-red-500',
} as const;

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
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const machineSummaryHelpText = isZh
    ? '个人/他人来自 3X-UI 应用层统计；机器余量来自 DMIT 网卡账单或 Prism 估算，两种口径不直接相加。'
    : 'Personal and shared-user usage comes from 3X-UI. Machine remaining comes from DMIT billing or Prism estimation, so the two scopes are not additive.';

  const used = stats ? stats.up + stats.down : 0;
  const hasPool = Boolean(usageSummary && usageSummary.machineTotal > 0);

  let bigValue = '';
  let subtitle = '';
  let usedPercent = 0;
  let unlimited = false;

  if (hasPool && usageSummary) {
    const { machineRemaining, machineTotal, ownUsed, machineUsed, machineSource } = usageSummary;
    const sourceLabel =
      machineSource === 'dmit'
        ? isZh
          ? 'DMIT账单'
          : 'DMIT billing'
        : isZh
          ? '机器估算'
          : 'Machine estimate';
    bigValue = isZh
      ? `剩 ${formatTraffic(machineRemaining)}`
      : `${formatTraffic(machineRemaining)} left`;
    usedPercent = Math.min(Math.max((machineUsed / machineTotal) * 100, 0), 100);
    subtitle = isZh
      ? `${sourceLabel} 已用 ${formatTraffic(machineUsed)} / ${formatTraffic(machineTotal)} · 其中你(3X-UI) ${formatTraffic(ownUsed)}`
      : `${sourceLabel} ${formatTraffic(machineUsed)} / ${formatTraffic(machineTotal)} used · you (3X-UI) ${formatTraffic(ownUsed)}`;
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
      ? `重置 ${daysUntilResetDay(resetDay)} 天后（每月 ${resetDay} 日 UTC）`
      : `Resets in ~${daysUntilResetDay(resetDay)}d (UTC day ${resetDay})`
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
  const statusLabel = {
    ready: isZh ? '可用' : 'Ready',
    preparing: isZh ? '准备中' : 'Preparing',
    disabled: isZh ? '已停用' : 'Disabled',
  }[status];

  return (
    <section
      className={cn('surface-card space-y-5 border p-6 md:p-7', STATUS_BORDER[status])}
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
            STATUS_PILL[status],
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
          {statusLabel}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-4 w-64" />
        </div>
      ) : hasSubscription ? (
        <div
          className={cn(
            'grid gap-6 lg:items-center',
            subscriptionUniversalUrl && 'lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]',
          )}
        >
          <div className="space-y-5">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-3xl font-semibold tabular-nums text-zinc-50">{bigValue}</p>
                <p className="inline-flex items-center gap-1 text-xs text-zinc-500">
                  <span>{subtitle}</span>
                  {hasPool ? <InfoTooltip content={machineSummaryHelpText} /> : null}
                </p>
              </div>

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

              {resetText || expiryText ? (
                <p className="text-xs text-zinc-500">
                  {resetText}
                  {resetText && expiryText ? ' · ' : ''}
                  {expiryText ? (
                    <span className={cn(isExpired && 'text-red-500')}>{expiryText}</span>
                  ) : null}
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {subscriptionUniversalUrl ? (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      onCopy(subscriptionUniversalUrl, 'home-universal');
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? (isZh ? '已复制' : 'Copied') : isZh ? '复制订阅' : 'Copy link'}
                  </Button>
                ) : null}
                {subscriptionUniversalUrl ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5 lg:hidden"
                    onClick={() => setShowQr((value) => !value)}
                    aria-expanded={showQr}
                  >
                    <QrCode className="h-4 w-4" />
                    {isZh ? '二维码' : 'QR code'}
                  </Button>
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
              {showQr && subscriptionUniversalUrl ? (
                <div className="lg:hidden">
                  <QrCodeCanvas url={subscriptionUniversalUrl} isZh={isZh} />
                </div>
              ) : null}
            </div>
          </div>

          {subscriptionUniversalUrl ? (
            <div className="hidden flex-col items-center gap-2 lg:flex lg:border-l lg:border-[var(--border-subtle)] lg:pl-6">
              <QrCodeCanvas url={subscriptionUniversalUrl} isZh={isZh} />
              <p className="text-xs text-zinc-500">{isZh ? '手机扫码导入' : 'Scan to import'}</p>
            </div>
          ) : null}
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

function UsageDetailCard({
  isZh,
  stats,
  usageSummary,
  isLoading,
}: {
  isZh: boolean;
  stats?: ClientStats;
  usageSummary?: PortalUsageSummary | null;
  isLoading?: boolean;
}) {
  const used = stats ? stats.up + stats.down : 0;
  const hasPool = Boolean(usageSummary && usageSummary.machineTotal > 0);

  const rows: Array<{ label: string; value: string }> = [];
  if (hasPool && usageSummary) {
    const sourceLabel =
      usageSummary.machineSource === 'dmit'
        ? isZh
          ? 'DMIT账单'
          : 'DMIT billing'
        : isZh
          ? '机器估算'
          : 'Machine estimate';
    const syncText = formatSyncTime(usageSummary.machineUpdatedAt, isZh);
    const xuiTotalUsed = usageSummary.xuiTotalUsed ?? usageSummary.totalUsed;
    const usageGap = usageSummary.usageGap ?? Math.max(0, usageSummary.machineUsed - xuiTotalUsed);
    rows.push({
      label: isZh ? '你已用(3X-UI)' : 'You used (3X-UI)',
      value: formatTraffic(usageSummary.ownUsed),
    });
    rows.push({
      label: isZh ? '他人用量(3X-UI)' : 'Others (3X-UI)',
      value: formatTraffic(usageSummary.otherUsersUsed),
    });
    rows.push({
      label: isZh ? '3X-UI合计' : '3X-UI total',
      value: formatTraffic(xuiTotalUsed),
    });
    rows.push({
      label: sourceLabel,
      value: `${formatTraffic(usageSummary.machineUsed)} / ${formatTraffic(usageSummary.machineTotal)}`,
    });
    rows.push({
      label: isZh ? '口径差值' : 'Scope gap',
      value: formatTraffic(usageGap),
    });
    rows.push({
      label: isZh ? '同步时间' : 'Sync time',
      value: syncText,
    });
  } else if (stats) {
    rows.push({ label: isZh ? '已用' : 'Used', value: formatTraffic(used) });
    if (stats.total > 0) {
      rows.push({ label: isZh ? '总量' : 'Total', value: formatTraffic(stats.total) });
    }
  }
  if (stats) {
    rows.push({ label: isZh ? '上传' : 'Upload', value: formatTraffic(stats.up) });
    rows.push({ label: isZh ? '下载' : 'Download', value: formatTraffic(stats.down) });
    rows.push({ label: isZh ? '协议' : 'Protocol', value: stats.protocol.toUpperCase() });
  }

  return (
    <section className="surface-card space-y-4 p-6 md:p-7">
      <p className="section-kicker">{isZh ? '用量明细' : 'Usage detail'}</p>
      {isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ) : rows.length > 0 ? (
        <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-zinc-500">{row.label}</span>
              <span className="font-medium tabular-nums text-zinc-100">{row.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-zinc-500">
          {isZh ? '暂无流量数据，稍后再试。' : 'No usage data yet.'}
        </p>
      )}
    </section>
  );
}

function RouteStatusPill({
  isZh,
  profile,
  expanded,
  onToggle,
}: {
  isZh: boolean;
  profile?: NodeQualityProfile | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const fraudMeta = getFraudRiskMeta(profile?.fraudScore ?? null, isZh);
  const egress = profile?.egress;
  const location = egress ? [egress.city, egress.country].filter(Boolean).join(', ') : '';
  const score = profile?.fraudScore;
  const summaryText = profile
    ? [
        isZh ? '线路' : 'Route',
        fraudMeta.label,
        location,
        score != null ? (isZh ? `风险 ${score}` : `risk ${score}`) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : isZh
      ? '线路检测结果加载中…'
      : 'Loading route status…';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="surface-card flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:border-[var(--border-strong)]"
    >
      <span className="inline-flex min-w-0 items-center gap-2 text-sm text-zinc-300">
        <span
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full bg-current', fraudMeta.className)}
          aria-hidden="true"
        />
        <span className="truncate">{summaryText}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-500">
        {expanded ? (isZh ? '收起' : 'Hide') : isZh ? '查看详情' : 'Details'}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
      </span>
    </button>
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
