import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutDashboard, ListChecks, Bell } from 'lucide-react';
import { cn } from '@/src/utils/cn';
import { useI18n } from '@/src/context/I18nContext';
import { Button } from '@/src/components/ui/Button';
import { buildSubscriptionUrl } from '@/src/utils/subscription';
import { HomeTab } from './portal/HomeTab';
import { SubscriptionTab } from './portal/SubscriptionTab';
import { NotificationsTab } from './portal/NotificationsTab';
import type { PortalContextResponse, PortalTab, ClientStats } from './portal/types';
import { isPortalTab, toMillis, COPY_RESET_DELAY_MS } from './portal/types';

const READ_NOTIFICATIONS_STORAGE_PREFIX = 'proxydog:user:notification-read:v1';

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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  // Sync URL → activeTab
  useEffect(() => {
    const tab = toUserTab(searchParams.get('section'));
    if (tab !== activeTab) setActiveTab(tab);
  }, [activeTab, searchParams]);

  // localStorage for read notifications
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
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!context) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            {isZh ? '无法加载用户中心' : 'Failed to load workspace'}
          </h2>
          <p className="text-sm text-zinc-400">{loadError}</p>
          <Button onClick={() => void loadContext()}>{isZh ? '重试' : 'Retry'}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-wrap gap-2">
        <TabButton
          icon={<LayoutDashboard className="w-4 h-4" />}
          label={isZh ? '概览' : 'Overview'}
          active={activeTab === 'home'}
          onClick={() => setSection('home')}
        />
        <TabButton
          icon={<ListChecks className="w-4 h-4" />}
          label={isZh ? '订阅与客户端' : 'Subscription & Clients'}
          active={activeTab === 'subscription'}
          onClick={() => setSection('subscription')}
        />
        <TabButton
          icon={<Bell className="w-4 h-4" />}
          label={isZh ? '通知' : 'Notifications'}
          active={activeTab === 'notifications'}
          onClick={() => setSection('notifications')}
          badge={unreadCount > 0 ? unreadCount : undefined}
        />
      </div>

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
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-2 rounded-lg text-sm border transition-colors inline-flex items-center gap-2',
        active
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'border-white/10 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800/60',
      )}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className="min-w-5 h-5 px-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}
