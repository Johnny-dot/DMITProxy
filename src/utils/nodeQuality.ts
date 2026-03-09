import type {
  NodeQualityEgressMeta,
  NodeQualityProfile,
  NodeQualityServiceDetail,
  UnlockServiceId,
  UnlockStatus,
} from '@/src/types/nodeQuality';

export const UNLOCK_STATUS_VALUES: UnlockStatus[] = ['supported', 'limited', 'blocked', 'unknown'];

export const NODE_QUALITY_SERVICE_LABELS: Record<UnlockServiceId, string> = {
  netflix: 'Netflix',
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  spotify: 'Spotify',
  youtube: 'YouTube',
  disneyplus: 'Disney+',
  primevideo: 'Prime Video',
  x: 'X',
};

const NODE_QUALITY_SERVICE_IDS: UnlockServiceId[] = [
  'netflix',
  'chatgpt',
  'claude',
  'tiktok',
  'instagram',
  'spotify',
  'youtube',
  'disneyplus',
  'primevideo',
  'x',
];

function formatBooleanValue(value: boolean | null | undefined, isZh: boolean) {
  if (value === true) return isZh ? '是' : 'Yes';
  if (value === false) return isZh ? '否' : 'No';
  return isZh ? '未知' : 'Unknown';
}

function joinParts(parts: Array<string | null | undefined>, separator = ' · ') {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(separator);
}

function formatLocation(meta: NodeQualityEgressMeta) {
  return [meta.countryCode || meta.country, meta.regionName, meta.city].filter(Boolean).join(' / ');
}

function formatHttpStatus(detail: NodeQualityServiceDetail) {
  if (detail.httpStatus === null) return null;
  return `HTTP ${detail.httpStatus}`;
}

function formatRedirect(detail: NodeQualityServiceDetail, isZh: boolean) {
  if (!detail.location) return null;
  return isZh ? `跳转到 ${detail.location}` : `Redirect: ${detail.location}`;
}

function getLegacyStatusHint(status: UnlockStatus, isZh: boolean) {
  switch (status) {
    case 'supported':
      return isZh
        ? '这是较早的检测结果，刷新后可看更新说明'
        : 'This comes from an older check. Refresh for newer details.';
    case 'limited':
      return isZh
        ? '这是较早的检测结果，刷新后可看具体原因'
        : 'This comes from an older check. Refresh for the reason.';
    case 'blocked':
      return isZh
        ? '这是较早的检测结果，刷新后可看更新说明'
        : 'This comes from an older check. Refresh for newer details.';
    default:
      return isZh ? '这次还没有拿到明确结果' : 'There is no clear result yet.';
  }
}

function getLegacyStatusTooltip(serviceLabel: string, status: UnlockStatus, isZh: boolean) {
  switch (status) {
    case 'supported':
      return isZh
        ? `${serviceLabel} 当前看起来可用，但这是较早的检测结果。刷新后可以看到更新说明。`
        : `${serviceLabel} currently looks available, but this result comes from an older check. Refresh to see the newer explanation.`;
    case 'limited':
      return isZh
        ? `${serviceLabel} 当前看起来受限，但这是较早的检测结果。刷新后可以看到更具体的原因。`
        : `${serviceLabel} currently looks limited, but this result comes from an older check. Refresh to see the reason in more detail.`;
    case 'blocked':
      return isZh
        ? `${serviceLabel} 当前看起来不可用，但这是较早的检测结果。刷新后可以看到更新说明。`
        : `${serviceLabel} currently looks blocked, but this result comes from an older check. Refresh to see the newer explanation.`;
    default:
      return isZh
        ? `${serviceLabel} 这次还没有拿到足够信号，所以暂时无法判断。`
        : `This check did not collect enough signal for ${serviceLabel}, so the result stays inconclusive for now.`;
  }
}

function getLegacyStatusNote(serviceLabel: string, status: UnlockStatus, isZh: boolean) {
  switch (status) {
    case 'supported':
      return isZh
        ? `${serviceLabel}：这是较早的检测结果，目前显示可用。`
        : `${serviceLabel}: This is an older result and currently shows as available.`;
    case 'limited':
      return isZh
        ? `${serviceLabel}：这是较早的检测结果，目前显示受限。`
        : `${serviceLabel}: This is an older result and currently shows as limited.`;
    case 'blocked':
      return isZh
        ? `${serviceLabel}：这是较早的检测结果，目前显示不可用。`
        : `${serviceLabel}: This is an older result and currently shows as blocked.`;
    default:
      return isZh
        ? `${serviceLabel}：这次还没有足够信号，暂时无法判断。`
        : `${serviceLabel}: There is still not enough signal for a verdict.`;
  }
}

export function getNodeQualityServiceItems(profile: NodeQualityProfile | null | undefined) {
  return NODE_QUALITY_SERVICE_IDS.map((serviceId) => ({
    id: serviceId,
    label: NODE_QUALITY_SERVICE_LABELS[serviceId],
    status:
      (profile?.[`${serviceId}Status` as keyof NodeQualityProfile] as UnlockStatus | undefined) ??
      'unknown',
    detail: profile?.serviceDetails?.[serviceId] ?? null,
  }));
}

export function getUnlockStatusMeta(status: UnlockStatus, isZh: boolean) {
  switch (status) {
    case 'supported':
      return {
        label: isZh ? '可用' : 'Available',
        className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      };
    case 'limited':
      return {
        label: isZh ? '受限' : 'Limited',
        className: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
      };
    case 'blocked':
      return {
        label: isZh ? '不可用' : 'Blocked',
        className: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
      };
    default:
      return {
        label: isZh ? '待确认' : 'Inconclusive',
        className: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20',
      };
  }
}

export function getFraudRiskMeta(fraudScore: number | null, isZh: boolean) {
  if (fraudScore === null) {
    return {
      label: isZh ? '未检测' : 'Not tested',
      className: 'text-zinc-400',
      description: isZh ? '点刷新后就能看到最新结果。' : 'Refresh to see the latest result.',
    };
  }

  if (fraudScore <= 20) {
    return {
      label: isZh ? '低风险' : 'Low risk',
      className: 'text-emerald-400',
      description: isZh
        ? '通常更稳，也更不容易遇到额外验证。'
        : 'Usually steadier and less likely to hit extra verification.',
    };
  }

  if (fraudScore <= 60) {
    return {
      label: isZh ? '中风险' : 'Medium risk',
      className: 'text-amber-300',
      description: isZh
        ? '部分服务可能会要求额外验证。'
        : 'Some services may ask for extra verification.',
    };
  }

  return {
    label: isZh ? '高风险' : 'High risk',
    className: 'text-rose-300',
    description: isZh
      ? '更容易遇到风控、验证码或人工校验。'
      : 'More likely to trigger verification or abuse checks.',
  };
}

export function getNodeQualitySummary(
  profile: NodeQualityProfile | null | undefined,
  isZh: boolean,
) {
  if (!profile) return '';

  if (profile.egress) {
    return joinParts([
      formatLocation(profile.egress) || (isZh ? '未知区域' : 'Unknown region'),
      profile.egress.ip || null,
      profile.fraudScore === null
        ? null
        : isZh
          ? `风险 ${profile.fraudScore}`
          : `Risk ${profile.fraudScore}`,
    ]);
  }

  return profile.summary;
}

export function getNodeQualityOverviewLines(
  profile: NodeQualityProfile | null | undefined,
  isZh: boolean,
) {
  if (!profile?.egress) {
    return profile?.notes
      ? []
      : [isZh ? '出口 IP 信息暂时不可用。' : 'Egress IP metadata is currently unavailable.'];
  }

  const meta = profile.egress;
  return [
    isZh
      ? '这是服务器出口的自动检测结果，仅供参考。'
      : 'This is an automatic check from the server egress and is for reference only.',
    isZh
      ? `IP：${meta.ip || '未知'} · ISP：${meta.isp || '未知'} · ASN：${meta.asn || '未知'}`
      : `IP: ${meta.ip || 'unknown'} · ISP: ${meta.isp || 'unknown'} · ASN: ${meta.asn || 'unknown'}`,
    isZh
      ? `位置：${joinParts([meta.city, meta.regionName, meta.country], ' / ') || '未知'}`
      : `Location: ${joinParts([meta.city, meta.regionName, meta.country], ' / ') || 'unknown'}`,
    isZh
      ? `标记：代理 ${formatBooleanValue(meta.proxy, true)} · 机房 ${formatBooleanValue(meta.hosting, true)} · 移动网络 ${formatBooleanValue(meta.mobile, true)}`
      : `Flags: proxy ${formatBooleanValue(meta.proxy, false)} · hosting ${formatBooleanValue(meta.hosting, false)} · mobile ${formatBooleanValue(meta.mobile, false)}`,
  ];
}

export function getNodeQualityServiceHint(
  serviceId: UnlockServiceId,
  status: UnlockStatus,
  detail: NodeQualityServiceDetail | null | undefined,
  isZh: boolean,
) {
  if (!detail) {
    return getLegacyStatusHint(status, isZh);
  }

  switch (detail.code) {
    case 'http_ok':
      return joinParts([
        formatHttpStatus(detail),
        isZh ? '公开页面可以打开' : 'Public page reachable',
      ]);
    case 'challenge':
      return isZh ? '可以访问，但可能需要验证' : 'Reachable, but verification may be required';
    case 'region_block':
      return isZh ? '当前线路可能受地区限制' : 'Likely region-restricted on this route';
    case 'unsupported_browser':
      return isZh ? '能打开，但结果还不够确定' : 'Reachable, but the result is still inconclusive';
    case 'probe_failed':
      return isZh ? '这次检测没有成功' : 'This check did not succeed';
    case 'trace_unreachable':
      return isZh ? '检测端点暂时没响应' : 'The probe endpoint did not respond';
    case 'static_unreachable':
      return isZh ? '资源入口暂时没响应' : 'The asset endpoint did not respond';
    case 'http_status':
      return joinParts([
        formatHttpStatus(detail),
        formatRedirect(detail, isZh),
        status === 'limited' ? (isZh ? '目前仍算受限' : 'Still limited') : null,
      ]);
    default:
      return isZh ? '还需要更多信号' : 'More signal is needed';
  }
}

export function getNodeQualityServiceTooltip(
  serviceId: UnlockServiceId,
  status: UnlockStatus,
  detail: NodeQualityServiceDetail | null | undefined,
  isZh: boolean,
) {
  const serviceLabel = NODE_QUALITY_SERVICE_LABELS[serviceId];
  if (!detail) {
    return getLegacyStatusTooltip(serviceLabel, status, isZh);
  }

  switch (detail.code) {
    case 'http_ok':
      return isZh
        ? `${serviceLabel} 的公开页面可以打开，但这不代表登录、播放或全部功能一定正常。`
        : `${serviceLabel}'s public page is reachable, but login, playback, or every feature may still behave differently.`;
    case 'challenge':
      return isZh
        ? `${serviceLabel} 可以访问，但可能会要求验证码、风控校验或人工确认。`
        : `${serviceLabel} is reachable, but it may ask for challenges, anti-bot checks, or manual verification.`;
    case 'region_block':
      return isZh
        ? `${serviceLabel} 看起来受地区限制，当前线路可能不在支持区域内。`
        : `${serviceLabel} appears region-restricted, which usually means the current route is outside the supported region.`;
    case 'unsupported_browser':
      return isZh
        ? `${serviceLabel} 能打开，但这次结果还不足以确认完整可用。`
        : `${serviceLabel} is reachable, but this result is still not enough to confirm full usability.`;
    case 'probe_failed':
      return isZh
        ? `这次没有拿到 ${serviceLabel} 的稳定结果，稍后可以再试一次。`
        : `This check did not return a stable result for ${serviceLabel}. Try again later.`;
    case 'trace_unreachable':
      return isZh
        ? `${serviceLabel} 的检测端点这次没有响应，所以还不能确认是否稳定可用。`
        : `The probe endpoint for ${serviceLabel} did not respond, so stable access cannot be confirmed right now.`;
    case 'static_unreachable':
      return isZh
        ? `${serviceLabel} 的资源入口这次没有响应，所以还不能确认当前状态。`
        : `The asset endpoint for ${serviceLabel} did not respond, so its current status cannot be confirmed yet.`;
    case 'http_status':
      return isZh
        ? `${serviceLabel} 返回了非标准页面结果${detail.location ? `，并跳转到了 ${detail.location}` : ''}，所以目前只能判断为部分可达。`
        : `${serviceLabel} returned a non-standard page response${detail.location ? ` and redirected to ${detail.location}` : ''}, so it is only treated as partially reachable for now.`;
    default:
      return isZh
        ? `${serviceLabel} 这次还没有拿到足够信号，所以暂时无法判断。`
        : `This check did not collect enough signal for ${serviceLabel}, so it stays inconclusive for now.`;
  }
}

export function getNodeQualityServiceNote(
  serviceId: UnlockServiceId,
  status: UnlockStatus,
  detail: NodeQualityServiceDetail | null | undefined,
  isZh: boolean,
) {
  const serviceLabel = NODE_QUALITY_SERVICE_LABELS[serviceId];

  if (!detail) {
    return getLegacyStatusNote(serviceLabel, status, isZh);
  }

  switch (detail.code) {
    case 'http_ok':
      return isZh
        ? `${serviceLabel}：公开页面可以打开。`
        : `${serviceLabel}: The public page is reachable.`;
    case 'challenge':
      return isZh
        ? `${serviceLabel}：可以访问，但可能需要验证码或额外验证。`
        : `${serviceLabel}: Reachable, but it may require a challenge or extra verification.`;
    case 'region_block':
      return isZh
        ? `${serviceLabel}：看起来受地区限制，当前线路可能不在支持区域内。`
        : `${serviceLabel}: It appears region-restricted on the current route.`;
    case 'unsupported_browser':
      return isZh
        ? `${serviceLabel}：能打开，但这次结果还不够确定。`
        : `${serviceLabel}: Reachable, but this result is still inconclusive.`;
    case 'probe_failed':
      return isZh
        ? `${serviceLabel}：这次检测没有成功，结果待确认。`
        : `${serviceLabel}: This check failed, so the result remains inconclusive.`;
    case 'trace_unreachable':
      return isZh
        ? `${serviceLabel}：检测端点没有响应，当前还不能确认。`
        : `${serviceLabel}: The probe endpoint did not respond, so access could not be confirmed.`;
    case 'static_unreachable':
      return isZh
        ? `${serviceLabel}：资源入口没有响应，当前还不能确认。`
        : `${serviceLabel}: The asset endpoint did not respond, so access could not be confirmed.`;
    case 'http_status':
      return isZh
        ? `${serviceLabel}：返回了非标准页面结果${detail.location ? `，并跳转到 ${detail.location}` : ''}。`
        : `${serviceLabel}: Returned a non-standard page response${detail.location ? ` and redirected to ${detail.location}` : ''}.`;
    default:
      return isZh
        ? `${serviceLabel}：这次还没有足够信号，暂时无法判断。`
        : `${serviceLabel}: There is still not enough signal for a verdict.`;
  }
}

export function hasMeaningfulNodeQuality(profile: NodeQualityProfile | null | undefined) {
  if (!profile) return false;
  return Boolean(
    profile.summary ||
    profile.notes ||
    profile.egress ||
    Object.keys(profile.serviceDetails ?? {}).length ||
    profile.fraudScore !== null ||
    profile.netflixStatus !== 'unknown' ||
    profile.chatgptStatus !== 'unknown' ||
    profile.claudeStatus !== 'unknown' ||
    profile.tiktokStatus !== 'unknown' ||
    profile.instagramStatus !== 'unknown' ||
    profile.spotifyStatus !== 'unknown' ||
    profile.youtubeStatus !== 'unknown' ||
    profile.disneyplusStatus !== 'unknown' ||
    profile.primevideoStatus !== 'unknown' ||
    profile.xStatus !== 'unknown',
  );
}
