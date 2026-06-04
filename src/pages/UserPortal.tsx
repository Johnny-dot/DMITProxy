import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutDashboard, ListChecks, Bell, UserCog } from 'lucide-react';
import { useI18n } from '@/src/context/I18nContext';
import { useAuth } from '@/src/context/AuthContext';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { buildSubscriptionUrl } from '@/src/utils/subscription';
import type { ServerStatus } from '@/src/api/xui';
import type { NodeQualityProfile } from '@/src/types/nodeQuality';
import { UsersCenterPage } from './UsersCenter';
import { PortalHeader } from './portal/PortalHeader';
import { HomeTab } from './portal/HomeTab';
import { SubscriptionTab } from './portal/SubscriptionTab';
import { NotificationsTab } from './portal/NotificationsTab';
import type {
  PortalContextResponse,
  PortalSettings,
  PortalTab,
  ViewerRole,
  PortalNotification,
  ClientStats,
  PortalStatsResponse,
  PortalUsageSummary,
} from './portal/types';
import { isPortalTab, toMillis, COPY_RESET_DELAY_MS } from './portal/types';

const READ_NOTIFICATIONS_STORAGE_PREFIX = 'prism:user:notification-read:v1';

export function UserPortalPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    isAuthenticated: isAdminAuthenticated,
    isChecking: isCheckingAdminAuth,
    logout: adminLogout,
  } = useAuth();
  const { language } = useI18n();
  const isZh = language === 'zh-CN';

  // -----------------------------------------------------------------------
  // Core state
  // -----------------------------------------------------------------------
  const [context, setContext] = useState<PortalContextResponse | null>(null);
  const [adminSettings, setAdminSettings] = useState<PortalSettings | null>(null);
  const [viewerRole, setViewerRole] = useState<ViewerRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [clientStats, setClientStats] = useState<ClientStats | null | 'loading'>('loading');
  const [usageSummary, setUsageSummary] = useState<PortalUsageSummary | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [nodeQuality, setNodeQuality] = useState<NodeQualityProfile | null>(null);

  // -----------------------------------------------------------------------
  // Derived state
  // -----------------------------------------------------------------------
  // Single source of truth for the active tab: always read from the URL.
  // This eliminates the dual-state (activeTab + searchParams) that caused
  // two separate renders — and therefore flickering — on every tab switch.
  const activeTab = useMemo<PortalTab>(() => {
    const s = searchParams.get('section');
    return isPortalTab(s) ? s : 'home';
  }, [searchParams]);

  // -----------------------------------------------------------------------
  // Derived state
  // -----------------------------------------------------------------------
  const isAdminView = viewerRole === 'admin';
  const effectiveSettings = context?.settings ?? adminSettings;
  const currentUsername = isAdminView
    ? isZh
      ? '管理员'
      : 'admin'
    : (context?.user.username ?? '');

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
        (left, right) => toMillis(right.createdAt) - toMillis(left.createdAt),
      ),
    [context?.notifications],
  );

  const unreadCount = useMemo(
    () => notifications.filter((item) => !readNotificationIds.includes(item.id)).length,
    [notifications, readNotificationIds],
  );

  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------
  // Tab / section management
  // -----------------------------------------------------------------------
  // Only one state update per click: setSearchParams. activeTab is derived from it.
  const setSection = useCallback(
    (nextTab: PortalTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('section', nextTab);
          if (nextTab !== 'management') next.delete('tab');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // -----------------------------------------------------------------------
  // Load context (user or admin)
  // -----------------------------------------------------------------------
  const loadContext = useCallback(async () => {
    if (isCheckingAdminAuth) return;

    setIsLoading(true);
    setLoadError('');

    try {
      const res = await fetch('/local/auth/portal/context', { credentials: 'include' });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (!data) throw new Error('Failed to load portal context');
        setContext(data as PortalContextResponse);
        setAdminSettings(null);
        setViewerRole('user');
        return;
      }

      if (res.status !== 401) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Failed to load portal context');
      }

      if (!isAdminAuthenticated) {
        navigate('/login', { replace: true });
        return;
      }

      // Admin should use the main sidebar layout, not the portal
      navigate('/users', { replace: true });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load portal context');
    } finally {
      setIsLoading(false);
    }
  }, [isAdminAuthenticated, isCheckingAdminAuth, navigate]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const loadStats = useCallback(async () => {
    setClientStats('loading');
    setUsageSummary(null);
    setServerStatus(null);
    setNodeQuality(null);
    try {
      const res = await fetch('/local/auth/portal/stats', { credentials: 'include' });
      if (!res.ok) {
        console.error('[portal] loadStats: server returned', res.status);
        setClientStats(null);
        return;
      }
      const data = await res.json().catch((err: unknown) => {
        console.error('[portal] loadStats: failed to parse response:', err);
        return null;
      });
      const typed = data as PortalStatsResponse | null;
      setClientStats(typed?.stats ?? null);
      setUsageSummary(typed?.usageSummary ?? null);
      setServerStatus(typed?.serverStatus ?? null);
      setNodeQuality(typed?.nodeQuality ?? null);
    } catch (error) {
      console.error('[portal] loadStats: network error:', error);
      setClientStats(null);
      setUsageSummary(null);
      setServerStatus(null);
      setNodeQuality(null);
    }
  }, []);

  useEffect(() => {
    if (viewerRole === 'user') void loadStats();
    else {
      setClientStats(null);
      setUsageSummary(null);
      setServerStatus(null);
      setNodeQuality(null);
    }
  }, [viewerRole, loadStats]);

  // Set default section based on role (only when URL has no section yet)
  useEffect(() => {
    if (!viewerRole) return;
    if (isPortalTab(searchParams.get('section'))) return;
    const defaultTab: PortalTab = viewerRole === 'admin' ? 'management' : 'home';
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('section', defaultTab);
        return next;
      },
      { replace: true },
    );
  }, [viewerRole, searchParams, setSearchParams]);

  // Guard invalid tab for role
  useEffect(() => {
    let corrected: PortalTab | null = null;
    if (viewerRole === 'admin' && activeTab === 'setup') corrected = 'management';
    else if (viewerRole === 'user' && activeTab === 'management') corrected = 'home';
    if (!corrected) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('section', corrected!);
        next.delete('tab');
        return next;
      },
      { replace: true },
    );
  }, [activeTab, viewerRole, setSearchParams]);

  // -----------------------------------------------------------------------
  // Notification read state (localStorage)
  // -----------------------------------------------------------------------
  const notificationStorageKey = useMemo(
    () => (context ? `${READ_NOTIFICATIONS_STORAGE_PREFIX}:${context.user.username}` : ''),
    [context],
  );

  useEffect(() => {
    if (!notificationStorageKey) return;
    try {
      const raw = window.localStorage.getItem(notificationStorageKey);
      if (!raw) {
        setReadNotificationIds([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setReadNotificationIds(parsed.filter((item): item is string => typeof item === 'string'));
      } else {
        setReadNotificationIds([]);
      }
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
      notifications.forEach((item) => next.add(item.id));
      return Array.from(next);
    });
  };

  // -----------------------------------------------------------------------
  // Copy handler (used only by HomeTab for the quick-copy button)
  // -----------------------------------------------------------------------
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), COPY_RESET_DELAY_MS);
    });
  };

  // -----------------------------------------------------------------------
  // Logout
  // -----------------------------------------------------------------------
  const handleLogout = async () => {
    if (isAdminView) {
      await adminLogout();
    } else {
      await fetch('/local/auth/logout', { method: 'POST', credentials: 'include' });
    }
    navigate('/login', { replace: true });
  };

  // -----------------------------------------------------------------------
  // Render: loading / error states
  // -----------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <PortalHeader
          siteName={effectiveSettings?.siteName ?? ''}
          currentUsername={currentUsername}
          onLogout={handleLogout}
        />
        <main className="content-shell-wide reveal-stagger w-full min-w-0 space-y-6 px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          <div className="surface-card space-y-3 p-6 md:p-7">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-2/3 max-w-md" />
            <Skeleton className="h-4 w-full max-w-2xl" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-11 w-28" />
            <Skeleton className="h-11 w-28" />
            <Skeleton className="h-11 w-28" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!context && !isAdminView) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="surface-card w-full max-w-md space-y-4 p-6">
          <h2 className="text-lg font-semibold">
            {isZh ? '页面加载失败' : 'Failed to load this page'}
          </h2>
          <p className="text-sm text-zinc-400">{loadError || 'Unknown error'}</p>
          <Button onClick={() => void loadContext()}>{isZh ? '重试' : 'Retry'}</Button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render: main portal
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen">
      <PortalHeader
        siteName={effectiveSettings?.siteName ?? ''}
        currentUsername={currentUsername}
        onLogout={handleLogout}
      />

      <main className="content-shell-wide reveal-stagger w-full min-w-0 space-y-6 px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        {/* Hero section */}
        <section className="surface-card p-6 md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="section-kicker">{isAdminView ? 'ADMIN VIEW' : 'YOUR PAGE'}</p>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                {isAdminView
                  ? isZh
                    ? '统一用户中心（管理员扩展）'
                    : 'Unified user center with admin extensions'
                  : isZh
                    ? '把常用内容都放在一起'
                    : 'Keep the usual things in one place'}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-zinc-400">
                {isAdminView
                  ? isZh
                    ? '同一页面可查看用户侧内容，并额外进入用户管理、在线状态和邀请码管理。'
                    : 'Use one page for user-facing content, plus admin-only user management and invite operations.'
                  : isZh
                    ? '看订阅、更新客户端、阅读说明都放在这里，不用来回找页面。'
                    : 'Links, client updates, and notes stay here so you do not have to jump around.'}
              </p>
            </div>

            {isAdminView ? (
              <div className="surface-panel w-full space-y-3 p-4 md:w-60">
                <p className="text-xs text-zinc-400">{isZh ? '当前身份' : 'Current role'}</p>
                <p className="text-sm text-zinc-200">{isZh ? '管理员' : 'Administrator'}</p>
                <Button size="sm" className="w-full" onClick={() => setSection('management')}>
                  {isZh ? '打开管理功能' : 'Open management'}
                </Button>
              </div>
            ) : (
              <div className="surface-panel w-full space-y-3 p-4 md:w-60">
                <p className="text-xs text-zinc-400">{isZh ? '订阅状态' : 'Subscription'}</p>
                <p className="text-sm text-zinc-200">
                  {hasSubscription ? (isZh ? '已就绪' : 'Ready') : isZh ? '待配置' : 'Not set up'}
                </p>
                <Button size="sm" className="w-full" onClick={() => setSection('setup')}>
                  {isZh ? '使用订阅' : 'Set up'}
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Tab bar */}
        <section className="glass-pill inline-flex flex-wrap items-center gap-2 p-2">
          <Button
            variant={activeTab === 'home' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-11 gap-2 px-4"
            onClick={() => setSection('home')}
          >
            <LayoutDashboard className="h-4 w-4" />
            {isZh ? '概览' : 'Overview'}
          </Button>
          {!isAdminView && (
            <Button
              variant={activeTab === 'setup' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-11 gap-2 px-4"
              onClick={() => setSection('setup')}
            >
              <ListChecks className="h-4 w-4" />
              {isZh ? '使用订阅' : 'Set up'}
            </Button>
          )}
          <Button
            variant={activeTab === 'notifications' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-11 gap-2 px-4"
            onClick={() => setSection('notifications')}
          >
            <Bell className="h-4 w-4" />
            {isZh ? '通知' : 'Notifications'}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-0.5">
                {unreadCount}
              </Badge>
            )}
          </Button>
          {isAdminView && (
            <Button
              variant={activeTab === 'management' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-11 gap-2 px-4"
              onClick={() => setSection('management')}
            >
              <UserCog className="h-4 w-4" />
              {isZh ? '管理功能' : 'Management'}
            </Button>
          )}
        </section>

        {/* Tab content */}
        {activeTab === 'home' && (
          <HomeTab
            isAdminView={isAdminView}
            context={context}
            effectiveSettings={effectiveSettings}
            hasSubscription={hasSubscription}
            subscriptionUniversalUrl={subscriptionLinks.universal}
            clientStats={clientStats === 'loading' ? undefined : (clientStats ?? undefined)}
            usageSummary={usageSummary}
            serverStatus={serverStatus}
            isStatsLoading={clientStats === 'loading'}
            onCopy={handleCopy}
            onSetSection={setSection}
            onNavigate={navigate}
          />
        )}

        {activeTab === 'setup' && !isAdminView && (
          <SubscriptionTab
            initialFocus="overview"
            subId={context?.user.subId ?? null}
            onSetSection={setSection}
          />
        )}

        {activeTab === 'management' && isAdminView && <UsersCenterPage embedded />}

        {activeTab === 'notifications' && (
          <NotificationsTab
            notifications={notifications}
            readNotificationIds={readNotificationIds}
            supportTelegram={context?.settings.supportTelegram}
            onMarkRead={markNotificationRead}
            onMarkAllRead={markAllNotificationsRead}
            onRefresh={() => void loadContext()}
          />
        )}
      </main>
    </div>
  );
}
