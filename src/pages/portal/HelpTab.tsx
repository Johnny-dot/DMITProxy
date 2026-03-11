import React, { useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import type { CommunityLink } from '@/src/types/communityLink';
import {
  getSharedResourceAccessLabel,
  getSharedResourceKindLabel,
} from '@/src/types/sharedResource';
import { CommunityTab } from './CommunityTab';
import type { PortalSettings, PortalTab } from './types';
import { COPY_RESET_DELAY_MS } from './types';

interface HelpTabProps {
  portalSettings: PortalSettings | null;
  communityLinks: CommunityLink[];
  isZh: boolean;
  onSetSection?: (tab: PortalTab) => void;
}

export function HelpTab({ portalSettings, communityLinks, isZh, onSetSection }: HelpTabProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const sharedResources = useMemo(
    () =>
      (portalSettings?.sharedResources ?? []).filter(
        (item) => item.active && (item.title.trim() || item.content.trim() || item.summary.trim()),
      ),
    [portalSettings?.sharedResources],
  );

  function handleCopy(text: string, key: string) {
    if (!text.trim()) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, COPY_RESET_DELAY_MS);
    });
  }

  return (
    <section className="space-y-6" data-testid="portal-help-tab">
      <CommunityTab communityLinks={communityLinks} isZh={isZh} onSetSection={onSetSection} />

      <section className="surface-card space-y-5 p-6 md:p-7" data-testid="portal-help-resources">
        <h3 className="text-xl font-semibold tracking-tight text-zinc-50">
          {isZh ? '共享资源' : 'Shared resources'}
        </h3>

        {sharedResources.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {sharedResources.map((resource) => {
              const hasContent = Boolean(resource.content.trim());

              return (
                <article key={resource.id} className="surface-panel space-y-4 rounded-[24px] p-5">
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
                      <h4 className="text-base font-semibold text-zinc-100">{resource.title}</h4>
                      {resource.summary ? (
                        <p className="text-sm leading-7 text-zinc-400">{resource.summary}</p>
                      ) : null}
                    </div>
                    {hasContent ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleCopy(resource.content, `resource-${resource.id}`)}
                      >
                        <Copy className="h-4 w-4" />
                        {copiedKey === `resource-${resource.id}`
                          ? isZh
                            ? '已复制'
                            : 'Copied'
                          : isZh
                            ? '复制内容'
                            : 'Copy details'}
                      </Button>
                    ) : null}
                  </div>

                  {hasContent ? (
                    <div className="whitespace-pre-wrap rounded-[20px] border border-[color:var(--border-subtle)] bg-black/10 px-4 py-3 font-mono text-xs leading-6 text-zinc-300">
                      {resource.content}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="surface-panel rounded-[24px] p-5 text-sm leading-7 text-zinc-400">
            {isZh ? '当前没有可用的共享资源。' : 'No shared resources right now.'}
          </div>
        )}
      </section>
    </section>
  );
}
