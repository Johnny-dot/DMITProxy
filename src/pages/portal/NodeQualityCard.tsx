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
  getNodeQualityOverviewLines,
  getNodeQualityServiceItems,
  getNodeQualityServiceNote,
  getNodeQualityServiceTooltip,
  getNodeQualitySummary,
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

export function getNodeQualityCardNotes(
  profile: NodeQualityProfile | null | undefined,
  isZh: boolean,
) {
  const overviewLines = getNodeQualityOverviewLines(profile, isZh).filter((line): line is string =>
    Boolean(line),
  );
  const serviceNoteLines = getNodeQualityServiceItems(profile)
    .filter((item) => item.detail || item.status !== 'unknown')
    .map((item) => getNodeQualityServiceNote(item.id, item.status, item.detail, isZh));
  const hasStructuredNotes = overviewLines.length > 0 || serviceNoteLines.length > 0;
  const legacyNotesText = profile?.notes?.trim() ?? '';
  const hasServiceDetails = Object.keys(profile?.serviceDetails ?? {}).length > 0;
  const shouldRenderLegacyNotes = legacyNotesText.length > 0 && !hasServiceDetails;

  return {
    overviewLines,
    serviceNoteLines,
    legacyNotesText,
    shouldRenderLegacyNotes,
    hasAnyNotes: hasStructuredNotes || shouldRenderLegacyNotes,
  };
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

  const isProxyProbe = profile?.probeMode === 'proxy-outbound';
  const fraudMeta = getFraudRiskMeta(profile?.fraudScore ?? null, isZh);
  const unlockItems = getNodeQualityServiceItems(profile);
  const hasDetails = hasMeaningfulNodeQuality(profile);
  const summary = getNodeQualitySummary(profile, isZh);
  const { overviewLines, serviceNoteLines, legacyNotesText, shouldRenderLegacyNotes, hasAnyNotes } =
    getNodeQualityCardNotes(profile, isZh);
  const riskHelpText = isZh
    ? '这是当前检测到的出口 IP 风险参考值。通常越低越稳定，但它不是任何平台的官方评分。'
    : 'This is a reference risk score for the detected exit IP. Lower usually means steadier, but it is not an official platform score.';
  const checkedAtHelpText = isZh
    ? isProxyProbe
      ? '这是最近一次通过代理节点完成检测的时间。'
      : '这是最近一次服务器出口检测完成的时间。'
    : isProxyProbe
      ? 'This is when the latest proxy-node check finished.'
      : 'This is when the latest server-egress check finished.';
  const notesHelpText = isZh
    ? isProxyProbe
      ? '这里会说明代理出口的检测结果，以及各服务现在大致是可用、受限还是待确认。'
      : '这里会说明服务器出口的检测结果，以及各服务现在大致是可用、受限还是待确认。'
    : isProxyProbe
      ? 'This section explains the proxy egress and whether each service looks available, limited, or still inconclusive.'
      : 'This section explains the server egress and whether each service looks available, limited, or still inconclusive.';
  const legacyNotesHelpText = isZh
    ? '这是较早缓存下来的结果。重新检测一次后，会显示新的说明。'
    : 'This is an older cached result. Refresh once to get the newer explanation.';

  return (
    <section className={cn('surface-card space-y-5 p-6 md:p-7', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="section-kicker">
            {isZh
              ? isProxyProbe
                ? '代理出口检测'
                : '服务器出口检测'
              : isProxyProbe
                ? 'Proxy route check'
                : 'Server egress check'}
          </p>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
            {isZh
              ? isProxyProbe
                ? '当前代理线路的风控和可达性'
                : '当前服务器出口的风控和可达性'
              : isProxyProbe
                ? 'How this proxy route is doing right now'
                : 'How the server egress is doing right now'}
          </h2>
          <p className="text-sm leading-6 text-zinc-400">
            {inboundRemark
              ? isZh
                ? `关联入站：${inboundRemark}`
                : `Linked inbound: ${inboundRemark}`
              : isZh
                ? '关联的入站备注会显示在这里。'
                : 'The linked inbound remark appears here.'}
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
            <span>{isZh ? '风险值' : 'Risk score'}</span>
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
              {isZh
                ? isProxyProbe
                  ? '来自代理节点自动检测'
                  : '来自服务器出口自动检测'
                : isProxyProbe
                  ? 'Automatic proxy-node check'
                  : 'Automatic server-egress check'}
            </span>
          </div>

          {summary ? (
            <div className="surface-panel p-4 text-sm leading-6 text-zinc-300">{summary}</div>
          ) : (
            <div className="surface-panel p-4 text-sm leading-6 text-zinc-500">
              {isZh
                ? '还没有检测结果，点右上角“重新检测”再试一次。'
                : 'There is no result yet. Use Refresh to run a new check.'}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {unlockItems.map((item) => {
              const meta = getUnlockStatusMeta(item.status, isZh);
              const tooltipText = getNodeQualityServiceTooltip(
                item.id,
                item.status,
                item.detail,
                isZh,
              );

              return (
                <div
                  key={item.id}
                  className="surface-panel flex items-center justify-between gap-2 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <UnlockServiceIcon service={item.id} />
                    <p className="inline-flex min-w-0 items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                      <span className="truncate">{item.label}</span>
                      <InfoTooltip content={tooltipText} />
                    </p>
                  </div>
                  <Badge className={cn('shrink-0 border', meta.className)}>{meta.label}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {hasAnyNotes ? (
        <div className="surface-panel space-y-4 p-4">
          <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            <span>{isZh ? '检测备注' : 'Check notes'}</span>
            <InfoTooltip content={notesHelpText} />
          </p>

          {overviewLines.length > 0 && (
            <div className="grid gap-2 md:grid-cols-2">
              {overviewLines.map((line) => (
                <p key={line} className="text-sm leading-6 text-zinc-300">
                  {line}
                </p>
              ))}
            </div>
          )}

          {serviceNoteLines.length > 0 && (
            <div className="grid gap-2 md:grid-cols-2">
              {serviceNoteLines.map((line) => (
                <p key={line} className="text-sm leading-6 text-zinc-300">
                  {line}
                </p>
              ))}
            </div>
          )}

          {shouldRenderLegacyNotes && (
            <div className="space-y-2">
              <p className="text-xs leading-5 text-zinc-500">{legacyNotesHelpText}</p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                {legacyNotesText}
              </p>
            </div>
          )}
        </div>
      ) : !hasDetails ? (
        <p className="text-sm leading-6 text-zinc-500">
          {isZh ? '现在还没有可以展示的检测结果。' : 'There are no check results to show yet.'}
        </p>
      ) : null}
    </section>
  );
}
