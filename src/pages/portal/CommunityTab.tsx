import React, { useMemo, useState } from 'react';
import { Copy, ExternalLink, QrCode, Users } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/utils/cn';
import type { CommunityLink } from '@/src/types/communityLink';
import { COMMUNITY_PLATFORM_OPTIONS, getCommunityPlatformLabel } from '@/src/types/communityLink';
import type { PortalTab } from './types';
import { COPY_RESET_DELAY_MS } from './types';

interface CommunityTabProps {
  communityLinks: CommunityLink[];
  isZh: boolean;
  onSetSection?: (tab: PortalTab) => void;
}

export function CommunityTab({ communityLinks, isZh, onSetSection }: CommunityTabProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedQrId, setExpandedQrId] = useState<string | null>(null);

  const visibleLinks = useMemo(
    () =>
      communityLinks.filter(
        (item) =>
          item.active &&
          (item.title.trim() ||
            item.url.trim() ||
            item.summary.trim() ||
            item.rules.trim() ||
            item.notes.trim()),
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

  if (visibleLinks.length === 0) {
    return (
      <section className="surface-card space-y-6 p-6 md:p-7" data-testid="portal-community-tab">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
              {isZh ? '暂时还没有可加入的社区。' : 'No community link is available yet.'}
            </h2>
            <p className="text-sm leading-7 text-zinc-400">
              {isZh ? '入口发布后会直接显示在这里。' : 'Published links will appear here directly.'}
            </p>
          </div>

          {onSetSection ? (
            <Button variant="secondary" size="sm" onClick={() => onSetSection('setup')}>
              {isZh ? '打开使用订阅' : 'Open setup'}
            </Button>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {placeholderPlatforms.map((platform) => (
              <article
                key={platform.value}
                className="surface-panel rounded-[24px] border border-dashed border-[color:var(--border-subtle)] p-4"
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs text-zinc-300">
                  <Users className="h-3.5 w-3.5" />
                  {isZh ? platform.labelZh : platform.labelEn}
                </div>
                <p className="mt-4 text-sm font-medium text-zinc-100">
                  {isZh ? '待发布' : 'Pending'}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {isZh ? '发布后显示链接和二维码。' : 'Link and QR code will appear here.'}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6" data-testid="portal-community-tab">
      <p className="text-sm leading-7 text-zinc-400">
        {isZh
          ? `当前有 ${visibleLinks.length} 个可用社区入口，按平台选择即可。`
          : `${visibleLinks.length} community link${visibleLinks.length > 1 ? 's are' : ' is'} available.`}
      </p>

      <div className="grid gap-6 xl:grid-cols-2">
        {visibleLinks.map((entry) => {
          const qrValue = entry.qrContent.trim() || entry.url.trim();
          const isQrOpen = expandedQrId === entry.id;

          return (
            <article key={entry.id} className="surface-card space-y-5 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                    <Users className="h-3.5 w-3.5" />
                    {getCommunityPlatformLabel(entry.platform, isZh)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-50">{entry.title}</h3>
                    {entry.summary ? (
                      <p className="mt-2 text-sm leading-6 text-zinc-400">{entry.summary}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {entry.url.trim() ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                      onClick={() => openLink(entry.url)}
                    >
                      <ExternalLink className="h-4 w-4" />
                      {isZh ? '打开入口' : 'Open link'}
                    </Button>
                  ) : null}
                  {entry.url.trim() ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleCopy(entry.url, `link-${entry.id}`)}
                    >
                      <Copy className="h-4 w-4" />
                      {copiedId === `link-${entry.id}`
                        ? isZh
                          ? '已复制'
                          : 'Copied'
                        : isZh
                          ? '复制链接'
                          : 'Copy link'}
                    </Button>
                  ) : null}
                  {qrValue ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() =>
                        setExpandedQrId((current) => (current === entry.id ? null : entry.id))
                      }
                    >
                      <QrCode className="h-4 w-4" />
                      {isQrOpen
                        ? isZh
                          ? '隐藏二维码'
                          : 'Hide QR'
                        : isZh
                          ? '显示二维码'
                          : 'Show QR'}
                    </Button>
                  ) : null}
                </div>
              </div>

              {entry.url.trim() ? (
                <div className="surface-panel break-all rounded-[20px] px-4 py-3 text-xs leading-6 text-zinc-300">
                  {entry.url}
                </div>
              ) : null}

              {isQrOpen && qrValue ? <CommunityQr value={qrValue} isZh={isZh} /> : null}

              <div
                className={cn(
                  'grid gap-4',
                  entry.rules.trim() && entry.notes.trim() ? 'md:grid-cols-2' : 'md:grid-cols-1',
                )}
              >
                {entry.rules.trim() ? (
                  <div className="surface-panel rounded-[24px] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      {isZh ? '加入规则' : 'Rules'}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                      {entry.rules}
                    </p>
                  </div>
                ) : null}

                {entry.notes.trim() ? (
                  <div className="surface-panel rounded-[24px] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      {isZh ? '备注' : 'Notes'}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                      {entry.notes}
                    </p>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CommunityQr({ value, isZh }: { value: string; isZh: boolean }) {
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
          width: 180,
          margin: 2,
          color: { dark: '#d4d4d8', light: '#18181b' },
        });
      })
      .then(() => setError(null))
      .catch(() => setError(isZh ? '二维码生成失败' : 'Failed to generate QR code'));
  }, [isZh, value]);

  if (error) {
    return <p className="text-xs text-red-400">{error}</p>;
  }

  return (
    <div className="surface-panel flex justify-center rounded-[24px] p-4">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
