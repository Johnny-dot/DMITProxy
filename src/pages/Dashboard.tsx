import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Activity,
  Zap,
  Cpu,
  ArrowUpRight,
  HardDrive,
  Database,
  ArrowUp,
  ArrowDown,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/src/components/ui/Card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getInbounds, getServerStatus, Inbound, ServerStatus } from '@/src/api/client';
import { cn } from '@/src/utils/cn';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { flattenInboundClients, formatTraffic, getClientStatus } from '@/src/utils/xuiClients';
import { useToast } from '@/src/components/ui/Toast';
import { useI18n } from '@/src/context/I18nContext';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';

export function Dashboard() {
  const { toast } = useToast();
  const { t, language } = useI18n();
  const [isLoading, setIsLoading] = useState(true);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [inbounds, setInbounds] = useState<Inbound[]>([]);

  const load = async (silent = false) => {
    try {
      const [status, inboundList] = await Promise.all([getServerStatus(), getInbounds()]);
      setServerStatus(status);
      setInbounds(inboundList);
    } catch {
      if (!silent) toast(t('dashboard.failedLoad'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 5000);
    return () => clearInterval(interval);
  }, []);

  const clients = useMemo(() => flattenInboundClients(inbounds), [inbounds]);
  const activeClients = useMemo(
    () =>
      clients.filter(
        (client) => getClientStatus(client) === 'active' && client.up + client.down > 0,
      ),
    [clients],
  );

  const inboundTrafficData = useMemo(() => {
    return inbounds
      .map((inbound) => ({
        name: inbound.remark || `Inbound-${inbound.id}`,
        downloadMB: Number((inbound.down / (1024 * 1024)).toFixed(1)),
        uploadMB: Number((inbound.up / (1024 * 1024)).toFixed(1)),
      }))
      .sort((a, b) => b.downloadMB + b.uploadMB - (a.downloadMB + a.uploadMB))
      .slice(0, 8);
  }, [inbounds]);

  const totalInboundTraffic = useMemo(() => {
    return inbounds.reduce((sum, inbound) => sum + inbound.up + inbound.down, 0);
  }, [inbounds]);

  const stats = [
    {
      key: 'totalClients',
      title: t('dashboard.totalClients'),
      value: String(clients.length),
      icon: Users,
      trend: t('dashboard.inboundsTrend', { count: inbounds.length }),
      color: 'emerald',
    },
    {
      key: 'activeClients',
      title: t('dashboard.activeClients'),
      value: String(activeClients.length),
      icon: Activity,
      trend: t('dashboard.trafficDetected'),
      color: 'indigo',
    },
    {
      key: 'inboundTraffic',
      title: t('dashboard.inboundTraffic'),
      value: formatTraffic(totalInboundTraffic),
      icon: Zap,
      trend: t('dashboard.uploadDownload'),
      color: 'amber',
    },
    {
      key: 'serverLoad',
      title: t('dashboard.serverLoad'),
      value: serverStatus ? `${serverStatus.cpu.toFixed(1)}%` : '--',
      icon: Cpu,
      trend: serverStatus
        ? t('dashboard.cores', { count: serverStatus.cpuCores })
        : t('common.unavailable'),
      color: 'rose',
    },
  ] as const;

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (language === 'zh-CN') {
      if (d > 0) return `${d}天 ${h}小时 ${m}分钟`;
      if (h > 0) return `${h}小时 ${m}分钟`;
      return `${m}分钟`;
    }
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatSpeed = (bytesPerSec: number) => {
    const kbps = bytesPerSec / 1024;
    if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} MB/s`;
    return `${kbps.toFixed(1)} KB/s`;
  };

  const usagePercent = (used: number, total: number) => {
    if (!total || total <= 0) return 0;
    return Math.min((used / total) * 100, 100);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-zinc-400 mt-1">{t('dashboard.subtitle')}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.key}
            className={cn(
              'relative overflow-hidden group transition-all duration-300',
              stat.color === 'emerald' && 'hover:border-emerald-500/50',
              stat.color === 'indigo' && 'hover:border-indigo-500/50',
              stat.color === 'amber' && 'hover:border-amber-500/50',
              stat.color === 'rose' && 'hover:border-rose-500/50',
            )}
          >
            <div
              className={cn(
                'absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none',
                stat.color === 'emerald' && 'bg-emerald-500',
                stat.color === 'indigo' && 'bg-indigo-500',
                stat.color === 'amber' && 'bg-amber-500',
                stat.color === 'rose' && 'bg-rose-500',
              )}
            />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-1 text-sm font-medium text-zinc-400">
                <span>{stat.title}</span>
                <InfoTooltip content={t(`dashboard.help.${stat.key}`)} />
              </CardTitle>
              <stat.icon className="h-4 w-4 text-zinc-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs mt-1 flex items-center gap-1 text-emerald-500">
                    <ArrowUpRight className="w-3 h-3" />
                    {stat.trend}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              <span>{t('dashboard.inboundTrafficOverview')}</span>
              <InfoTooltip content={t('dashboard.help.inboundTrafficOverview')} />
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoading ? (
              <Skeleton className="w-full h-full" />
            ) : inboundTrafficData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm gap-2">
                <ShieldCheck className="w-4 h-4" />
                {t('dashboard.noInboundTrafficData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={inboundTrafficData}>
                  <defs>
                    <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#71717a"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}MB`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#09090b',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                    }}
                    itemStyle={{ fontSize: '12px' }}
                    formatter={(value, name) => [
                      `${value} MB`,
                      name === 'downloadMB' ? t('dashboard.download') : t('dashboard.upload'),
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="downloadMB"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorDownload)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="uploadMB"
                    stroke="#6366f1"
                    fillOpacity={1}
                    fill="url(#colorUpload)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-1">
                <span>{t('dashboard.serverStatus')}</span>
                <InfoTooltip content={t('dashboard.help.serverStatus')} />
              </CardTitle>
              <CardDescription>{t('dashboard.realtimeResourceMonitoring')}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-2 h-2 rounded-full animate-pulse',
                  serverStatus?.xray.state === 'running' ? 'bg-emerald-500' : 'bg-red-500',
                )}
              />
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
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
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Cpu className="w-4 h-4" />
                      <span>{t('dashboard.cpuUsage')}</span>
                      <InfoTooltip content={t('dashboard.help.cpuUsage')} />
                    </div>
                    <span className="font-medium">{serverStatus?.cpu.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        (serverStatus?.cpu ?? 0) < 50
                          ? 'bg-emerald-500'
                          : (serverStatus?.cpu ?? 0) < 80
                            ? 'bg-yellow-500'
                            : 'bg-red-500',
                      )}
                      style={{ width: `${serverStatus?.cpu ?? 0}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Database className="w-4 h-4" />
                      <span>{t('dashboard.ramUsage')}</span>
                      <InfoTooltip content={t('dashboard.help.ramUsage')} />
                    </div>
                    <span className="font-medium">
                      {formatBytes(serverStatus?.mem.current ?? 0)} /{' '}
                      {formatBytes(serverStatus?.mem.total ?? 0)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{
                        width: serverStatus
                          ? `${usagePercent(serverStatus.mem.current, serverStatus.mem.total)}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <HardDrive className="w-4 h-4" />
                      <span>{t('dashboard.diskUsage')}</span>
                      <InfoTooltip content={t('dashboard.help.diskUsage')} />
                    </div>
                    <span className="font-medium">
                      {formatBytes(serverStatus?.disk.current ?? 0)} /{' '}
                      {formatBytes(serverStatus?.disk.total ?? 0)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-500 rounded-full transition-all"
                      style={{
                        width: serverStatus
                          ? `${usagePercent(serverStatus.disk.current, serverStatus.disk.total)}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                      <span className="inline-flex items-center gap-1">
                        <span>{t('dashboard.networkSpeed')}</span>
                        <InfoTooltip content={t('dashboard.help.networkSpeed')} />
                      </span>
                    </p>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-xs">
                        <ArrowUp className="w-3 h-3 text-indigo-500" />
                        <span>{formatSpeed(serverStatus?.netIO.up ?? 0)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <ArrowDown className="w-3 h-3 text-emerald-500" />
                        <span>{formatSpeed(serverStatus?.netIO.down ?? 0)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                      <span className="inline-flex items-center gap-1">
                        <span>{t('dashboard.uptime')}</span>
                        <InfoTooltip content={t('dashboard.help.uptime')} />
                      </span>
                    </p>
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      <span>{serverStatus ? formatUptime(serverStatus.uptime) : '--'}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
