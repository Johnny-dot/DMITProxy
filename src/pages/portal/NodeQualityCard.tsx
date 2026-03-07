import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/utils/cn';
import type { NodeQualityProfile } from '@/src/types/nodeQuality';
import {
  getFraudRiskMeta,
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
  const unlockItems = [
    { label: 'Netflix', status: profile?.netflixStatus ?? 'unknown' },
    { label: 'ChatGPT', status: profile?.chatgptStatus ?? 'unknown' },
    { label: 'Claude', status: profile?.claudeStatus ?? 'unknown' },
  ];
  const hasDetails = hasMeaningfulNodeQuality(profile);

  return (
    <section className={cn('surface-card space-y-5 p-6 md:p-7', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="section-kicker">{isZh ? '节点质量' : 'Node quality'}</p>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
            {isZh ? '当前节点的风控与解锁情况' : 'Risk and unlock status for your current node'}
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
            {isRefreshing ? (isZh ? '检测中...' : 'Refreshing...') : isZh ? '刷新检测' : 'Refresh'}
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
        <div className="surface-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            {isZh ? '欺诈值' : 'Fraud score'}
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{profile?.fraudScore ?? '--'}</p>
          <p className={cn('mt-1 text-sm font-medium', fraudMeta.className)}>{fraudMeta.label}</p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">{fraudMeta.description}</p>
        </div>

        <div className="space-y-4">
          <div className="surface-panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                {isZh ? '最近检测' : 'Last checked'}
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-50">
                {formatCheckedAt(profile?.updatedAt, isZh)}
              </p>
            </div>
            <span className="text-xs text-zinc-500">
              {isZh ? '由服务器出口自动探测' : 'Auto-probed from server egress'}
            </span>
          </div>

          {profile?.summary ? (
            <div className="surface-panel p-4 text-sm leading-6 text-zinc-300">
              {profile.summary}
            </div>
          ) : (
            <div className="surface-panel p-4 text-sm leading-6 text-zinc-500">
              {isZh
                ? '还没有检测结果。点击右上角“刷新检测”获取最新状态。'
                : 'No probe result yet. Use Refresh to run a live check.'}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            {unlockItems.map((item) => {
              const meta = getUnlockStatusMeta(item.status, isZh);
              return (
                <div
                  key={item.label}
                  className="surface-panel flex items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-medium text-zinc-50">{meta.label}</p>
                  </div>
                  <Badge className={cn('border', meta.className)}>{meta.label}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {profile?.notes ? (
        <div className="surface-panel space-y-2 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            {isZh ? '检测详情' : 'Probe details'}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">{profile.notes}</p>
        </div>
      ) : !hasDetails ? (
        <p className="text-sm leading-6 text-zinc-500">
          {isZh
            ? '当前还没有可展示的自动探测结果。'
            : 'No automatic probe details are available yet.'}
        </p>
      ) : null}
    </section>
  );
}
