import React, { useMemo, useState } from 'react';
import { Copy, ExternalLink, QrCode, Users } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/utils/cn';
import type { CommunityLink } from '@/src/types/communityLink';
import { getCommunityPlatformLabel } from '@/src/types/communityLink';

interface CommunityTabProps {
  communityLinks: CommunityLink[];
  isZh: boolean;
}

export function CommunityTab({ communityLinks, isZh }: CommunityTabProps) {
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

  function handleCopy(text: string, id: string) {
    if (!text.trim()) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 2000);
    });
  }

  function openLink(url: string) {
    if (!url.trim()) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  if (visibleLinks.length === 0) {
    return (
      <section className="surface-card space-y-4 p-6 md:p-7" data-testid="portal-community-tab">
        <div className="space-y-2">
          <p className="section-kicker">{isZh ? '社区入口' : 'Community'}</p>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
            {isZh ? '暂时还没有可加入的社区。' : 'No community link is available yet.'}
          </h2>
        </div>
        <div className="surface-panel p-4 text-sm leading-6 text-zinc-400">
          {isZh
            ? '有新的群组入口后，会显示在这里。'
            : 'New community links will appear here once they are available.'}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6" data-testid="portal-community-tab">
      <div className="surface-card space-y-3 p-6 md:p-7">
        <p className="section-kicker">{isZh ? '社区入口' : 'Community'}</p>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
          {isZh ? '找到适合你的社区入口。' : 'Find the right community link for you.'}
        </h2>
        <p className="max-w-3xl text-sm leading-7 text-zinc-400">
          {isZh
            ? '群链接、二维码和加入说明都会放在这里，按需要打开即可。'
            : 'Links, QR codes, and join notes are collected here so you can open the one you need.'}
        </p>
      </div>

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
                    {entry.summary && (
                      <p className="mt-2 text-sm leading-6 text-zinc-400">{entry.summary}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {entry.url.trim() && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                      onClick={() => openLink(entry.url)}
                    >
                      <ExternalLink className="h-4 w-4" />
                      {isZh ? '打开入口' : 'Open link'}
                    </Button>
                  )}
                  {entry.url.trim() && (
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
                  )}
                  {qrValue && (
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
                  )}
                </div>
              </div>

              {entry.url.trim() && (
                <div className="surface-panel break-all px-4 py-3 text-xs leading-6 text-zinc-300">
                  {entry.url}
                </div>
              )}

              {isQrOpen && qrValue && <CommunityQr value={qrValue} isZh={isZh} />}

              <div
                className={cn(
                  'grid gap-4',
                  entry.rules.trim() && entry.notes.trim() ? 'md:grid-cols-2' : 'md:grid-cols-1',
                )}
              >
                {entry.rules.trim() && (
                  <div className="surface-panel p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      {isZh ? '加入规则' : 'Rules'}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                      {entry.rules}
                    </p>
                  </div>
                )}

                {entry.notes.trim() && (
                  <div className="surface-panel p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      {isZh ? '备注' : 'Notes'}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                      {entry.notes}
                    </p>
                  </div>
                )}
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
        )(canvasRef.current!, value, {
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
    <div className="surface-panel flex justify-center p-4">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
