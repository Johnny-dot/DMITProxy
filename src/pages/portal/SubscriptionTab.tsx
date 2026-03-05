import React, { useMemo, useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Smartphone,
  Monitor,
  Apple,
  ExternalLink,
  Download,
  Link as LinkIcon,
  Shield,
  Terminal,
  Zap,
} from 'lucide-react';
import { cn } from '@/src/utils/cn';
import { useI18n } from '@/src/context/I18nContext';
import { Button } from '@/src/components/ui/Button';
import { buildSubscriptionUrl } from '@/src/utils/subscription';
import { getClientDownloadLinks } from '@/src/utils/clientDownloads';
import type { ClientCard, PlatformKey, SubscriptionFormat } from './types';
import { COPY_RESET_DELAY_MS } from './types';

interface SubscriptionTabProps {
  subId: string | null;
}

export function SubscriptionTab({ subId }: SubscriptionTabProps) {
  const { t, language } = useI18n();
  const isZh = language === 'zh-CN';

  const [activeFormat, setActiveFormat] = useState<SubscriptionFormat>('universal');
  const [activePlatform, setActivePlatform] = useState<PlatformKey>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [hasOpenedDownload, setHasOpenedDownload] = useState(false);
  const [hasMarkedConnected, setHasMarkedConnected] = useState(false);

  // Auto-detect platform
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
        desc: isZh ? '推荐 Clash 系列' : 'Recommended for Clash clients',
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

  const clients = useMemo<ClientCard[]>(
    () => [
      {
        id: 'v2rayN',
        name: 'v2rayN',
        os: 'Windows',
        icon: Monitor,
        platforms: ['windows'],
        recommendedFor: ['windows'],
        links: getClientDownloadLinks('v2rayN'),
        desc: t('portal.recommendedFor', { platform: 'Windows' }),
      },
      {
        id: 'v2rayNG',
        name: 'v2rayNG',
        os: 'Android',
        icon: Smartphone,
        platforms: ['android'],
        recommendedFor: ['android'],
        links: getClientDownloadLinks('v2rayNG'),
        desc: t('portal.recommendedFor', { platform: 'Android' }),
      },
      {
        id: 'shadowrocket',
        name: 'Shadowrocket',
        os: 'iOS',
        icon: Apple,
        platforms: ['ios'],
        recommendedFor: ['ios'],
        links: getClientDownloadLinks('shadowrocket'),
        desc: t('portal.recommendedFor', { platform: 'iPhone/iPad' }),
      },
      {
        id: 'clashVerge',
        name: 'Clash Verge',
        os: 'Windows / macOS',
        icon: Monitor,
        platforms: ['windows', 'macos'],
        recommendedFor: ['macos'],
        links: getClientDownloadLinks('clashVerge'),
        desc: t('portal.advancedRules'),
      },
      {
        id: 'hiddify',
        name: 'Hiddify',
        os: 'Windows / macOS / Android / iOS',
        icon: Smartphone,
        platforms: ['windows', 'macos', 'android', 'ios'],
        recommendedFor: ['windows', 'android', 'ios'],
        links: getClientDownloadLinks('hiddify'),
        desc: t('portal.easyToUse'),
      },
    ],
    [t],
  );

  const tutorialMap = useMemo<Record<Exclude<PlatformKey, 'all'>, string[]>>(
    () => ({
      windows: [
        t('subscriptions.tutorial.windows1'),
        t('subscriptions.tutorial.windows2'),
        t('subscriptions.tutorial.windows3'),
      ],
      macos: [
        t('subscriptions.tutorial.macos1'),
        t('subscriptions.tutorial.macos2'),
        t('subscriptions.tutorial.macos3'),
      ],
      ios: [
        t('subscriptions.tutorial.ios1'),
        t('subscriptions.tutorial.ios2'),
        t('subscriptions.tutorial.ios3'),
      ],
      android: [
        t('subscriptions.tutorial.android1'),
        t('subscriptions.tutorial.android2'),
        t('subscriptions.tutorial.android3'),
      ],
    }),
    [t],
  );

  const troubleshooting = isZh
    ? [
        '先在客户端执行"更新订阅"再连接。',
        '切换其它节点重试，优先选择低延迟节点。',
        '若仍失败，把报错截图发给管理员排查。',
      ]
    : [
        'Run "Update subscription" in the client before connecting.',
        'Switch to another node and prefer lower latency options.',
        'If it still fails, send an error screenshot to your admin.',
      ];

  const guidePlatform: Exclude<PlatformKey, 'all'> =
    activePlatform === 'all' ? 'windows' : activePlatform;
  const guideSteps = tutorialMap[guidePlatform];
  const currentGuideLabel =
    platformOptions.find((item) => item.key === guidePlatform)?.label ?? 'Windows';
  const visibleClients = useMemo(
    () =>
      activePlatform === 'all'
        ? clients
        : clients.filter((c) => c.platforms.includes(activePlatform)),
    [activePlatform, clients],
  );

  const setupSteps = [
    {
      id: 'copy',
      title: isZh ? '复制订阅链接' : 'Copy subscription URL',
      done: hasSubscription && hasCopied,
    },
    { id: 'download', title: isZh ? '下载客户端' : 'Download a client', done: hasOpenedDownload },
    { id: 'connect', title: isZh ? '导入并连接' : 'Import and connect', done: hasMarkedConnected },
  ];
  const completedCount = setupSteps.filter((s) => s.done).length;

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setHasCopied(true);
      setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), COPY_RESET_DELAY_MS);
    });
  };

  const openDownload = (url: string) => {
    if (!url) return;
    setHasOpenedDownload(true);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      {/* Step 1: Copy subscription URL + Setup checklist */}
      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-emerald-400" />
              <span>{isZh ? '步骤 1：复制订阅链接' : 'Step 1: Copy subscription URL'}</span>
            </h2>
            <p className="text-sm text-zinc-400">{t('portal.subscriptionDesc')}</p>
          </div>

          {hasSubscription ? (
            <div className="space-y-4">
              <div className="grid gap-2 md:grid-cols-4">
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
                    <p className="text-[11px] text-zinc-500 mt-0.5">{format.desc}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-4 space-y-3">
                <p className="font-mono text-xs text-zinc-300 break-all">{activeSubUrl}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={() => handleCopy(activeSubUrl, `active-${activeFormat}`)}
                >
                  {copiedKey === `active-${activeFormat}` ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copiedKey === `active-${activeFormat}`
                    ? t('portal.copied')
                    : isZh
                      ? `复制 ${formatOptions.find((item) => item.key === activeFormat)?.label} 链接`
                      : `Copy ${formatOptions.find((item) => item.key === activeFormat)?.label} link`}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-zinc-950/50 p-6 text-center space-y-2">
              <p className="text-zinc-300 text-sm">{t('portal.notReadyTitle')}</p>
              <p className="text-zinc-500 text-xs">{t('portal.notReadyDesc')}</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
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
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs border',
                    step.done
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-zinc-800 border-white/10 text-zinc-400',
                  )}
                >
                  {step.done ? <Check className="w-3.5 h-3.5" /> : index + 1}
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

      {/* Step 2: Download client */}
      <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400" />
            <span>{isZh ? '步骤 2：下载客户端' : 'Step 2: Download client'}</span>
          </h2>
          <p className="text-sm text-zinc-400">
            {isZh
              ? '先筛选你的设备，再安装推荐客户端。'
              : 'Pick your device first, then install the recommended client.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {platformOptions.map((platform) => (
            <button
              key={platform.key}
              type="button"
              onClick={() => setActivePlatform(platform.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs border transition-colors',
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
            return (
              <div
                key={client.id}
                className="rounded-xl border border-white/10 bg-zinc-950/40 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <client.icon className="w-5 h-5 text-zinc-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">{client.name}</p>
                      <p className="text-xs text-zinc-500">
                        {client.os} / {client.desc}
                      </p>
                    </div>
                  </div>
                  {isRecommended && (
                    <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                      {isZh ? '推荐' : 'Recommended'}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => openDownload(client.links.github)}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    GitHub
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => openDownload(client.links.vps)}
                    disabled={!client.links.vps}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    VPS
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Step 3: Import and connect + Troubleshooting */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>{isZh ? '步骤 3：导入并连接' : 'Step 3: Import and connect'}</span>
            </h2>
            <p className="text-sm text-zinc-400">
              {isZh ? `当前教程设备：${currentGuideLabel}` : `Current guide: ${currentGuideLabel}`}
            </p>
          </div>
          <div className="space-y-3">
            {guideSteps.map((step, index) => (
              <div key={step} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full border border-white/10 bg-zinc-950/60 text-xs flex items-center justify-center text-zinc-300 flex-shrink-0">
                  {index + 1}
                </span>
                <p className="text-sm text-zinc-300 pt-0.5">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>{isZh ? '连接失败排查' : 'Troubleshooting'}</span>
          </h2>
          <div className="space-y-3">
            {troubleshooting.map((item, index) => (
              <p key={item} className="text-sm text-zinc-300">
                {index + 1}. {item}
              </p>
            ))}
          </div>
          <p className="text-xs text-zinc-500 border-t border-white/10 pt-4">
            {t('portal.needHelp')}
          </p>
        </div>
      </section>
    </>
  );
}
