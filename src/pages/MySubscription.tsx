import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bell, LayoutDashboard, ListChecks } from 'lucide-react';
import { cn } from '@/src/utils/cn';
import { useI18n } from '@/src/context/I18nContext';
import { Button } from '@/src/components/ui/Button';
import { buildSubscriptionUrl } from '@/src/utils/subscription';
import { HomeTab } from './portal/HomeTab';
import { SubscriptionTab } from './portal/SubscriptionTab';
import { NotificationsTab } from './portal/NotificationsTab';
import type { ClientStats, PortalContextResponse, PortalTab } from './portal/types';
import { COPY_RESET_DELAY_MS, toMillis } from './portal/types';

const READ_NOTIFICATIONS_STORAGE_PREFIX = 'prism:user:notification-read:v1';

type UserTab = 'home' | 'subscription' | 'notifications';

function toUserTab(value: string | null): UserTab {
  if (value === 'subscription' || value === 'notifications') return value;
  return 'home';
}

export function MySubscriptionPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useI18n();
  const isZh = language === 'zh-CN';

  const [context, setContext] = useState<PortalContextResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState<UserTab>(() => toUserTab(searchParams.get('section')));
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [clientStats, setClientStats] = useState<ClientStats | null | 'loading'>('loading');
  const [, setCopiedKey] = useState<string | null>(null);

  const setSection = useCallback(
    (tab: PortalTab) => {
      const userTab = toUserTab(tab);
      setActiveTab(userTab);
      const next = new URLSearchParams(searchParams);
      next.set('section', userTab);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const subscriptionLinks = useMemo(
    () => ({
      universal: context?.user.subId ? buildSubscriptionUrl(context.user.subId, 'universal') : '',
    }),
    [context?.user.subId],
  );
  const hasSubscription = Boolean(subscriptionLinks.universal);

  const notifications = useMemo(
    () =>
      [...(context?.notifications ?? [])].sort(
        (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt),
      ),
    [context?.notifications],
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readNotificationIds.includes(n.id)).length,
    [notifications, readNotificationIds],
  );

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
    try {
      const res = await fetch('/local/auth/portal/stats', { credentials: 'include' });
      if (!res.ok) {
        setClientStats(null);
        return;
      }
      const data = await res.json().catch(() => null);
      setClientStats(data?.stats ?? null);
    } catch {
      setClientStats(null);
    }
  }, []);

  useEffect(() => {
    if (context) void loadStats();
  }, [context, loadStats]);

  useEffect(() => {
    const tab = toUserTab(searchParams.get('section'));
    if (tab !== activeTab) setActiveTab(tab);
  }, [activeTab, searchParams]);

  const notificationStorageKey = useMemo(
    () => (context ? `${READ_NOTIFICATIONS_STORAGE_PREFIX}:${context.user.username}` : ''),
    [context],
  );

  useEffect(() => {
    if (!notificationStorageKey) return;
    try {
      const raw = window.localStorage.getItem(notificationStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setReadNotificationIds(
        Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [],
      );
    } catch {
      setReadNotificationIds([]);
    }
  }, [notificationStorageKey]);

  useEffect(() => {
    if (!notificationStorageKey) return;
    window.localStorage.setItem(notificationStorageKey, JSON.stringify(readNotificationIds));
  }, [notificationStorageKey, readNotificationIds]);

  const markNotificationRead = (id: string) => {
    setReadNotificationIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const markAllNotificationsRead = () => {
    setReadNotificationIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      return Array.from(next);
    });
  };

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), COPY_RESET_DELAY_MS);
    });
  };

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
      className="mx-auto w-full max-w-6xl space-y-8 px-4 py-2 sm:px-6 lg:px-8"
      data-testid="my-subscription-page"
    >
      <section className="surface-card space-y-4 p-6 md:p-7">
        <p className="section-kicker">{isZh ? '订阅工作区' : 'Subscription workspace'}</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
              {isZh
                ? '把订阅、客户端与通知放在同一个安静视图里。'
                : 'Keep subscription, clients, and notices in one calm view.'}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-zinc-400">
              {isZh
                ? '这里保留你最常用的操作：查看状态、复制订阅、下载客户端，以及阅读管理员更新。'
                : 'The essential actions stay here: check status, copy the subscription, download a client, and read admin updates.'}
            </p>
          </div>
          <div className="surface-panel px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              {isZh ? '当前用户' : 'Current user'}
            </p>
            <p className="mt-2 text-sm font-medium text-zinc-50">{context.user.username}</p>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <TabButton
          icon={<LayoutDashboard className="h-4 w-4" />}
          label={isZh ? '概览' : 'Overview'}
          active={activeTab === 'home'}
          onClick={() => setSection('home')}
          testId="my-subscription-tab-home"
        />
        <TabButton
          icon={<ListChecks className="h-4 w-4" />}
          label={isZh ? '订阅与客户端' : 'Subscription & Clients'}
          active={activeTab === 'subscription'}
          onClick={() => setSection('subscription')}
          testId="my-subscription-tab-subscription"
        />
        <TabButton
          icon={<Bell className="h-4 w-4" />}
          label={isZh ? '通知' : 'Notifications'}
          active={activeTab === 'notifications'}
          onClick={() => setSection('notifications')}
          badge={unreadCount > 0 ? unreadCount : undefined}
          testId="my-subscription-tab-notifications"
        />
      </section>

      {activeTab === 'home' && (
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
        />
      )}

      {activeTab === 'subscription' && <SubscriptionTab subId={context.user.subId ?? null} />}

      {activeTab === 'notifications' && (
        <NotificationsTab
          notifications={notifications}
          readNotificationIds={readNotificationIds}
          supportTelegram={context.settings.supportTelegram}
          onMarkRead={markNotificationRead}
          onMarkAllRead={markAllNotificationsRead}
          onRefresh={() => void loadContext()}
        />
      )}
    </div>
  );
}

function TabButton({
  icon,
  label,
  active,
  onClick,
  badge,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'border-transparent bg-[var(--accent)] text-[var(--accent-contrast)]'
          : 'border-[color:var(--border-subtle)] bg-[var(--surface-card)] text-zinc-400 hover:bg-[var(--surface-panel)] hover:text-zinc-50',
      )}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger-soft)] px-1 text-[10px] font-semibold text-red-500">
          {badge}
        </span>
      )}
    </button>
  );
}
