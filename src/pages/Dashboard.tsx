import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { getInbounds, getServerStatus, Inbound, ServerStatus } from '@/src/api/client';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { QuietStat, shareWidth, UsageMeter } from '@/src/components/ui/UsageMeter';
import {
  flattenInboundClients,
  formatTraffic,
  getClientStatus,
  inboundClientTraffic,
} from '@/src/utils/xuiClients';
import { useMachineUsage } from '@/src/hooks/useMachineUsage';
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
  const { usage } = useMachineUsage();
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
      .map((inbound) => {
        const ct = inboundClientTraffic(inbound);
        return {
          name: inbound.remark || `Inbound-${inbound.id}`,
          downloadMB: Number((ct.down / (1024 * 1024)).toFixed(1)),
          uploadMB: Number((ct.up / (1024 * 1024)).toFixed(1)),
        };
      })
      .sort((a, b) => b.downloadMB + b.uploadMB - (a.downloadMB + a.uploadMB))
      .slice(0, 8);
  }, [inbounds]);

  const totalInboundTraffic = useMemo(() => {
    return usage
      ? usage.usedBytes
      : inbounds.reduce((sum, inbound) => sum + inboundClientTraffic(inbound).total, 0);
  }, [inbounds, usage]);

  const maxInboundSample = useMemo(
    () => inboundTrafficData.reduce((max, row) => Math.max(max, row.downloadMB, row.uploadMB), 0),
    [inboundTrafficData],
  );

  const stats = [
    {
      key: 'totalClients',
      title: t('dashboard.totalClients'),
      value: String(clients.length),
      trend: t('dashboard.inboundsTrend', { count: inbounds.length }),
    },
    {
      key: 'activeClients',
      title: t('dashboard.activeClients'),
      value: String(activeClients.length),
      trend: t('dashboard.trafficDetected'),
    },
    {
      key: 'inboundTraffic',
      title: t('dashboard.inboundTraffic'),
      value: formatTraffic(totalInboundTraffic),
      trend: t('dashboard.uploadDownload'),
    },
    {
      key: 'serverLoad',
      title: t('dashboard.serverLoad'),
      value: serverStatus ? `${serverStatus.cpu.toFixed(1)}%` : '--',
      trend: serverStatus
        ? t('dashboard.cores', { count: serverStatus.cpuCores })
        : t('common.unavailable'),
    },
  ] as const;

  return (
    <div className="content-shell-wide reveal-stagger w-full min-w-0 space-y-8 px-4 md:px-6 xl:px-8">
      <section className="surface-card p-6 md:p-7">
        <p className="section-kicker">{t('dashboard.title')}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{t('dashboard.title')}</h1>
        <p className="max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
          {t('dashboard.subtitle')}
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.key}>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ) : (
              <QuietStat
                value={stat.value}
                label={stat.title}
                hint={<InfoTooltip content={t(`dashboard.help.${stat.key}`)} />}
                extra={stat.trend}
              />
            )}
          </div>
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
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : inboundTrafficData.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {t('dashboard.noInboundTrafficData')}
              </p>
            ) : (
              <div className="usage-rank-list">
                {inboundTrafficData.map((row) => (
                  <div key={row.name}>
                    <p className="usage-rank-label">{row.name}</p>
                    <div className="usage-rank-pair">
                      <UsageMeter
                        widthPercent={shareWidth(row.downloadMB, maxInboundSample)}
                        value={`${t('dashboard.download')} ${row.downloadMB} MB`}
                      />
                      <UsageMeter
                        widthPercent={shareWidth(row.uploadMB, maxInboundSample)}
                        value={`${t('dashboard.upload')} ${row.uploadMB} MB`}
                      />
                    </div>
                  </div>
                ))}
              </div>
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
