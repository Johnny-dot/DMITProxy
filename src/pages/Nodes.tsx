import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Input } from '@/src/components/ui/Input';
import { Globe, Zap, Plus, ShieldCheck, Users, RefreshCw, Save } from 'lucide-react';
import {
  getInbounds,
  getNodeQualityProfiles,
  saveNodeQualityProfile,
  Inbound,
} from '@/src/api/client';
import { cn } from '@/src/utils/cn';
import { useToast } from '@/src/components/ui/Toast';
import { formatTraffic } from '@/src/utils/xuiClients';
import { useI18n } from '@/src/context/I18nContext';
import type { NodeQualityProfile, UnlockStatus } from '@/src/types/nodeQuality';
import {
  getFraudRiskMeta,
  getUnlockStatusMeta,
  hasMeaningfulNodeQuality,
  UNLOCK_STATUS_VALUES,
} from '@/src/utils/nodeQuality';

interface NodeQualityDraft {
  summary: string;
  fraudScore: string;
  netflixStatus: UnlockStatus;
  chatgptStatus: UnlockStatus;
  claudeStatus: UnlockStatus;
  notes: string;
}

const EMPTY_DRAFT: NodeQualityDraft = {
  summary: '',
  fraudScore: '',
  netflixStatus: 'unknown',
  chatgptStatus: 'unknown',
  claudeStatus: 'unknown',
  notes: '',
};

function buildDraft(profile?: NodeQualityProfile | null): NodeQualityDraft {
  return {
    summary: profile?.summary ?? '',
    fraudScore:
      profile?.fraudScore === null || profile?.fraudScore === undefined
        ? ''
        : String(profile.fraudScore),
    netflixStatus: profile?.netflixStatus ?? 'unknown',
    chatgptStatus: profile?.chatgptStatus ?? 'unknown',
    claudeStatus: profile?.claudeStatus ?? 'unknown',
    notes: profile?.notes ?? '',
  };
}

function draftToPayload(draft: NodeQualityDraft): Partial<NodeQualityProfile> {
  return {
    summary: draft.summary,
    fraudScore: draft.fraudScore.trim() ? Number(draft.fraudScore) : null,
    netflixStatus: draft.netflixStatus,
    chatgptStatus: draft.chatgptStatus,
    claudeStatus: draft.claudeStatus,
    notes: draft.notes,
  };
}

export function NodesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language } = useI18n();
  const isZh = language === 'zh-CN';
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const [profiles, setProfiles] = useState<Record<number, NodeQualityProfile>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [draft, setDraft] = useState<NodeQualityDraft>(EMPTY_DRAFT);

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
      const profile = profiles[inbound.id] ?? null;
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
        profile,
      };
    });
  }, [inbounds, profiles]);

  const selectedNode = nodeCards.find((node) => node.id === selectedNodeId) ?? nodeCards[0] ?? null;

  useEffect(() => {
    if (!selectedNode) {
      setDraft(EMPTY_DRAFT);
      return;
    }
    setDraft(buildDraft(selectedNode.profile));
  }, [selectedNode?.id, selectedNode?.profile]);

  const handleDraftChange = <K extends keyof NodeQualityDraft>(
    key: K,
    value: NodeQualityDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSaveProfile = async (clear = false) => {
    if (!selectedNode) return;

    setIsSavingProfile(true);
    try {
      const payload = clear ? draftToPayload(EMPTY_DRAFT) : draftToPayload(draft);
      const result = await saveNodeQualityProfile(selectedNode.id, payload);
      setProfiles((current) => {
        const next = { ...current };
        if (result.removed) {
          delete next[selectedNode.id];
        } else {
          next[selectedNode.id] = result.profile;
        }
        return next;
      });
      setDraft(buildDraft(result.removed ? null : result.profile));
      toast(
        clear
          ? isZh
            ? '该节点的质量资料已清空'
            : 'Node quality profile cleared'
          : isZh
            ? '节点质量资料已保存'
            : 'Node quality profile saved',
        'success',
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : t('nodes.failedLoad'), 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

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
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {nodeCards.map((node) => {
              const fraudMeta = getFraudRiskMeta(node.profile?.fraudScore ?? null, isZh);
              const unlockItems = [
                { label: 'Netflix', status: node.profile?.netflixStatus ?? 'unknown' },
                { label: 'ChatGPT', status: node.profile?.chatgptStatus ?? 'unknown' },
                { label: 'Claude', status: node.profile?.claudeStatus ?? 'unknown' },
              ];

              return (
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

                    <div className="surface-panel space-y-3 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          {isZh ? '质量资料' : 'Quality profile'}
                        </p>
                        <span className={cn('text-xs font-medium', fraudMeta.className)}>
                          {fraudMeta.label}
                        </span>
                      </div>
                      <p className="text-sm leading-6 text-zinc-300">
                        {node.profile?.summary ||
                          (isZh
                            ? '管理员尚未填写该节点的欺诈值和解锁说明。'
                            : 'No fraud score or unlock summary has been added yet.')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {unlockItems.map((item) => {
                          const meta = getUnlockStatusMeta(item.status, isZh);
                          return (
                            <Badge key={item.label} className={cn('border', meta.className)}>
                              {item.label}: {meta.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant={selectedNodeId === node.id ? 'secondary' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelectedNodeId(node.id)}
                      >
                        {isZh ? '编辑质量' : 'Edit quality'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate('/inbounds')}
                      >
                        {t('nodes.edit')}
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
            <Card>
              <CardHeader>
                <div className="space-y-2">
                  <CardTitle>
                    {isZh ? '维护节点质量资料' : 'Maintain node quality profile'} ·{' '}
                    {selectedNode.name}
                  </CardTitle>
                  <CardDescription>
                    {isZh
                      ? '这部分是管理员手工维护的资料，不是自动探测结果。建议填写欺诈值、流媒体和 AI 服务解锁情况。'
                      : 'This profile is maintained manually by admins, not auto-probed. Use it for fraud score and unlock checks.'}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">{isZh ? '概览说明' : 'Summary'}</label>
                    <Input
                      value={draft.summary}
                      onChange={(event) => handleDraftChange('summary', event.target.value)}
                      placeholder={
                        isZh
                          ? '例如：美区住宅质量较稳，适合日常使用'
                          : 'Example: Stable US residential quality for daily use'
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">{isZh ? '欺诈值' : 'Fraud score'}</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={draft.fraudScore}
                      onChange={(event) => handleDraftChange('fraudScore', event.target.value)}
                      placeholder="0 - 100"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    ['netflixStatus', 'Netflix'],
                    ['chatgptStatus', 'ChatGPT'],
                    ['claudeStatus', 'Claude'],
                  ].map(([field, label]) => (
                    <div key={field} className="surface-panel space-y-3 p-4">
                      <p className="text-sm font-medium text-zinc-50">{label}</p>
                      <div className="flex flex-wrap gap-2">
                        {UNLOCK_STATUS_VALUES.map((status) => {
                          const meta = getUnlockStatusMeta(status, isZh);
                          const fieldName = field as keyof Pick<
                            NodeQualityDraft,
                            'netflixStatus' | 'chatgptStatus' | 'claudeStatus'
                          >;
                          return (
                            <Button
                              key={status}
                              variant={draft[fieldName] === status ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => handleDraftChange(fieldName, status)}
                            >
                              {meta.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">{isZh ? '补充说明' : 'Notes'}</label>
                  <textarea
                    className="min-h-[140px] w-full rounded-[22px] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 text-sm text-zinc-50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                    value={draft.notes}
                    onChange={(event) => handleDraftChange('notes', event.target.value)}
                    placeholder={
                      isZh
                        ? '例如：Netflix 美区稳定，ChatGPT 与 Claude 正常，偶尔会触发短信验证。'
                        : 'Example: Netflix US works well, ChatGPT and Claude are available, occasional SMS verification.'
                    }
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    className="gap-2"
                    onClick={() => void handleSaveProfile()}
                    disabled={isSavingProfile}
                  >
                    <Save className="w-4 h-4" />
                    {isSavingProfile
                      ? isZh
                        ? '保存中...'
                        : 'Saving...'
                      : isZh
                        ? '保存资料'
                        : 'Save profile'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleSaveProfile(true)}
                    disabled={isSavingProfile}
                  >
                    {isZh ? '清空资料' : 'Clear profile'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
