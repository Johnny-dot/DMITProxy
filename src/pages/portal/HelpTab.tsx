import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Inbox } from 'lucide-react';
import { SharedResourceKindIcon } from '@/src/components/icons/SharedResourceKindIcon';
import { Button } from '@/src/components/ui/Button';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/Tabs';
import type { CommunityLink } from '@/src/types/communityLink';
import { parseCredentialContent, parseInviteContent } from '@/src/utils/sharedResourceContent';
import { cn } from '@/src/utils/cn';
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

type HelpPanel = 'community' | 'resources';

function ResourceCopyRow({
  label,
  value,
  copied,
  copyLabel,
  copiedLabel,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  copyLabel: string;
  copiedLabel: string;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className="w-full surface-inline px-4 py-3 text-left transition hover:border-[color:var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--page-bg)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
          <p className="mt-2 break-all font-mono text-sm leading-6 text-zinc-200">{value}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1.5 text-[13px] text-[var(--text-primary)]">
          <Copy className="h-4 w-4" />
          {copied ? copiedLabel : copyLabel}
        </span>
      </div>
    </button>
  );
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
  const visibleCommunityLinks = useMemo(
    () =>
      communityLinks.filter(
        (item) =>
          item.active &&
          (item.title.trim() || item.url.trim() || item.summary.trim() || item.qrContent.trim()),
      ),
    [communityLinks],
  );
  const [activePanel, setActivePanel] = useState<HelpPanel>(() =>
    visibleCommunityLinks.length > 0 ? 'community' : 'resources',
  );

  useEffect(() => {
    if (
      activePanel === 'community' &&
      visibleCommunityLinks.length === 0 &&
      sharedResources.length > 0
    ) {
      setActivePanel('resources');
      return;
    }

    if (
      activePanel === 'resources' &&
      sharedResources.length === 0 &&
      visibleCommunityLinks.length > 0
    ) {
      setActivePanel('community');
    }
  }, [activePanel, sharedResources.length, visibleCommunityLinks.length]);

  const activePanelDescription =
    activePanel === 'community'
      ? isZh
        ? `当前共有 ${visibleCommunityLinks.length} 个可加入的社群入口。`
        : `${visibleCommunityLinks.length} community link${visibleCommunityLinks.length === 1 ? '' : 's'} available.`
      : isZh
        ? `当前共有 ${sharedResources.length} 个可用的共享资源。`
        : `${sharedResources.length} shared resource${sharedResources.length === 1 ? '' : 's'} available.`;

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
      <Tabs className="gap-4">
        <section className="surface-card p-4 md:p-5" data-testid="portal-help-switcher">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <TabsList className="w-full justify-start overflow-x-auto lg:w-auto">
              <TabsTrigger
                active={activePanel === 'community'}
                onClick={() => setActivePanel('community')}
                className="gap-2"
              >
                <span>{isZh ? '社区入口' : 'Community links'}</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px]',
                    activePanel === 'community'
                      ? 'bg-[var(--surface-panel)] text-[var(--text-primary)]'
                      : 'bg-[var(--surface-card)] text-zinc-400',
                  )}
                >
                  {visibleCommunityLinks.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                active={activePanel === 'resources'}
                onClick={() => setActivePanel('resources')}
                className="gap-2"
              >
                <span>{isZh ? '共享资源' : 'Shared resources'}</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px]',
                    activePanel === 'resources'
                      ? 'bg-[var(--surface-panel)] text-[var(--text-primary)]'
                      : 'bg-[var(--surface-card)] text-zinc-400',
                  )}
                >
                  {sharedResources.length}
                </span>
              </TabsTrigger>
            </TabsList>

            <p className="text-sm leading-7 text-zinc-400">{activePanelDescription}</p>
          </div>
        </section>

        <TabsContent active={activePanel === 'community'} className="mt-0">
          <CommunityTab communityLinks={communityLinks} isZh={isZh} onSetSection={onSetSection} />
        </TabsContent>

        <TabsContent active={activePanel === 'resources'} className="mt-0">
          <section
            className="surface-card space-y-5 p-6 md:p-7"
            data-testid="portal-help-resources"
          >
            <div className="space-y-1">
              <p className="section-kicker">{isZh ? '帮助中心' : 'Help center'}</p>
              <h3 className="text-xl font-semibold tracking-tight text-zinc-50">
                {isZh ? '共享资源' : 'Shared resources'}
              </h3>
            </div>

            {sharedResources.length > 0 ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {sharedResources.map((resource) => {
                  const hasContent = Boolean(resource.content.trim());
                  const kindLabel = getSharedResourceKindLabel(resource.kind, isZh);
                  const showHeadline = resource.kind === 'other' && Boolean(resource.title.trim());
                  const credentialFields = parseCredentialContent(resource.content);
                  const inviteFields = parseInviteContent(resource.content);
                  const isCredentialResource = resource.access === 'credentials';
                  const isInviteResource = resource.access === 'invite-link';
                  const accountValue = credentialFields.account.trim();
                  const passwordValue = credentialFields.password.trim();
                  const credentialNote = credentialFields.note.trim();
                  const inviteLink = inviteFields.link.trim();
                  const inviteNote = inviteFields.note.trim();
                  const shouldShowGenericCopy =
                    hasContent && !isCredentialResource && !isInviteResource;

                  return (
                    <article
                      key={resource.id}
                      className="surface-panel space-y-4 rounded-[24px] p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-4">
                          <SharedResourceKindIcon kind={resource.kind} />
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
                                {kindLabel}
                              </span>
                              <span className="glass-pill px-2.5 py-1 text-[11px] text-zinc-400">
                                {getSharedResourceAccessLabel(resource.access, isZh)}
                              </span>
                            </div>
                            {showHeadline ? (
                              <h4 className="text-base font-semibold text-zinc-100">
                                {resource.title}
                              </h4>
                            ) : null}
                            {resource.summary ? (
                              <p className="text-sm leading-7 text-zinc-400">{resource.summary}</p>
                            ) : null}
                          </div>
                        </div>

                        {shouldShowGenericCopy ? (
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

                      {isCredentialResource ? (
                        <div className="space-y-3">
                          {accountValue ? (
                            <ResourceCopyRow
                              label={isZh ? '账号 / 邮箱' : 'Account / email'}
                              value={accountValue}
                              copied={copiedKey === `resource-account-${resource.id}`}
                              copyLabel={isZh ? '复制账号' : 'Copy account'}
                              copiedLabel={isZh ? '已复制' : 'Copied'}
                              onCopy={() =>
                                handleCopy(accountValue, `resource-account-${resource.id}`)
                              }
                            />
                          ) : null}

                          {passwordValue ? (
                            <ResourceCopyRow
                              label={isZh ? '密码 / 验证码' : 'Password / code'}
                              value={passwordValue}
                              copied={copiedKey === `resource-password-${resource.id}`}
                              copyLabel={isZh ? '复制密码' : 'Copy password'}
                              copiedLabel={isZh ? '已复制' : 'Copied'}
                              onCopy={() =>
                                handleCopy(passwordValue, `resource-password-${resource.id}`)
                              }
                            />
                          ) : null}

                          {credentialNote ? (
                            <div className="surface-inline px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                                {isZh ? '补充说明' : 'Extra note'}
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                                {credentialNote}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {isInviteResource ? (
                        <div className="space-y-3">
                          {inviteLink ? (
                            <ResourceCopyRow
                              label={isZh ? '邀请链接' : 'Invite link'}
                              value={inviteLink}
                              copied={copiedKey === `resource-link-${resource.id}`}
                              copyLabel={isZh ? '复制链接' : 'Copy link'}
                              copiedLabel={isZh ? '已复制' : 'Copied'}
                              onCopy={() => handleCopy(inviteLink, `resource-link-${resource.id}`)}
                            />
                          ) : null}

                          {inviteNote ? (
                            <div className="surface-inline px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                                {isZh ? '补充说明' : 'Extra note'}
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                                {inviteNote}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {shouldShowGenericCopy ? (
                        <div className="whitespace-pre-wrap surface-inline px-4 py-3 font-mono text-xs leading-6 text-zinc-300">
                          {resource.content}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Inbox}
                title={isZh ? '暂无共享资源' : 'No shared resources'}
                description={
                  isZh
                    ? '管理员添加后会显示在这里。'
                    : 'They will appear here once an admin adds them.'
                }
              />
            )}
          </section>
        </TabsContent>
      </Tabs>
    </section>
  );
}
