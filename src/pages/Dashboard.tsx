import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Users, Activity, Zap, Cpu, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
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
import { Skeleton } from '@/src/components/ui/Skeleton';
import { flattenInboundClients, formatTraffic, getClientStatus } from '@/src/utils/xuiClients';
import { useToast } from '@/src/components/ui/Toast';
import { useI18n } from '@/src/context/I18nContext';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';
import { ServerStatusCard } from '@/src/components/status/ServerStatusCard';

const DASHBOARD_POLL_INTERVAL_MS = 5_000;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

export function Dashboard() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(true);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const pollTimerRef = useRef<number | null>(null);
  const inFlightRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let disposed = false;
    let hasLoadedOnce = false;
    let isInFlight = false;

    const clearPollTimer = () => {
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const clearInFlightRequest = () => {
      if (inFlightRequestRef.current) {
        inFlightRequestRef.current.abort();
        inFlightRequestRef.current = null;
      }
    };

    const scheduleNextPoll = () => {
      clearPollTimer();
      if (disposed || document.visibilityState !== 'visible') return;

      pollTimerRef.current = window.setTimeout(() => {
        void load(true);
      }, DASHBOARD_POLL_INTERVAL_MS);
    };

    const load = async (silent = false) => {
      if (disposed || isInFlight) return;

      isInFlight = true;
      clearPollTimer();

      const controller = new AbortController();
      inFlightRequestRef.current = controller;

      try {
        const [status, inboundList] = await Promise.all([
          getServerStatus({ signal: controller.signal }),
          getInbounds({ signal: controller.signal }),
        ]);

        if (disposed || controller.signal.aborted) return;

        setServerStatus(status);
        setInbounds(inboundList);
        hasLoadedOnce = true;
      } catch (error) {
        if (isAbortError(error)) return;
        if (!silent) toast(t('dashboard.failedLoad'), 'error');
      } finally {
        if (inFlightRequestRef.current === controller) {
          inFlightRequestRef.current = null;
        }

        isInFlight = false;

        if (!disposed) {
          setIsLoading(false);
          scheduleNextPoll();
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void load(hasLoadedOnce);
        return;
      }

      clearPollTimer();
      clearInFlightRequest();
    };

    void load();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      clearPollTimer();
      clearInFlightRequest();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [t, toast]);

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
      iconClass: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-500',
      glowClass: 'bg-emerald-500/20',
    },
    {
      key: 'activeClients',
      title: t('dashboard.activeClients'),
      value: String(activeClients.length),
      icon: Activity,
      trend: t('dashboard.trafficDetected'),
      iconClass: 'border-indigo-400/25 bg-indigo-500/10 text-indigo-500',
      glowClass: 'bg-indigo-500/20',
    },
    {
      key: 'inboundTraffic',
      title: t('dashboard.inboundTraffic'),
      value: formatTraffic(totalInboundTraffic),
      icon: Zap,
      trend: t('dashboard.uploadDownload'),
      iconClass: 'border-amber-400/25 bg-amber-500/10 text-amber-500',
      glowClass: 'bg-amber-500/20',
    },
    {
      key: 'serverLoad',
      title: t('dashboard.serverLoad'),
      value: serverStatus ? `${serverStatus.cpu.toFixed(1)}%` : '--',
      icon: Cpu,
      trend: serverStatus
        ? t('dashboard.cores', { count: serverStatus.cpuCores })
        : t('common.unavailable'),
      iconClass: 'border-rose-400/25 bg-rose-500/10 text-rose-500',
      glowClass: 'bg-rose-500/20',
    },
  ] as const;

  return (
    <div className="content-shell-wide w-full min-w-0 space-y-8 px-4 md:px-6 xl:px-8">
      <section className="surface-card relative overflow-hidden p-6 md:p-7">
        <div className="pointer-events-none absolute right-[-5rem] top-[-4rem] h-32 w-32 rounded-full bg-[radial-gradient(circle,_rgba(111,154,255,0.3)_0%,_rgba(111,154,255,0)_72%)] blur-2xl" />
        <p className="section-kicker">{t('dashboard.title')}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{t('dashboard.title')}</h1>
        <p className="max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
          {t('dashboard.subtitle')}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.key} className="relative overflow-hidden">
            <div
              className={`pointer-events-none absolute inset-x-8 top-0 h-20 rounded-full blur-3xl ${stat.glowClass}`}
            />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-1 text-sm font-medium text-[var(--text-secondary)]">
                <span>{stat.title}</span>
                <InfoTooltip content={t(`dashboard.help.${stat.key}`)} />
              </CardTitle>
              <div
                className={`glass-pill flex h-10 w-10 items-center justify-center border ${stat.iconClass}`}
              >
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ) : (
                <>
                  <div className="text-3xl font-semibold tracking-tight">{stat.value}</div>
                  <p className="mt-2 flex items-center gap-1 text-xs text-[var(--text-secondary)]">
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
              <div className="flex h-full items-center justify-center gap-2 text-sm text-[var(--text-secondary)]">
                <ShieldCheck className="w-4 h-4" />
                {t('dashboard.noInboundTrafficData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={inboundTrafficData}>
                  <defs>
                    <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-subtle)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="var(--text-tertiary)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--text-tertiary)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}MB`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface-card-strong)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '18px',
                      boxShadow: 'var(--shadow-card)',
                      backdropFilter: 'blur(20px) saturate(180%)',
                    }}
                    itemStyle={{ fontSize: '12px', color: 'var(--text-secondary)' }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                    formatter={(value, name) => [
                      `${value} MB`,
                      name === 'downloadMB' ? t('dashboard.download') : t('dashboard.upload'),
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="downloadMB"
                    stroke="var(--success)"
                    fillOpacity={1}
                    fill="url(#colorDownload)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="uploadMB"
                    stroke="var(--accent)"
                    fillOpacity={1}
                    fill="url(#colorUpload)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <ServerStatusCard
          className="lg:col-span-3"
          serverStatus={serverStatus}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
