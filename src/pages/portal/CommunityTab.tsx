import React, { useMemo, useState } from 'react';
import { Copy, ExternalLink, X, ZoomIn } from 'lucide-react';
import { CommunityPlatformIcon } from '@/src/components/icons/CommunityPlatformIcon';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/utils/cn';
import { isCommunityQrImageSource } from '@/src/utils/communityQr';
import type { CommunityLink } from '@/src/types/communityLink';
import { COMMUNITY_PLATFORM_OPTIONS, getCommunityPlatformLabel } from '@/src/types/communityLink';
import type { PortalTab } from './types';
import { COPY_RESET_DELAY_MS } from './types';

interface CommunityTabProps {
  communityLinks: CommunityLink[];
  isZh: boolean;
  onSetSection?: (tab: PortalTab) => void;
}

function getCommunityPlatformPreset(platform: CommunityLink['platform']) {
  switch (platform) {
    case 'telegram':
      return {
        badgeClassName: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
        cardClassName:
          'border-sky-500/18 bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(255,255,255,0.02))]',
      };
    case 'whatsapp':
      return {
        badgeClassName: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
        cardClassName:
          'border-emerald-500/18 bg-[linear-gradient(135deg,rgba(34,197,94,0.08),rgba(255,255,255,0.02))]',
      };
    case 'discord':
      return {
        badgeClassName: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-300',
        cardClassName:
          'border-indigo-500/18 bg-[linear-gradient(135deg,rgba(99,102,241,0.08),rgba(255,255,255,0.02))]',
      };
    case 'wechat':
      return {
        badgeClassName: 'border-lime-500/25 bg-lime-500/10 text-lime-300',
        cardClassName:
          'border-lime-500/18 bg-[linear-gradient(135deg,rgba(132,204,22,0.08),rgba(255,255,255,0.02))]',
      };
    default:
      return {
        badgeClassName: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-300',
        cardClassName:
          'border-[color:var(--border-subtle)] bg-[linear-gradient(135deg,rgba(113,113,122,0.08),rgba(255,255,255,0.02))]',
      };
  }
}

function formatCommunityLinkPreview(value: string): string {
  const normalized = value.trim();
  if (!normalized) return '';

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const { hostname, pathname, search } = new URL(normalized);
      const compactPath = pathname === '/' ? '' : pathname;
      const compactSearch = search && search.length <= 18 ? search : '';
      const preview = `${hostname.replace(/^www\./i, '')}${compactPath}${compactSearch}`;
      return preview.length > 52 ? `${preview.slice(0, 49)}...` : preview;
    } catch {
      return normalized.length > 52 ? `${normalized.slice(0, 49)}...` : normalized;
    }
  }

  return normalized.length > 52 ? `${normalized.slice(0, 49)}...` : normalized;
}

function getCommunityTitle(entry: CommunityLink, isZh: boolean) {
  const title = entry.title.trim();
  if (title) return title;
  return getCommunityPlatformLabel(entry.platform, isZh);
}

function getCommunityDescription(entry: CommunityLink, isZh: boolean, hasQrImage: boolean) {
  const summary = entry.summary.trim();
  if (summary) return summary;

  if (entry.url.trim()) {
    return isZh
      ? '可以直接点击链接，或扫描右侧二维码加入。'
      : 'Open the invite link or scan the QR code to join.';
  }

  if (hasQrImage) {
    return isZh ? '使用二维码加入。' : 'Use the QR code to join.';
  }

  if (entry.qrContent.trim()) {
    return isZh ? '支持通过二维码内容加入。' : 'Join with the QR content.';
  }

  return isZh ? '社区入口即将开放。' : 'This entry will open soon.';
}

function getCommunityQrHint(entry: CommunityLink, isZh: boolean, hasQrImage: boolean) {
  if (entry.url.trim()) {
    return isZh ? '扫码或点击链接都可以加入。' : 'Scan or use the invite link.';
  }

  if (hasQrImage) {
    return isZh ? '长按或扫码即可加入。' : 'Long press or scan to join.';
  }

  return isZh ? '扫描二维码加入。' : 'Scan the QR code to join.';
}

export function CommunityTab({ communityLinks, isZh, onSetSection }: CommunityTabProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewQr, setPreviewQr] = useState<{
    title: string;
    value: string;
    isImage: boolean;
  } | null>(null);

  const visibleLinks = useMemo(
    () =>
      communityLinks.filter(
        (item) =>
          item.active &&
          (item.title.trim() || item.url.trim() || item.summary.trim() || item.qrContent.trim()),
      ),
    [communityLinks],
  );
  const placeholderPlatforms = useMemo(
    () => COMMUNITY_PLATFORM_OPTIONS.filter((item) => item.value !== 'custom'),
    [],
  );

  function handleCopy(text: string, id: string) {
    if (!text.trim()) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, COPY_RESET_DELAY_MS);
    });
  }

  function openLink(url: string) {
    if (!url.trim()) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  React.useEffect(() => {
    if (!previewQr) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPreviewQr(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewQr]);

  if (visibleLinks.length === 0) {
    return (
      <section className="surface-card space-y-6 p-6 md:p-7" data-testid="portal-community-tab">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
              {isZh ? '暂时还没有开放的社群入口。' : 'No community links are available yet.'}
            </h2>
            <p className="text-sm leading-7 text-zinc-400">
              {isZh ? '发布后会直接显示在这里。' : 'Published community links will appear here.'}
            </p>
          </div>

          {onSetSection ? (
            <Button variant="secondary" size="sm" onClick={() => onSetSection('setup')}>
              {isZh ? '前往设置' : 'Open setup'}
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {placeholderPlatforms.map((platform) => {
            const preset = getCommunityPlatformPreset(platform.value);

            return (
              <article
                key={platform.value}
                className={cn('rounded-[24px] border border-dashed p-4', preset.cardClassName)}
              >
                <div className="flex items-start gap-3">
                  <CommunityPlatformIcon
                    platform={platform.value}
                    className="h-12 w-12 rounded-[16px]"
                  />
                  <div className="space-y-2">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium',
                        preset.badgeClassName,
                      )}
                    >
                      {isZh ? platform.labelZh : platform.labelEn}
                    </span>
                    <p className="text-sm font-medium text-zinc-100">
                      {isZh ? '等待发布' : 'Pending'}
                    </p>
                    <p className="text-sm leading-6 text-zinc-400">
                      {isZh
                        ? '链接和二维码发布后会显示在这里。'
                        : 'Link and QR code will show here once published.'}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6" data-testid="portal-community-tab">
      <p className="text-sm leading-7 text-zinc-400">
        {isZh
          ? `当前共有 ${visibleLinks.length} 个可加入的社群入口。`
          : `${visibleLinks.length} community link${visibleLinks.length > 1 ? 's are' : ' is'} available.`}
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        {visibleLinks.map((entry) => {
          const qrValue = entry.qrContent.trim() || entry.url.trim();
          const hasQrImage = isCommunityQrImageSource(qrValue);
          const platformPreset = getCommunityPlatformPreset(entry.platform);
          const platformLabel = getCommunityPlatformLabel(entry.platform, isZh);
          const title = getCommunityTitle(entry, isZh);
          const description = getCommunityDescription(entry, isZh, hasQrImage);
          const preview = formatCommunityLinkPreview(entry.url);
          const copyValue = entry.url.trim() || (!hasQrImage ? qrValue : '');
          const copyId = `${entry.url.trim() ? 'link' : 'content'}-${entry.id}`;
          const actionCount = Number(Boolean(entry.url.trim())) + Number(Boolean(copyValue));

          return (
            <article
              key={entry.id}
              className={cn(
                'overflow-hidden rounded-[28px] border p-5 shadow-[0_20px_60px_rgba(15,23,42,0.16)]',
                platformPreset.cardClassName,
              )}
            >
              <div
                className={cn(
                  'grid gap-5',
                  qrValue ? 'lg:grid-cols-[minmax(0,1fr)_188px] lg:items-start' : '',
                )}
              >
                <div className="min-w-0 space-y-5">
                  <div className="flex min-w-0 items-start gap-4">
                    <CommunityPlatformIcon platform={entry.platform} />
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium',
                            platformPreset.badgeClassName,
                          )}
                        >
                          {platformLabel}
                        </span>
                        {hasQrImage ? (
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs text-zinc-300">
                            {isZh ? '二维码图片' : 'QR image'}
                          </span>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold tracking-tight text-zinc-50">
                          {title}
                        </h3>
                        {preview ? (
                          <p className="truncate text-sm text-zinc-400" title={preview}>
                            {preview}
                          </p>
                        ) : null}
                        <p className="text-sm leading-7 text-zinc-300">{description}</p>
                      </div>
                    </div>
                  </div>

                  {entry.url.trim() ? (
                    <div className="rounded-[22px] border border-white/5 bg-black/10 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        {isZh ? '加入链接' : 'Invite link'}
                      </p>
                      <p className="mt-2 break-all text-sm leading-6 text-zinc-100">{entry.url}</p>
                    </div>
                  ) : null}

                  {actionCount > 0 ? (
                    <div className={cn('grid gap-2', actionCount > 1 ? 'sm:grid-cols-2' : '')}>
                      {entry.url.trim() ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-2 justify-center"
                          onClick={() => openLink(entry.url)}
                        >
                          <ExternalLink className="h-4 w-4" />
                          {isZh ? '打开入口' : 'Open link'}
                        </Button>
                      ) : null}
                      {copyValue ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 justify-center border-white/10 bg-black/10 hover:bg-black/20"
                          onClick={() => handleCopy(copyValue, copyId)}
                        >
                          <Copy className="h-4 w-4" />
                          {copiedId === copyId
                            ? isZh
                              ? '已复制'
                              : 'Copied'
                            : entry.url.trim()
                              ? isZh
                                ? '复制链接'
                                : 'Copy link'
                              : isZh
                                ? '复制加入信息'
                                : 'Copy details'}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {qrValue ? (
                  <button
                    type="button"
                    className="group rounded-[24px] border border-white/5 bg-black/10 p-4 text-left transition hover:border-white/15 hover:bg-black/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]"
                    onClick={() =>
                      setPreviewQr({
                        title,
                        value: qrValue,
                        isImage: hasQrImage,
                      })
                    }
                    aria-label={isZh ? `查看 ${title} 的二维码大图` : `Preview ${title} QR code`}
                  >
                    <p className="text-center text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      {isZh ? '扫码加入' : 'Scan to join'}
                    </p>
                    <div className="mt-3 flex min-h-[180px] items-center justify-center rounded-[20px] border border-white/5 bg-white/95 p-3">
                      {hasQrImage ? (
                        <CommunityQrImage src={qrValue} title={title} isZh={isZh} />
                      ) : (
                        <CommunityQr value={qrValue} isZh={isZh} />
                      )}
                    </div>
                    <p className="mt-3 text-center text-xs leading-6 text-zinc-400">
                      {getCommunityQrHint(entry, isZh, hasQrImage)}
                    </p>
                    <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-zinc-500 transition-colors group-hover:text-zinc-300">
                      <ZoomIn className="h-3.5 w-3.5" />
                      {isZh ? '点击放大查看' : 'Click to enlarge'}
                    </p>
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {previewQr ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[color:var(--overlay)] p-4 backdrop-blur-sm"
          onClick={() => setPreviewQr(null)}
        >
          <div
            className="surface-card w-full max-w-3xl rounded-[32px] p-5 shadow-[var(--shadow-strong)] md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  {isZh ? '二维码预览' : 'QR preview'}
                </p>
                <h3 className="text-lg font-semibold text-zinc-50">{previewQr.title}</h3>
                <p className="text-sm text-zinc-400">
                  {previewQr.isImage
                    ? isZh
                      ? '这里显示原图，方便直接扫码。'
                      : 'Showing the original image for easier scanning.'
                    : isZh
                      ? '这里显示更大的二维码版本。'
                      : 'Showing a larger QR code for easier scanning.'}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setPreviewQr(null)}
                aria-label={isZh ? '关闭二维码预览' : 'Close QR preview'}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 flex min-h-[420px] items-center justify-center rounded-[28px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-4 md:p-6">
              {previewQr.isImage ? (
                <img
                  src={previewQr.value}
                  alt={previewQr.title ? `${previewQr.title} QR` : 'QR code'}
                  className="max-h-[72vh] w-auto rounded-[24px] object-contain"
                />
              ) : (
                <div className="rounded-[28px] bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.18)]">
                  <CommunityQr value={previewQr.value} isZh={isZh} size={320} />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CommunityQrImage({ src, title, isZh }: { src: string; title: string; isZh: boolean }) {
  const [loadFailed, setLoadFailed] = React.useState(false);

  React.useEffect(() => {
    setLoadFailed(false);
  }, [src]);

  if (loadFailed) {
    return (
      <p className="text-center text-xs text-red-400">
        {isZh ? '二维码图片加载失败' : 'Failed to load QR image'}
      </p>
    );
  }

  return (
    <img
      src={src}
      alt={title ? `${title} QR` : 'QR code'}
      className="max-h-40 w-auto rounded-[16px] object-contain"
      loading="lazy"
      onError={() => setLoadFailed(true)}
    />
  );
}

function CommunityQr({ value, isZh, size = 160 }: { value: string; isZh: boolean; size?: number }) {
  const [error, setError] = React.useState<string | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    if (!canvasRef.current || !value) return;

    import('qrcode')
      .then((mod) => {
        const QRCode = (mod as { default?: unknown }).default ?? mod;
        return (
          QRCode.toCanvas as (el: HTMLCanvasElement, text: string, opts: object) => Promise<void>
        )(canvasRef.current, value, {
          width: size,
          margin: 1,
          color: { dark: '#111827', light: '#ffffff' },
        });
      })
      .then(() => setError(null))
      .catch(() => setError(isZh ? '二维码生成失败' : 'Failed to generate QR code'));
  }, [isZh, size, value]);

  if (error) {
    return <p className="text-center text-xs text-red-400">{error}</p>;
  }

  return (
    <canvas ref={canvasRef} className="block h-auto w-full" style={{ maxWidth: `${size}px` }} />
  );
}
