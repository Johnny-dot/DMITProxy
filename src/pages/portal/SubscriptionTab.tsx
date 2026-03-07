import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Apple,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Link as LinkIcon,
  Monitor,
  QrCode,
  Shield,
  Smartphone,
  Terminal,
  Zap,
} from 'lucide-react';
import { cn } from '@/src/utils/cn';
import { useI18n } from '@/src/context/I18nContext';
import { Button } from '@/src/components/ui/Button';
import { buildSubscriptionUrl } from '@/src/utils/subscription';
import { getClientDownloadLinks, type ClientDownloadPlatform } from '@/src/utils/clientDownloads';
import type { NodeQualityProfile } from '@/src/types/nodeQuality';
import type {
  ClientCard,
  ClientStats,
  PlatformKey,
  PortalSettings,
  SubscriptionFormat,
} from './types';
import { COPY_RESET_DELAY_MS } from './types';
import { NodeQualityCard } from './NodeQualityCard';

interface SubscriptionTabProps {
  subId: string | null;
  portalSettings: PortalSettings | null;
  clientStats?: ClientStats;
  nodeQuality?: NodeQualityProfile | null;
  onRefreshNodeQuality?: () => void;
  isRefreshingNodeQuality?: boolean;
}

type GuidePlatform = Exclude<PlatformKey, 'all'>;

interface ClientGuideContent {
  recommendedFormat: SubscriptionFormat;
  steps: string[];
  tip: string;
}

function buildClientGuide(
  clientId: ClientCard['id'],
  platform: GuidePlatform,
  platformLabel: string,
  isZh: boolean,
): ClientGuideContent {
  switch (clientId) {
    case 'v2rayN':
      return {
        recommendedFormat: 'universal',
        steps: isZh
          ? [
              '打开 v2rayN，首次启动如果提示下载核心或初始化，按默认完成即可。',
              '进入“订阅分组”或“从剪贴板导入批量 URL”，把上面复制的订阅链接导入进去。',
              '导入后执行“更新订阅”，选择一个节点，再打开系统代理或设置为你常用的模式。',
            ]
          : [
              'Open v2rayN and finish the initial core setup if it prompts on first launch.',
              'Use Subscription Group or Import batch URLs from clipboard to add the copied subscription link above.',
              'Run Update subscription, pick a node, then enable the system proxy or your preferred routing mode.',
            ],
        tip: isZh
          ? '如果剪贴板导入失败，就改用“从 URL 导入”再更新一次订阅。'
          : 'If clipboard import fails, switch to importing from URL and update the subscription again.',
      };
    case 'v2rayNG':
      return {
        recommendedFormat: 'universal',
        steps: isZh
          ? [
              '打开 v2rayNG，点击右上角加号，或者进入订阅分组设置。',
              '选择“从剪贴板导入”或“添加订阅”，把上面复制的链接粘贴进去并保存。',
              '更新订阅后选择一个节点，再点击连接，并允许 Android 的 VPN 权限。',
            ]
          : [
              'Open v2rayNG and tap the plus button or the subscription group settings.',
              'Choose Import from clipboard or Add subscription, paste the copied link above, then save it.',
              'Update the subscription, select a node, then tap Connect and allow the Android VPN permission.',
            ],
        tip: isZh
          ? '第一次连接时弹出 VPN 授权是正常现象。'
          : 'The first connection usually requests VPN permission. That is expected.',
      };
    case 'shadowrocket':
      return {
        recommendedFormat: 'universal',
        steps: isZh
          ? [
              '打开 Shadowrocket，点击右上角加号，新增一个订阅来源。',
              '把上面复制的订阅链接粘贴到 URL，备注可以填写站点名或你的用户名。',
              '保存后下拉刷新订阅，选中节点，再打开顶部连接开关并允许系统 VPN 权限。',
            ]
          : [
              'Open Shadowrocket and tap the plus button to create a new subscription source.',
              'Paste the copied subscription URL above, add an optional remark, then save it.',
              'Refresh the subscription, pick a node, and turn on the main connection toggle with VPN permission.',
            ],
        tip: isZh
          ? '如果新节点没有马上出现，先手动刷新一次订阅列表。'
          : 'If fresh nodes do not appear right away, manually refresh the subscription list once.',
      };
    case 'clashVerge':
      return {
        recommendedFormat: 'clash',
        steps: isZh
          ? [
              '先把上方订阅格式切到 Clash，再打开 Clash Verge 进入 Profiles 页面。',
              '选择 New Profile 或 Import from URL，把 Clash 订阅链接粘贴进去并保存。',
              '更新 Profile 后选择节点组，按需要开启 System Proxy 或 TUN 模式开始使用。',
            ]
          : [
              'Switch the subscription format above to Clash, then open Clash Verge and go to Profiles.',
              'Use New Profile or Import from URL, paste the Clash subscription link, and save it.',
              'Update the profile, choose your proxy group, and enable System Proxy or TUN if needed.',
            ],
        tip: isZh
          ? 'Clash Verge 更适合需要规则分流和策略组的场景。'
          : 'Clash Verge is better when you want rule-based routing and proxy groups.',
      };
    case 'hiddify':
      return {
        recommendedFormat: 'universal',
        steps: isZh
          ? [
              `打开 ${platformLabel} 上的 Hiddify，进入 New Profile / Add Profile。`,
              '选择从剪贴板、URL 或二维码导入，把上面复制的订阅链接加进去。',
              platform === 'android' || platform === 'ios'
                ? '保存后点击连接，并允许系统 VPN 权限。'
                : '保存后点击连接，并按提示允许系统代理或网络扩展权限。',
            ]
          : [
              `Open Hiddify on ${platformLabel} and go to New Profile or Add Profile.`,
              'Import the profile from clipboard, URL, or QR code using the copied subscription link above.',
              platform === 'android' || platform === 'ios'
                ? 'Save it, tap Connect, and allow the system VPN permission.'
                : 'Save it, connect, and allow any system proxy or network extension permissions that appear.',
            ],
        tip: isZh
          ? 'Hiddify 是最省心的通用方案，桌面和移动端都能用同一条订阅。'
          : 'Hiddify is the easiest all-around option and works well across desktop and mobile.',
      };
    default:
      return {
        recommendedFormat: 'universal',
        steps: [],
        tip: '',
      };
  }
}

export function SubscriptionTab({
  subId,
  portalSettings,
  clientStats,
  nodeQuality,
  onRefreshNodeQuality,
  isRefreshingNodeQuality,
}: SubscriptionTabProps) {
  const { t, language } = useI18n();
  const isZh = language === 'zh-CN';

  const [activeFormat, setActiveFormat] = useState<SubscriptionFormat>('universal');
  const [activePlatform, setActivePlatform] = useState<PlatformKey>('all');
  const [activeGuideClientId, setActiveGuideClientId] = useState<ClientCard['id']>('hiddify');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [hasOpenedDownload, setHasOpenedDownload] = useState(false);
  const [hasMarkedConnected, setHasMarkedConnected] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) {
      setActivePlatform('android');
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      setActivePlatform('ios');
    } else if (ua.includes('mac os')) {
      setActivePlatform('macos');
    } else if (ua.includes('windows')) {
      setActivePlatform('windows');
    }
  }, []);

  const subscriptionLinks = useMemo(
    () => ({
      universal: subId ? buildSubscriptionUrl(subId, 'universal') : '',
      clash: subId ? buildSubscriptionUrl(subId, 'clash') : '',
      v2ray: subId ? buildSubscriptionUrl(subId, 'v2ray') : '',
      singbox: subId ? buildSubscriptionUrl(subId, 'singbox') : '',
    }),
    [subId],
  );

  const hasSubscription = Boolean(subscriptionLinks.universal);
  const activeSubUrl = subscriptionLinks[activeFormat];

  useEffect(() => {
    if (!hasSubscription) {
      setHasCopied(false);
      setHasMarkedConnected(false);
    }
  }, [hasSubscription]);

  const formatOptions = useMemo(
    () => [
      {
        key: 'universal' as const,
        label: 'Universal',
        desc: isZh ? '兼容绝大多数客户端' : 'Works with most clients',
      },
      {
        key: 'clash' as const,
        label: 'Clash',
        desc: isZh ? '推荐给 Clash 系列' : 'Recommended for Clash clients',
      },
      {
        key: 'v2ray' as const,
        label: 'V2Ray',
        desc: isZh ? '适合 V2Ray 客户端' : 'For V2Ray clients',
      },
      {
        key: 'singbox' as const,
        label: 'Singbox',
        desc: isZh ? '适合 sing-box 客户端' : 'For sing-box clients',
      },
      {
        key: 'surge' as const,
        label: 'Surge',
        desc: isZh ? '适合 iOS/macOS Surge' : 'For Surge on iOS/macOS',
      },
      {
        key: 'quanx' as const,
        label: 'QuantumultX',
        desc: isZh ? '适合 QuantumultX' : 'For QuantumultX',
      },
    ],
    [isZh],
  );

  const platformOptions = useMemo(
    () => [
      { key: 'all' as const, label: isZh ? '全部' : 'All' },
      { key: 'windows' as const, label: 'Windows' },
      { key: 'macos' as const, label: 'macOS' },
      { key: 'android' as const, label: 'Android' },
      { key: 'ios' as const, label: 'iOS' },
    ],
    [isZh],
  );

  const resolveDownloadPlatform = useCallback(
    (platforms: GuidePlatform[], recommendedFor: ClientDownloadPlatform[]) => {
      if (activePlatform !== 'all') return activePlatform;
      return recommendedFor[0] ?? platforms[0] ?? 'windows';
    },
    [activePlatform],
  );

  const clients = useMemo<ClientCard[]>(
    () => [
      {
        id: 'v2rayN',
        name: 'v2rayN',
        os: 'Windows',
        icon: Monitor,
        platforms: ['windows'],
        recommendedFor: ['windows'],
        links: getClientDownloadLinks('v2rayN', resolveDownloadPlatform(['windows'], ['windows'])),
        desc: t('portal.recommendedFor', { platform: 'Windows' }),
      },
      {
        id: 'v2rayNG',
        name: 'v2rayNG',
        os: 'Android',
        icon: Smartphone,
        platforms: ['android'],
        recommendedFor: ['android'],
        links: getClientDownloadLinks('v2rayNG', resolveDownloadPlatform(['android'], ['android'])),
        desc: t('portal.recommendedFor', { platform: 'Android' }),
      },
      {
        id: 'shadowrocket',
        name: 'Shadowrocket',
        os: 'iOS',
        icon: Apple,
        platforms: ['ios'],
        recommendedFor: ['ios'],
        links: getClientDownloadLinks('shadowrocket', resolveDownloadPlatform(['ios'], ['ios'])),
        desc: t('portal.recommendedFor', { platform: 'iPhone/iPad' }),
      },
      {
        id: 'clashVerge',
        name: 'Clash Verge',
        os: 'Windows / macOS',
        icon: Monitor,
        platforms: ['windows', 'macos'],
        recommendedFor: ['macos'],
        links: getClientDownloadLinks(
          'clashVerge',
          resolveDownloadPlatform(['windows', 'macos'], ['macos']),
        ),
        desc: t('portal.advancedRules'),
      },
      {
        id: 'hiddify',
        name: 'Hiddify',
        os: 'Windows / macOS / Android / iOS',
        icon: Smartphone,
        platforms: ['windows', 'macos', 'android', 'ios'],
        recommendedFor: ['windows', 'android', 'ios'],
        links: getClientDownloadLinks(
          'hiddify',
          resolveDownloadPlatform(
            ['windows', 'macos', 'android', 'ios'],
            ['windows', 'android', 'ios'],
          ),
        ),
        desc: t('portal.easyToUse'),
      },
    ],
    [resolveDownloadPlatform, t],
  );

  const troubleshooting = isZh
    ? [
        '先在客户端执行“更新订阅”后再连接。',
        '切换其他节点重试，优先选择延迟更低的节点。',
        '如果仍然失败，把报错截图发给管理员排查。',
      ]
    : [
        'Run "Update subscription" in the client before connecting.',
        'Switch to another node and prefer lower latency options.',
        'If it still fails, send an error screenshot to your admin.',
      ];

  const visibleClients = useMemo(
    () =>
      activePlatform === 'all'
        ? clients
        : clients.filter((client) => client.platforms.includes(activePlatform)),
    [activePlatform, clients],
  );

  const preferredGuideClientId = useMemo<ClientCard['id']>(
    () =>
      visibleClients.find((client) =>
        client.recommendedFor.includes(activePlatform === 'all' ? 'windows' : activePlatform),
      )?.id ??
      visibleClients[0]?.id ??
      'hiddify',
    [activePlatform, visibleClients],
  );

  useEffect(() => {
    if (!visibleClients.some((client) => client.id === activeGuideClientId)) {
      setActiveGuideClientId(preferredGuideClientId);
    }
  }, [activeGuideClientId, preferredGuideClientId, visibleClients]);

  const activeGuideClient =
    visibleClients.find((client) => client.id === activeGuideClientId) ??
    visibleClients[0] ??
    clients[0];

  const guidePlatform: GuidePlatform =
    activePlatform !== 'all' && activeGuideClient?.platforms.includes(activePlatform)
      ? activePlatform
      : (activeGuideClient?.recommendedFor[0] ?? activeGuideClient?.platforms[0] ?? 'windows');

  const guidePlatformLabel =
    platformOptions.find((item) => item.key === guidePlatform)?.label ?? 'Windows';

  const guideContent = useMemo<ClientGuideContent>(
    () =>
      activeGuideClient
        ? buildClientGuide(activeGuideClient.id, guidePlatform, guidePlatformLabel, isZh)
        : { recommendedFormat: 'universal', steps: [], tip: '' },
    [activeGuideClient, guidePlatform, guidePlatformLabel, isZh],
  );

  const recommendedFormatLabel =
    formatOptions.find((item) => item.key === guideContent.recommendedFormat)?.label ?? 'Universal';
  const sharedAppleIdTitle = portalSettings?.sharedAppleIdTitle.trim() || '';
  const sharedAppleIdContent = portalSettings?.sharedAppleIdContent.trim() || '';
  const sharedAppleIdEnabled = portalSettings?.sharedAppleIdActive === true;
  const showSharedAppleIdCard =
    sharedAppleIdEnabled &&
    Boolean(sharedAppleIdContent) &&
    (activePlatform === 'all' || activePlatform === 'ios');

  const setupSteps = [
    {
      id: 'copy',
      title: isZh ? '复制订阅链接' : 'Copy subscription URL',
      done: hasSubscription && hasCopied,
    },
    {
      id: 'download',
      title: isZh ? '下载客户端' : 'Download a client',
      done: hasOpenedDownload,
    },
    {
      id: 'connect',
      title: isZh ? '导入并连接' : 'Import and connect',
      done: hasMarkedConnected,
    },
  ];

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setHasCopied(true);
      setTimeout(
        () => setCopiedKey((current) => (current === key ? null : current)),
        COPY_RESET_DELAY_MS,
      );
    });
  };

  const openDownload = (url: string, clientId?: ClientCard['id']) => {
    if (!url) return;
    if (clientId) setActiveGuideClientId(clientId);
    setHasOpenedDownload(true);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      {clientStats && (
        <NodeQualityCard
          isZh={isZh}
          inboundRemark={clientStats.inboundRemark}
          profile={nodeQuality}
          className="mb-6"
          onRefresh={onRefreshNodeQuality}
          isRefreshing={isRefreshingNodeQuality}
        />
      )}

      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]" data-testid="subscription-tab">
        <div className="surface-card space-y-4 p-6">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <LinkIcon className="h-4 w-4 text-emerald-400" />
              <span>{isZh ? '步骤 1：复制订阅链接' : 'Step 1: Copy subscription URL'}</span>
            </h2>
            <p className="text-sm text-zinc-400">{t('portal.subscriptionDesc')}</p>
          </div>

          {hasSubscription ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
                {formatOptions.map((format) => (
                  <button
                    key={format.key}
                    type="button"
                    onClick={() => setActiveFormat(format.key)}
                    className={cn(
                      'rounded-lg border p-2.5 text-left transition-colors',
                      activeFormat === format.key
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-white/10 bg-zinc-950/50 hover:bg-zinc-800/60',
                    )}
                  >
                    <p className="text-sm font-medium">{format.label}</p>
                    <p className="mt-0.5 text-[11px] leading-tight text-zinc-500">{format.desc}</p>
                  </button>
                ))}
              </div>

              <div className="surface-panel space-y-3 p-4">
                <p
                  className="break-all font-mono text-xs text-zinc-300"
                  data-testid="subscription-active-url"
                >
                  {activeSubUrl}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleCopy(activeSubUrl, `active-${activeFormat}`)}
                    data-testid="subscription-copy-active"
                  >
                    {copiedKey === `active-${activeFormat}` ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copiedKey === `active-${activeFormat}`
                      ? t('portal.copied')
                      : isZh
                        ? `复制 ${formatOptions.find((item) => item.key === activeFormat)?.label} 链接`
                        : `Copy ${formatOptions.find((item) => item.key === activeFormat)?.label} link`}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setShowQr((prev) => !prev)}
                  >
                    <QrCode className="h-4 w-4" />
                    {showQr ? (isZh ? '隐藏二维码' : 'Hide QR') : isZh ? '显示二维码' : 'Show QR'}
                    {showQr ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                {showQr && <QrCodeCanvas url={activeSubUrl} />}
              </div>
            </div>
          ) : (
            <div
              className="surface-panel space-y-2 p-6 text-center"
              data-testid="subscription-not-ready"
            >
              <p className="text-sm text-zinc-300">{t('portal.notReadyTitle')}</p>
              <p className="text-xs text-zinc-500">{t('portal.notReadyDesc')}</p>
            </div>
          )}
        </div>

        <div className="surface-card space-y-4 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Shield className="h-4 w-4 text-emerald-400" />
            <span>{isZh ? '上手进度清单' : 'Setup checklist'}</span>
          </h2>
          <div className="space-y-3">
            {setupSteps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2',
                  step.done
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : 'border-white/10 bg-zinc-950/40',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full border text-xs',
                    step.done
                      ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                      : 'border-white/10 bg-zinc-800 text-zinc-400',
                  )}
                >
                  {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-zinc-100">{step.title}</p>
                  <p className="text-[11px] text-zinc-500">
                    {step.done ? (isZh ? '已完成' : 'Done') : isZh ? '待完成' : 'Pending'}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setHasMarkedConnected((prev) => !prev)}
          >
            {hasMarkedConnected
              ? isZh
                ? '已标记：连接成功'
                : 'Marked: Connected'
              : isZh
                ? '连接成功后点此标记'
                : 'Mark this after successful connection'}
          </Button>
        </div>
      </section>

      <section className="surface-card space-y-4 p-6" data-testid="subscription-downloads-section">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Download className="h-4 w-4 text-emerald-400" />
            <span>{isZh ? '步骤 2：下载客户端' : 'Step 2: Download client'}</span>
          </h2>
          <p className="text-sm text-zinc-400">
            {isZh
              ? '先筛选你的设备，再安装推荐客户端。'
              : 'Pick your device first, then install the recommended client.'}
          </p>
          <p className="text-xs leading-6 text-zinc-500">
            {isZh
              ? '“官方源”会打开 GitHub 或应用商店；“镜像下载”走当前站点 VPS 的缓存，适合官方源较慢时使用。'
              : '"Official" opens GitHub or the app store. "Mirror" serves the cached package from this VPS when official sources are slow.'}
          </p>
          <p className="text-xs leading-6 text-zinc-500">
            {isZh
              ? '下面选中的客户端会直接决定第 3 步显示哪一套操作说明。'
              : 'The client you select here directly controls which setup guide appears in step 3.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {platformOptions.map((platform) => (
            <button
              key={platform.key}
              type="button"
              onClick={() => setActivePlatform(platform.key)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs transition-colors',
                activePlatform === platform.key
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-white/10 bg-zinc-950/40 text-zinc-300 hover:bg-zinc-800/60',
              )}
            >
              {platform.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {visibleClients.map((client) => {
            const isRecommended =
              activePlatform !== 'all' && client.recommendedFor.includes(activePlatform);
            const isActiveGuide = activeGuideClient?.id === client.id;

            return (
              <div
                key={client.id}
                className={cn(
                  'surface-panel space-y-3 p-4 transition-colors',
                  isActiveGuide && 'border-emerald-500/40 bg-emerald-500/5',
                )}
                onClick={() => setActiveGuideClientId(client.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <client.icon className="mt-0.5 h-5 w-5 text-zinc-400" />
                    <div>
                      <p className="text-sm font-medium">{client.name}</p>
                      <p className="text-xs text-zinc-500">
                        {client.os} / {client.desc}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {isRecommended && (
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-wide text-emerald-300">
                        {isZh ? '推荐' : 'Recommended'}
                      </span>
                    )}
                    {isActiveGuide && (
                      <span className="rounded border border-white/10 bg-zinc-900/70 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-300">
                        {isZh ? '当前教程' : 'Current guide'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => openDownload(client.links.github, client.id)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {isZh ? '官方源' : 'Official'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => openDownload(client.links.vps, client.id)}
                    disabled={!client.links.vps}
                    title={
                      client.links.vps
                        ? isZh
                          ? '通过当前站点 VPS 缓存分发'
                          : 'Serve the cached package from this VPS'
                        : isZh
                          ? '当前平台暂不提供镜像下载'
                          : 'Mirror is not available for this platform'
                    }
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {isZh ? '镜像下载' : 'Mirror'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {showSharedAppleIdCard && (
          <div className="rounded-[22px] border border-amber-500/20 bg-amber-500/6 p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
                    {isZh ? 'iPhone / iPad 下载辅助' : 'iPhone / iPad download help'}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {isZh ? '管理员共享内容' : 'Admin-managed content'}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  {sharedAppleIdTitle ||
                    (isZh
                      ? '共享美区 Apple ID / 下载说明'
                      : 'Shared US Apple ID / download instructions')}
                </h3>
                <p className="max-w-3xl text-xs leading-6 text-zinc-400">
                  {isZh
                    ? '适合国区商店无法直接下载 Shadowrocket 等工具时使用。请只在 App Store 内登录，不要开启 iCloud 同步。'
                    : 'Use this when the local App Store cannot download Shadowrocket or similar tools. Sign in only inside App Store and do not enable iCloud sync.'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 self-start"
                onClick={() => handleCopy(sharedAppleIdContent, 'shared-apple-id')}
              >
                <Copy className="h-4 w-4" />
                {copiedKey === 'shared-apple-id'
                  ? isZh
                    ? '已复制'
                    : 'Copied'
                  : isZh
                    ? '复制内容'
                    : 'Copy details'}
              </Button>
            </div>

            <div className="mt-4 whitespace-pre-wrap rounded-[18px] border border-white/10 bg-zinc-950/40 px-4 py-3 font-mono text-xs leading-6 text-zinc-300">
              {sharedAppleIdContent}
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card space-y-4 p-6" data-testid="subscription-guide-section">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Terminal className="h-4 w-4 text-emerald-400" />
              <span>{isZh ? '步骤 3：导入并连接' : 'Step 3: Import and connect'}</span>
            </h2>
            <p className="text-sm text-zinc-400">
              {activeGuideClient
                ? isZh
                  ? `当前教程：${activeGuideClient.name} · ${guidePlatformLabel}`
                  : `Current guide: ${activeGuideClient.name} on ${guidePlatformLabel}`
                : isZh
                  ? '请先在上方选择客户端'
                  : 'Choose a client above first'}
            </p>
          </div>

          {visibleClients.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {visibleClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => setActiveGuideClientId(client.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs transition-colors',
                    activeGuideClient?.id === client.id
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/10 bg-zinc-950/40 text-zinc-300 hover:bg-zinc-800/60',
                  )}
                >
                  {client.name}
                </button>
              ))}
            </div>
          )}

          <div className="surface-panel space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span>{isZh ? '推荐订阅格式' : 'Recommended format'}</span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                {recommendedFormatLabel}
              </span>
              {activeFormat !== guideContent.recommendedFormat && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-300">
                  {isZh
                    ? `当前是 ${formatOptions.find((item) => item.key === activeFormat)?.label ?? activeFormat}`
                    : `Current: ${formatOptions.find((item) => item.key === activeFormat)?.label ?? activeFormat}`}
                </span>
              )}
            </div>

            {activeFormat !== guideContent.recommendedFormat && (
              <p className="text-xs leading-6 text-amber-300/90">
                {isZh
                  ? `这套教程按 ${recommendedFormatLabel} 格式写的。建议先回到步骤 1 切换订阅格式，再继续导入。`
                  : `This guide assumes the ${recommendedFormatLabel} format. Switch the link type in step 1 before importing.`}
              </p>
            )}
          </div>

          <div className="space-y-3">
            {guideContent.steps.map((step, index) => (
              <div
                key={`${activeGuideClient?.id ?? 'guide'}-${index}`}
                className="flex items-start gap-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-950/60 text-xs text-zinc-300">
                  {index + 1}
                </span>
                <p className="pt-0.5 text-sm text-zinc-300">{step}</p>
              </div>
            ))}
          </div>

          {guideContent.tip && (
            <p className="rounded-lg border border-white/10 bg-zinc-950/40 px-4 py-3 text-xs leading-6 text-zinc-400">
              {guideContent.tip}
            </p>
          )}
        </div>

        <div
          className="surface-card space-y-4 p-6"
          data-testid="subscription-troubleshooting-section"
        >
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Zap className="h-4 w-4 text-amber-400" />
            <span>{isZh ? '连接失败排查' : 'Troubleshooting'}</span>
          </h2>
          <div className="space-y-3">
            {troubleshooting.map((item, index) => (
              <p key={item} className="text-sm text-zinc-300">
                {index + 1}. {item}
              </p>
            ))}
          </div>
          <p className="border-t border-white/10 pt-4 text-xs text-zinc-500">
            {t('portal.needHelp')}
          </p>
        </div>
      </section>
    </>
  );
}

function QrCodeCanvas({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  const render = useCallback((canvas: HTMLCanvasElement, targetUrl: string) => {
    import('qrcode')
      .then((mod) => {
        const QRCode = (mod as { default?: unknown }).default ?? mod;
        return (
          QRCode.toCanvas as (el: HTMLCanvasElement, text: string, opts: object) => Promise<void>
        )(canvas, targetUrl, {
          width: 200,
          margin: 2,
          color: { dark: '#d4d4d8', light: '#18181b' },
        });
      })
      .then(() => setError(null))
      .catch(() => setError('Failed to generate QR code'));
  }, []);

  useEffect(() => {
    if (canvasRef.current && url) render(canvasRef.current, url);
  }, [url, render]);

  if (error) {
    return <p className="text-xs text-red-400">{error}</p>;
  }

  return (
    <div className="flex justify-start pt-2">
      <div className="surface-panel overflow-hidden p-1">
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
}
