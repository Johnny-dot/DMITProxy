import type { XuiClientStat, XuiInbound } from './xui-admin.js';
import { safeNonNegativeInt } from './xui-admin.js';

const GB = 1024 ** 3;

export interface SubscriptionUsageSummary {
  resetDay: number | null;
  expiryDate: string | null;
  ownUp: number;
  ownDown: number;
  ownUsed: number;
  otherUsersUp: number;
  otherUsersDown: number;
  otherUsersUsed: number;
  totalUp: number;
  totalDown: number;
  totalUsed: number;
  machineUsed: number;
  machineRemaining: number;
  machineTotal: number;
  machineSource: 'dmit' | 'xui';
}

export interface SubscriptionUsageSummaryInput {
  resetDay: number | null;
  expiryTime?: number | null;
  ownUp: number;
  ownDown: number;
  allClientUp: number;
  allClientDown: number;
  machineTotal: number;
  /** Bytes consumed at DMIT (network-layer) — overrides totalUsed when present. */
  dmitMachineUsed?: number;
  /** Bytes of DMIT plan total — overrides machineTotal when present. */
  dmitMachineTotal?: number;
  /** Machine-level source used for display copy. Defaults to DMIT when dmitMachineUsed is present. */
  machineSource?: 'dmit' | 'xui';
}

export interface TrafficBreakdown {
  up: number;
  down: number;
  total: number;
}

export function formatTrafficGB(bytes: number): string {
  return `${(safeNonNegativeInt(bytes) / GB).toFixed(2)}G`;
}

function formatTrafficBriefGB(bytes: number): string {
  return (safeNonNegativeInt(bytes) / GB).toFixed(1).replace(/\.0$/, '');
}

export function getClientUsedBytes(
  stats: { up?: unknown; down?: unknown } | null | undefined,
): number {
  return safeNonNegativeInt(stats?.up) + safeNonNegativeInt(stats?.down);
}

export function getClientTrafficBreakdown(
  stats: { up?: unknown; down?: unknown } | null | undefined,
): TrafficBreakdown {
  const up = safeNonNegativeInt(stats?.up);
  const down = safeNonNegativeInt(stats?.down);
  return { up, down, total: up + down };
}

export function getInboundClientUsedBytes(inbound: Pick<XuiInbound, 'clientStats'>): number {
  return (inbound.clientStats ?? []).reduce(
    (sum: number, stats: XuiClientStat) => sum + getClientUsedBytes(stats),
    0,
  );
}

export function getInboundClientTrafficBreakdown(
  inbound: Pick<XuiInbound, 'clientStats'>,
): TrafficBreakdown {
  return (inbound.clientStats ?? []).reduce<TrafficBreakdown>(
    (sum, stats) => {
      const item = getClientTrafficBreakdown(stats);
      return {
        up: sum.up + item.up,
        down: sum.down + item.down,
        total: sum.total + item.total,
      };
    },
    { up: 0, down: 0, total: 0 },
  );
}

function formatExpiryDate(expiryTime: number | null | undefined): string | null {
  const normalized = safeNonNegativeInt(expiryTime);
  if (!normalized) return null;
  return new Date(normalized).toISOString().slice(0, 10);
}

export function buildSubscriptionUsageSummary(
  input: SubscriptionUsageSummaryInput,
): SubscriptionUsageSummary {
  const ownUp = safeNonNegativeInt(input.ownUp);
  const ownDown = safeNonNegativeInt(input.ownDown);
  const totalUp = safeNonNegativeInt(input.allClientUp);
  const totalDown = safeNonNegativeInt(input.allClientDown);
  const ownUsed = ownUp + ownDown;
  const totalUsed = totalUp + totalDown;

  const machineTotal =
    input.dmitMachineTotal !== undefined
      ? safeNonNegativeInt(input.dmitMachineTotal)
      : safeNonNegativeInt(input.machineTotal);

  const usedForRemaining =
    input.dmitMachineUsed !== undefined ? safeNonNegativeInt(input.dmitMachineUsed) : totalUsed;
  const machineUsed =
    machineTotal > 0 ? Math.min(usedForRemaining, machineTotal) : usedForRemaining;

  return {
    resetDay: Number.isInteger(input.resetDay) && (input.resetDay ?? 0) > 0 ? input.resetDay : null,
    expiryDate: formatExpiryDate(input.expiryTime),
    ownUp,
    ownDown,
    ownUsed,
    otherUsersUp: Math.max(0, totalUp - ownUp),
    otherUsersDown: Math.max(0, totalDown - ownDown),
    otherUsersUsed: Math.max(0, totalUsed - ownUsed),
    totalUp,
    totalDown,
    totalUsed,
    machineUsed,
    machineRemaining: Math.max(0, machineTotal - usedForRemaining),
    machineTotal,
    machineSource: input.machineSource ?? (input.dmitMachineUsed !== undefined ? 'dmit' : 'xui'),
  };
}

export function buildSubscriptionDecorations(input: SubscriptionUsageSummaryInput): string[] {
  const summary = buildSubscriptionUsageSummary(input);
  const resetText = summary.resetDay ? `每月${summary.resetDay}日` : '未配置';
  const expiryText = summary.expiryDate ?? '未配置';

  return [
    `重置｜${resetText}`,
    `到期｜${expiryText}`,
    `个人｜↑${formatTrafficBriefGB(summary.ownUp)} ↓${formatTrafficBriefGB(summary.ownDown)}G`,
    `他人｜↑${formatTrafficBriefGB(summary.otherUsersUp)} ↓${formatTrafficBriefGB(summary.otherUsersDown)}G`,
    `机器｜剩${formatTrafficBriefGB(summary.machineRemaining)}/${formatTrafficBriefGB(summary.machineTotal)}G`,
  ];
}
