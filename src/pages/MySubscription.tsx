import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/src/components/ui/Button';
import { useToast } from '@/src/components/ui/Toast';
import { refreshCurrentNodeQuality } from '@/src/api/client';
import { useI18n } from '@/src/context/I18nContext';
import { buildSubscriptionUrl } from '@/src/utils/subscription';
import type { NodeQualityProfile } from '@/src/types/nodeQuality';
import { HomeTab } from './portal/HomeTab';
import { SubscriptionTab } from './portal/SubscriptionTab';
import type {
  ClientStats,
  PortalContextResponse,
  PortalStatsResponse,
  PortalTab,
} from './portal/types';

type UserTab = 'home' | 'subscription';

function toUserTab(value: string | null): UserTab {
  return value === 'subscription' ? 'subscription' : 'home';
}

export function MySubscriptionPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useI18n();
  const { toast } = useToast();
  const isZh = language === 'zh-CN';

  const [context, setContext] = useState<PortalContextResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [clientStats, setClientStats] = useState<ClientStats | null | 'loading'>('loading');
  const [nodeQuality, setNodeQuality] = useState<NodeQualityProfile | null>(null);
  const [isRefreshingNodeQuality, setIsRefreshingNodeQuality] = useState(false);

  const activeTab = useMemo<UserTab>(() => toUserTab(searchParams.get('section')), [searchParams]);

  const setSection = useCallback(
    (tab: PortalTab) => {
      const nextTab = tab === 'subscription' ? 'subscription' : 'home';
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('section', nextTab);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const subscriptionLinks = useMemo(
    () => ({
      universal: context?.user.subId ? buildSubscriptionUrl(context.user.subId, 'universal') : '',
    }),
    [context?.user.subId],
  );
  const hasSubscription = Boolean(subscriptionLinks.universal);

  const loadContext = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/local/auth/portal/context', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (!data) throw new Error('Failed to parse response');
        setContext(data as PortalContextResponse);
        return;
      }
      if (res.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? 'Failed to load portal context');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const loadStats = useCallback(async () => {
    setClientStats('loading');
    setNodeQuality(null);
    try {
      const res = await fetch('/local/auth/portal/stats', { credentials: 'include' });
      if (!res.ok) {
        setClientStats(null);
        return;
      }
      const data = (await res.json().catch(() => null)) as PortalStatsResponse | null;
      setClientStats(data?.stats ?? null);
      setNodeQuality(data?.nodeQuality ?? null);
    } catch {
      setClientStats(null);
      setNodeQuality(null);
    }
  }, []);

  useEffect(() => {
    if (context) void loadStats();
  }, [context, loadStats]);

  const handleCopy = useCallback((text: string) => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
  }, []);

  const handleRefreshNodeQuality = useCallback(async () => {
    setIsRefreshingNodeQuality(true);
    try {
      const data = await refreshCurrentNodeQuality();
      setClientStats(data.stats ?? null);
      setNodeQuality(data.nodeQuality ?? null);
      toast(isZh ? '节点质量已刷新' : 'Node quality refreshed', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to refresh node quality', 'error');
    } finally {
      setIsRefreshingNodeQuality(false);
    }
  }, [isZh, toast]);

  const sectionMeta = useMemo(
    () =>
      activeTab === 'home'
        ? {
            kicker: isZh ? '账户概览' : 'Account overview',
            title: isZh
              ? '先看状态，再决定下一步。'
              : 'Check status first, then take the next step.',
            description: isZh
              ? '这里保留账户摘要、订阅状态和使用情况。通知改由顶部铃铛统一承接，不再占用侧边常驻位置。'
              : 'Keep account summary, subscription status, and usage here. Notifications now live behind the top bell instead of a permanent side dock.',
          }
        : {
            kicker: isZh ? '订阅与客户端' : 'Subscription & clients',
            title: isZh
              ? '复制订阅、下载客户端、导入连接放在同一条路径里。'
              : 'Copy the link, download a client, and connect in one flow.',
            description: isZh
              ? '把订阅链接、客户端下载和导入步骤集中在这里，减少来回切换。'
              : 'Subscription links, client downloads, and setup steps now stay in one continuous view.',
          },
    [activeTab, isZh],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
      </div>
    );
  }

  if (!context) {
    return (
      <div className="flex items-center justify-center px-4 py-8 lg:px-8">
        <div className="surface-card w-full max-w-md space-y-4 p-6">
          <h2 className="text-lg font-semibold text-zinc-50">
            {isZh ? '无法加载用户中心' : 'Failed to load workspace'}
          </h2>
          <p className="text-sm leading-6 text-zinc-400">{loadError}</p>
          <Button onClick={() => void loadContext()}>{isZh ? '重试' : 'Retry'}</Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-2 sm:px-6 lg:px-8"
      data-testid="my-subscription-page"
    >
      <section className="surface-card space-y-3 p-6 md:p-7">
        <p className="section-kicker">{sectionMeta.kicker}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{sectionMeta.title}</h1>
        <p className="max-w-3xl text-sm leading-7 text-zinc-400">{sectionMeta.description}</p>
      </section>

      {activeTab === 'home' ? (
        <HomeTab
          isAdminView={false}
          context={context}
          effectiveSettings={context.settings}
          hasSubscription={hasSubscription}
          subscriptionUniversalUrl={subscriptionLinks.universal}
          clientStats={clientStats === 'loading' ? undefined : (clientStats ?? undefined)}
          isStatsLoading={clientStats === 'loading'}
          onCopy={handleCopy}
          onSetSection={setSection}
          onNavigate={navigate}
          showMessagesCard={false}
        />
      ) : (
        <SubscriptionTab
          subId={context.user.subId ?? null}
          portalSettings={context.settings}
          clientStats={clientStats === 'loading' ? undefined : (clientStats ?? undefined)}
          nodeQuality={nodeQuality}
          onRefreshNodeQuality={handleRefreshNodeQuality}
          isRefreshingNodeQuality={isRefreshingNodeQuality}
        />
      )}
    </div>
  );
}
