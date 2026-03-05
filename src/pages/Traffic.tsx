import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Skeleton } from '@/src/components/ui/Skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getInbounds, Inbound } from '@/src/api/client';
import { flattenInboundClients, formatTraffic } from '@/src/utils/xuiClients';
import { useToast } from '@/src/components/ui/Toast';
import { useI18n } from '@/src/context/I18nContext';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#14b8a6', '#f97316', '#3b82f6'];

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
    const rows = inbounds.map((inbound) => ({
      name: inbound.remark || `Inbound-${inbound.id}`,
      usedBytes: inbound.up + inbound.down,
      uploadGB: Number((inbound.up / (1024 * 1024 * 1024)).toFixed(2)),
      downloadGB: Number((inbound.down / (1024 * 1024 * 1024)).toFixed(2)),
    }));
    return rows.sort((a, b) => b.usedBytes - a.usedBytes);
  }, [inbounds]);

  const protocolUsage = useMemo(() => {
    const map = new Map<string, number>();
    for (const inbound of inbounds) {
      const key = inbound.protocol.toUpperCase();
      map.set(key, (map.get(key) ?? 0) + inbound.up + inbound.down);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('traffic.title')}</h1>
        <p className="text-zinc-400 mt-1">{t('traffic.subtitle')}</p>
        <p className="text-zinc-500 text-xs mt-2">{t('traffic.note')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <Card key={card.key}>
            <CardContent className="py-4">
              {isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="space-y-1">
                  <p className="inline-flex items-center gap-1 text-zinc-500 text-xs">
                    <span>{card.label}</span>
                    <InfoTooltip content={card.hint} />
                  </p>
                  <p className="text-lg font-semibold">{card.value}</p>
                </div>
              )}
            </CardContent>
          </Card>
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
          <CardContent className="h-[350px]">
            {isLoading ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userRanking} layout="vertical" margin={{ left: 50, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="#71717a"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#71717a"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={120}
                  />
                  <Tooltip
                    cursor={{ fill: '#27272a' }}
                    contentStyle={{
                      backgroundColor: '#09090b',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                    }}
                    formatter={(value) => [`${value} GB`, t('traffic.traffic')]}
                  />
                  <Bar dataKey="traffic" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
          <CardContent className="h-[350px] flex items-center justify-center relative">
            {isLoading ? (
              <Skeleton className="w-full h-full rounded-full" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={protocolUsage}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                    >
                      {protocolUsage.map((entry, index) => (
                        <Cell key={`protocol-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(_value, _name, item) => {
                        const payload = item?.payload as { display?: string; name?: string };
                        return [payload.display ?? '0 B', payload.name ?? t('traffic.protocol')];
                      }}
                      contentStyle={{
                        backgroundColor: '#09090b',
                        border: '1px solid #27272a',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">{formatTraffic(totalTraffic)}</span>
                  <span className="text-xs text-zinc-500">{t('traffic.totalTraffic')}</span>
                </div>
              </>
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
        <CardContent className="h-[320px]">
          {isLoading ? (
            <Skeleton className="w-full h-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inboundUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#71717a"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: '#27272a' }}
                  formatter={(value, name) => [
                    `${value} GB`,
                    name === 'downloadGB' ? t('traffic.download') : t('traffic.upload'),
                  ]}
                  contentStyle={{
                    backgroundColor: '#09090b',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="downloadGB" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="uploadGB" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
