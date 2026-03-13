import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Globe, Plus, RefreshCw, ShieldCheck, Users, Zap } from 'lucide-react';
import { UnlockServiceIcon } from '@/src/components/icons/UnlockServiceIcon';
import {
  getInbounds,
  getNodeQualityProfiles,
  refreshNodeQualityProfile,
  Inbound,
} from '@/src/api/client';
import { cn } from '@/src/utils/cn';
import { useToast } from '@/src/components/ui/Toast';
import { formatTraffic } from '@/src/utils/xuiClients';
import { useI18n } from '@/src/context/I18nContext';
import type { NodeQualityProfile } from '@/src/types/nodeQuality';
import {
  getFraudRiskMeta,
  getNodeQualityServiceItems,
  getUnlockStatusMeta,
} from '@/src/utils/nodeQuality';
import { NodeQualityCard } from './portal/NodeQualityCard';

export function NodesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language } = useI18n();
  const isZh = language === 'zh-CN';
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingNodeId, setIsRefreshingNodeId] = useState<number | null>(null);
  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const [profiles, setProfiles] = useState<Record<number, NodeQualityProfile>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const [inboundData, profileData] = await Promise.all([
        getInbounds(),
        getNodeQualityProfiles(),
      ]);
      setInbounds(inboundData);
      setProfiles(
        Object.fromEntries(profileData.map((profile) => [profile.inboundId, profile])) as Record<
          number,
          NodeQualityProfile
        >,
      );
      setSelectedNodeId((current) => current ?? inboundData[0]?.id ?? null);
    } catch {
      toast(t('nodes.failedLoad'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
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
        profile: profiles[inbound.id] ?? null,
      };
    });
  }, [inbounds, profiles]);

  const selectedNode = nodeCards.find((node) => node.id === selectedNodeId) ?? nodeCards[0] ?? null;

  const handleRefresh = async (inboundId: number) => {
    setIsRefreshingNodeId(inboundId);
    try {
      const profile = await refreshNodeQualityProfile(inboundId);
      setProfiles((current) => ({ ...current, [inboundId]: profile }));
      toast(isZh ? '节点检测已刷新' : 'Node quality refreshed', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : t('nodes.failedLoad'), 'error');
    } finally {
      setIsRefreshingNodeId(null);
    }
  };

  const formatCheckedAt = (value: number | null | undefined) =>
    value
      ? new Date(value).toLocaleString(isZh ? 'zh-CN' : 'en-US', { hour12: false })
      : isZh
        ? '尚未检测'
        : 'Not checked yet';

  return (
    <div className="content-shell-wide w-full min-w-0 space-y-6 px-4 md:px-6 xl:px-8">
      <section className="surface-card flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between md:p-7">
        <div className="space-y-3">
          <p className="section-kicker">{t('nodes.title')}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t('nodes.title')}</h1>
          <p className="max-w-3xl text-sm leading-7 text-zinc-400">
            {isZh
              ? '节点质量现在通过自动探测生成。这里展示最近一次缓存结果，并支持按节点手动刷新。'
              : 'Node quality now comes from automated probes. This page shows the latest cached result and lets you refresh each node manually.'}
          </p>
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
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {nodeCards.map((node) => {
              const fraudMeta = getFraudRiskMeta(node.profile?.fraudScore ?? null, isZh);
              const unlockItems = getNodeQualityServiceItems(node.profile);

              return (
                <Card key={node.id} className="group transition-all hover:border-white/20">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg',
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
                  <CardContent className="space-y-5 pt-4">
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
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
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

                    <div className="surface-panel space-y-3 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          {isZh ? '自动探测结果' : 'Auto probe'}
                        </p>
                        <span className={cn('text-xs font-medium', fraudMeta.className)}>
                          {fraudMeta.label}
                        </span>
                      </div>
                      <p className="text-sm leading-6 text-zinc-300">
                        {node.profile?.summary ||
                          (isZh
                            ? '暂无探测结果。点击刷新后会写入最新状态。'
                            : 'No probe result yet. Refresh to write the latest status.')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {unlockItems.map((item) => {
                          const meta = getUnlockStatusMeta(item.status, isZh);
                          return (
                            <Badge key={item.id} className={cn('border', meta.className)}>
                              <span className="inline-flex items-center gap-1.5">
                                <UnlockServiceIcon
                                  service={item.id}
                                  className="h-5 w-5 rounded-lg border-0"
                                />
                                <span>
                                  {item.label}: {meta.label}
                                </span>
                              </span>
                            </Badge>
                          );
                        })}
                      </div>
                      <p className="text-xs text-zinc-500">
                        {isZh ? '最近检测：' : 'Last checked: '}
                        {formatCheckedAt(node.profile?.updatedAt)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant={selectedNodeId === node.id ? 'secondary' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelectedNodeId(node.id)}
                      >
                        {isZh ? '查看详情' : 'View details'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => void handleRefresh(node.id)}
                        disabled={isRefreshingNodeId === node.id}
                      >
                        <RefreshCw
                          className={cn(
                            'h-4 w-4',
                            isRefreshingNodeId === node.id && 'animate-spin',
                          )}
                        />
                        {isZh ? '重新探测' : 'Refresh'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

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

          {selectedNode && (
            <NodeQualityCard
              isZh={isZh}
              inboundRemark={selectedNode.name}
              profile={selectedNode.profile}
              onRefresh={() => void handleRefresh(selectedNode.id)}
              isRefreshing={isRefreshingNodeId === selectedNode.id}
            />
          )}
        </>
      )}
    </div>
  );
}
