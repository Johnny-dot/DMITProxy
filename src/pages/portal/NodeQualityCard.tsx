import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { UnlockServiceIcon } from '@/src/components/icons/UnlockServiceIcon';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';
import { cn } from '@/src/utils/cn';
import type { NodeQualityProfile, NodeQualityServiceDetail } from '@/src/types/nodeQuality';
import {
  getFraudRiskMeta,
  getNodeQualityServiceItems,
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

function formatBooleanValue(value: boolean | null | undefined, isZh: boolean) {
  if (value === true) return isZh ? '是' : 'Yes';
  if (value === false) return isZh ? '否' : 'No';
  return isZh ? '未知' : 'Unknown';
}

function getOverviewLines(profile: NodeQualityProfile | null | undefined, isZh: boolean) {
  if (!profile?.egress) {
    return profile?.notes
      ? []
      : [isZh ? '出口 IP 信息暂时不可用。' : 'Egress IP metadata is currently unavailable.'];
  }

  const meta = profile.egress;
  const isProxyProbe = profile.probeMode === 'proxy-outbound';
  const location =
    [meta.city, meta.regionName, meta.country].filter(Boolean).join(' / ') ||
    (isZh ? '未知' : 'unknown');

  return [
    isZh
      ? isProxyProbe
        ? '这是通过代理节点出口完成的自动检测结果，仅供参考。'
        : '这是服务器出口的自动检测结果，仅供参考。'
      : isProxyProbe
        ? 'This is an automatic check through the proxy node egress and is for reference only.'
        : 'This is an automatic check from the server egress and is for reference only.',
    profile.probeTarget
      ? isZh
        ? `探测目标：${profile.probeTarget}`
        : `Probe target: ${profile.probeTarget}`
      : '',
    isZh
      ? `IP：${meta.ip || '未知'} 路 ISP：${meta.isp || '未知'} 路 ASN：${meta.asn || '未知'}`
      : `IP: ${meta.ip || 'unknown'} 路 ISP: ${meta.isp || 'unknown'} 路 ASN: ${meta.asn || 'unknown'}`,
    isZh ? `位置：${location}` : `Location: ${location}`,
    isZh
      ? `标记：代理 ${formatBooleanValue(meta.proxy, true)} 路 机房 ${formatBooleanValue(meta.hosting, true)} 路 移动网络 ${formatBooleanValue(meta.mobile, true)}`
      : `Flags: proxy ${formatBooleanValue(meta.proxy, false)} 路 hosting ${formatBooleanValue(meta.hosting, false)} 路 mobile ${formatBooleanValue(meta.mobile, false)}`,
  ].filter(Boolean);
}

function getServiceHint(detail: NodeQualityServiceDetail | null | undefined, isZh: boolean) {
  if (!detail) {
    return isZh ? '还没有明确结果。' : 'There is no clear result yet.';
  }

  switch (detail.code) {
    case 'http_ok':
      return detail.httpStatus
        ? isZh
          ? `HTTP ${detail.httpStatus} · 公开页面可以打开`
          : `HTTP ${detail.httpStatus} · Public page reachable`
        : isZh
          ? '公开页面可以打开'
          : 'Public page reachable';
    case 'challenge':
      return isZh ? '可以访问，但可能需要验证' : 'Reachable, but verification may be required';
    case 'region_block':
      return isZh
        ? '当前出口 IP 可能受地区限制'
        : 'Likely region-restricted on the current exit IP';
    case 'unsupported_browser':
      return isZh ? '能打开，但结果还不够确定' : 'Reachable, but the result is still inconclusive';
    case 'probe_failed':
      return isZh ? '这次检测没有成功' : 'This check did not succeed';
    case 'trace_unreachable':
      return isZh ? '检测端点暂时没有响应' : 'The probe endpoint did not respond';
    case 'static_unreachable':
      return isZh ? '资源入口暂时没有响应' : 'The asset endpoint did not respond';
    case 'http_status':
      return detail.httpStatus
        ? detail.location
          ? isZh
            ? `HTTP ${detail.httpStatus} · 跳转到 ${detail.location}`
            : `HTTP ${detail.httpStatus} · Redirected to ${detail.location}`
          : `HTTP ${detail.httpStatus}`
        : isZh
          ? '需要更多信号'
          : 'More signal is needed';
    default:
      return isZh ? '还需要更多信号' : 'More signal is needed';
  }
}

function getServiceTooltip(
  label: string,
  detail: NodeQualityServiceDetail | null | undefined,
  isZh: boolean,
) {
  if (!detail) {
    return isZh
      ? `${label} 还没有拿到足够信号，所以暂时无法判断。`
      : `There is not enough signal for ${label} yet.`;
  }

  switch (detail.code) {
    case 'http_ok':
      return isZh
        ? `${label} 的公开页面可以打开，但这不代表登录、播放或全部功能一定正常。`
        : `${label}'s public page is reachable, but login, playback, or every feature may still behave differently.`;
    case 'challenge':
      return isZh
        ? `${label} 可以访问，但可能会要求验证码、风控校验或人工确认。`
        : `${label} is reachable, but it may ask for challenges, anti-bot checks, or manual verification.`;
    case 'region_block':
      return isZh
        ? `${label} 看起来受地区限制，说明当前出口 IP 可能不在支持区域内。`
        : `${label} appears region-restricted, which usually means the current exit IP is outside the supported region.`;
    case 'unsupported_browser':
      return isZh
        ? `${label} 能打开，但这次结果还不足以确认完整可用。`
        : `${label} is reachable, but this result is still not enough to confirm full usability.`;
    case 'probe_failed':
      return isZh
        ? `这次没有拿到 ${label} 的稳定结果，稍后可以再试一次。`
        : `This check did not return a stable result for ${label}. Try again later.`;
    case 'trace_unreachable':
      return isZh
        ? `${label} 的检测端点这次没有响应，所以还不能确认是否稳定可用。`
        : `The probe endpoint for ${label} did not respond, so stable access cannot be confirmed right now.`;
    case 'static_unreachable':
      return isZh
        ? `${label} 的资源入口这次没有响应，所以还不能确认当前状态。`
        : `The asset endpoint for ${label} did not respond, so its current status cannot be confirmed yet.`;
    case 'http_status':
      return isZh
        ? `${label} 返回了非标准页面结果${detail.location ? `，并跳转到了 ${detail.location}` : ''}，所以目前只能判断为部分可达。`
        : `${label} returned a non-standard page response${detail.location ? ` and redirected to ${detail.location}` : ''}, so it is only treated as partially reachable for now.`;
    default:
      return isZh
        ? `${label} 还没有拿到足够信号，所以暂时无法判断。`
        : `There is not enough signal for ${label} yet.`;
  }
}

function getServiceNote(
  label: string,
  detail: NodeQualityServiceDetail | null | undefined,
  isZh: boolean,
) {
  if (!detail) {
    return isZh ? `${label}：还没有明确结果。` : `${label}: There is no clear result yet.`;
  }

  switch (detail.code) {
    case 'http_ok':
      return isZh ? `${label}：公开页面可以打开。` : `${label}: The public page is reachable.`;
    case 'challenge':
      return isZh
        ? `${label}：可以访问，但可能需要验证码或额外验证。`
        : `${label}: Reachable, but it may require a challenge or extra verification.`;
    case 'region_block':
      return isZh
        ? `${label}：看起来受地区限制，当前出口 IP 可能不在支持区域内。`
        : `${label}: It appears region-restricted on the current exit IP.`;
    case 'unsupported_browser':
      return isZh
        ? `${label}：能打开，但这次结果还不够确定。`
        : `${label}: Reachable, but this result is still inconclusive.`;
    case 'probe_failed':
      return isZh
        ? `${label}：这次检测没有成功，结果待确认。`
        : `${label}: This check failed, so the result remains inconclusive.`;
    case 'trace_unreachable':
      return isZh
        ? `${label}：检测端点没有响应，当前还不能确认。`
        : `${label}: The probe endpoint did not respond, so access could not be confirmed.`;
    case 'static_unreachable':
      return isZh
        ? `${label}：资源入口没有响应，当前还不能确认。`
        : `${label}: The asset endpoint did not respond, so access could not be confirmed.`;
    case 'http_status':
      return isZh
        ? `${label}：返回了非标准页面结果${detail.location ? `，并跳转到了 ${detail.location}` : ''}。`
        : `${label}: Returned a non-standard page response${detail.location ? ` and redirected to ${detail.location}` : ''}.`;
    default:
      return isZh
        ? `${label}：还没有足够信号，暂时无法判断。`
        : `${label}: There is still not enough signal for a verdict.`;
  }
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
  const overviewLines = getOverviewLines(profile, isZh);
  const serviceNoteLines = unlockItems
    .filter((item) => item.detail)
    .map((item) => getServiceNote(item.label, item.detail, isZh));
  const hasStructuredNotes = overviewLines.length > 0 || serviceNoteLines.length > 0;
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

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {unlockItems.map((item) => {
              const meta = getUnlockStatusMeta(item.status, isZh);
              const tooltipText = getServiceTooltip(item.label, item.detail, isZh);
              const hintText = getServiceHint(item.detail, isZh);

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
                        <InfoTooltip content={tooltipText} />
                      </p>
                      <p className="mt-2 text-sm font-medium text-zinc-50">{meta.label}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">{hintText}</p>
                    </div>
                  </div>
                  <Badge className={cn('shrink-0 border', meta.className)}>{meta.label}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {hasStructuredNotes ? (
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

          <div className="grid gap-2 md:grid-cols-2">
            {serviceNoteLines.map((line) => (
              <p key={line} className="text-sm leading-6 text-zinc-300">
                {line}
              </p>
            ))}
          </div>
        </div>
      ) : profile?.notes ? (
        <div className="surface-panel space-y-2 p-4">
          <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            <span>{isZh ? '检测备注' : 'Check notes'}</span>
            <InfoTooltip content={legacyNotesHelpText} />
          </p>
          <p className="text-xs leading-5 text-zinc-500">{legacyNotesHelpText}</p>
          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">{profile.notes}</p>
        </div>
      ) : !hasDetails ? (
        <p className="text-sm leading-6 text-zinc-500">
          {isZh ? '现在还没有可以展示的检测结果。' : 'There are no check results to show yet.'}
        </p>
      ) : null}
    </section>
  );
}
