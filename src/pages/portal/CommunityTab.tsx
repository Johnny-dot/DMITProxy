import React, { useMemo, useState } from 'react';
import { BellRing, Copy, ExternalLink, LifeBuoy, QrCode, Users } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/utils/cn';
import type { CommunityLink } from '@/src/types/communityLink';
import { getCommunityPlatformLabel } from '@/src/types/communityLink';
import type { PortalTab } from './types';

interface CommunityTabProps {
  communityLinks: CommunityLink[];
  isZh: boolean;
  announcementText?: string;
  supportContact?: string;
  onSetSection?: (tab: PortalTab) => void;
}

export function CommunityTab({
  communityLinks,
  isZh,
  announcementText = '',
  supportContact = '',
  onSetSection,
}: CommunityTabProps) {
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
  const latestAnnouncement = announcementText.trim();
  const latestSupport = supportContact.trim();

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
      <section className="surface-card overflow-hidden" data-testid="portal-community-tab">
        <div className="grid gap-px bg-[var(--border-subtle)] xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6 bg-[var(--surface-card)] p-6 md:p-7">
            <div className="space-y-3">
              <p className="section-kicker">{isZh ? '社区入口' : 'Community'}</p>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
                {isZh ? '暂时还没有可加入的社区。' : 'No community link is available yet.'}
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-zinc-400">
                {isZh
                  ? '等管理员发布新的群组入口后，你就会在这里直接看到链接、二维码和加入说明。'
                  : 'Once the team publishes a new invite, the link, QR code, and join notes will appear here automatically.'}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="surface-panel p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  {isZh ? '当前状态' : 'Current status'}
                </p>
                <p className="mt-2 text-sm font-medium text-zinc-50">
                  {isZh ? '还没有公开入口' : 'No public invite yet'}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {isZh
                    ? '只要有可用的社区入口，这个区域就会自动更新，不需要你反复查找。'
                    : 'As soon as a community link is published, this space will update automatically.'}
                </p>
              </div>

              <div className="surface-panel p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  {isZh ? '建议下一步' : 'Recommended next step'}
                </p>
                <p className="mt-2 text-sm font-medium text-zinc-50">
                  {isZh ? '先完成订阅接入' : 'Finish setup first'}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {isZh
                    ? '先去使用订阅页面完成客户端下载和导入，后面拿到社区入口时就能直接加入。'
                    : 'Open setup first so your client is ready when the invite arrives.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {onSetSection ? (
                <Button variant="secondary" size="sm" onClick={() => onSetSection('setup')}>
                  {isZh ? '打开使用订阅' : 'Open setup'}
                </Button>
              ) : null}
              {latestSupport ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(latestSupport, 'empty-support')}
                >
                  {copiedId === 'empty-support'
                    ? isZh
                      ? '已复制'
                      : 'Copied'
                    : isZh
                      ? '复制支持联系方式'
                      : 'Copy support contact'}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 bg-[var(--surface-card)] p-6 md:p-7">
            <div className="surface-panel p-4">
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                <BellRing className="h-3.5 w-3.5" />
                <span>{isZh ? '最新说明' : 'Latest note'}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                {latestAnnouncement ||
                  (isZh
                    ? '暂时还没有新的公告，你可以先完成订阅配置。'
                    : 'No new announcement has been posted yet. You can finish your subscription setup first.')}
              </p>
            </div>

            <div className="surface-panel p-4">
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                <LifeBuoy className="h-3.5 w-3.5" />
                <span>{isZh ? '支持联系方式' : 'Support contact'}</span>
              </div>
              <p className="mt-3 break-all text-sm leading-7 text-zinc-300">
                {latestSupport ||
                  (isZh
                    ? '暂时还没有公开的支持渠道。后续如果有更新，会显示在这里。'
                    : 'No support channel is published yet. It will appear here when available.')}
              </p>
            </div>
          </div>
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
                <div className="surface-panel break-all px-4 py-3 text-xs leading-6 text-zinc-300">
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
                  <div className="surface-panel p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      {isZh ? '加入规则' : 'Rules'}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                      {entry.rules}
                    </p>
                  </div>
                ) : null}

                {entry.notes.trim() ? (
                  <div className="surface-panel p-4">
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
    <div className="surface-panel flex justify-center p-4">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
