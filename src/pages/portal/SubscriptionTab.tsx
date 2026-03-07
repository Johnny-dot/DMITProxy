import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Apple,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  LifeBuoy,
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
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';
import { buildSubscriptionUrl } from '@/src/utils/subscription';
import { getClientDownloadLinks, type ClientDownloadPlatform } from '@/src/utils/clientDownloads';
import type { NodeQualityProfile } from '@/src/types/nodeQuality';
import {
  getSharedResourceAccessLabel,
  getSharedResourceKindLabel,
} from '@/src/types/sharedResource';
import type {
  ClientCard,
  ClientStats,
  PlatformKey,
  PortalSettings,
  PortalTab,
  SubscriptionFormat,
} from './types';
import { COPY_RESET_DELAY_MS } from './types';

type WorkspaceSection = 'subscription' | 'clients' | 'help';
type GuidePlatform = Exclude<PlatformKey, 'all'>;

interface SubscriptionTabProps {
  section?: WorkspaceSection;
  subId: string | null;
  portalSettings: PortalSettings | null;
  clientStats?: ClientStats;
  nodeQuality?: NodeQualityProfile | null;
  onRefreshNodeQuality?: () => void;
  isRefreshingNodeQuality?: boolean;
  onSetSection?: (tab: PortalTab) => void;
}

function buildClientGuide(
  clientId: ClientCard['id'],
  platform: GuidePlatform,
  platformLabel: string,
  isZh: boolean,
) {
  if (clientId === 'clashVerge') {
    return {
      recommendedFormat: 'clash' as const,
      steps: isZh
        ? [
            '先把订阅格式切到 Clash。',
            '在 Profiles 里导入 URL。',
            '更新后选择策略组并打开系统代理。',
          ]
        : [
            'Switch the subscription format to Clash.',
            'Import the URL in Profiles.',
            'Update it, choose a proxy group, and enable system proxy.',
          ],
    };
  }

  if (clientId === 'shadowrocket') {
    return {
      recommendedFormat: 'universal' as const,
      steps: isZh
        ? ['点击右上角加号新建订阅。', '把订阅链接粘贴到 URL。', '刷新订阅后选择节点并开启连接。']
        : [
            'Tap the plus button to create a subscription.',
            'Paste the subscription URL.',
            'Refresh it, pick a node, and connect.',
          ],
    };
  }

  if (clientId === 'v2rayNG') {
    return {
      recommendedFormat: 'universal' as const,
      steps: isZh
        ? [
            '打开订阅分组或加号菜单。',
            '从剪贴板或 URL 导入订阅。',
            '更新后选择节点并允许 VPN 权限。',
          ]
        : [
            'Open the subscription menu.',
            'Import the subscription from clipboard or URL.',
            'Update it, select a node, and allow VPN permission.',
          ],
    };
  }

  if (clientId === 'v2rayN') {
    return {
      recommendedFormat: 'universal' as const,
      steps: isZh
        ? [
            '完成首次核心初始化。',
            '从剪贴板或 URL 导入订阅。',
            '更新订阅后选择节点并打开系统代理。',
          ]
        : [
            'Finish the initial core setup.',
            'Import the subscription from clipboard or URL.',
            'Update it, choose a node, and enable system proxy.',
          ],
    };
  }

  return {
    recommendedFormat: 'universal' as const,
    steps: isZh
      ? [
          `打开 ${platformLabel} 上的 Hiddify。`,
          '从剪贴板、URL 或二维码导入订阅。',
          platform === 'android' || platform === 'ios'
            ? '保存后点击连接并允许 VPN。'
            : '保存后点击连接并允许系统代理权限。',
        ]
      : [
          `Open Hiddify on ${platformLabel}.`,
          'Import the subscription from clipboard, URL, or QR.',
          platform === 'android' || platform === 'ios'
            ? 'Save it, connect, and allow VPN.'
            : 'Save it, connect, and allow system proxy permissions.',
        ],
  };
}

export function SubscriptionTab({
  section = 'subscription',
  subId,
  portalSettings,
  onSetSection,
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
  const downloadsHelpText = isZh
    ? '“官方源”会跳到项目官方发布页；“镜像下载”会优先走当前服务器缓存的文件。'
    : '"Official" opens the upstream release page. "Mirror" prefers files cached on this server.';
  const recommendedFormatHelpText = isZh
    ? '有些客户端更适合特定订阅格式；如果这里提示 Clash，就先回到订阅页切换格式。'
    : 'Some clients work better with a specific subscription format. If this says Clash, switch the format in Subscription first.';

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) setActivePlatform('android');
    else if (ua.includes('iphone') || ua.includes('ipad')) setActivePlatform('ios');
    else if (ua.includes('mac os')) setActivePlatform('macos');
    else if (ua.includes('windows')) setActivePlatform('windows');
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
    if (!visibleClients.some((client) => client.id === activeGuideClientId))
      setActiveGuideClientId(preferredGuideClientId);
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
  const guide = buildClientGuide(activeGuideClient.id, guidePlatform, guidePlatformLabel, isZh);

  const supportContact = portalSettings?.supportTelegram?.trim() ?? '';
  const announcementText = portalSettings?.announcementActive
    ? portalSettings.announcementText.trim()
    : '';
  const sharedResources = (portalSettings?.sharedResources ?? []).filter(
    (item) => item.active && (item.title.trim() || item.content.trim() || item.summary.trim()),
  );

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

  if (section === 'clients') {
    return (
      <div className="space-y-6">
        <section
          className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]"
          data-testid="portal-clients-tab"
        >
          <div className="surface-card space-y-4 p-6">
            <div className="space-y-1">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Download className="h-4 w-4 text-emerald-400" />
                {isZh ? '客户端下载' : 'Client downloads'}
              </h2>
              <p className="text-sm text-zinc-400">
                {isZh
                  ? '先按设备筛选，再挑一个自己顺手的软件。'
                  : 'Pick your device first, then choose a client that feels right.'}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <span>{isZh ? '涓嬭浇鏉ユ簮璇存槑' : 'Download source note'}</span>
              <InfoTooltip content={downloadsHelpText} />
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
              {visibleClients.map((client) => (
                <div
                  key={client.id}
                  className={cn(
                    'surface-panel space-y-3 p-4 transition-colors',
                    activeGuideClient?.id === client.id && 'border-emerald-500/40 bg-emerald-500/5',
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
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {isZh ? '镜像下载' : 'Mirror'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="surface-card space-y-4 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Shield className="h-4 w-4 text-emerald-400" />
              {isZh ? '进度清单' : 'Checklist'}
            </h2>
            {[
              { title: isZh ? '复制订阅链接' : 'Copy link', done: hasSubscription && hasCopied },
              { title: isZh ? '下载客户端' : 'Download client', done: hasOpenedDownload },
              { title: isZh ? '导入并连接' : 'Import and connect', done: hasMarkedConnected },
            ].map((step, index) => (
              <div
                key={step.title}
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
                <span className="text-sm text-zinc-100">{step.title}</span>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setHasMarkedConnected((prev) => !prev)}
            >
              {hasMarkedConnected
                ? isZh
                  ? '已标记连接成功'
                  : 'Marked as connected'
                : isZh
                  ? '连接成功后点此标记'
                  : 'Mark this after connecting'}
            </Button>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="surface-card space-y-4 p-6" data-testid="portal-clients-guide">
            <div className="space-y-1">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Terminal className="h-4 w-4 text-emerald-400" />
                {isZh ? '导入教程' : 'Import guide'}
              </h2>
              <p className="text-sm text-zinc-400">
                {isZh
                  ? `当前教程：${activeGuideClient.name} / ${guidePlatformLabel}`
                  : `Current guide: ${activeGuideClient.name} on ${guidePlatformLabel}`}
              </p>
            </div>
            <div className="surface-panel space-y-3 p-4">
              <p className="text-xs text-zinc-400">
                {isZh ? '推荐订阅格式' : 'Recommended format'}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                <span>{isZh ? '涓轰粈涔堟槸杩欎釜鏍煎紡' : 'Why this format'}</span>
                <InfoTooltip content={recommendedFormatHelpText} />
              </div>
              <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                {formatOptions.find((item) => item.key === guide.recommendedFormat)?.label ??
                  'Universal'}
              </span>
              {activeFormat !== guide.recommendedFormat && (
                <p className="text-xs leading-6 text-amber-300/90">
                  {isZh
                    ? '如果格式不一致，先去订阅页切换链接格式。'
                    : 'If the format does not match, switch it in Subscription first.'}
                </p>
              )}
            </div>
            <div className="space-y-3">
              {guide.steps.map((step, index) => (
                <div key={`${activeGuideClient.id}-${index}`} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-950/60 text-xs text-zinc-300">
                    {index + 1}
                  </span>
                  <p className="pt-0.5 text-sm text-zinc-300">{step}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="surface-card space-y-4 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <LifeBuoy className="h-4 w-4 text-amber-400" />
              {isZh ? '补充说明' : 'Notes'}
            </h2>
            <p className="text-sm leading-6 text-zinc-400">
              {isZh
                ? '这里主要负责安装和导入。共享账号、Apple ID 或排错说明都放在帮助页。'
                : 'This area is mainly for installing and importing. Shared accounts, Apple ID notes, and troubleshooting stay under Help.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => onSetSection?.('subscription')}>
                {isZh ? '去订阅页' : 'Go to subscription'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onSetSection?.('help')}>
                {isZh ? '去帮助页' : 'Go to help'}
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (section === 'help') {
    return (
      <div className="space-y-6" data-testid="portal-help-tab">
        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="surface-card space-y-4 p-6">
            <div className="space-y-1">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Apple className="h-4 w-4 text-amber-400" />
                {isZh ? '共享内容' : 'Shared resources'}
              </h2>
              <p className="text-sm text-zinc-400">
                {isZh
                  ? '大家一起用的账号、家庭组邀请、Apple ID 下载协助，以及其他数字资源会放在这里。'
                  : 'Shared accounts, family invites, Apple ID notes, and other digital resources appear here.'}
              </p>
            </div>
            {sharedResources.length > 0 ? (
              <>
                <div className="space-y-4">
                  {sharedResources.map((resource) => (
                    <div key={resource.id} className="surface-panel space-y-4 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                              {getSharedResourceKindLabel(resource.kind, isZh)}
                            </span>
                            <span className="rounded-full border border-white/10 bg-zinc-950/50 px-2.5 py-1 text-[11px] text-zinc-400">
                              {getSharedResourceAccessLabel(resource.access, isZh)}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-zinc-100">{resource.title}</p>
                          {resource.summary && (
                            <p className="text-sm leading-6 text-zinc-400">{resource.summary}</p>
                          )}
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-2"
                          onClick={() =>
                            handleCopy(resource.content, `shared-resource-${resource.id}`)
                          }
                        >
                          <Copy className="h-4 w-4" />
                          {copiedKey === `shared-resource-${resource.id}`
                            ? isZh
                              ? '已复制'
                              : 'Copied'
                            : isZh
                              ? '复制内容'
                              : 'Copy details'}
                        </Button>
                      </div>
                      <div className="whitespace-pre-wrap rounded-[18px] border border-white/10 bg-zinc-950/40 px-4 py-3 font-mono text-xs leading-6 text-zinc-300">
                        {resource.content}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="surface-panel p-4 text-sm leading-6 text-zinc-400">
                {isZh
                  ? '现在还没有可用的共享内容或额外说明。'
                  : 'There are no shared resources or extra notes here yet.'}
              </div>
            )}
          </div>
          <div className="surface-card space-y-4 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <LifeBuoy className="h-4 w-4 text-emerald-400" />
              {isZh ? '联系渠道' : 'Contact'}
            </h2>
            <div className="surface-panel p-4 text-sm leading-7 text-zinc-300">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                {isZh ? '怎么联系' : 'How to reach us'}
              </p>
              <p className="mt-2">
                {supportContact ||
                  (isZh
                    ? '现在还没有固定的联系渠道。'
                    : 'There is no fixed contact channel here yet.')}
              </p>
            </div>
            <div className="surface-panel p-4 text-sm leading-7 text-zinc-300">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                {isZh ? '补充说明' : 'Extra note'}
              </p>
              <p className="mt-2">
                {announcementText ||
                  (isZh ? '现在没有额外说明。' : 'There is no extra note right now.')}
              </p>
            </div>
          </div>
        </section>
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="surface-card space-y-4 p-6" data-testid="portal-help-troubleshooting">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Zap className="h-4 w-4 text-amber-400" />
              {isZh ? '遇到问题时可以这样试' : 'If something is not working'}
            </h2>
            {(isZh
              ? [
                  '先在客户端执行“更新订阅”后再连接。',
                  '切换其他节点重试，优先选择延迟更低的节点。',
                  '如果仍然失败，把报错截图通过支持联系方式发出。',
                ]
              : [
                  'Run "Update subscription" before connecting.',
                  'Switch to another node and prefer lower-latency options.',
                  'If it still fails, send an error screenshot through the support contact.',
                ]
            ).map((item, index) => (
              <p key={item} className="text-sm text-zinc-300">
                {index + 1}. {item}
              </p>
            ))}
          </div>
          <div className="surface-card space-y-4 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Shield className="h-4 w-4 text-emerald-400" />
              {isZh ? '回到前面的步骤' : 'Go back to setup'}
            </h2>
            <p className="text-sm leading-6 text-zinc-400">
              {isZh
                ? '这里主要放特殊说明和排错；要复制订阅或下载客户端，可以回到前面的页面。'
                : 'This area is mainly for special notes and troubleshooting. Go back to Subscription or Clients for the main steps.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => onSetSection?.('subscription')}>
                {isZh ? '回到订阅' : 'Back to subscription'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onSetSection?.('clients')}>
                {isZh ? '回到客户端' : 'Back to clients'}
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <section
      className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]"
      data-testid="portal-subscription-tab"
    >
      <div className="surface-card space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <LinkIcon className="h-4 w-4 text-emerald-400" />
            {isZh ? '订阅链接与格式' : 'Subscription links and formats'}
          </h2>
          <p className="text-sm text-zinc-400">
            {isZh
              ? '这里只放链接、格式切换和二维码，不把别的信息混进来。'
              : 'This tab stays focused on links, formats, and QR codes.'}
          </p>
        </div>
        {hasSubscription ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {formatOptions.map((format) => (
                <button
                  key={format.key}
                  type="button"
                  onClick={() => setActiveFormat(format.key)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    activeFormat === format.key
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-white/10 bg-zinc-950/50 hover:bg-zinc-800/60',
                  )}
                >
                  <p className="text-sm font-medium">{format.label}</p>
                  <p className="mt-1 text-[11px] leading-tight text-zinc-500">{format.desc}</p>
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
                >
                  <Copy className="h-4 w-4" />
                  {copiedKey === `active-${activeFormat}`
                    ? isZh
                      ? '已复制'
                      : 'Copied'
                    : isZh
                      ? '复制当前链接'
                      : 'Copy current link'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowQr((prev) => !prev)}
                >
                  <QrCode className="h-4 w-4" />
                  {showQr ? (isZh ? '隐藏二维码' : 'Hide QR') : isZh ? '显示二维码' : 'Show QR'}
                  {showQr ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </div>
              {showQr && <QrCodeCanvas url={activeSubUrl} />}
            </div>
          </div>
        ) : (
          <div className="surface-panel space-y-2 p-6 text-center">
            <p className="text-sm text-zinc-300">{t('portal.notReadyTitle')}</p>
            <p className="text-xs text-zinc-500">{t('portal.notReadyDesc')}</p>
          </div>
        )}
      </div>
      <div className="surface-card space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Shield className="h-4 w-4 text-emerald-400" />
          {isZh ? '下一步' : 'Next step'}
        </h2>
        <p className="text-sm leading-6 text-zinc-400">
          {isZh
            ? '大多数软件先用 Universal；Clash 系列再切到 Clash。复制好之后，去“客户端”继续。'
            : 'Universal works for most apps. Switch to Clash only for Clash-based clients. After copying the link, continue to Clients.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => onSetSection?.('clients')}>
            {isZh ? '去客户端' : 'Go to clients'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onSetSection?.('help')}>
            {isZh ? '去帮助页' : 'Go to help'}
          </Button>
        </div>
      </div>
    </section>
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

  if (error) return <p className="text-xs text-red-400">{error}</p>;

  return (
    <div className="flex justify-start pt-2">
      <div className="surface-panel overflow-hidden p-1">
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
}
