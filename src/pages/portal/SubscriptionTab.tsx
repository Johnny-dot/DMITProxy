import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Monitor,
  QrCode,
  Terminal,
} from 'lucide-react';
import { MirrorDownloadDialog } from '@/src/components/downloads/MirrorDownloadDialog';
import { Button } from '@/src/components/ui/Button';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';
import { useToast } from '@/src/components/ui/Toast';
import { useI18n } from '@/src/context/I18nContext';
import { cn } from '@/src/utils/cn';
import { buildClientImportUrl, isClientImportFormat } from '@/src/utils/clientImport';
import { getClientDownloadLinks, type ClientDownloadPlatform } from '@/src/utils/clientDownloads';
import { buildSubscriptionUrl } from '@/src/utils/subscription';
import type { ClientCard, PortalTab, SetupFocus, SubscriptionFormat } from './types';
import { COPY_RESET_DELAY_MS } from './types';
import {
  type ClientId,
  type GuidePlatform,
  type MirrorDialogState,
  CLIENT_META,
  DEFAULT_CLIENT_BY_PLATFORM,
  PLATFORM_CLIENT_ORDER,
  PLATFORM_OPTIONS,
  detectInitialPlatform,
  getPlatformBlurb,
  getPlatformLabel,
  getRecommendedClientId,
} from './SubscriptionTabData';
import { buildClientGuide, decorateGuideWithRealScreenshots } from './SubscriptionTabGuides';
import {
  ClientCompactCard,
  ClientHighlightCard,
  GuideScreenshotStepCard,
  GuideStepCard,
  StepHeader,
  QrCodeCanvas,
} from './SubscriptionTabCards';

interface SubscriptionTabProps {
  initialFocus?: SetupFocus;
  subId: string | null;
  onSetSection?: (tab: PortalTab) => void;
}

export function SubscriptionTab({ initialFocus = 'overview', subId }: SubscriptionTabProps) {
  const { language } = useI18n();
  const { toast } = useToast();
  const isZh = language === 'zh-CN';
  const downloadsRef = useRef<HTMLElement>(null);
  const importName = 'PrismProxy';
  const [activePlatform, setActivePlatform] = useState<GuidePlatform>(() =>
    detectInitialPlatform(),
  );
  const [activeClientId, setActiveClientId] = useState<ClientId>(() =>
    getRecommendedClientId(detectInitialPlatform()),
  );
  const [activeFormat, setActiveFormat] = useState<SubscriptionFormat>('universal');
  const [showFormatOptions, setShowFormatOptions] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [hasMarkedConnected, setHasMarkedConnected] = useState(false);
  const [showQuickQr, setShowQuickQr] = useState(false);
  const [mirrorDialog, setMirrorDialog] = useState<MirrorDialogState | null>(null);

  const subscriptionLinks = useMemo(
    () => ({
      universal: subId ? buildSubscriptionUrl(subId, 'universal') : '',
      clash: subId ? buildSubscriptionUrl(subId, 'clash') : '',
      v2ray: subId ? buildSubscriptionUrl(subId, 'v2ray') : '',
      singbox: subId ? buildSubscriptionUrl(subId, 'singbox') : '',
      surge: subId ? buildSubscriptionUrl(subId, 'surge') : '',
    }),
    [subId],
  );
  const hasSubscription = Boolean(subscriptionLinks.universal);

  const formatOptions = useMemo(
    () => [
      {
        key: 'universal' as const,
        label: 'Shadowrocket / V2Ray',
        desc: isZh
          ? '原始协议订阅，适合 Shadowrocket、v2rayN、v2rayNG'
          : 'Raw protocol links for Shadowrocket, v2rayN, and v2rayNG',
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
      {
        key: 'surge' as const,
        label: 'Surge',
        desc: isZh ? '适合 Surge 客户端' : 'For Surge clients',
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
        const useEnglishDescription =
          isZh &&
          ((client.id === 'v2rayN' && activePlatform === 'linux') ||
            client.id === 'flClash' ||
            client.id === 'clashMeta' ||
            client.id === 'sparkle' ||
            client.id === 'singBox');
        const descriptionOverride =
          client.id === 'singBox' && activePlatform === 'macos'
            ? isZh
              ? '更贴近 macOS 原生界面的 sing-box 客户端，页面里的导入步骤和应用界面更容易一一对照。'
              : 'A native-feeling sing-box client for macOS with a guide that matches the app UI.'
            : null;
        return {
          id: client.id,
          name:
            client.id === 'singBox'
              ? preferredPlatform === 'ios'
                ? 'Sing-box VT'
                : preferredPlatform === 'macos'
                  ? 'Singbox for Mac'
                  : preferredPlatform === 'linux'
                    ? 'Singbox for Linux'
                    : client.name
              : client.name,
          icon: client.icon,
          os: client.os,
          platforms: client.platforms,
          recommendedFor: client.recommendedFor,
          desc:
            descriptionOverride ??
            (useEnglishDescription ? client.descEn : isZh ? client.descZh : client.descEn),
          links: getClientDownloadLinks(client.id, preferredPlatform),
        };
      }),
    [activePlatform, isZh],
  );

  const visibleClients = useMemo(() => {
    const preferredOrder = PLATFORM_CLIENT_ORDER[activePlatform];

    return [...clients]
      .filter(
        (client) => client.platforms.includes(activePlatform) && preferredOrder.includes(client.id),
      )
      .sort((left, right) => {
        const leftIndex = preferredOrder.indexOf(left.id);
        const rightIndex = preferredOrder.indexOf(right.id);
        const normalizedLeftIndex = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
        const normalizedRightIndex = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
        return normalizedLeftIndex - normalizedRightIndex;
      });
  }, [activePlatform, clients]);
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
  const activePlatformLabel = getPlatformLabel(activePlatform, isZh);
  const ActiveClientIcon = activeClient.icon;
  const guide = decorateGuideWithRealScreenshots(
    buildClientGuide(activeClient.id, guidePlatform, guidePlatformLabel, isZh),
    activeClient.id,
    guidePlatform,
    isZh,
  );
  const activeSubUrl = subscriptionLinks[activeFormat];
  const recommendedImportFormat = isClientImportFormat(guide.recommendedFormat)
    ? guide.recommendedFormat
    : null;
  const recommendedImportUrl = recommendedImportFormat
    ? subscriptionLinks[recommendedImportFormat]
    : '';
  const oneClickImportUrl = useMemo(
    () =>
      recommendedImportFormat
        ? buildClientImportUrl({
            clientId: activeClient.id,
            platform: guidePlatform,
            subscriptionUrl: recommendedImportUrl,
            subscriptionName: importName,
            format: recommendedImportFormat,
          })
        : null,
    [activeClient.id, guidePlatform, importName, recommendedImportFormat, recommendedImportUrl],
  );
  const importUsesRecommendedFormat =
    Boolean(oneClickImportUrl) && activeFormat !== guide.recommendedFormat;
  const activeFormatOption =
    formatOptions.find((item) => item.key === activeFormat) ?? formatOptions[0];
  const recommendedFormatOption =
    formatOptions.find((item) => item.key === guide.recommendedFormat) ?? formatOptions[0];
  const usesRealGuideScreenshots = guide.steps.some((step) => Boolean(step.screenshot));
  const usesDesktopReferenceScreenshots =
    activePlatform === 'macos' && usesRealGuideScreenshots && activeClient.id === 'clashVerge';
  const usesTextOnlyGuide = !usesRealGuideScreenshots;
  const guideDescription = usesDesktopReferenceScreenshots
    ? isZh
      ? `${activeClient.name} 当前展示的是桌面版参考截图，窗口样式可能和 macOS 实际界面略有差异，但导入顺序是一致的。`
      : `${activeClient.name} is using desktop reference screenshots here. Some window chrome may differ on macOS, but the import flow is the same.`
    : usesTextOnlyGuide
      ? isZh
        ? `下面整理了 ${activeClient.name} 在 ${guidePlatformLabel} 上的常见导入路径。当前没有展示该平台的真实截图，以免和其他系统或客户端界面混淆。`
        : `These steps summarize the usual ${activeClient.name} import flow on ${guidePlatformLabel}. Matching platform screenshots are intentionally hidden here to avoid mixing in another OS or client UI.`
      : isZh
        ? `下面是 ${activeClient.name} 在 ${guidePlatformLabel} 上更接近真实界面的导入流程。`
        : `These cards show a more realistic flow for ${activeClient.name} on ${guidePlatformLabel}.`;

  useEffect(() => {
    setActiveFormat(guide.recommendedFormat);
    setShowFormatOptions(false);
  }, [guide.recommendedFormat, activeClient.id]);

  useEffect(() => {
    const target = initialFocus === 'downloads' ? downloadsRef.current : null;
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

  const handleOneClickImport = useCallback((url: string) => {
    if (!url) return;
    window.location.href = url;
  }, []);

  const openDownload = useCallback(
    (
      url: string,
      clientId?: ClientId,
      options?: {
        kind?: 'official' | 'mirror';
        managed?: boolean;
        platform?: ClientDownloadPlatform;
      },
    ) => {
      if (!url) return;
      if (clientId) setActiveClientId(clientId);
      if (options?.kind === 'mirror' && clientId && options.platform) {
        setMirrorDialog({
          url,
          clientName: clients.find((item) => item.id === clientId)?.name ?? clientId,
          clientId,
          platform: options.platform,
          managed: options.managed ?? false,
        });
        return;
      }

      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [clients],
  );

  return (
    <div className="space-y-6" data-testid="portal-setup-tab">
      <section
        className="surface-card relative overflow-hidden p-5 md:p-7"
        data-testid="portal-setup-quick"
      >
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-emerald-300/18 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-40 w-96 rounded-full bg-sky-300/10 blur-3xl" />
        <div className="relative space-y-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-300/90">
                {isZh ? '使用订阅' : 'Subscription setup'}
              </p>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
                  {isZh ? '接入控制台' : 'Setup console'}
                </h2>
                <p className="text-sm leading-7 text-zinc-400">
                  {isZh
                    ? '先确认设备和客户端，然后直接导入订阅；下载、格式和教程都跟着当前选择自动联动。'
                    : 'Confirm your device and client first, then import the subscription. Downloads, format, and guide stay synced to the current choice.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 lg:min-w-[420px]">
              <div className="min-w-0 rounded-[18px] border border-white/10 bg-white/[0.055] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:rounded-[22px] sm:px-4 sm:py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  {isZh ? '设备' : 'Device'}
                </p>
                <p className="mt-1 truncate text-sm font-medium text-zinc-100">
                  {activePlatformLabel}
                </p>
              </div>
              <div className="min-w-0 rounded-[18px] border border-white/10 bg-white/[0.055] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:rounded-[22px] sm:px-4 sm:py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  {isZh ? '客户端' : 'Client'}
                </p>
                <p className="mt-1 truncate text-sm font-medium text-zinc-100">
                  {activeClient.name}
                </p>
              </div>
              <div className="min-w-0 rounded-[18px] border border-white/10 bg-white/[0.055] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:rounded-[22px] sm:px-4 sm:py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  {isZh ? '状态' : 'Status'}
                </p>
                <p className="mt-1 truncate text-sm font-medium text-zinc-100">
                  {hasCopied
                    ? isZh
                      ? '订阅已复制'
                      : 'Link copied'
                    : isZh
                      ? '等待接入'
                      : 'Ready to connect'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div
              className="rounded-[30px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-4 md:p-5"
              data-testid="portal-setup-platforms"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-50">
                    {isZh ? '选择设备平台' : 'Choose device'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {isZh
                      ? '选择后会同步客户端、格式和教程。'
                      : 'This syncs client, format, and guide.'}
                  </p>
                </div>
                <Monitor className="h-4 w-4 text-emerald-300" />
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-2">
                {PLATFORM_OPTIONS.map((platform) => (
                  <button
                    key={platform.key}
                    type="button"
                    onClick={() => handlePlatformSelect(platform.key)}
                    data-testid={`portal-setup-platform-${platform.key}`}
                    className={cn(
                      'group rounded-[18px] border px-3 py-2.5 text-left transition-all sm:rounded-[20px] sm:px-3.5 sm:py-3',
                      activePlatform === platform.key
                        ? 'border-emerald-500/45 bg-emerald-500/12 shadow-[0_16px_45px_rgba(16,185,129,0.12)]'
                        : 'border-white/10 bg-white/[0.035] hover:border-[color:var(--border-strong)] hover:bg-white/[0.06]',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-zinc-50">
                        {isZh ? platform.zhLabel : platform.label}
                      </p>
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full transition-colors',
                          activePlatform === platform.key ? 'bg-emerald-300' : 'bg-white/20',
                        )}
                      />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                      {getPlatformBlurb(platform.key, isZh)}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div
              className="rounded-[30px] border border-emerald-500/25 bg-gradient-to-br from-white/[0.09] via-white/[0.045] to-emerald-500/[0.06] p-4 shadow-[0_24px_70px_rgba(15,23,42,0.22)] md:p-5"
              data-testid="portal-setup-link"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-black/10">
                    <ActiveClientIcon className="h-5 w-5 text-zinc-100" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-zinc-50">{activeClient.name}</p>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
                        {activeFormat === guide.recommendedFormat
                          ? isZh
                            ? '自动匹配'
                            : 'Auto-matched'
                          : isZh
                            ? '手动格式'
                            : 'Manual format'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-6 text-zinc-400">
                      {activeFormat === guide.recommendedFormat
                        ? isZh
                          ? `${activePlatformLabel} 推荐使用 ${recommendedFormatOption.label}。`
                          : `${recommendedFormatOption.label} is recommended for ${activePlatformLabel}.`
                        : isZh
                          ? `当前使用 ${activeFormatOption.label}，一键导入仍会使用 ${recommendedFormatOption.label}。`
                          : `Using ${activeFormatOption.label}; one-click import still uses ${recommendedFormatOption.label}.`}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={showFormatOptions ? 'secondary' : 'outline'}
                  size="sm"
                  className="shrink-0 gap-2"
                  onClick={() => setShowFormatOptions((current) => !current)}
                  data-testid="portal-setup-toggle-formats"
                >
                  {showFormatOptions
                    ? isZh
                      ? '收起格式'
                      : 'Hide formats'
                    : isZh
                      ? '切换格式'
                      : 'Switch format'}
                  {showFormatOptions ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              </div>

              {showFormatOptions ? (
                <div className="mt-4 grid gap-2 md:grid-cols-5 xl:grid-cols-3">
                  {formatOptions.map((format) => (
                    <button
                      key={format.key}
                      type="button"
                      onClick={() => setActiveFormat(format.key)}
                      data-testid={`portal-setup-format-${format.key}`}
                      className={cn(
                        'rounded-[18px] border p-3 text-left transition-colors',
                        activeFormat === format.key
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : 'border-white/10 bg-black/10 hover:border-[color:var(--border-strong)]',
                      )}
                    >
                      <p className="text-sm font-medium text-zinc-50">{format.label}</p>
                      <p className="mt-1 text-[11px] leading-5 text-zinc-500">{format.desc}</p>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 space-y-4">
                {hasSubscription ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 text-xs text-zinc-400">
                        <span>{isZh ? '当前可导入订阅' : 'Current import link'}</span>
                        <InfoTooltip
                          content={
                            importUsesRecommendedFormat
                              ? isZh
                                ? '手动切换格式只影响复制链接；一键导入仍使用当前客户端推荐格式。'
                                : 'Manual format switching only changes the copied link. One-click import keeps the client-recommended format.'
                              : isZh
                                ? '复制后直接粘贴到客户端，或优先尝试一键导入。'
                                : 'Copy it into the client, or try one-click import first.'
                          }
                        />
                      </div>
                      <p
                        className="break-all rounded-[22px] border border-white/10 bg-black/10 px-4 py-3 font-mono text-xs leading-6 text-zinc-300"
                        data-testid="subscription-active-url"
                      >
                        {activeSubUrl}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {oneClickImportUrl ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleOneClickImport(oneClickImportUrl)}
                          data-testid="portal-setup-one-click-import"
                          title={
                            isZh
                              ? `唤起 ${activeClient.name} 并导入推荐的 ${recommendedFormatOption.label} 订阅`
                              : `Open ${activeClient.name} and import the recommended ${recommendedFormatOption.label} link.`
                          }
                        >
                          <ExternalLink className="h-4 w-4" />
                          {isZh ? '一键导入' : 'One-click import'}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant={oneClickImportUrl ? 'outline' : 'secondary'}
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
                            ? '复制订阅'
                            : 'Copy link'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setShowQuickQr((current) => !current)}
                      >
                        <QrCode className="h-4 w-4" />
                        {showQuickQr
                          ? isZh
                            ? '隐藏二维码'
                            : 'Hide QR'
                          : isZh
                            ? '二维码'
                            : 'QR code'}
                        {showQuickQr ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() =>
                          downloadsRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          })
                        }
                      >
                        <Download className="h-4 w-4" />
                        {isZh ? '下载客户端' : 'Download client'}
                      </Button>
                    </div>
                    {showQuickQr ? <QrCodeCanvas url={activeSubUrl} isZh={isZh} /> : null}
                  </>
                ) : (
                  <div
                    className="space-y-2 rounded-[22px] border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-5 text-sm leading-7 text-zinc-300"
                    data-testid="portal-setup-not-ready"
                  >
                    <p className="font-medium text-zinc-100">
                      {isZh ? '订阅还在准备中' : 'Your subscription is still being prepared'}
                    </p>
                    <p>
                      {isZh
                        ? '你可以先下载客户端并预览导入步骤，等订阅准备好后再回来复制链接。'
                        : 'You can download the client and preview the guide now, then come back once the subscription is ready.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <section
          ref={downloadsRef}
          className="surface-card space-y-5 p-6 md:p-7"
          data-testid="portal-setup-clients"
        >
          <StepHeader
            step={2}
            icon={Download}
            title={isZh ? '客户端与下载' : 'Client and downloads'}
            description={
              isZh
                ? '推荐项会根据你的设备自动切换；如果你更熟悉其他客户端，也可以在这里改。'
                : 'The primary pick follows your device. If you prefer another client, switch here.'
            }
          />
          <div className="space-y-4">
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
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
                  {alternativeClients.map((client) => (
                    <div key={client.id} className="h-full">
                      <ClientCompactCard
                        client={client}
                        activePlatform={activePlatform}
                        isZh={isZh}
                        isActive={client.id === activeClient.id}
                        onSelect={setActiveClientId}
                        onOpenDownload={openDownload}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="surface-panel rounded-[24px] p-4 text-sm leading-6 text-zinc-400">
                  {isZh
                    ? '这个平台用当前推荐客户端就足够，直接继续下一步即可。'
                    : 'The recommended client is enough for this platform, so you can continue.'}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="surface-card space-y-5 p-6 md:p-7" data-testid="portal-setup-guide">
          <StepHeader
            step={3}
            icon={Terminal}
            title={isZh ? '按步骤导入并连接' : 'Import and connect'}
            description={guideDescription}
          />
          <div className="surface-panel rounded-[24px] p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>{isZh ? '这个客户端建议使用的格式' : 'Best format for this client'}</span>
                  <InfoTooltip
                    content={
                      isZh
                        ? '如果导入不顺利，可以回到上一步试试其他格式。'
                        : 'If import does not go smoothly, come back and try another format.'
                    }
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                    {formatOptions.find((item) => item.key === guide.recommendedFormat)?.label ??
                      'Shadowrocket / V2Ray'}
                  </span>
                  <span className="text-xs text-zinc-400">{guide.note}</span>
                  {guide.sourceUrl ? (
                    <a
                      href={guide.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
                    >
                      {guide.sourceLabel ?? 'Source'}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="rounded-[20px] border border-[color:var(--border-subtle)] bg-black/10 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  {isZh ? '当前教程' : 'Current guide'}
                </p>
                <p className="mt-2 text-sm font-medium text-zinc-100">
                  {activeClient.name} / {guidePlatformLabel}
                </p>
              </div>
            </div>
          </div>
          {usesRealGuideScreenshots ? (
            <div className="space-y-4">
              {guide.steps.map((step, index) => (
                <div key={`${activeClient.id}-${step.tone}-${index}`}>
                  <GuideScreenshotStepCard step={step} index={index} />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                {isZh
                  ? '当前客户端暂时只有简化步骤，没有站内真机图文教程。'
                  : 'This client currently uses a simplified text guide without on-site screenshots.'}
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                {guide.steps.map((step, index) => (
                  <div key={`${activeClient.id}-${step.tone}-${index}`}>
                    <GuideStepCard step={step} index={index} />
                  </div>
                ))}
              </div>
            </div>
          )}
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
      </section>

      <MirrorDownloadDialog
        open={Boolean(mirrorDialog)}
        url={mirrorDialog?.url ?? ''}
        clientName={mirrorDialog?.clientName ?? ''}
        clientId={mirrorDialog?.clientId}
        platform={mirrorDialog?.platform ?? 'windows'}
        managed={mirrorDialog?.managed ?? false}
        isZh={isZh}
        onClose={() => setMirrorDialog(null)}
      />
    </div>
  );
}
