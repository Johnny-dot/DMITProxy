import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/src/components/ui/Button';
import { useToast } from '@/src/components/ui/Toast';
import { refreshCurrentNodeQuality } from '@/src/api/client';
import { useI18n } from '@/src/context/I18nContext';
import { buildSubscriptionUrl } from '@/src/utils/subscription';
import type { NodeQualityProfile } from '@/src/types/nodeQuality';
import { CommunityTab } from './portal/CommunityTab';
import { HomeTab } from './portal/HomeTab';
import { MarketTab } from './portal/MarketTab';
import { SubscriptionTab } from './portal/SubscriptionTab';
import type {
  ClientStats,
  PortalContextResponse,
  PortalStatsResponse,
  PortalTab,
} from './portal/types';

type UserTab = 'home' | 'market' | 'subscription' | 'clients' | 'community' | 'help';

function toUserTab(value: string | null): UserTab {
  if (
    value === 'market' ||
    value === 'subscription' ||
    value === 'clients' ||
    value === 'community' ||
    value === 'help'
  ) {
    return value;
  }

  return 'home';
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
      const nextTab =
        tab === 'market' ||
        tab === 'subscription' ||
        tab === 'clients' ||
        tab === 'community' ||
        tab === 'help'
          ? tab
          : 'home';

      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
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
      const response = await fetch('/local/auth/portal/context', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (!data) throw new Error('Failed to parse response');
        setContext(data as PortalContextResponse);
        return;
      }

      if (response.status === 401) {
        navigate('/login', { replace: true });
        return;
      }

      const data = await response.json().catch(() => null);
      throw new Error(data?.error ?? 'Failed to load portal context');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unknown error');
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

  const sectionMeta = useMemo(() => {
    if (activeTab === 'home') {
      return {
        kicker: isZh ? '账户概览' : 'Account overview',
        title: isZh ? '先看一眼今天的状态。' : 'Start with a quick status check.',
        description: isZh
          ? '这里放账户、流量、到期时间和当前线路情况，通知仍然在顶部铃铛里。'
          : 'Keep account info, traffic, expiry, and current node status here. Notifications still live behind the top bell.',
      };
    }

    if (activeTab === 'market') {
      return {
        kicker: isZh ? '资讯' : 'Markets',
        title: isZh ? '看看今天外面的市场快照。' : 'Take a quick look at the market snapshot.',
        description: isZh
          ? '这里只做轻量参考：先看卡片，点开单个项目再看迷你走势图。'
          : 'This stays lightweight: start with cards, then open any item for a mini chart.',
      };
    }

    if (activeTab === 'subscription') {
      return {
        kicker: isZh ? '订阅' : 'Subscription',
        title: isZh ? '先把链接拿到手。' : 'Start by getting the right link.',
        description: isZh
          ? '这个分区只用来复制订阅链接、切换格式和查看二维码，不再混入下载和排查。'
          : 'This section is only for link formats, copying, and QR codes. Downloads and troubleshooting stay elsewhere.',
      };
    }

    if (activeTab === 'clients') {
      return {
        kicker: isZh ? '客户端' : 'Clients',
        title: isZh ? '再选一个顺手的客户端。' : 'Then pick a client that fits you.',
        description: isZh
          ? '按设备筛选，下载后跟着教程导入就行。'
          : 'Filter by device, download the app, and follow the guide.',
      };
    }

    if (activeTab === 'community') {
      return {
        kicker: isZh ? '社区' : 'Community',
        title: isZh ? '群入口和加入说明都在这里。' : 'Group links and join notes live here.',
        description: isZh
          ? '如果有 Telegram、WhatsApp、Discord 或微信群说明，会集中放在这里。'
          : 'Telegram, WhatsApp, Discord, or other shared group notes appear here when available.',
      };
    }

    return {
      kicker: isZh ? '帮助' : 'Help',
      title: isZh ? '遇到问题时来这里看看。' : 'Start here if something feels off.',
      description: isZh
        ? '共享账号、家庭组邀请、Apple ID 下载协助和常见排错都放在这里。'
        : 'Shared accounts, family invites, Apple ID download help, and common troubleshooting all stay here.',
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
          section={activeTab}
          subId={context.user.subId ?? null}
          portalSettings={context.settings}
          clientStats={clientStats === 'loading' ? undefined : (clientStats ?? undefined)}
          onSetSection={setSection}
        />
      )}
    </div>
  );
}
