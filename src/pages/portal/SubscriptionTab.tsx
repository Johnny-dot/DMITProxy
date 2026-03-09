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
  Smartphone,
  Terminal,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';
import { useI18n } from '@/src/context/I18nContext';
import {
  getSharedResourceAccessLabel,
  getSharedResourceKindLabel,
} from '@/src/types/sharedResource';
import { cn } from '@/src/utils/cn';
import { getClientDownloadLinks, type ClientDownloadPlatform } from '@/src/utils/clientDownloads';
import { buildSubscriptionUrl } from '@/src/utils/subscription';
import type {
  ClientCard,
  PlatformKey,
  PortalSettings,
  PortalTab,
  SetupFocus,
  SubscriptionFormat,
} from './types';
import { COPY_RESET_DELAY_MS } from './types';

type GuidePlatform = Exclude<PlatformKey, 'all'>;
type ClientId = ClientCard['id'];
type SupportPanelKey = 'resources' | 'contact' | 'troubleshooting';

interface SubscriptionTabProps {
  initialFocus?: SetupFocus;
  subId: string | null;
  portalSettings: PortalSettings | null;
  onSetSection?: (tab: PortalTab) => void;
}

const PLATFORM_OPTIONS: Array<{ key: GuidePlatform; label: string; zhLabel: string }> = [
  { key: 'windows', label: 'Windows', zhLabel: 'Windows' },
  { key: 'macos', label: 'macOS', zhLabel: 'macOS' },
  { key: 'android', label: 'Android', zhLabel: 'Android' },
  { key: 'ios', label: 'iPhone / iPad', zhLabel: 'iPhone / iPad' },
];

const CLIENT_META: Array<{
  id: ClientId;
  name: string;
  icon: typeof Monitor;
  os: string;
  platforms: GuidePlatform[];
  recommendedFor: GuidePlatform[];
  descZh: string;
  descEn: string;
}> = [
  {
    id: 'v2rayN',
    name: 'v2rayN',
    icon: Monitor,
    os: 'Windows',
    platforms: ['windows'],
    recommendedFor: ['windows'],
    descZh: 'Windows 上最直接的传统选择',
    descEn: 'A straightforward classic choice for Windows',
  },
  {
    id: 'clashVerge',
    name: 'Clash Verge',
    icon: Monitor,
    os: 'Windows / macOS',
    platforms: ['windows', 'macos'],
    recommendedFor: ['macos'],
    descZh: '适合需要规则组和策略的用户',
    descEn: 'Best when you want rules, groups, and policy control',
  },
  {
    id: 'v2rayNG',
    name: 'v2rayNG',
    icon: Smartphone,
    os: 'Android',
    platforms: ['android'],
    recommendedFor: ['android'],
    descZh: 'Android 上成熟稳定，适合日常使用',
    descEn: 'A stable Android option for everyday use',
  },
  {
    id: 'shadowrocket',
    name: 'Shadowrocket',
    icon: Apple,
    os: 'iPhone / iPad',
    platforms: ['ios'],
    recommendedFor: ['ios'],
    descZh: 'iPhone 和 iPad 上最常见的导入方式',
    descEn: 'The most common import flow on iPhone and iPad',
  },
  {
    id: 'hiddify',
    name: 'Hiddify',
    icon: Smartphone,
    os: 'Windows / macOS / Android / iPhone / iPad',
    platforms: ['windows', 'macos', 'android', 'ios'],
    recommendedFor: ['windows', 'android', 'ios'],
    descZh: '上手最快，支持 URL、剪贴板和二维码导入',
    descEn: 'Fastest to onboard with URL, clipboard, and QR import',
  },
];

const ALL_SUPPORT_PANELS: SupportPanelKey[] = ['resources', 'contact', 'troubleshooting'];

function detectInitialPlatform(): GuidePlatform {
  if (typeof window === 'undefined') return 'windows';
  const ua = window.navigator.userAgent.toLowerCase();
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macos';
  return 'windows';
}

function getPlatformLabel(platform: GuidePlatform, isZh: boolean) {
  return (
    PLATFORM_OPTIONS.find((item) => item.key === platform)?.[isZh ? 'zhLabel' : 'label'] ??
    'Windows'
  );
}

function getRecommendedClientId(platform: GuidePlatform): ClientId {
  return (
    CLIENT_META.find((client) => client.recommendedFor.includes(platform))?.id ??
    CLIENT_META.find((client) => client.platforms.includes(platform))?.id ??
    'hiddify'
  );
}

function buildClientGuide(
  clientId: ClientId,
  platform: GuidePlatform,
  platformLabel: string,
  isZh: boolean,
) {
  if (clientId === 'clashVerge') {
    return {
      recommendedFormat: 'clash' as const,
      steps: isZh
        ? [
            '先保持当前推荐客户端为 Clash Verge，然后把订阅格式切到 Clash。',
            '在 Profiles 里导入订阅 URL，更新后会看到策略组。',
            '选择合适的策略组，再开启系统代理或 TUN。',
          ]
        : [
            'Keep Clash Verge selected, then switch the subscription format to Clash.',
            'Import the subscription URL in Profiles and refresh it to load policy groups.',
            'Choose a group, then enable system proxy or TUN mode.',
          ],
    };
  }

  if (clientId === 'shadowrocket') {
    return {
      recommendedFormat: 'universal' as const,
      steps: isZh
        ? [
            '打开 Shadowrocket，点击右上角加号创建订阅。',
            '把当前页面复制的订阅链接粘贴到 URL。',
            '保存后刷新订阅，选择节点并允许 VPN 连接。',
          ]
        : [
            'Open Shadowrocket and tap the plus button to create a subscription.',
            'Paste the copied subscription link into the URL field.',
            'Save it, refresh the subscription, pick a node, and allow VPN.',
          ],
    };
  }

  if (clientId === 'v2rayNG') {
    return {
      recommendedFormat: 'universal' as const,
      steps: isZh
        ? [
            '打开 v2rayNG 的订阅分组或右上角加号菜单。',
            '从剪贴板或 URL 导入当前订阅链接。',
            '更新订阅后选择节点，并允许 VPN 权限。',
          ]
        : [
            'Open the subscription group or plus menu in v2rayNG.',
            'Import the current subscription from clipboard or URL.',
            'Refresh it, choose a node, and allow VPN permission.',
          ],
    };
  }

  if (clientId === 'v2rayN') {
    return {
      recommendedFormat: 'universal' as const,
      steps: isZh
        ? [
            '首次打开时先完成内核初始化。',
            '从订阅菜单里导入当前页面复制的链接。',
            '更新成功后选择节点并开启系统代理。',
          ]
        : [
            'Finish the initial core setup the first time you open it.',
            'Import the copied link from the subscription menu.',
            'Refresh it, select a node, and enable system proxy.',
          ],
    };
  }

  return {
    recommendedFormat: 'universal' as const,
    steps: isZh
      ? [
          `在 ${platformLabel} 上打开 Hiddify。`,
          '从 URL、剪贴板或二维码导入当前订阅。',
          platform === 'android' || platform === 'ios'
            ? '保存后点击连接，并允许 VPN。'
            : '保存后点击连接，并允许系统代理权限。',
        ]
      : [
          `Open Hiddify on ${platformLabel}.`,
          'Import the current subscription from URL, clipboard, or QR.',
          platform === 'android' || platform === 'ios'
            ? 'Save it, connect, and allow VPN.'
            : 'Save it, connect, and allow system proxy permission.',
        ],
  };
}

function togglePanel(current: SupportPanelKey[], key: SupportPanelKey) {
  return current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
}

export function SubscriptionTab({
  initialFocus = 'overview',
  subId,
  portalSettings,
  onSetSection,
}: SubscriptionTabProps) {
  const { language } = useI18n();
  const isZh = language === 'zh-CN';
  const downloadsRef = useRef<HTMLElement>(null);
  const supportRef = useRef<HTMLElement>(null);
  const [activePlatform, setActivePlatform] = useState<GuidePlatform>(() =>
    detectInitialPlatform(),
  );
  const [activeClientId, setActiveClientId] = useState<ClientId>(() =>
    getRecommendedClientId(detectInitialPlatform()),
  );
  const [activeFormat, setActiveFormat] = useState<SubscriptionFormat>('universal');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [hasOpenedDownload, setHasOpenedDownload] = useState(false);
  const [hasMarkedConnected, setHasMarkedConnected] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [openPanels, setOpenPanels] = useState<SupportPanelKey[]>([]);

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

  const formatOptions = useMemo(
    () => [
      {
        key: 'universal' as const,
        label: 'Universal',
        desc: isZh ? '适合大多数客户端' : 'Works with most clients',
      },
      {
        key: 'clash' as const,
        label: 'Clash',
        desc: isZh ? '更适合 Clash 系列' : 'Best for Clash-based clients',
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

  const clients = useMemo<ClientCard[]>(
    () =>
      CLIENT_META.map((client) => {
        const preferredPlatform = client.platforms.includes(activePlatform)
          ? activePlatform
          : ((client.recommendedFor[0] ?? client.platforms[0]) as ClientDownloadPlatform);
        return {
          id: client.id,
          name: client.name,
          icon: client.icon,
          os: client.os,
          platforms: client.platforms,
          recommendedFor: client.recommendedFor,
          desc: isZh ? client.descZh : client.descEn,
          links: getClientDownloadLinks(client.id, preferredPlatform),
        };
      }),
    [activePlatform, isZh],
  );

  const visibleClients = useMemo(
    () => clients.filter((client) => client.platforms.includes(activePlatform)),
    [activePlatform, clients],
  );
  const recommendedClientId = useMemo(
    () => getRecommendedClientId(activePlatform),
    [activePlatform],
  );

  useEffect(() => {
    if (!visibleClients.some((client) => client.id === activeClientId)) {
      setActiveClientId(recommendedClientId);
    }
  }, [activeClientId, recommendedClientId, visibleClients]);

  const activeClient =
    visibleClients.find((client) => client.id === activeClientId) ??
    visibleClients[0] ??
    clients[0];
  const alternativeClients = visibleClients.filter((client) => client.id !== recommendedClientId);
  const guidePlatform: GuidePlatform = activeClient.platforms.includes(activePlatform)
    ? activePlatform
    : (activeClient.recommendedFor[0] ?? activeClient.platforms[0] ?? 'windows');
  const guidePlatformLabel = getPlatformLabel(guidePlatform, isZh);
  const guide = buildClientGuide(activeClient.id, guidePlatform, guidePlatformLabel, isZh);
  const activeSubUrl = subscriptionLinks[activeFormat];

  const sharedResources = (portalSettings?.sharedResources ?? []).filter(
    (item) => item.active && (item.title.trim() || item.content.trim() || item.summary.trim()),
  );
  const supportContact = portalSettings?.supportTelegram?.trim() ?? '';
  const announcementText = portalSettings?.announcementActive
    ? portalSettings.announcementText.trim()
    : '';

  useEffect(() => {
    setActiveFormat(guide.recommendedFormat);
  }, [guide.recommendedFormat, activeClient.id]);

  useEffect(() => {
    if (initialFocus === 'support') {
      setOpenPanels(ALL_SUPPORT_PANELS);
    }

    const target =
      initialFocus === 'downloads'
        ? downloadsRef.current
        : initialFocus === 'support'
          ? supportRef.current
          : null;
    if (!target) return;

    const timer = window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [initialFocus]);

  const handlePlatformSelect = useCallback((platform: GuidePlatform) => {
    setActivePlatform(platform);
    setActiveClientId(getRecommendedClientId(platform));
  }, []);

  const handleCopy = useCallback((text: string, key: string) => {
    if (!text) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setHasCopied(true);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, COPY_RESET_DELAY_MS);
    });
  }, []);

  const openDownload = useCallback((url: string, clientId?: ClientId) => {
    if (!url) return;
    if (clientId) setActiveClientId(clientId);
    setHasOpenedDownload(true);
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <div className="space-y-6" data-testid="portal-setup-tab">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section
            className="surface-card space-y-5 p-6 md:p-7"
            data-testid="portal-setup-platforms"
          >
            <StepHeader
              step={1}
              icon={Monitor}
              title={isZh ? '先选你的设备平台' : 'Start with your device'}
              description={
                isZh
                  ? '先选你最常用的设备，我们会带你走最合适的接入方式。'
                  : 'Choose the device you use most, and we will guide you through the best setup path for it.'
              }
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {PLATFORM_OPTIONS.map((platform) => {
                const isActive = activePlatform === platform.key;
                return (
                  <button
                    key={platform.key}
                    type="button"
                    onClick={() => handlePlatformSelect(platform.key)}
                    data-testid={`portal-setup-platform-${platform.key}`}
                    className={cn(
                      'rounded-[24px] border px-4 py-4 text-left transition-colors',
                      isActive
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-[color:var(--border-subtle)] bg-[var(--surface-panel)] hover:border-[color:var(--border-strong)]',
                    )}
                  >
                    <p className="text-sm font-medium text-zinc-50">
                      {isZh ? platform.zhLabel : platform.label}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-zinc-400">
                      {platform.key === 'windows'
                        ? isZh
                          ? '适合电脑端日常使用'
                          : 'A solid choice for desktop use'
                        : platform.key === 'macos'
                          ? isZh
                            ? '适合偏好规则和策略的用户'
                            : 'Best if you prefer rules and policy groups'
                          : platform.key === 'android'
                            ? isZh
                              ? '适合手机上快速导入'
                              : 'Great for quick setup on your phone'
                            : isZh
                              ? '适合 iPhone 和 iPad 导入'
                              : 'Best for import on iPhone and iPad'}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          <section
            ref={downloadsRef}
            className="surface-card space-y-5 p-6 md:p-7"
            data-testid="portal-setup-clients"
          >
            <StepHeader
              step={2}
              icon={Download}
              title={isZh ? '下载推荐客户端' : 'Download a recommended client'}
              description={
                isZh
                  ? '先从推荐客户端开始，下面也保留了几个常用备选。'
                  : 'Start with the recommended client, with a few common alternatives kept below.'
              }
            />

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <ClientHighlightCard
                client={clients.find((item) => item.id === recommendedClientId) ?? activeClient}
                activePlatform={activePlatform}
                isZh={isZh}
                isActive={activeClient.id === recommendedClientId}
                onSelect={setActiveClientId}
                onOpenDownload={openDownload}
              />

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  {isZh ? '备选客户端' : 'Alternatives'}
                </p>
                {alternativeClients.length > 0 ? (
                  alternativeClients.map((client) => (
                    <div key={client.id}>
                      <ClientCompactCard
                        client={client}
                        isZh={isZh}
                        isActive={client.id === activeClient.id}
                        onSelect={setActiveClientId}
                        onOpenDownload={openDownload}
                      />
                    </div>
                  ))
                ) : (
                  <div className="surface-panel rounded-[24px] p-4 text-sm leading-6 text-zinc-400">
                    {isZh
                      ? '这个平台用这一款就够了，继续下一步就可以。'
                      : 'This platform works well with this one client, so you can continue to the next step.'}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="surface-card space-y-5 p-6 md:p-7" data-testid="portal-setup-link">
            <StepHeader
              step={3}
              icon={LinkIcon}
              title={isZh ? '复制匹配好的订阅链接' : 'Copy the matched subscription link'}
              description={
                isZh
                  ? '下面这条链接会优先匹配当前推荐客户端；如果你熟悉格式，也可以手动切换。'
                  : 'The link below is matched to the current recommended client first, but you can still switch formats manually if you know what you need.'
              }
            />

            <div className="grid gap-2 md:grid-cols-4">
              {formatOptions.map((format) => (
                <button
                  key={format.key}
                  type="button"
                  onClick={() => setActiveFormat(format.key)}
                  data-testid={`portal-setup-format-${format.key}`}
                  className={cn(
                    'rounded-[20px] border p-3 text-left transition-colors',
                    activeFormat === format.key
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-[color:var(--border-subtle)] bg-[var(--surface-panel)] hover:border-[color:var(--border-strong)]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-50">{format.label}</p>
                    {guide.recommendedFormat === format.key ? (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                        {isZh ? '当前推荐' : 'Recommended'}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-zinc-400">{format.desc}</p>
                </button>
              ))}
            </div>

            <div className="surface-panel space-y-4 rounded-[28px] p-4 md:p-5">
              {hasSubscription ? (
                <>
                  <div className="flex items-center gap-1 text-xs text-zinc-400">
                    <span>{isZh ? '可直接导入的链接' : 'Ready-to-import link'}</span>
                    <InfoTooltip
                      content={
                        isZh
                          ? '复制后，把它粘贴到客户端里即可。'
                          : 'Copy it, then paste it into your client.'
                      }
                    />
                  </div>
                  <p
                    className="break-all rounded-[20px] border border-[color:var(--border-subtle)] bg-black/10 px-4 py-3 font-mono text-xs leading-6 text-zinc-300"
                    data-testid="subscription-active-url"
                  >
                    {activeSubUrl}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleCopy(activeSubUrl, `active-${activeFormat}`)}
                      data-testid="portal-setup-copy-link"
                    >
                      <Copy className="h-4 w-4" />
                      {copiedKey === `active-${activeFormat}`
                        ? isZh
                          ? '已复制'
                          : 'Copied'
                        : isZh
                          ? '复制订阅链接'
                          : 'Copy subscription link'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setShowQr((current) => !current)}
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
                  {showQr ? <QrCodeCanvas url={activeSubUrl} isZh={isZh} /> : null}
                </>
              ) : (
                <div
                  className="space-y-2 rounded-[20px] border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-5 text-sm leading-7 text-zinc-300"
                  data-testid="portal-setup-not-ready"
                >
                  <p className="font-medium text-zinc-100">
                    {isZh ? '订阅还在准备中' : 'Your subscription is still being prepared'}
                  </p>
                  <p>
                    {isZh
                      ? '你可以先下载客户端并看导入步骤，订阅准备好后再回来复制链接。'
                      : 'You can download the client and preview the import steps now, then come back to copy the link once the subscription is ready.'}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="surface-card space-y-5 p-6 md:p-7" data-testid="portal-setup-guide">
            <StepHeader
              step={4}
              icon={Terminal}
              title={isZh ? '按步骤导入并连接' : 'Import and connect'}
              description={
                isZh
                  ? `下面就是 ${activeClient.name} 在 ${guidePlatformLabel} 上的导入步骤。`
                  : `These are the import steps for ${activeClient.name} on ${guidePlatformLabel}.`
              }
            />

            <div className="surface-panel rounded-[24px] p-4">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span>{isZh ? '适合这个客户端的格式' : 'Best format for this client'}</span>
                <InfoTooltip
                  content={
                    isZh
                      ? '如果导入不顺利，可以回来试试其他格式。'
                      : 'If import does not go smoothly, come back and try another format.'
                  }
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                  {formatOptions.find((item) => item.key === guide.recommendedFormat)?.label ??
                    'Universal'}
                </span>
                <span className="text-xs text-zinc-400">
                  {isZh
                    ? '如果你换了客户端，记得顺手确认一下这里的格式。'
                    : 'If you switch clients, it is worth rechecking the format here.'}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {guide.steps.map((step, index) => (
                <div key={`${activeClient.id}-${index}`} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] text-xs text-zinc-300">
                    {index + 1}
                  </span>
                  <p className="pt-0.5 text-sm leading-7 text-zinc-300">{step}</p>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant={hasMarkedConnected ? 'secondary' : 'outline'}
              size="sm"
              className="gap-2"
              onClick={() => setHasMarkedConnected((current) => !current)}
            >
              <Check className="h-4 w-4" />
              {hasMarkedConnected
                ? isZh
                  ? '已标记为导入完成'
                  : 'Marked as completed'
                : isZh
                  ? '导入成功后点此标记'
                  : 'Mark this after you connect successfully'}
            </Button>
          </section>
        </div>

        <div className="space-y-6">
          <section
            className="surface-card space-y-5 p-6 md:p-7"
            data-testid="portal-setup-progress"
          >
            <div className="space-y-2">
              <p className="section-kicker">{isZh ? '接入进度' : 'Setup progress'}</p>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
                {isZh ? '按这三步完成连接' : 'Finish setup in these three steps'}
              </h2>
            </div>

            <div className="grid gap-3">
              <SummaryItem
                label={isZh ? '设备平台' : 'Device'}
                value={getPlatformLabel(activePlatform, isZh)}
              />
              <SummaryItem
                label={isZh ? '推荐客户端' : 'Recommended client'}
                value={
                  clients.find((item) => item.id === recommendedClientId)?.name ?? activeClient.name
                }
              />
              <SummaryItem
                label={isZh ? '当前导入教程' : 'Current guide'}
                value={`${activeClient.name} / ${guidePlatformLabel}`}
              />
              <SummaryItem
                label={isZh ? '当前订阅格式' : 'Current format'}
                value={
                  formatOptions.find((item) => item.key === activeFormat)?.label ?? 'Universal'
                }
              />
            </div>

            <div className="space-y-3">
              {[
                { title: isZh ? '下载客户端' : 'Download client', done: hasOpenedDownload },
                {
                  title: isZh ? '复制订阅链接' : 'Copy subscription link',
                  done: hasSubscription && hasCopied,
                },
                {
                  title: isZh ? '完成导入并连接' : 'Finish import and connect',
                  done: hasMarkedConnected,
                },
              ].map((item, index) => (
                <div
                  key={item.title}
                  className={cn(
                    'flex items-center gap-3 rounded-[20px] border px-4 py-3',
                    item.done
                      ? 'border-emerald-500/30 bg-emerald-500/10'
                      : 'border-[color:var(--border-subtle)] bg-[var(--surface-panel)]',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full border text-xs',
                      item.done
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-[color:var(--border-subtle)] text-zinc-400',
                    )}
                  >
                    {item.done ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className="text-sm text-zinc-100">{item.title}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card space-y-4 p-6 md:p-7">
            <div className="space-y-2">
              <p className="section-kicker">{isZh ? '更多帮助' : 'More help'}</p>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
                {isZh ? '需要时，再展开这些说明' : 'Open these notes only when you need them'}
              </h2>
            </div>
            <p className="text-sm leading-7 text-zinc-400">
              {isZh
                ? '共享资源、公告和排错建议都放在下面，需要时再展开，不会打断主流程。'
                : 'Shared resources, announcements, and troubleshooting are kept below so you can open them only when you need them.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setOpenPanels(ALL_SUPPORT_PANELS)}
              >
                {isZh ? '展开全部补充说明' : 'Open all support notes'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSetSection?.('community')}
              >
                {isZh ? '查看社区入口' : 'Open community'}
              </Button>
            </div>
          </section>
        </div>
      </section>

      <section ref={supportRef} className="space-y-4" data-testid="portal-setup-support">
        <div className="space-y-2 px-1">
          <p className="section-kicker">{isZh ? '补充帮助' : 'Extra help'}</p>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
            {isZh
              ? '共享资源、支持和排错都在这里'
              : 'Shared resources, support, and troubleshooting'}
          </h2>
        </div>

        <CollapsiblePanel
          title={isZh ? '共享资源与额外账号' : 'Shared resources and extra accounts'}
          description={
            isZh
              ? '如果你需要 Apple ID、共享账号或补充资料，在这里查看。'
              : 'Look here when you need an Apple ID, shared account details, or extra access notes.'
          }
          open={openPanels.includes('resources')}
          onToggle={() => setOpenPanels((current) => togglePanel(current, 'resources'))}
          testId="portal-setup-support-resources"
        >
          {sharedResources.length > 0 ? (
            <div className="space-y-4">
              {sharedResources.map((resource) => (
                <div key={resource.id} className="surface-panel space-y-4 rounded-[24px] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
                          {getSharedResourceKindLabel(resource.kind, isZh)}
                        </span>
                        <span className="rounded-full border border-[color:var(--border-subtle)] bg-black/10 px-2.5 py-1 text-[11px] text-zinc-400">
                          {getSharedResourceAccessLabel(resource.access, isZh)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-zinc-100">{resource.title}</p>
                      {resource.summary ? (
                        <p className="text-sm leading-7 text-zinc-400">{resource.summary}</p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleCopy(resource.content, `shared-${resource.id}`)}
                    >
                      <Copy className="h-4 w-4" />
                      {copiedKey === `shared-${resource.id}`
                        ? isZh
                          ? '已复制'
                          : 'Copied'
                        : isZh
                          ? '复制内容'
                          : 'Copy details'}
                    </Button>
                  </div>
                  <div className="whitespace-pre-wrap rounded-[20px] border border-[color:var(--border-subtle)] bg-black/10 px-4 py-3 font-mono text-xs leading-6 text-zinc-300">
                    {resource.content}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-7 text-zinc-400">
              {isZh
                ? '当前还没有可用的共享资源或额外账号说明。'
                : 'There are no shared resources or extra account notes available right now.'}
            </p>
          )}
        </CollapsiblePanel>

        <CollapsiblePanel
          title={isZh ? '联系支持与服务说明' : 'Support contact and service notes'}
          description={
            isZh
              ? '需要人工协助，或想确认服务说明时，看这里。'
              : 'Look here when you need human help or want to check service notes.'
          }
          open={openPanels.includes('contact')}
          onToggle={() => setOpenPanels((current) => togglePanel(current, 'contact'))}
          testId="portal-setup-support-contact"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="surface-panel rounded-[24px] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                {isZh ? '联系渠道' : 'Support contact'}
              </p>
              <p className="mt-3 text-sm leading-7 text-zinc-300">
                {supportContact ||
                  (isZh
                    ? '当前还没有固定的联系渠道。'
                    : 'There is no fixed support contact configured right now.')}
              </p>
            </div>
            <div className="surface-panel rounded-[24px] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                {isZh ? '额外说明' : 'Announcement'}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                {announcementText ||
                  (isZh ? '当前没有额外公告说明。' : 'There is no active announcement right now.')}
              </p>
            </div>
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel
          title={isZh ? '排错建议' : 'Troubleshooting'}
          description={
            isZh
              ? '导入后仍然无法连接时，按这个顺序排查。'
              : 'If it still does not work after import, troubleshoot in this order.'
          }
          open={openPanels.includes('troubleshooting')}
          onToggle={() => setOpenPanels((current) => togglePanel(current, 'troubleshooting'))}
          testId="portal-setup-support-troubleshooting"
        >
          <div className="space-y-3">
            {(isZh
              ? [
                  '先在客户端里执行“更新订阅”或刷新配置，再重新连接。',
                  '切换到其他节点重试，优先选择延迟更低、状态正常的节点。',
                  '如果仍然失败，把报错截图、客户端名和设备平台一起发给支持渠道。',
                ]
              : [
                  'Run "update subscription" or refresh the profile in the client before reconnecting.',
                  'Try another node and prefer one with lower latency and a healthy status.',
                  'If it still fails, send the error screenshot, client name, and device platform to support.',
                ]
            ).map((item, index) => (
              <div key={item} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] text-xs text-zinc-300">
                  {index + 1}
                </span>
                <p className="pt-0.5 text-sm leading-7 text-zinc-300">{item}</p>
              </div>
            ))}
          </div>
        </CollapsiblePanel>
      </section>
    </div>
  );
}

function StepHeader({
  step,
  icon: Icon,
  title,
  description,
}: {
  step: number;
  icon: typeof Monitor;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-sm font-medium text-emerald-300">
          {step}
        </span>
        <div className="flex items-center gap-2 text-lg font-semibold text-zinc-50">
          <Icon className="h-4 w-4 text-emerald-400" />
          <span>{title}</span>
        </div>
      </div>
      <p className="max-w-3xl text-sm leading-7 text-zinc-400">{description}</p>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-panel flex items-center justify-between gap-3 rounded-[20px] px-4 py-3">
      <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</span>
      <span className="text-sm font-medium text-zinc-100">{value}</span>
    </div>
  );
}

function ClientHighlightCard({
  client,
  activePlatform,
  isZh,
  isActive,
  onSelect,
  onOpenDownload,
}: {
  client: ClientCard;
  activePlatform: GuidePlatform;
  isZh: boolean;
  isActive: boolean;
  onSelect: (clientId: ClientId) => void;
  onOpenDownload: (url: string, clientId?: ClientId) => void;
}) {
  return (
    <div
      className={cn(
        'rounded-[28px] border p-5 transition-colors',
        isActive
          ? 'border-emerald-500/40 bg-emerald-500/10'
          : 'border-[color:var(--border-subtle)] bg-[var(--surface-panel)]',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
            {isZh ? '主推荐' : 'Primary pick'}
          </span>
          <div className="flex items-center gap-3">
            <client.icon className="h-5 w-5 text-zinc-300" />
            <div>
              <p className="text-base font-semibold text-zinc-50">{client.name}</p>
              <p className="text-xs leading-6 text-zinc-400">{client.os}</p>
            </div>
          </div>
          <p className="max-w-xl text-sm leading-7 text-zinc-300">{client.desc}</p>
          <p className="text-xs leading-6 text-zinc-500">
            {isZh
              ? `当前按 ${getPlatformLabel(activePlatform, true)} 给你推荐这款客户端。`
              : `Recommended for ${getPlatformLabel(activePlatform, false)} right now.`}
          </p>
        </div>
        <Button
          type="button"
          variant={isActive ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => onSelect(client.id)}
        >
          {isZh ? '使用这个客户端' : 'Use this client'}
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-2"
          onClick={() => onOpenDownload(client.links.github, client.id)}
          data-testid="portal-setup-download-primary"
        >
          <Download className="h-4 w-4" />
          {isZh ? '下载客户端' : 'Download client'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => onOpenDownload(client.links.github, client.id)}
        >
          <ExternalLink className="h-4 w-4" />
          {isZh ? '官方源' : 'Official'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => onOpenDownload(client.links.vps, client.id)}
          disabled={!client.links.vps}
        >
          <ExternalLink className="h-4 w-4" />
          {isZh ? '镜像下载' : 'Mirror'}
        </Button>
      </div>
    </div>
  );
}

function ClientCompactCard({
  client,
  isZh,
  isActive,
  onSelect,
  onOpenDownload,
}: {
  client: ClientCard;
  isZh: boolean;
  isActive: boolean;
  onSelect: (clientId: ClientId) => void;
  onOpenDownload: (url: string, clientId?: ClientId) => void;
}) {
  return (
    <div
      className={cn(
        'surface-panel rounded-[24px] border p-4 transition-colors',
        isActive && 'border-emerald-500/30 bg-emerald-500/5',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <client.icon className="h-4 w-4 text-zinc-400" />
          <div>
            <p className="text-sm font-medium text-zinc-100">{client.name}</p>
            <p className="text-xs leading-6 text-zinc-400">{client.desc}</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(client.id)}>
          {isZh ? '切换' : 'Select'}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => onOpenDownload(client.links.github, client.id)}
        >
          <ExternalLink className="h-4 w-4" />
          {isZh ? '官方' : 'Official'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => onOpenDownload(client.links.vps, client.id)}
          disabled={!client.links.vps}
        >
          <ExternalLink className="h-4 w-4" />
          {isZh ? '镜像' : 'Mirror'}
        </Button>
      </div>
    </div>
  );
}

function CollapsiblePanel({
  title,
  description,
  open,
  onToggle,
  testId,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="surface-card p-5 md:p-6"
      data-testid={testId}
      data-state={open ? 'open' : 'closed'}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-zinc-50">{title}</h3>
          <p className="text-sm leading-7 text-zinc-400">{description}</p>
        </div>
        <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] text-zinc-400">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

function QrCodeCanvas({ url, isZh }: { url: string; isZh: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  const render = useCallback(
    (canvas: HTMLCanvasElement, targetUrl: string) => {
      import('qrcode')
        .then((mod) => {
          const qrModule = (mod as { default?: unknown }).default ?? mod;
          return (
            qrModule.toCanvas as (
              element: HTMLCanvasElement,
              text: string,
              options: object,
            ) => Promise<void>
          )(canvas, targetUrl, {
            width: 200,
            margin: 2,
            color: { dark: '#d4d4d8', light: '#18181b' },
          });
        })
        .then(() => setError(null))
        .catch(() => setError(isZh ? '生成二维码失败' : 'Failed to generate QR code'));
    },
    [isZh],
  );

  useEffect(() => {
    if (canvasRef.current && url) {
      render(canvasRef.current, url);
    }
  }, [url, render]);

  if (error) {
    return <p className="text-xs text-red-400">{error}</p>;
  }

  return (
    <div className="flex justify-start pt-2">
      <div className="surface-panel overflow-hidden rounded-[22px] p-2">
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
}
