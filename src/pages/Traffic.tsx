import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { QuietStat, shareWidth, UsageMeter } from '@/src/components/ui/UsageMeter';
import { getInbounds, Inbound } from '@/src/api/client';
import { flattenInboundClients, formatTraffic, inboundClientTraffic } from '@/src/utils/xuiClients';
import { useToast } from '@/src/components/ui/Toast';
import { useI18n } from '@/src/context/I18nContext';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';

export function TrafficPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    getInbounds()
      .then(setInbounds)
      .catch(() => toast(t('traffic.failedLoad'), 'error'))
      .finally(() => setIsLoading(false));
  }, []);

  const clients = useMemo(() => flattenInboundClients(inbounds), [inbounds]);

  const userRanking = useMemo(() => {
    return clients
      .map((client) => ({
        name: client.username,
        traffic: Number(((client.up + client.down) / (1024 * 1024 * 1024)).toFixed(2)),
      }))
      .sort((a, b) => b.traffic - a.traffic)
      .slice(0, 10);
  }, [clients]);

  const inboundUsage = useMemo(() => {
    const rows = inbounds.map((inbound) => {
      const ct = inboundClientTraffic(inbound);
      return {
        name: inbound.remark || `Inbound-${inbound.id}`,
        usedBytes: ct.total,
        uploadGB: Number((ct.up / (1024 * 1024 * 1024)).toFixed(2)),
        downloadGB: Number((ct.down / (1024 * 1024 * 1024)).toFixed(2)),
      };
    });
    return rows.sort((a, b) => b.usedBytes - a.usedBytes);
  }, [inbounds]);

  const protocolUsage = useMemo(() => {
    const map = new Map<string, number>();
    for (const inbound of inbounds) {
      const key = inbound.protocol.toUpperCase();
      map.set(key, (map.get(key) ?? 0) + inboundClientTraffic(inbound).total);
    }
    return Array.from(map.entries()).map(([name, bytes]) => ({
      name,
      value: bytes,
      display: formatTraffic(bytes),
    }));
  }, [inbounds]);

  const totalTraffic = useMemo(() => {
    return inboundUsage.reduce((sum, item) => sum + item.usedBytes, 0);
  }, [inboundUsage]);

  const activeInbounds = useMemo(
    () => inbounds.filter((inbound) => inbound.enable).length,
    [inbounds],
  );
  const averageTrafficPerClient = useMemo(
    () => (clients.length > 0 ? totalTraffic / clients.length : 0),
    [clients.length, totalTraffic],
  );

  const clientRankRows = useMemo(() => {
    const max = userRanking.reduce((peak, row) => Math.max(peak, row.traffic), 0);
    return userRanking.map((row) => ({
      key: row.name,
      label: row.name,
      width: shareWidth(row.traffic, max),
      value: `${row.traffic} GB`,
    }));
  }, [userRanking]);

  const protocolRankRows = useMemo(() => {
    const max = protocolUsage.reduce((peak, row) => Math.max(peak, row.value), 0);
    return [...protocolUsage]
      .sort((a, b) => b.value - a.value)
      .map((row) => ({
        key: row.name,
        label: row.name,
        width: shareWidth(row.value, max),
        value: row.display,
      }));
  }, [protocolUsage]);

  const inboundScale = useMemo(
    () => inboundUsage.reduce((peak, row) => Math.max(peak, row.downloadGB, row.uploadGB), 0),
    [inboundUsage],
  );

  const summaryCards = [
    {
      key: 'totalTraffic',
      label: t('traffic.totalTraffic'),
      value: formatTraffic(totalTraffic),
      hint: t('traffic.help.totalTraffic'),
    },
    {
      key: 'totalClients',
      label: t('traffic.totalClients'),
      value: String(clients.length),
      hint: t('traffic.help.totalClients'),
    },
    {
      key: 'totalInbounds',
      label: t('traffic.totalInbounds'),
      value: String(inbounds.length),
      hint: t('traffic.help.totalInbounds'),
    },
    {
      key: 'activeInbounds',
      label: t('traffic.activeInbounds'),
      value: String(activeInbounds),
      hint: t('traffic.help.activeInbounds'),
    },
    {
      key: 'avgTrafficPerClient',
      label: t('traffic.avgTrafficPerClient'),
      value: formatTraffic(averageTrafficPerClient),
      hint: t('traffic.help.avgTrafficPerClient'),
    },
  ];

  return (
    <div className="content-shell-wide reveal-stagger w-full min-w-0 space-y-6 px-4 md:px-6 xl:px-8">
      <section className="surface-card space-y-3 p-6 md:p-7">
        <p className="section-kicker">{t('traffic.title')}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{t('traffic.title')}</h1>
        <p className="max-w-3xl text-sm leading-7 text-zinc-400">{t('traffic.subtitle')}</p>
        <p className="text-xs text-zinc-500">{t('traffic.note')}</p>
      </section>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <div key={card.key}>
            {isLoading ? (
              <Skeleton className="h-14 w-full" />
            ) : (
              <QuietStat
                value={card.value}
                label={card.label}
                hint={<InfoTooltip content={card.hint} />}
              />
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              <span>{t('traffic.topClients')}</span>
              <InfoTooltip content={t('traffic.help.topClients')} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <RankedMeters rows={clientRankRows} />
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              <span>{t('traffic.protocolDist')}</span>
              <InfoTooltip content={t('traffic.help.protocolDist')} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <RankedMeters rows={protocolRankRows} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            <span>{t('traffic.inboundUploadDownload')}</span>
            <InfoTooltip content={t('traffic.help.inboundUploadDownload')} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="usage-rank-list">
              {inboundUsage.map((row) => (
                <div key={row.name}>
                  <p className="usage-rank-label">{row.name}</p>
                  <div className="usage-rank-pair">
                    <UsageMeter
                      widthPercent={shareWidth(row.downloadGB, inboundScale)}
                      value={`${t('traffic.download')} ${row.downloadGB} GB`}
                    />
                    <UsageMeter
                      widthPercent={shareWidth(row.uploadGB, inboundScale)}
                      value={`${t('traffic.upload')} ${row.uploadGB} GB`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RankedMeters({
  rows,
}: {
  rows: Array<{ key: string; label: string; width: number; value: string }>;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="usage-rank-list">
      {rows.map((row) => (
        <div key={row.key}>
          <p className="usage-rank-label">{row.label}</p>
          <UsageMeter widthPercent={row.width} value={row.value} />
        </div>
      ))}
    </div>
  );
}
