import React from 'react';
import { ArrowDown, ArrowUp, Clock, Cpu, Database, HardDrive } from 'lucide-react';
import type { ServerStatus } from '@/src/api/xui';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/Card';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { useI18n } from '@/src/context/I18nContext';
import { cn } from '@/src/utils/cn';

interface ServerStatusCardProps {
  serverStatus?: ServerStatus | null;
  isLoading?: boolean;
  className?: string;
}

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function formatSpeed(bytesPerSec: number) {
  const kbps = bytesPerSec / 1024;
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} MB/s`;
  return `${kbps.toFixed(1)} KB/s`;
}

function usagePercent(used: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.min((used / total) * 100, 100);
}

export function ServerStatusCard({
  serverStatus,
  isLoading = false,
  className,
}: ServerStatusCardProps) {
  const { t } = useI18n();

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return t('dashboard.uptimeDHM', { d, h, m });
    if (h > 0) return t('dashboard.uptimeHM', { h, m });
    return t('dashboard.uptimeM', { m });
  };

  const xrayIndicatorClass = !serverStatus
    ? 'bg-[var(--text-tertiary)]'
    : serverStatus.xray.state === 'running'
      ? 'bg-emerald-500'
      : 'bg-red-500';

  return (
    <Card className={className} data-testid="server-status-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-1">
            <span>{t('dashboard.serverStatus')}</span>
            <InfoTooltip content={t('dashboard.help.serverStatus')} />
          </CardTitle>
          <CardDescription>{t('dashboard.realtimeResourceMonitoring')}</CardDescription>
        </div>
        <div className="glass-pill flex items-center gap-2 px-3 py-2">
          <div
            className={cn(
              'h-2 w-2 rounded-full',
              serverStatus ? 'animate-pulse' : undefined,
              xrayIndicatorClass,
            )}
          />
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
            {t('dashboard.xray')}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="surface-panel space-y-3 p-4">
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <Cpu className="h-4 w-4" />
                  <span>{t('dashboard.cpuUsage')}</span>
                  <InfoTooltip content={t('dashboard.help.cpuUsage')} />
                </div>
                <span className="font-medium">
                  {serverStatus ? `${serverStatus.cpu.toFixed(1)}%` : '--'}
                </span>
              </div>
              <div className="glass-progress-track h-2 w-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    (serverStatus?.cpu ?? 0) < 50
                      ? 'bg-emerald-500'
                      : (serverStatus?.cpu ?? 0) < 80
                        ? 'bg-amber-500'
                        : 'bg-red-500',
                  )}
                  style={{ width: `${serverStatus?.cpu ?? 0}%` }}
                />
              </div>
            </div>

            <div className="surface-panel space-y-3 p-4">
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <Database className="h-4 w-4" />
                  <span>{t('dashboard.ramUsage')}</span>
                  <InfoTooltip content={t('dashboard.help.ramUsage')} />
                </div>
                <span className="font-medium">
                  {serverStatus
                    ? `${formatBytes(serverStatus.mem.current)} / ${formatBytes(serverStatus.mem.total)}`
                    : '--'}
                </span>
              </div>
              <div className="glass-progress-track h-2 w-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{
                    width: serverStatus
                      ? `${usagePercent(serverStatus.mem.current, serverStatus.mem.total)}%`
                      : '0%',
                  }}
                />
              </div>
            </div>

            <div className="surface-panel space-y-3 p-4">
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <HardDrive className="h-4 w-4" />
                  <span>{t('dashboard.diskUsage')}</span>
                  <InfoTooltip content={t('dashboard.help.diskUsage')} />
                </div>
                <span className="font-medium">
                  {serverStatus
                    ? `${formatBytes(serverStatus.disk.current)} / ${formatBytes(serverStatus.disk.total)}`
                    : '--'}
                </span>
              </div>
              <div className="glass-progress-track h-2 w-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--text-tertiary)] transition-all"
                  style={{
                    width: serverStatus
                      ? `${usagePercent(serverStatus.disk.current, serverStatus.disk.total)}%`
                      : '0%',
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-[color:var(--border-subtle)] pt-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1">
                    <span>{t('dashboard.networkSpeed')}</span>
                    <InfoTooltip content={t('dashboard.help.networkSpeed')} />
                  </span>
                </p>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs">
                    <ArrowUp className="h-3 w-3 text-indigo-500" />
                    <span>{serverStatus ? formatSpeed(serverStatus.netIO.up) : '--'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <ArrowDown className="h-3 w-3 text-emerald-500" />
                    <span>{serverStatus ? formatSpeed(serverStatus.netIO.down) : '--'}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1">
                    <span>{t('dashboard.uptime')}</span>
                    <InfoTooltip content={t('dashboard.help.uptime')} />
                  </span>
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="h-3 w-3 text-[var(--text-secondary)]" />
                  <span>{serverStatus ? formatUptime(serverStatus.uptime) : '--'}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
