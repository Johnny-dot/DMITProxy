import type { NodeQualityProfile, UnlockStatus } from '@/src/types/nodeQuality';

export const UNLOCK_STATUS_VALUES: UnlockStatus[] = ['supported', 'limited', 'blocked', 'unknown'];

export function getUnlockStatusMeta(status: UnlockStatus, isZh: boolean) {
  switch (status) {
    case 'supported':
      return {
        label: isZh ? '可用' : 'Supported',
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
        label: isZh ? '未标注' : 'Unknown',
        className: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20',
      };
  }
}

export function getFraudRiskMeta(fraudScore: number | null, isZh: boolean) {
  if (fraudScore === null) {
    return {
      label: isZh ? '待补充' : 'Pending',
      className: 'text-zinc-400',
      description: isZh ? '管理员尚未填写欺诈值。' : 'Awaiting admin input.',
    };
  }

  if (fraudScore <= 20) {
    return {
      label: isZh ? '低风险' : 'Low risk',
      className: 'text-emerald-400',
      description: isZh ? '数值越低，越接近干净住宅环境。' : 'Lower is generally cleaner.',
    };
  }

  if (fraudScore <= 60) {
    return {
      label: isZh ? '中等风险' : 'Medium risk',
      className: 'text-amber-300',
      description: isZh ? '部分服务可能需要二次验证。' : 'Some services may require extra checks.',
    };
  }

  return {
    label: isZh ? '高风险' : 'High risk',
    className: 'text-rose-300',
    description: isZh ? '更容易被风控命中。' : 'More likely to trigger abuse checks.',
  };
}

export function hasMeaningfulNodeQuality(profile: NodeQualityProfile | null | undefined) {
  if (!profile) return false;
  return Boolean(
    profile.summary ||
    profile.notes ||
    profile.fraudScore !== null ||
    profile.netflixStatus !== 'unknown' ||
    profile.chatgptStatus !== 'unknown' ||
    profile.claudeStatus !== 'unknown',
  );
}
