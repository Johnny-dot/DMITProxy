import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, ExternalLink, Link as LinkIcon, Monitor, QrCode } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/utils/cn';
import type { ClientDownloadPlatform } from '@/src/utils/clientDownloads';
import type { ClientCard } from './types';
import {
  type ClientId,
  type GuidePlatform,
  type GuideStep,
  GUIDE_SCREENSHOT_HIGHLIGHTS,
  getPlatformLabel,
} from './SubscriptionTabData';

export function StepHeader({
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

export function GuideStepCard({ step, index }: { step: GuideStep; index: number }) {
  const toneClasses =
    step.tone === 'launch'
      ? {
          border: 'border-sky-500/25',
          panel: 'border-sky-500/20 bg-sky-500/8',
          badge: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
          icon: 'text-sky-300',
        }
      : step.tone === 'import'
        ? {
            border: 'border-amber-500/25',
            panel: 'border-amber-500/20 bg-amber-500/8',
            badge: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
            icon: 'text-amber-300',
          }
        : {
            border: 'border-emerald-500/25',
            panel: 'border-emerald-500/20 bg-emerald-500/8',
            badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
            icon: 'text-emerald-300',
          };

  const VisualIcon = step.tone === 'launch' ? Monitor : step.tone === 'import' ? LinkIcon : Check;

  return (
    <article className={cn('rounded-[28px] border p-5', toneClasses.border)}>
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-zinc-400">
          {`Step ${index + 1}`}
        </span>
        <span className={cn('rounded-full border px-3 py-1 text-[11px]', toneClasses.badge)}>
          {step.visualLabel}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        <h3 className="text-base font-semibold text-zinc-50">{step.title}</h3>
        <p className="text-sm leading-7 text-zinc-400">{step.description}</p>
      </div>
      <div className={cn('mt-5 rounded-[24px] border p-4', toneClasses.panel)}>
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/10">
              <VisualIcon className={cn('h-4 w-4', toneClasses.icon)} />
            </span>
            <span className="text-sm font-medium text-zinc-100">{step.visualLabel}</span>
          </div>
          <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-[11px] text-zinc-300">
            {step.ctaLabel}
          </span>
        </div>
        <div className="mt-4 space-y-2">
          {step.visualItems.map((item) => (
            <div
              key={item}
              className="flex items-center justify-between rounded-[18px] border border-white/10 bg-black/10 px-3 py-2"
            >
              <span className="text-xs text-zinc-200">{item}</span>
              <span className="h-2 w-2 rounded-full bg-white/50" />
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-xs leading-6 text-zinc-500">{step.helper}</p>
    </article>
  );
}

export function GuideScreenshotStepCard({ step, index }: { step: GuideStep; index: number }) {
  if (!step.screenshot) {
    return <GuideStepCard step={step} index={index} />;
  }

  const [naturalImageSize, setNaturalImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const naturalRatio = naturalImageSize ? naturalImageSize.width / naturalImageSize.height : null;
  const highlights = GUIDE_SCREENSHOT_HIGHLIGHTS[step.screenshot.src] ?? [];
  const screenshotLayout =
    naturalRatio !== null && naturalRatio < 0.7
      ? 'narrowPortrait'
      : naturalRatio !== null && naturalRatio < 1.05
        ? 'portrait'
        : 'landscape';
  const screenshotLayoutMaxWidth =
    screenshotLayout === 'narrowPortrait' ? 320 : screenshotLayout === 'portrait' ? 448 : null;
  const screenshotRenderMaxWidth = naturalImageSize
    ? Math.min(naturalImageSize.width * 1.25, screenshotLayoutMaxWidth ?? Number.POSITIVE_INFINITY)
    : screenshotLayoutMaxWidth;
  const toneClasses =
    step.tone === 'launch'
      ? {
          border: 'border-sky-500/25',
          panel: 'border-sky-500/20 bg-sky-500/8',
          badge: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
        }
      : step.tone === 'import'
        ? {
            border: 'border-amber-500/25',
            panel: 'border-amber-500/20 bg-amber-500/8',
            badge: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
          }
        : {
            border: 'border-emerald-500/25',
            panel: 'border-emerald-500/20 bg-emerald-500/8',
            badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
          };

  return (
    <article className={cn('rounded-[28px] border p-4 md:p-5', toneClasses.border)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-zinc-400">
            {`Step ${index + 1}`}
          </span>
          <span className={cn('rounded-full border px-3 py-1 text-[11px]', toneClasses.badge)}>
            {step.visualLabel}
          </span>
        </div>
        <a
          href={step.screenshot.src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-100"
        >
          {step.ctaLabel}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)] lg:items-start">
        <a
          href={step.screenshot.src}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'overflow-hidden rounded-[24px] border p-3 transition-colors hover:border-[color:var(--border-strong)]',
            toneClasses.panel,
          )}
        >
          <div className="flex justify-center">
            <div
              className="relative w-full overflow-hidden rounded-[18px] border border-white/10 bg-white/5"
              style={screenshotRenderMaxWidth ? { maxWidth: screenshotRenderMaxWidth } : undefined}
            >
              <img
                src={step.screenshot.src}
                alt={step.screenshot.alt}
                loading="lazy"
                className="block h-auto w-full"
                onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  if (!naturalWidth || !naturalHeight) return;
                  setNaturalImageSize({ width: naturalWidth, height: naturalHeight });
                }}
              />
              {highlights.length ? (
                <div className="pointer-events-none absolute inset-0">
                  {highlights.map((highlight, highlightIndex) => (
                    <div
                      key={`${step.screenshot?.src}-${highlightIndex}`}
                      className="absolute rounded-[16px] border-2 border-red-500/95 bg-red-500/10 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_rgba(220,38,38,0.18)]"
                      style={{
                        left: `${highlight.x}%`,
                        top: `${highlight.y}%`,
                        width: `${highlight.w}%`,
                        height: `${highlight.h}%`,
                      }}
                    >
                      <span className="absolute left-2 top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white shadow-lg">
                        {highlightIndex + 1}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </a>

        <div className={cn('rounded-[24px] border p-4', toneClasses.panel)}>
          <h3 className="text-base font-semibold text-zinc-50">{step.title}</h3>
          <p className="mt-2 text-sm leading-7 text-zinc-300">{step.description}</p>
          <div className="mt-4 space-y-2">
            {step.visualItems.map((item, itemIndex) => (
              <div
                key={`${step.title}-${item}`}
                className="flex items-start gap-3 rounded-[18px] border border-white/10 bg-black/10 px-3 py-3"
              >
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[11px] text-zinc-200">
                  {itemIndex + 1}
                </span>
                <span className="text-sm leading-6 text-zinc-100">{item}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-6 text-zinc-400">{step.helper}</p>
        </div>
      </div>
    </article>
  );
}

export function isClientCardActionTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('[data-client-action]'));
}

export function ClientHighlightCard({
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
  onOpenDownload: (
    url: string,
    clientId?: ClientId,
    options?: {
      kind?: 'official' | 'mirror';
      managed?: boolean;
      platform?: ClientDownloadPlatform;
    },
  ) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onClick={(event) => {
        if (isClientCardActionTarget(event.target)) return;
        onSelect(client.id);
      }}
      onKeyDown={(event) => {
        if (isClientCardActionTarget(event.target)) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect(client.id);
      }}
      className={cn(
        'cursor-pointer rounded-[28px] border p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]',
        isActive
          ? 'border-emerald-500/40 bg-emerald-500/10'
          : 'border-[color:var(--border-subtle)] bg-[var(--surface-panel)] hover:border-[color:var(--border-strong)]',
      )}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
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
          className="hidden"
          onClick={() => onSelect(client.id)}
        >
          {isZh ? '使用这个客户端' : 'Use this client'}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-2"
          onClick={() =>
            onOpenDownload(client.links.github, client.id, {
              kind: 'official',
              platform: activePlatform,
            })
          }
          data-testid="portal-setup-download-primary"
          data-client-action="true"
          disabled={!client.links.github}
        >
          <Download className="h-4 w-4" />
          {isZh ? '下载客户端' : 'Download client'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() =>
            onOpenDownload(client.links.github, client.id, {
              kind: 'official',
              platform: activePlatform,
            })
          }
          data-client-action="true"
          disabled={!client.links.github}
        >
          <ExternalLink className="h-4 w-4" />
          {isZh ? '官方源' : 'Official'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          title={
            client.links.vps
              ? client.links.vpsManaged
                ? isZh
                  ? '通过当前站点 VPS 缓存分发；首次请求可能需要等待官方包缓存完成'
                  : 'Served through this VPS cache. The first request may wait while the official package is cached.'
                : isZh
                  ? '打开已配置的镜像下载地址'
                  : 'Open the configured mirror download URL'
              : isZh
                ? '当前平台暂不提供镜像下载'
                : 'Mirror is not available for this platform'
          }
          onClick={() =>
            onOpenDownload(client.links.vps, client.id, {
              kind: 'mirror',
              managed: client.links.vpsManaged,
              platform: activePlatform,
            })
          }
          data-client-action="true"
          disabled={!client.links.vps}
        >
          <ExternalLink className="h-4 w-4" />
          {isZh ? '镜像下载' : 'Mirror'}
        </Button>
      </div>
    </div>
  );
}

export function ClientCompactCard({
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
  onOpenDownload: (
    url: string,
    clientId?: ClientId,
    options?: {
      kind?: 'official' | 'mirror';
      managed?: boolean;
      platform?: ClientDownloadPlatform;
    },
  ) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onClick={(event) => {
        if (isClientCardActionTarget(event.target)) return;
        onSelect(client.id);
      }}
      onKeyDown={(event) => {
        if (isClientCardActionTarget(event.target)) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect(client.id);
      }}
      className={cn(
        'surface-panel flex h-full cursor-pointer flex-col justify-between rounded-[24px] border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]',
        isActive
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'hover:border-[color:var(--border-strong)]',
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden"
          onClick={() => onSelect(client.id)}
        >
          {isZh ? '切换' : 'Select'}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() =>
            onOpenDownload(client.links.github, client.id, {
              kind: 'official',
              platform: activePlatform,
            })
          }
          data-client-action="true"
          disabled={!client.links.github}
        >
          <ExternalLink className="h-4 w-4" />
          {isZh ? '官方' : 'Official'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          title={
            client.links.vps
              ? client.links.vpsManaged
                ? isZh
                  ? '通过当前站点 VPS 缓存分发；首次请求可能需要等待官方包缓存完成'
                  : 'Served through this VPS cache. The first request may wait while the official package is cached.'
                : isZh
                  ? '打开已配置的镜像下载地址'
                  : 'Open the configured mirror download URL'
              : isZh
                ? '当前平台暂不提供镜像下载'
                : 'Mirror is not available for this platform'
          }
          onClick={() =>
            onOpenDownload(client.links.vps, client.id, {
              kind: 'mirror',
              managed: client.links.vpsManaged,
              platform: activePlatform,
            })
          }
          data-client-action="true"
          disabled={!client.links.vps}
        >
          <ExternalLink className="h-4 w-4" />
          {isZh ? '镜像' : 'Mirror'}
        </Button>
      </div>
    </div>
  );
}

export function QrCodeCanvas({ url, isZh }: { url: string; isZh: boolean }) {
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
