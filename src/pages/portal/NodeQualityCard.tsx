import React from 'react';
import { Badge } from '@/src/components/ui/Badge';
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
}

export function NodeQualityCard({ isZh, inboundRemark, profile, className }: NodeQualityCardProps) {
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
          {profile?.summary ? (
            <div className="surface-panel p-4 text-sm leading-6 text-zinc-300">
              {profile.summary}
            </div>
          ) : (
            <div className="surface-panel p-4 text-sm leading-6 text-zinc-500">
              {isZh
                ? '管理员还没有补充这条节点的补充说明。'
                : 'Your admin has not added extra notes for this node yet.'}
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
            {isZh ? '补充说明' : 'Notes'}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">{profile.notes}</p>
        </div>
      ) : !hasDetails ? (
        <p className="text-sm leading-6 text-zinc-500">
          {isZh
            ? '这张卡片展示的是管理员维护的节点测试结果；当前还没有填入详细资料。'
            : 'This card shows admin-maintained checks. Detailed notes are not available yet.'}
        </p>
      ) : null}
    </section>
  );
}
