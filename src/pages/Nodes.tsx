import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Globe, Zap, Plus, ShieldCheck, Users, RefreshCw } from 'lucide-react';
import { getInbounds, Inbound } from '@/src/api/client';
import { cn } from '@/src/utils/cn';
import { useToast } from '@/src/components/ui/Toast';
import { formatTraffic } from '@/src/utils/xuiClients';
import { useI18n } from '@/src/context/I18nContext';

export function NodesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(true);
  const [inbounds, setInbounds] = useState<Inbound[]>([]);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await getInbounds();
      setInbounds(data);
    } catch {
      toast(t('nodes.failedLoad'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const nodeCards = useMemo(() => {
    return inbounds.map((inbound) => {
      const trafficUsed = inbound.up + inbound.down;
      const usagePercent =
        inbound.total > 0 ? Math.min((trafficUsed / inbound.total) * 100, 100) : 0;
      return {
        id: inbound.id,
        name: inbound.remark || `Inbound-${inbound.id}`,
        protocol: inbound.protocol.toUpperCase(),
        port: inbound.port,
        status: inbound.enable ? 'online' : 'offline',
        trafficUsed,
        trafficLimit: inbound.total,
        usagePercent,
        clientCount: inbound.clientStats?.length ?? 0,
      };
    });
  }, [inbounds]);

  return (
    <div className="space-y-6">
      <section className="surface-card flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between md:p-7">
        <div className="space-y-3">
          <p className="section-kicker">{t('nodes.title')}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t('nodes.title')}</h1>
          <p className="max-w-3xl text-sm leading-7 text-zinc-400">{t('nodes.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={load} disabled={isLoading}>
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
          <Button className="gap-2" onClick={() => navigate('/inbounds')}>
            <Plus className="w-4 h-4" />
            {t('nodes.manageInbounds')}
          </Button>
        </div>
      </section>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Card key={item}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {nodeCards.map((node) => (
            <Card key={node.id} className="group hover:border-white/20 transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      node.status === 'online' ? 'bg-emerald-500/10' : 'bg-red-500/10',
                    )}
                  >
                    <Globe
                      className={cn(
                        'w-5 h-5',
                        node.status === 'online' ? 'text-emerald-500' : 'text-red-500',
                      )}
                    />
                  </div>
                  <div>
                    <CardTitle className="text-base">{node.name}</CardTitle>
                    <p className="text-xs text-zinc-500">
                      {node.protocol}:{node.port}
                    </p>
                  </div>
                </div>
                <Badge variant={node.status === 'online' ? 'success' : 'destructive'}>
                  {node.status === 'online' ? t('nodes.online') : t('nodes.offline')}
                </Badge>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Users className="w-4 h-4" />
                      {t('nodes.clients')}
                    </div>
                    <span className="font-medium">{node.clientCount}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Zap className="w-4 h-4" />
                        {t('nodes.traffic')}
                      </div>
                      <span className="font-medium">{formatTraffic(node.trafficUsed)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          node.usagePercent < 50
                            ? 'bg-emerald-500'
                            : node.usagePercent < 80
                              ? 'bg-yellow-500'
                              : 'bg-red-500',
                        )}
                        style={{ width: `${node.usagePercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-zinc-500">
                      {node.trafficLimit > 0
                        ? t('nodes.limit', { value: formatTraffic(node.trafficLimit) })
                        : t('nodes.unlimitedTraffic')}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate('/inbounds')}
                  >
                    {t('nodes.edit')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      toast(
                        t('nodes.trafficToast', { value: formatTraffic(node.trafficUsed) }),
                        'info',
                      )
                    }
                  >
                    {t('nodes.stats')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {nodeCards.length === 0 && (
            <div className="md:col-span-2 lg:col-span-3">
              <Card>
                <CardContent className="p-0">
                  <EmptyState
                    icon={ShieldCheck}
                    title={t('nodes.noNodesFound')}
                    description=""
                    illustration="empty-nodes.webp"
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
