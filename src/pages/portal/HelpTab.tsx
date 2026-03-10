import React, { useMemo, useState } from 'react';
import { BellRing, Copy, ExternalLink, LifeBuoy, Link as LinkIcon, Users } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import {
  getSharedResourceAccessLabel,
  getSharedResourceKindLabel,
} from '@/src/types/sharedResource';
import type { PortalSettings, PortalTab } from './types';
import { COPY_RESET_DELAY_MS } from './types';

interface HelpTabProps {
  portalSettings: PortalSettings | null;
  isZh: boolean;
  onSetSection?: (tab: PortalTab) => void;
}

export function HelpTab({ portalSettings, isZh, onSetSection }: HelpTabProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const sharedResources = useMemo(
    () =>
      (portalSettings?.sharedResources ?? []).filter(
        (item) => item.active && (item.title.trim() || item.content.trim() || item.summary.trim()),
      ),
    [portalSettings?.sharedResources],
  );
  const supportContact = portalSettings?.supportTelegram?.trim() ?? '';
  const announcementText = portalSettings?.announcementActive
    ? portalSettings.announcementText.trim()
    : '';

  const troubleshootingItems = isZh
    ? [
        '先在客户端里执行“更新订阅”或刷新配置，再重新连接。',
        '切换到其他节点重试，优先选择延迟更低、状态正常的节点。',
        '如果仍然失败，把报错截图、客户端名称和设备平台一起发给支持渠道。',
      ]
    : [
        'Run "update subscription" or refresh the profile in the client before reconnecting.',
        'Try another node and prefer one with lower latency and a healthy status.',
        'If it still fails, send the error screenshot, client name, and device platform to support.',
      ];

  function handleCopy(text: string, key: string) {
    if (!text.trim()) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, COPY_RESET_DELAY_MS);
    });
  }

  function openExternal(url: string) {
    if (!/^https?:\/\//i.test(url.trim())) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="space-y-6" data-testid="portal-help-tab">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="surface-card space-y-5 p-6 md:p-7">
          <div className="space-y-3">
            <p className="section-kicker">{isZh ? '帮助中心' : 'Help center'}</p>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
              {isZh ? '需要支持时，直接来这一页。' : 'Open this page whenever you need support.'}
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-zinc-400">
              {isZh
                ? '共享资源、联系渠道、公告和排障建议不再塞在设置流程底部。这里集中展示，查找更直接。'
                : 'Shared resources, support contacts, announcements, and troubleshooting now live on their own page instead of being buried under setup.'}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              icon={Users}
              label={isZh ? '共享资源' : 'Resources'}
              value={String(sharedResources.length)}
              description={isZh ? '可复制的账号与补充资料' : 'Copyable accounts and extra notes'}
            />
            <SummaryCard
              icon={LifeBuoy}
              label={isZh ? '支持联系' : 'Support'}
              value={supportContact ? (isZh ? '已配置' : 'Ready') : isZh ? '未配置' : 'Empty'}
              description={isZh ? '人工协助与服务说明' : 'Human help and service notes'}
            />
            <SummaryCard
              icon={BellRing}
              label={isZh ? '公告提醒' : 'Announcement'}
              value={announcementText ? (isZh ? '进行中' : 'Live') : isZh ? '无' : 'None'}
              description={isZh ? '最近的补充说明和状态' : 'Latest service notes and updates'}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => onSetSection?.('setup')}>
              {isZh ? '返回使用订阅' : 'Back to setup'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onSetSection?.('community')}>
              {isZh ? '查看社区入口' : 'Open community'}
            </Button>
          </div>
        </div>

        <div className="surface-card space-y-4 p-6 md:p-7">
          <div className="space-y-2">
            <p className="section-kicker">{isZh ? '使用建议' : 'Recommended flow'}</p>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-50">
              {isZh ? '排障顺序也单独放清楚了。' : 'The support flow is now easier to follow.'}
            </h3>
          </div>

          <div className="space-y-3">
            {troubleshootingItems.map((item, index) => (
              <div
                key={item}
                className="surface-panel flex items-start gap-3 rounded-[24px] px-4 py-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-sm font-medium text-emerald-300">
                  {index + 1}
                </span>
                <p className="pt-0.5 text-sm leading-7 text-zinc-300">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="surface-card space-y-5 p-6 md:p-7" data-testid="portal-help-resources">
        <div className="space-y-2">
          <p className="section-kicker">{isZh ? '共享资源' : 'Shared resources'}</p>
          <h3 className="text-xl font-semibold tracking-tight text-zinc-50">
            {isZh ? '共享账号和补充资料' : 'Shared accounts and extra notes'}
          </h3>
          <p className="max-w-3xl text-sm leading-7 text-zinc-400">
            {isZh
              ? '如果你需要 Apple ID、共享账号或额外的登录说明，都集中展示在这里。'
              : 'If you need an Apple ID, shared account, or extra access notes, everything is collected here.'}
          </p>
        </div>

        {sharedResources.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {sharedResources.map((resource) => (
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
                </div>
                <div className="whitespace-pre-wrap rounded-[20px] border border-[color:var(--border-subtle)] bg-black/10 px-4 py-3 font-mono text-xs leading-6 text-zinc-300">
                  {resource.content}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="surface-panel rounded-[24px] p-5 text-sm leading-7 text-zinc-400">
            {isZh
              ? '当前还没有可用的共享资源或额外账号说明。'
              : 'There are no shared resources or extra account notes available right now.'}
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-2" data-testid="portal-help-support">
        <article className="surface-card space-y-5 p-6 md:p-7">
          <div className="space-y-2">
            <p className="section-kicker">{isZh ? '联系支持' : 'Support contact'}</p>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-50">
              {isZh ? '人工协助和服务说明' : 'Human help and service notes'}
            </h3>
          </div>

          <div className="surface-panel rounded-[24px] p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              {isZh ? '联系渠道' : 'Contact'}
            </p>
            <p className="mt-3 break-all text-sm leading-7 text-zinc-300">
              {supportContact ||
                (isZh
                  ? '当前还没有固定的联系渠道。'
                  : 'There is no fixed support contact configured right now.')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {supportContact ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => handleCopy(supportContact, 'support-contact')}
              >
                <Copy className="h-4 w-4" />
                {copiedKey === 'support-contact'
                  ? isZh
                    ? '已复制'
                    : 'Copied'
                  : isZh
                    ? '复制联系信息'
                    : 'Copy contact'}
              </Button>
            ) : null}
            {supportContact && /^https?:\/\//i.test(supportContact) ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => openExternal(supportContact)}
              >
                <ExternalLink className="h-4 w-4" />
                {isZh ? '打开支持入口' : 'Open support'}
              </Button>
            ) : null}
          </div>
        </article>

        <article className="surface-card space-y-5 p-6 md:p-7">
          <div className="space-y-2">
            <p className="section-kicker">{isZh ? '额外说明' : 'Announcement'}</p>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-50">
              {isZh ? '最近的公告和状态提醒' : 'Latest service notes and updates'}
            </h3>
          </div>

          <div className="surface-panel rounded-[24px] p-5">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
              <BellRing className="h-3.5 w-3.5" />
              <span>{isZh ? '当前公告' : 'Current note'}</span>
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
              {announcementText ||
                (isZh ? '当前没有额外公告说明。' : 'There is no active announcement right now.')}
            </p>
          </div>
        </article>
      </section>

      <section
        className="surface-card space-y-5 p-6 md:p-7"
        data-testid="portal-help-troubleshooting"
      >
        <div className="space-y-2">
          <p className="section-kicker">{isZh ? '排障建议' : 'Troubleshooting'}</p>
          <h3 className="text-xl font-semibold tracking-tight text-zinc-50">
            {isZh
              ? '导入后仍然无法连接时，按这个顺序排查。'
              : 'If it still fails after import, troubleshoot in this order.'}
          </h3>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {troubleshootingItems.map((item, index) => (
            <article key={item} className="surface-panel rounded-[24px] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-sm font-medium text-emerald-300">
                  {index + 1}
                </span>
                <p className="text-sm font-medium text-zinc-100">
                  {isZh ? `排查步骤 ${index + 1}` : `Check ${index + 1}`}
                </p>
              </div>
              <p className="mt-4 text-sm leading-7 text-zinc-300">{item}</p>
            </article>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={() => onSetSection?.('setup')}
          >
            <LinkIcon className="h-4 w-4" />
            {isZh ? '回到导入页重新核对' : 'Back to setup'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onSetSection?.('community')}>
            {isZh ? '再去看社区入口' : 'Open community'}
          </Button>
        </div>
      </section>
    </section>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="surface-panel rounded-[24px] p-4">
      <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-3 text-lg font-semibold text-zinc-50">{value}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
    </div>
  );
}
