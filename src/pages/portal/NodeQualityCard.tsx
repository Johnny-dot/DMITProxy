import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { UnlockServiceIcon } from '@/src/components/icons/UnlockServiceIcon';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';
import { cn } from '@/src/utils/cn';
import type { NodeQualityProfile } from '@/src/types/nodeQuality';
import {
  getFraudRiskMeta,
  getNodeQualityServiceItems,
  getUnlockStatusMeta,
  hasMeaningfulNodeQuality,
} from '@/src/utils/nodeQuality';

interface NodeQualityCardProps {
  isZh: boolean;
  inboundRemark?: string;
  profile?: NodeQualityProfile | null;
  className?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function formatCheckedAt(value: number | null | undefined, isZh: boolean) {
  if (!value) return isZh ? '尚未检测' : 'Not checked yet';
  return new Date(value).toLocaleString(isZh ? 'zh-CN' : 'en-US', { hour12: false });
}

export function NodeQualityCard({
  isZh,
  inboundRemark,
  profile,
  className,
  onRefresh,
  isRefreshing = false,
}: NodeQualityCardProps) {
  if (!profile && !inboundRemark) return null;

  const fraudMeta = getFraudRiskMeta(profile?.fraudScore ?? null, isZh);
  const unlockItems = getNodeQualityServiceItems(profile);
  const hasDetails = hasMeaningfulNodeQuality(profile);
  const riskHelpText = isZh
    ? '这是根据当前出口 IP 的风控信号做的参考值，通常越低越稳，但不是官方评分。'
    : 'A reference value based on current egress-IP risk signals. Lower is usually better, but it is not an official score.';
  const checkedAtHelpText = isZh
    ? '最近一次自动检测完成的时间。'
    : 'When the latest automatic check finished.';
  const unlockHelpText = isZh
    ? '表示这条线路访问该服务时的大致可用情况，仅供参考。'
    : 'Estimated availability of this service from the current node. For reference only.';
  const notesHelpText = isZh
    ? '补充记录这次检测里比较值得注意的结果。'
    : 'Extra notes recorded during the latest check.';

  return (
    <section className={cn('surface-card space-y-5 p-6 md:p-7', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="section-kicker">{isZh ? '节点情况' : 'Node check'}</p>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
            {isZh ? '这条线路最近的风控和解锁情况' : 'How this node is doing right now'}
          </h2>
          <p className="text-sm leading-6 text-zinc-400">
            {inboundRemark
              ? isZh
                ? `当前节点：${inboundRemark}`
                : `Current node: ${inboundRemark}`
              : isZh
                ? '当前节点信息会显示在这里。'
                : 'Current node details appear here.'}
          </p>
        </div>

        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 self-start"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            {isRefreshing ? (isZh ? '检测中...' : 'Refreshing...') : isZh ? '重新检测' : 'Refresh'}
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
        <div className="surface-panel p-4">
          <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            <span>{isZh ? '风控值' : 'Risk score'}</span>
            <InfoTooltip content={riskHelpText} />
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{profile?.fraudScore ?? '--'}</p>
          <p className={cn('mt-1 text-sm font-medium', fraudMeta.className)}>{fraudMeta.label}</p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">{fraudMeta.description}</p>
        </div>

        <div className="space-y-4">
          <div className="surface-panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                <span>{isZh ? '最近检测' : 'Last checked'}</span>
                <InfoTooltip content={checkedAtHelpText} />
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-50">
                {formatCheckedAt(profile?.updatedAt, isZh)}
              </p>
            </div>
            <span className="text-xs text-zinc-500">
              {isZh ? '自动检测结果' : 'Auto-checked from the server'}
            </span>
          </div>

          {profile?.summary ? (
            <div className="surface-panel p-4 text-sm leading-6 text-zinc-300">
              {profile.summary}
            </div>
          ) : (
            <div className="surface-panel p-4 text-sm leading-6 text-zinc-500">
              {isZh
                ? '还没有检测结果。点一下右上角“重新检测”就会刷新。'
                : 'No result yet. Use Refresh to run a fresh check.'}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {unlockItems.map((item) => {
              const meta = getUnlockStatusMeta(item.status, isZh);
              return (
                <div
                  key={item.id}
                  className="surface-panel flex items-center justify-between gap-3 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <UnlockServiceIcon service={item.id} />
                    <div className="min-w-0">
                      <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                        <span>{item.label}</span>
                        <InfoTooltip content={unlockHelpText} />
                      </p>
                      <p className="mt-2 text-sm font-medium text-zinc-50">{meta.label}</p>
                    </div>
                  </div>
                  <Badge className={cn('shrink-0 border', meta.className)}>{meta.label}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {profile?.notes ? (
        <div className="surface-panel space-y-2 p-4">
          <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            <span>{isZh ? '检测备注' : 'Check notes'}</span>
            <InfoTooltip content={notesHelpText} />
          </p>
          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">{profile.notes}</p>
        </div>
      ) : !hasDetails ? (
        <p className="text-sm leading-6 text-zinc-500">
          {isZh ? '现在还没有可展示的检测结果。' : 'There are no check results to show yet.'}
        </p>
      ) : null}
    </section>
  );
}
