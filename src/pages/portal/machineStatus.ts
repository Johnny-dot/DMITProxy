import type { ServerStatus } from '@/src/api/xui';

export type MachinePressureLevel = 'good' | 'warn' | 'danger' | 'unknown';

export interface MachinePressureState {
  level: MachinePressureLevel;
  percent: number;
}

export interface NetworkTrendBar {
  key: 'up' | 'down';
  value: number;
  percent: number;
}

function boundedPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value), 0), 100);
}

export function resourceUsagePercent(current: number, total: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return 0;
  return boundedPercent((current / total) * 100);
}

export function getMachinePressureState(serverStatus?: ServerStatus | null): MachinePressureState {
  if (!serverStatus) return { level: 'unknown', percent: 0 };

  const percent = Math.max(
    boundedPercent(serverStatus.cpu),
    resourceUsagePercent(serverStatus.mem.current, serverStatus.mem.total),
    resourceUsagePercent(serverStatus.disk.current, serverStatus.disk.total),
  );

  if (percent >= 85) return { level: 'danger', percent };
  if (percent >= 65) return { level: 'warn', percent };
  return { level: 'good', percent };
}

export function buildNetworkTrendBars(serverStatus?: ServerStatus | null): NetworkTrendBar[] {
  const up = Math.max(0, serverStatus?.netIO.up ?? 0);
  const down = Math.max(0, serverStatus?.netIO.down ?? 0);
  const max = Math.max(up, down, 1);

  return [
    { key: 'up', value: up, percent: boundedPercent((up / max) * 100) },
    { key: 'down', value: down, percent: boundedPercent((down / max) * 100) },
  ];
}

export function formatPortalUptime(seconds: number, isZh: boolean): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const d = Math.floor(safeSeconds / 86400);
  const h = Math.floor((safeSeconds % 86400) / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);

  if (d > 0) return isZh ? `${d}天 ${h}小时 ${m}分钟` : `${d}d ${h}h ${m}m`;
  if (h > 0) return isZh ? `${h}小时 ${m}分钟` : `${h}h ${m}m`;
  return isZh ? `${m}分钟` : `${m}m`;
}
