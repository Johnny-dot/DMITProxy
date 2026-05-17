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
  machineRemaining: number;
  machineTotal: number;
}

export interface SubscriptionUsageSummaryInput {
  resetDay: number | null;
  expiryTime?: number | null;
  ownUp: number;
  ownDown: number;
  allClientUp: number;
  allClientDown: number;
  machineTotal: number;
}

export interface TrafficBreakdown {
  up: number;
  down: number;
  total: number;
}

export function formatTrafficGB(bytes: number): string {
  return `${(safeNonNegativeInt(bytes) / GB).toFixed(2)}G`;
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
  const machineTotal = safeNonNegativeInt(input.machineTotal);

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
    machineRemaining: Math.max(0, machineTotal - totalUsed),
    machineTotal,
  };
}

export function buildSubscriptionDecorations(input: SubscriptionUsageSummaryInput): string[] {
  const summary = buildSubscriptionUsageSummary(input);
  const resetText = summary.resetDay ? `每月 ${summary.resetDay} 日（UTC）` : '未配置';
  const expiryText = summary.expiryDate ?? '未配置';

  return [
    `账单重置｜${resetText}`,
    `订阅到期｜${expiryText}`,
    `本月消耗｜↑ ${formatTrafficGB(summary.ownUp)} · ↓ ${formatTrafficGB(summary.ownDown)}`,
    `他人消耗｜↑ ${formatTrafficGB(summary.otherUsersUp)} · ↓ ${formatTrafficGB(summary.otherUsersDown)}`,
    `机器余量｜${formatTrafficGB(summary.machineRemaining)} / ${formatTrafficGB(summary.machineTotal)}`,
  ];
}
