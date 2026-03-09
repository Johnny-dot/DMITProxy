import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { refreshCurrentNodeQuality } from '@/src/api/client';
import { CommunityTab } from '@/src/pages/portal/CommunityTab';
import { HomeTab } from '@/src/pages/portal/HomeTab';
import { MarketTab } from '@/src/pages/portal/MarketTab';
import { SubscriptionTab } from '@/src/pages/portal/SubscriptionTab';
import { Button } from '@/src/components/ui/Button';
import { useToast } from '@/src/components/ui/Toast';
import { useI18n } from '@/src/context/I18nContext';
import type { NodeQualityProfile } from '@/src/types/nodeQuality';
import { buildSubscriptionUrl } from '@/src/utils/subscription';
import type {
  ClientStats,
  PortalContextResponse,
  PortalStatsResponse,
  PortalTab,
} from './portal/types';
import { getUserPortalSectionParam, resolveUserPortalSection } from './portal/types';

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

  const sectionState = useMemo(
    () => resolveUserPortalSection(searchParams.get('section')),
    [searchParams],
  );
  const activeTab = sectionState.tab;
  const setupFocus = sectionState.setupFocus;

  const setSection = useCallback(
    (tab: PortalTab) => {
      const nextSection = getUserPortalSectionParam(tab);
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set('section', nextSection);
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
      const response = await fetch('/local/auth/portal/context', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (!data)
          throw new Error(isZh ? '无法解析用户中心响应。' : 'Failed to parse portal response.');
        setContext(data as PortalContextResponse);
        return;
      }

      if (response.status === 401) {
        navigate('/login', { replace: true });
        return;
      }

      const data = await response.json().catch(() => null);
      throw new Error(data?.error ?? (isZh ? '无法加载用户中心。' : 'Failed to load the portal.'));
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : isZh ? '发生未知错误。' : 'Unknown error.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [isZh, navigate]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const loadStats = useCallback(async () => {
    setClientStats('loading');
    setNodeQuality(null);

    try {
      const response = await fetch('/local/auth/portal/stats', { credentials: 'include' });
      if (!response.ok) {
        setClientStats(null);
        return;
      }

      const data = (await response.json().catch(() => null)) as PortalStatsResponse | null;
      setClientStats(data?.stats ?? null);
      setNodeQuality(data?.nodeQuality ?? null);
    } catch {
      setClientStats(null);
      setNodeQuality(null);
    }
  }, []);

  useEffect(() => {
    if (context) {
      void loadStats();
    }
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
      toast(isZh ? '节点检测结果已刷新。' : 'Node quality refreshed.', 'success');
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : isZh
            ? '刷新节点检测结果失败。'
            : 'Failed to refresh node quality.',
        'error',
      );
    } finally {
      setIsRefreshingNodeQuality(false);
    }
  }, [isZh, toast]);

  const sectionMeta = useMemo(() => {
    if (activeTab === 'home') {
      return {
        kicker: isZh ? '账户概览' : 'Account overview',
        title: isZh ? '先确认你的账号状态。' : 'Check your account status first.',
        description: isZh
          ? '订阅是否可用、流量还剩多少、当前线路如何，都能先在这里看到。'
          : 'See whether your subscription is ready, how much traffic is left, and how your current route is performing.',
      };
    }

    if (activeTab === 'market') {
      return {
        kicker: isZh ? '市场' : 'Markets',
        title: isZh ? '看看今天的重要行情。' : 'Catch today’s key market moves.',
        description: isZh
          ? '重点标的、价格变化和相关新闻放在一起，方便快速浏览。'
          : 'Key assets, price changes, and related headlines are grouped together for a quick scan.',
      };
    }

    if (activeTab === 'setup') {
      return {
        kicker: isZh ? '使用订阅' : 'Set up',
        title: isZh ? '选好设备，跟着步骤接入。' : 'Pick your device and follow the setup.',
        description: isZh
          ? '页面会带你完成客户端下载、链接复制和导入连接。'
          : 'This page walks you through the client download, link copy, and import steps.',
      };
    }

    return {
      kicker: isZh ? '社区' : 'Community',
      title: isZh ? '找到你的群组和加入方式。' : 'Find your group links and join details.',
      description: isZh
        ? '常用社区链接、二维码和加入说明都会放在这里。'
        : 'Common community links, QR codes, and join notes are collected here.',
    };
  }, [activeTab, isZh]);

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
            {isZh ? '页面加载失败' : 'Failed to load this page'}
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
      {activeTab === 'market' ? null : (
        <section className="surface-card space-y-3 p-6 md:p-7">
          <p className="section-kicker">{sectionMeta.kicker}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            {sectionMeta.title}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-zinc-400">{sectionMeta.description}</p>
        </section>
      )}

      {activeTab === 'home' ? (
        <HomeTab
          isAdminView={false}
          context={context}
          effectiveSettings={context.settings}
          hasSubscription={hasSubscription}
          subscriptionUniversalUrl={subscriptionLinks.universal}
          clientStats={clientStats === 'loading' ? undefined : (clientStats ?? undefined)}
          nodeQuality={nodeQuality}
          isStatsLoading={clientStats === 'loading'}
          onRefreshNodeQuality={handleRefreshNodeQuality}
          isRefreshingNodeQuality={isRefreshingNodeQuality}
          onCopy={handleCopy}
          onSetSection={setSection}
          onNavigate={navigate}
          showMessagesCard={false}
        />
      ) : activeTab === 'market' ? (
        <MarketTab />
      ) : activeTab === 'community' ? (
        <CommunityTab communityLinks={context.settings.communityLinks} isZh={isZh} />
      ) : (
        <SubscriptionTab
          initialFocus={setupFocus}
          subId={context.user.subId ?? null}
          portalSettings={context.settings}
          onSetSection={setSection}
        />
      )}
    </div>
  );
}
