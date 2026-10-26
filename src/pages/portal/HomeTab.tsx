import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Cpu,
  Database,
  Download,
  HardDrive,
  QrCode,
} from 'lucide-react';
import type { ServerStatus } from '@/src/api/xui';
import { useI18n } from '@/src/context/I18nContext';
import { Button } from '@/src/components/ui/Button';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { UsageMeter } from '@/src/components/ui/UsageMeter';
import { cn } from '@/src/utils/cn';
import { formatDateTime } from '@/src/utils/dateTime';
import { formatTraffic } from '@/src/utils/xuiClients';
import { getFraudRiskMeta, isNodeQualityStale } from '@/src/utils/nodeQuality';
import { maskSubscriptionUrl } from '@/src/utils/subscription';
import {
  detectImportDevice,
  importDeviceLabel,
  importHint,
  importPrimaryLabel,
  IMPORT_DEVICES,
  resolveImportAction,
  type ImportDevice,
} from '@/src/utils/subscriptionImport';
import {
  parseSubscriptionNodeCards,
  type SubscriptionNodeCard,
} from '@/src/utils/subscriptionNodes';
import type { NodeQualityProfile } from '@/src/types/nodeQuality';
import type { ClientStats, PortalSettings, PortalTab, PortalUsageSummary, UserInfo } from './types';
import {
  buildNetworkTrendBars,
  formatPortalUptime,
  getMachinePressureState,
  resourceUsagePercent,
} from './machineStatus';
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
  // Route detail is heavy on a phone — start collapsed there, expanded on desktop.
  const [showRouteDetail, setShowRouteDetail] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
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
    <div className="user-home-stack">
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

      {hasSubscription ? (
        <SubscriptionNodeCards url={subscriptionUniversalUrl} isZh={isZh} />
      ) : null}

      {showAnnouncement ? (
        <AdminMessagesCard
          isZh={isZh}
          latestAnnouncement={latestAnnouncement}
          supportContact={supportContact}
        />
      ) : null}

      {hasSubscription || serverStatus || isStatsLoading ? (
        <section className="user-flat-section" data-testid="subscription-home-details">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={showTechnicalDetails}
            onClick={() => setShowTechnicalDetails((value) => !value)}
            data-testid="subscription-home-details-toggle"
          >
            <span>
              <span className="user-section-label">{isZh ? '详细信息' : 'Details'}</span>
              <span className="mt-1 block text-sm text-[var(--text-secondary)]">
                {isZh ? '账单、已用流量和节点检测。' : 'Billing, used traffic, and the node check.'}
              </span>
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-zinc-400 transition-transform',
                showTechnicalDetails && 'rotate-180',
              )}
            />
          </button>
          {showTechnicalDetails ? (
            <div className="mt-5 space-y-6">
              <MachineHealthCard
                isZh={isZh}
                serverStatus={serverStatus}
                usageSummary={usageSummary}
                isLoading={isStatsLoading}
              />
              {hasSubscription ? (
                <UsageDetailCard
                  isZh={isZh}
                  stats={clientStats}
                  usageSummary={usageSummary}
                  isLoading={isStatsLoading}
                />
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
          ) : null}
        </section>
      ) : null}
    </div>
  );
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

function shortExpiry(ms: number, isZh: boolean) {
  if (ms === 0) return isZh ? '永久' : 'Never';
  return formatDateTime(ms).slice(0, 10);
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
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [importDevice, setImportDevice] = useState<ImportDevice>(() =>
    detectImportDevice(typeof navigator === 'undefined' ? '' : navigator.userAgent),
  );

  const importAction = subscriptionUniversalUrl
    ? resolveImportAction(importDevice, subscriptionUniversalUrl)
    : null;
  const machineSummaryHelpText = isZh
    ? '这是整台服务器的共享额度，不是你一个人的用量。拆分在详细信息里。'
    : 'This is the whole server’s shared quota, not your personal usage. The split is under Details.';

  const used = stats ? stats.up + stats.down : 0;
  const hasPool = Boolean(usageSummary && usageSummary.machineTotal > 0);

  let quotaLabel = '';
  let bigValue = '';
  let subtitle = '';
  let personalUsage = '';
  let usedPercent = 0;
  let unlimited = false;

  if (hasPool && usageSummary) {
    const { machineRemaining, machineTotal, machineUsed, ownUsed } = usageSummary;
    quotaLabel = isZh ? '服务器共享流量' : 'Shared server traffic';
    bigValue = formatTraffic(machineRemaining);
    usedPercent = Math.min(Math.max((machineUsed / machineTotal) * 100, 0), 100);
    subtitle = isZh
      ? `剩余 · 已用 ${formatTraffic(machineUsed)} / ${formatTraffic(machineTotal)}`
      : `Left · used ${formatTraffic(machineUsed)} / ${formatTraffic(machineTotal)}`;
    personalUsage = formatTraffic(ownUsed);
  } else if (stats && stats.total > 0) {
    const remaining = Math.max(stats.total - used, 0);
    quotaLabel = isZh ? '个人流量' : 'Personal traffic';
    bigValue = formatTraffic(remaining);
    usedPercent = Math.min((used / stats.total) * 100, 100);
    subtitle = isZh
      ? `剩余 · 已用 ${formatTraffic(used)} / ${formatTraffic(stats.total)}`
      : `Left · used ${formatTraffic(used)} / ${formatTraffic(stats.total)}`;
  } else {
    unlimited = true;
    quotaLabel = isZh ? '已用流量' : 'Used traffic';
    bigValue = formatTraffic(used);
    subtitle = isZh ? '不限流量' : 'Unlimited';
  }

  const resetDay = usageSummary?.resetDay ?? null;
  const resetText = resetDay
    ? isZh
      ? `${daysUntilResetDay(resetDay)} 天后`
      : `${daysUntilResetDay(resetDay)} days`
    : null;

  const isExpired = Boolean(stats && stats.expiryTime > 0 && stats.expiryTime < Date.now());
  const expiryText = stats ? shortExpiry(stats.expiryTime, isZh) : null;

  const status = !hasSubscription
    ? 'preparing'
    : !stats
      ? 'unavailable'
      : !stats.enable || isExpired
        ? 'disabled'
        : 'ready';
  const statusLabel = {
    ready: isZh ? '可用' : 'Ready',
    preparing: isZh ? '准备中' : 'Preparing',
    disabled: isZh ? '已停用' : 'Disabled',
    unavailable: isLoading
      ? isZh
        ? '更新中'
        : 'Updating'
      : isZh
        ? '已用流量暂不可用'
        : 'Used traffic unavailable',
  }[status];

  return (
    <section className="user-sub" data-testid="subscription-home-account-status">
      <div className="user-sub-head">
        <h2 className="user-sub-title">{isZh ? '导入订阅' : 'Import subscription'}</h2>
        <p className="user-section-label" data-testid="subscription-home-status">
          {isZh ? '我的订阅' : 'My subscription'}
          {username ? ` · ${username}` : ''}
          {` · ${statusLabel}`}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-4 w-64" />
        </div>
      ) : hasSubscription && !stats ? (
        <div className="space-y-3" data-testid="subscription-home-usage-unavailable">
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            {isZh
              ? '已用流量暂不可用。订阅链接仍可复制。'
              : 'Used traffic is unavailable. You can still copy the subscription link.'}
          </p>
          <Button onClick={() => onSetSection('setup')} size="sm">
            {isZh ? '导入' : 'Import'}
          </Button>
        </div>
      ) : hasSubscription ? (
        <>
          {subscriptionUniversalUrl && importAction ? (
            <div className="user-sub-import">
              <div className="grid gap-3">
                <div
                  className="user-device-tabs"
                  role="group"
                  aria-label={isZh ? '选择设备' : 'Choose a device'}
                >
                  {IMPORT_DEVICES.map((device) => {
                    const selected = device === importDevice;
                    return (
                      <button
                        key={device}
                        type="button"
                        data-testid={`subscription-import-${device}`}
                        aria-pressed={selected}
                        className="user-device-tab"
                        onClick={() => setImportDevice(device)}
                      >
                        {importDeviceLabel(device, isZh)}
                      </button>
                    );
                  })}
                </div>
                <div className="user-sub-actions">
                  <Button
                    className="user-primary-action"
                    onClick={() => {
                      window.location.href = importAction.openUrl;
                    }}
                    data-testid="subscription-home-import"
                  >
                    {importPrimaryLabel(importDevice, isZh)}
                  </Button>
                  <div className="user-sub-ghosts">
                    <Button
                      variant="ghost"
                      className="gap-1.5"
                      onClick={() => {
                        onCopy(importAction.copyUrl, 'home-universal');
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? (isZh ? '已复制' : 'Copied') : isZh ? '复制' : 'Copy'}
                    </Button>
                    <Button
                      variant="ghost"
                      className="gap-1.5 lg:hidden"
                      onClick={() => setShowQr((value) => !value)}
                      aria-expanded={showQr}
                      data-testid="subscription-home-qr"
                    >
                      <QrCode className="h-4 w-4" />
                      {isZh ? '二维码' : 'QR'}
                    </Button>
                    <Button
                      variant="ghost"
                      className="gap-1.5"
                      onClick={() => onSetSection('setup')}
                    >
                      <Download className="h-4 w-4" />
                      {isZh ? '下载' : 'Download'}
                    </Button>
                  </div>
                </div>
                <p className="user-section-label">{importHint(importDevice, isZh)}</p>
                <p className="user-sub-link user-num">
                  {maskSubscriptionUrl(subscriptionUniversalUrl)}
                </p>
                <p className="user-section-label">
                  {isZh ? '请勿转发订阅链接。' : 'Do not share this subscription link.'}
                </p>
                {showQr && subscriptionUniversalUrl ? (
                  <div className="lg:hidden">
                    <QrCodeCanvas url={subscriptionUniversalUrl} isZh={isZh} plain size={140} />
                  </div>
                ) : null}
              </div>
              <div className="user-sub-qr">
                <QrCodeCanvas url={subscriptionUniversalUrl} isZh={isZh} plain size={112} />
                <p className="user-section-label">{isZh ? '扫码导入' : 'Scan to import'}</p>
              </div>
            </div>
          ) : null}
          <div className="user-sub-stats">
            <div
              className="user-sub-stat"
              data-testid={hasPool ? 'subscription-shared-quota' : 'subscription-personal-quota'}
            >
              <p className="user-figure">{bigValue}</p>
              <div className="user-section-label">
                <span>{quotaLabel}</span>
                {hasPool ? <InfoTooltip content={machineSummaryHelpText} /> : null}
              </div>
              <p className="user-section-label">{subtitle}</p>
            </div>
            {personalUsage ? (
              <div className="user-sub-stat" data-testid="subscription-personal-usage">
                <p className="user-figure">{personalUsage}</p>
                <p className="user-section-label">{isZh ? '你用了' : 'You used'}</p>
              </div>
            ) : null}
            <div className="user-sub-stat">
              <p className="user-figure">{resetText ?? (isZh ? '未同步' : 'Not synced')}</p>
              <p className="user-section-label">{isZh ? '重置' : 'Reset'}</p>
            </div>
            <div className="user-sub-stat">
              <p className={cn('user-figure', isExpired && 'text-red-500')}>
                {expiryText ?? (isZh ? '未同步' : 'Not synced')}
              </p>
              <p className="user-section-label">{isZh ? '到期' : 'Expires'}</p>
            </div>
          </div>
          {!unlimited ? (
            <UsageMeter percent={usedPercent} value={`${Math.round(usedPercent)}%`} />
          ) : null}
        </>
      ) : (
        <div className="grid gap-3">
          <p className="user-section-label">
            {isZh ? '订阅链接还在准备。' : 'The subscription link is not ready yet.'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => onSetSection('setup')}
          >
            {isZh ? '查看导入' : 'View import'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </section>
  );
}

function SubscriptionNodeCards({ url, isZh }: { url: string; isZh: boolean }) {
  const [cards, setCards] = useState<SubscriptionNodeCard[] | null>(null);

  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    void fetch(url, { credentials: 'include' })
      .then((response) => (response.ok ? response.text() : ''))
      .then((body) => {
        if (!cancelled) setCards(parseSubscriptionNodeCards(body));
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!cards?.length) return null;

  const ordered = [...cards].sort((left, right) => {
    const rank = (card: SubscriptionNodeCard) =>
      card.usedLabel && card.limitLabel ? 0 : card.limitLabel ? 1 : 2;
    return rank(left) - rank(right);
  });

  return (
    <section data-testid="subscription-node-cards">
      <p className="user-section-label">{isZh ? '节点' : 'Nodes'}</p>
      <div className="user-node-grid">
        {ordered.map((card) => (
          <article key={card.id}>
            <div className="user-node-name">
              <span className="user-flag" aria-hidden="true">
                {card.flag || '•'}
              </span>
              <p className="min-w-0 truncate font-semibold text-[var(--text-primary)]">
                {card.name}
              </p>
            </div>
            {card.usedLabel && card.limitLabel ? (
              <UsageMeter
                percent={(card.usedRatio ?? 0) * 100}
                value={`${card.usedLabel} / ${card.limitLabel}`}
              />
            ) : card.limitLabel ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {isZh ? `每月 ${card.limitLabel}` : `${card.limitLabel} / month`}
              </p>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                {isZh ? '未显示已用流量' : 'Used traffic is not shown'}
              </p>
            )}
          </article>
        ))}
      </div>
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
          ? '机器账单'
          : 'Machine bill'
        : isZh
          ? '机器估算'
          : 'Machine estimate';
    const syncText = formatSyncTime(usageSummary.machineUpdatedAt, isZh);
    const xuiTotalUsed = usageSummary.xuiTotalUsed ?? usageSummary.totalUsed;
    const usageGap = usageSummary.usageGap ?? Math.max(0, usageSummary.machineUsed - xuiTotalUsed);
    rows.push({
      label: isZh ? '你用了' : 'You used',
      value: formatTraffic(usageSummary.ownUsed),
    });
    rows.push({
      label: isZh ? '其他人用了' : 'Other people used',
      value: formatTraffic(usageSummary.otherUsersUsed),
    });
    rows.push({
      label: isZh ? '面板合计' : 'Panel total',
      value: formatTraffic(xuiTotalUsed),
    });
    rows.push({
      label: sourceLabel,
      value: `${formatTraffic(usageSummary.machineUsed)} / ${formatTraffic(usageSummary.machineTotal)}`,
    });
    rows.push({
      label: isZh ? '统计差额' : 'Billing difference',
      value: formatTraffic(usageGap),
    });
    rows.push({
      label: isZh ? '同步时间' : 'Sync time',
      value: syncText,
    });
  } else if (stats) {
    rows.push({ label: isZh ? '已用流量' : 'Used traffic', value: formatTraffic(used) });
    if (stats.total > 0) {
      rows.push({ label: isZh ? '总量' : 'Total', value: formatTraffic(stats.total) });
    }
  }
  if (stats) {
    rows.push({ label: isZh ? '上传' : 'Upload', value: formatTraffic(stats.up) });
    rows.push({ label: isZh ? '下载' : 'Download', value: formatTraffic(stats.down) });
    rows.push({
      label: isZh ? '连接方式' : 'Connection',
      value: plainConnectionLabel(stats.protocol, isZh),
    });
  }

  return (
    <section className="grid gap-3">
      <p className="user-section-label">{isZh ? '已用流量' : 'Used traffic'}</p>
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

const PRESSURE_TONE = {
  good: {
    border: 'border-emerald-500/25',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500',
    soft: 'bg-emerald-500/10',
    glow: 'bg-emerald-400/20',
    shadow: 'shadow-[0_28px_80px_rgba(47,157,135,0.12)]',
    badge: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-400',
  },
  warn: {
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    bg: 'bg-amber-500',
    soft: 'bg-amber-500/10',
    glow: 'bg-amber-400/20',
    shadow: 'shadow-[0_28px_80px_rgba(191,133,65,0.14)]',
    badge: 'border-amber-400/25 bg-amber-500/10 text-amber-400',
  },
  danger: {
    border: 'border-red-500/35',
    text: 'text-red-400',
    bg: 'bg-red-500',
    soft: 'bg-red-500/10',
    glow: 'bg-red-400/20',
    shadow: 'shadow-[0_28px_80px_rgba(212,95,124,0.16)]',
    badge: 'border-red-400/25 bg-red-500/10 text-red-400',
  },
  unknown: {
    border: 'border-[var(--border-subtle)]',
    text: 'text-zinc-400',
    bg: 'bg-zinc-500',
    soft: 'bg-zinc-500/10',
    glow: 'bg-zinc-400/10',
    shadow: 'shadow-[var(--shadow-card)]',
    badge: 'border-white/10 bg-white/5 text-zinc-400',
  },
} as const;

function formatSpeed(bytesPerSecond: number): string {
  const safe = Math.max(0, bytesPerSecond);
  const mb = safe / 1024 ** 2;
  if (mb >= 1) return `${mb.toFixed(1)} MB/s`;
  return `${(safe / 1024).toFixed(1)} KB/s`;
}

function formatResetAt(ms: number | null | undefined, isZh: boolean): string {
  if (!ms) return isZh ? '暂未同步' : 'Not synced';
  return formatDateTime(ms);
}

function plainConnectionLabel(protocol: string, isZh: boolean): string {
  if (!isZh) return protocol.toUpperCase();
  const value = protocol.toLowerCase();
  if (
    value.includes('vless') ||
    value.includes('reality') ||
    value.includes('vmess') ||
    value.includes('trojan') ||
    value.includes('shadowsocks')
  ) {
    return '加密线路';
  }
  return protocol ? '普通线路' : '加密线路';
}

function MachineHealthCard({
  isZh,
  serverStatus,
  usageSummary,
  isLoading,
}: {
  isZh: boolean;
  serverStatus?: ServerStatus | null;
  usageSummary?: PortalUsageSummary | null;
  isLoading?: boolean;
}) {
  const pressure = getMachinePressureState(serverStatus);
  const tone = PRESSURE_TONE[pressure.level];
  const pressureLabel = {
    good: isZh ? '健康' : 'Healthy',
    warn: isZh ? '有压力' : 'Under load',
    danger: isZh ? '压力高' : 'High pressure',
    unknown: isZh ? '等待数据' : 'Waiting',
  }[pressure.level];
  const healthSummary = {
    good: isZh
      ? '机器资源充足，当前连接状态稳定。'
      : 'Resources look comfortable and the route is stable.',
    warn: isZh ? '机器有一定负载，仍可正常使用。' : 'The machine is under load but still usable.',
    danger: isZh
      ? '资源压力偏高，连接体验可能波动。'
      : 'Resource pressure is high; connection quality may fluctuate.',
    unknown: isZh ? '正在等待服务器状态回传。' : 'Waiting for live server status.',
  }[pressure.level];
  const networkBars = buildNetworkTrendBars(serverStatus);
  const hasTrafficSplit =
    usageSummary?.machineInbound != null ||
    usageSummary?.machineOutbound != null ||
    usageSummary?.machineUsagePercentage != null;
  const hasTrafficSplitBytes =
    usageSummary?.machineInbound != null || usageSummary?.machineOutbound != null;
  const inboundTraffic = usageSummary?.machineInbound ?? 0;
  const outboundTraffic = usageSummary?.machineOutbound ?? 0;
  const trafficSplitTotal = Math.max(inboundTraffic + outboundTraffic, 1);
  const inboundPercent = Math.round((inboundTraffic / trafficSplitTotal) * 100);
  const outboundPercent = Math.max(0, 100 - inboundPercent);
  const dmitUsagePercent =
    usageSummary?.machineUsagePercentage ??
    (usageSummary && usageSummary.machineTotal > 0
      ? Math.min((usageSummary.machineUsed / usageSummary.machineTotal) * 100, 100)
      : null);
  const trafficUsed = usageSummary?.machineUsed ?? 0;
  const trafficRemaining = usageSummary?.machineRemaining ?? 0;
  const trafficTotal = usageSummary?.machineTotal ?? 0;
  const cpuPercent = serverStatus ? Math.round(serverStatus.cpu) : 0;
  const memPercent = serverStatus
    ? resourceUsagePercent(serverStatus.mem.current, serverStatus.mem.total)
    : 0;
  const diskPercent = serverStatus
    ? resourceUsagePercent(serverStatus.disk.current, serverStatus.disk.total)
    : 0;
  const resourceMeters = [
    {
      icon: <Cpu className="h-4 w-4" />,
      label: isZh ? 'CPU' : 'CPU',
      value: serverStatus ? `${serverStatus.cpu.toFixed(1)}%` : '--',
      percent: cpuPercent,
      tone: getResourceTone(cpuPercent),
    },
    {
      icon: <Database className="h-4 w-4" />,
      label: isZh ? '内存' : 'Memory',
      value: serverStatus
        ? `${formatTraffic(serverStatus.mem.current)} / ${formatTraffic(serverStatus.mem.total)}`
        : '--',
      percent: memPercent,
      tone: getResourceTone(memPercent),
    },
    {
      icon: <HardDrive className="h-4 w-4" />,
      label: isZh ? '磁盘' : 'Disk',
      value: serverStatus
        ? `${formatTraffic(serverStatus.disk.current)} / ${formatTraffic(serverStatus.disk.total)}`
        : '--',
      percent: diskPercent,
      tone: getResourceTone(diskPercent),
    },
  ] as const;
  const dmitDialColor =
    dmitUsagePercent == null
      ? 'var(--text-tertiary)'
      : dmitUsagePercent >= 85
        ? 'var(--danger)'
        : dmitUsagePercent >= 65
          ? 'var(--warning)'
          : 'var(--success)';

  return (
    <section
      className={cn(
        'surface-card relative overflow-hidden border p-5 md:p-7',
        tone.border,
        tone.shadow,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl',
          tone.glow,
        )}
      />
      <div className="pointer-events-none absolute bottom-0 left-0 h-28 w-1/2 rounded-full bg-sky-400/10 blur-3xl" />

      {isLoading ? (
        <div className="relative grid gap-4 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-36 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="relative space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-h-[176px] rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.025))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] md:p-6">
              <div className="flex h-full flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div className="space-y-3">
                  <p className="section-kicker">{isZh ? '机器健康' : 'Machine health'}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={cn(
                        'inline-flex h-11 w-11 items-center justify-center rounded-[18px] border',
                        tone.badge,
                      )}
                    >
                      <Activity className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
                        {pressureLabel}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-zinc-500">{healthSummary}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:min-w-64">
                  <MiniStat
                    label={isZh ? '综合压力' : 'Pressure'}
                    value={pressure.level === 'unknown' ? '--' : `${pressure.percent}%`}
                    toneClass={tone.text}
                  />
                  <MiniStat
                    label={isZh ? '运行时长' : 'Uptime'}
                    value={serverStatus ? formatPortalUptime(serverStatus.uptime, isZh) : '--'}
                    toneClass="text-zinc-100"
                  />
                </div>
              </div>
            </div>

            <div className="min-h-[176px] rounded-[30px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-5">
              <div className="flex h-full items-center justify-between gap-5">
                <div>
                  <p className="section-kicker">{isZh ? '流量水位' : 'Traffic level'}</p>
                  <p className="mt-3 text-2xl font-semibold tabular-nums text-zinc-50">
                    {trafficTotal > 0 ? formatTraffic(trafficRemaining) : '--'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {isZh
                      ? `剩余流量 · ${formatSyncTime(usageSummary?.machineUpdatedAt, isZh)}`
                      : `Remaining · ${formatSyncTime(usageSummary?.machineUpdatedAt, isZh)}`}
                  </p>
                </div>
                <div
                  className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full p-2"
                  style={{
                    background: `conic-gradient(${dmitDialColor} ${Math.max(0, Math.min(dmitUsagePercent ?? 0, 100))}%, rgba(255,255,255,0.08) 0)`,
                  }}
                >
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[var(--surface-card)] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
                    <span className="font-mono text-2xl font-semibold text-zinc-50">
                      {dmitUsagePercent == null ? '--' : dmitUsagePercent.toFixed(0)}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                      {isZh ? '已用%' : 'Used %'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {resourceMeters.map((meter) => (
              <ResourceMeter
                key={meter.label}
                icon={meter.icon}
                label={meter.label}
                value={meter.value}
                percent={meter.percent}
                tone={meter.tone}
              />
            ))}
            <ServiceStabilityTile isZh={isZh} serverStatus={serverStatus} />
          </div>

          <div className="grid items-stretch gap-4 xl:grid-cols-2">
            <div className="min-h-[258px] rounded-[28px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-100">
                    {isZh ? '实时网络节奏' : 'Live network rhythm'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {isZh
                      ? '当前上/下行吞吐，左右等宽对比。'
                      : 'Current up/down throughput with balanced comparison.'}
                  </p>
                </div>
                <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-medium text-sky-400">
                  LIVE
                </span>
              </div>
              <div className="grid h-[172px] gap-3 sm:grid-cols-2">
                {networkBars.map((bar) => (
                  <div
                    key={bar.key}
                    className="relative flex min-h-0 flex-col justify-between overflow-hidden rounded-[24px] border border-white/10 bg-[var(--surface-inline)] p-4"
                  >
                    <div
                      className={cn(
                        'pointer-events-none absolute inset-y-0 left-0 opacity-20 transition-all',
                        bar.key === 'up' ? 'bg-sky-400' : 'bg-emerald-400',
                      )}
                      style={{ width: `${bar.percent}%` }}
                    />
                    <div className="relative flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
                        {bar.key === 'up' ? (
                          <ArrowUp className="h-4 w-4 text-sky-400" />
                        ) : (
                          <ArrowDown className="h-4 w-4 text-emerald-400" />
                        )}
                        {bar.key === 'up' ? (isZh ? '上行' : 'Upload') : isZh ? '下行' : 'Download'}
                      </span>
                    </div>
                    <div className="relative">
                      <span className="font-mono text-xl font-semibold tabular-nums text-zinc-50">
                        {formatSpeed(bar.value)}
                      </span>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-800/70">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            bar.key === 'up' ? 'bg-sky-400' : 'bg-emerald-400',
                          )}
                          style={{ width: `${bar.percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-h-[258px] rounded-[28px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-100">
                    {isZh ? '流量账单' : 'Traffic bill'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {isZh
                      ? `同步：${formatSyncTime(usageSummary?.machineUpdatedAt, isZh)}`
                      : `Synced: ${formatSyncTime(usageSummary?.machineUpdatedAt, isZh)}`}
                  </p>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400">
                  {dmitUsagePercent == null ? '--' : `${dmitUsagePercent.toFixed(1)}%`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MiniStat
                  label={isZh ? '机器剩余' : 'Remaining'}
                  value={trafficTotal > 0 ? formatTraffic(trafficRemaining) : '--'}
                  toneClass="text-emerald-400"
                />
                <MiniStat
                  label={isZh ? '已用流量' : 'Used traffic'}
                  value={trafficTotal > 0 ? formatTraffic(trafficUsed) : '--'}
                  toneClass="text-zinc-100"
                />
              </div>

              {hasTrafficSplit ? (
                <div className="mt-5 space-y-3">
                  {hasTrafficSplitBytes ? (
                    <div className="flex h-4 overflow-hidden rounded-full bg-zinc-800/75 p-0.5">
                      <div
                        className="rounded-full bg-sky-400"
                        style={{ width: `${inboundPercent}%` }}
                      />
                      <div
                        className="rounded-full bg-emerald-400"
                        style={{ width: `${outboundPercent}%` }}
                      />
                    </div>
                  ) : null}
                  <div className="grid gap-2 text-xs text-zinc-400">
                    <TrafficRow
                      label={isZh ? '入站流量' : 'Inbound'}
                      value={
                        usageSummary?.machineInbound == null
                          ? isZh
                            ? '未提供'
                            : 'Not provided'
                          : formatTraffic(usageSummary.machineInbound)
                      }
                    />
                    <TrafficRow
                      label={isZh ? '出站流量' : 'Outbound'}
                      value={
                        usageSummary?.machineOutbound == null
                          ? isZh
                            ? '未提供'
                            : 'Not provided'
                          : formatTraffic(usageSummary.machineOutbound)
                      }
                    />
                    <TrafficRow
                      label={isZh ? '下次重置' : 'Next reset'}
                      value={formatResetAt(usageSummary?.machineNextResetAt, isZh)}
                    />
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-sm leading-6 text-zinc-500">
                  {isZh
                    ? '暂无 DMIT 入站/出站拆分；同步脚本更新后会自动显示。'
                    : 'No DMIT inbound/outbound split yet. It appears after the sync script updates.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function getResourceTone(percent: number): 'good' | 'warn' | 'danger' {
  if (percent >= 85) return 'danger';
  if (percent >= 65) return 'warn';
  return 'good';
}

function ResourceMeter({
  icon,
  label,
  value,
  percent,
  tone,
}: {
  key?: React.Key;
  icon: React.ReactNode;
  label: string;
  value: string;
  percent: number;
  tone: 'good' | 'warn' | 'danger';
}) {
  const toneClass = PRESSURE_TONE[tone];

  return (
    <div className="min-h-[132px] rounded-[24px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-4">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="inline-flex items-center gap-2 text-zinc-400">
          {icon}
          {label}
        </span>
        <span className={cn('font-medium tabular-nums', toneClass.text)}>{percent}%</span>
      </div>
      <p className="mt-2 truncate text-xs tabular-nums text-zinc-500">{value}</p>
      <div className="mt-7 h-2 overflow-hidden rounded-full bg-zinc-800/80">
        <div
          className={cn('h-full rounded-full transition-all', toneClass.bg)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function ServiceStabilityTile({
  isZh,
  serverStatus,
}: {
  isZh: boolean;
  serverStatus?: ServerStatus | null;
}) {
  return (
    <div className="min-h-[132px] rounded-[24px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-4">
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="inline-flex items-center gap-2 text-zinc-400">
            <Clock className="h-4 w-4" />
            {isZh ? '服务' : 'Service'}
          </span>
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              serverStatus?.xray.state === 'running' ? 'bg-emerald-400' : 'bg-red-400',
            )}
          />
        </div>
        <div>
          <p className="truncate text-xs text-zinc-500">
            {serverStatus
              ? serverStatus.xray.state === 'running'
                ? isZh
                  ? `Xray ${serverStatus.xray.version}`
                  : `Xray ${serverStatus.xray.version}`
                : isZh
                  ? 'Xray 未运行'
                  : 'Xray stopped'
              : isZh
                ? '等待状态'
                : 'Waiting'}
          </p>
          <p className="mt-2 text-lg font-semibold text-zinc-50">
            {serverStatus?.xray.state === 'running'
              ? isZh
                ? '正常'
                : 'Running'
              : isZh
                ? '异常'
                : 'Stopped'}
          </p>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  toneClass,
}: {
  label: string;
  value: string;
  toneClass: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[var(--surface-inline)] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className={cn('mt-1 truncate text-lg font-semibold tabular-nums', toneClass)}>{value}</p>
    </div>
  );
}

function TrafficRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="font-medium tabular-nums text-zinc-100">{value}</span>
    </div>
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
  const stale = isNodeQualityStale(profile?.updatedAt);
  const checkedAt = formatDateTime(profile?.updatedAt);
  const summaryText = stale
    ? isZh
      ? `线路检测已过期${checkedAt ? ` · ${checkedAt}` : ''}`
      : `Route check expired${checkedAt ? ` · ${checkedAt}` : ''}`
    : profile
      ? [
          isZh ? '节点' : 'Node',
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
    <div className="user-flat-section grid gap-3" data-testid="subscription-home-admin-messages">
      <p className="user-section-label">{isZh ? '公告' : 'Notes'}</p>

      {hasContent ? (
        <div className="grid gap-2">
          {latestAnnouncement && (
            <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">
              {latestAnnouncement}
            </p>
          )}

          {supportContact && (
            <p className="text-sm text-[var(--text-secondary)]">
              <span>{isZh ? '联系渠道：' : 'Contact: '}</span>
              {supportContact}
            </p>
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
