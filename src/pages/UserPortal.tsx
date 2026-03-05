import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutDashboard, ListChecks, Bell, UserCog } from 'lucide-react';
import { cn } from '@/src/utils/cn';
import { useI18n } from '@/src/context/I18nContext';
import { useAuth } from '@/src/context/AuthContext';
import { Button } from '@/src/components/ui/Button';
import { buildSubscriptionUrl } from '@/src/utils/subscription';
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
} from './portal/types';
import { isPortalTab, toMillis, COPY_RESET_DELAY_MS } from './portal/types';

const READ_NOTIFICATIONS_STORAGE_PREFIX = 'proxydog:user:notification-read:v1';

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

  const [activeTab, setActiveTab] = useState<PortalTab>(() => {
    const requestedSection = searchParams.get('section');
    return isPortalTab(requestedSection) ? requestedSection : 'home';
  });
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

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
  // Tab / section management
  // -----------------------------------------------------------------------
  const setSection = useCallback(
    (nextTab: PortalTab) => {
      setActiveTab(nextTab);
      const next = new URLSearchParams(searchParams);
      next.set('section', nextTab);
      if (nextTab !== 'management') {
        next.delete('tab');
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
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

      const settingsRes = await fetch('/local/admin/settings', { credentials: 'include' });
      const settingsData = await settingsRes.json().catch(() => null);
      if (!settingsRes.ok) {
        throw new Error(settingsData?.error ?? 'Failed to load admin context');
      }

      const incoming = (settingsData ?? {}) as Partial<PortalSettings>;
      setAdminSettings({
        siteName: String(incoming.siteName ?? '').trim(),
        publicUrl: String(incoming.publicUrl ?? '').trim(),
        supportTelegram: String(incoming.supportTelegram ?? '').trim(),
        announcementText: String(incoming.announcementText ?? ''),
        announcementActive: Boolean(incoming.announcementActive),
      });
      setContext(null);
      setViewerRole('admin');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load portal context');
    } finally {
      setIsLoading(false);
    }
  }, [isAdminAuthenticated, isCheckingAdminAuth, navigate]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  // Sync URL → activeTab
  useEffect(() => {
    const requestedSection = searchParams.get('section');
    if (!isPortalTab(requestedSection)) return;
    if (requestedSection !== activeTab) {
      setActiveTab(requestedSection);
    }
  }, [activeTab, searchParams]);

  // Set default section based on role
  useEffect(() => {
    if (!viewerRole) return;
    if (isPortalTab(searchParams.get('section'))) return;
    setSection(viewerRole === 'admin' ? 'management' : 'home');
  }, [searchParams, setSection, viewerRole]);

  // Guard invalid tab for role
  useEffect(() => {
    if (viewerRole === 'admin' && activeTab === 'subscription') {
      setSection('management');
    } else if (viewerRole === 'user' && activeTab === 'management') {
      setSection('home');
    }
  }, [activeTab, setSection, viewerRole]);

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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!context && !isAdminView) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6 flex items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            {isZh ? '无法加载用户中心' : 'Failed to load user workspace'}
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
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <PortalHeader
        siteName={effectiveSettings?.siteName ?? ''}
        currentUsername={currentUsername}
        onLogout={handleLogout}
      />

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        {/* Hero section */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-zinc-900 to-zinc-900 p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300/80">
                {isAdminView ? 'UNIFIED WORKSPACE' : 'USER WORKSPACE'}
              </p>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                {isAdminView
                  ? isZh
                    ? '统一用户中心（管理员扩展）'
                    : 'Unified user center with admin extensions'
                  : isZh
                    ? '用户中心与上手引导一体化'
                    : 'Onboarding and user workspace in one place'}
              </h1>
              <p className="text-sm text-zinc-300 max-w-2xl">
                {isAdminView
                  ? isZh
                    ? '同一页面可查看用户侧内容，并额外进入用户管理、在线状态和邀请码管理。'
                    : 'Use one page for user-facing content, plus admin-only user management and invite operations.'
                  : isZh
                    ? '流程完成后仍可继续使用：查看订阅、更新客户端、接收管理员公告。'
                    : 'After onboarding, users can keep using this workspace for subscription, client updates, and admin notices.'}
              </p>
            </div>

            {isAdminView ? (
              <div className="w-full md:w-60 rounded-xl border border-white/10 bg-zinc-950/60 p-4 space-y-3">
                <p className="text-xs text-zinc-400">{isZh ? '当前身份' : 'Current role'}</p>
                <p className="text-sm text-zinc-200">{isZh ? '管理员' : 'Administrator'}</p>
                <Button size="sm" className="w-full" onClick={() => setSection('management')}>
                  {isZh ? '打开管理功能' : 'Open management'}
                </Button>
              </div>
            ) : (
              <div className="w-full md:w-60 rounded-xl border border-white/10 bg-zinc-950/60 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{isZh ? '完成进度' : 'Progress'}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Tab bar */}
        <section className="flex flex-wrap gap-2">
          <TabButton
            icon={<LayoutDashboard className="w-4 h-4" />}
            label={isZh ? '概览' : 'Overview'}
            active={activeTab === 'home'}
            onClick={() => setSection('home')}
          />
          {!isAdminView && (
            <TabButton
              icon={<ListChecks className="w-4 h-4" />}
              label={isZh ? '订阅与客户端' : 'Subscription & Clients'}
              active={activeTab === 'subscription'}
              onClick={() => setSection('subscription')}
            />
          )}
          <TabButton
            icon={<Bell className="w-4 h-4" />}
            label={isZh ? '通知' : 'Notifications'}
            active={activeTab === 'notifications'}
            onClick={() => setSection('notifications')}
            badge={unreadCount > 0 ? unreadCount : undefined}
          />
          {isAdminView && (
            <TabButton
              icon={<UserCog className="w-4 h-4" />}
              label={isZh ? '管理功能' : 'Management'}
              active={activeTab === 'management'}
              onClick={() => setSection('management')}
            />
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
            onCopy={handleCopy}
            onSetSection={setSection}
            onNavigate={navigate}
          />
        )}

        {activeTab === 'subscription' && !isAdminView && (
          <SubscriptionTab subId={context?.user.subId ?? null} />
        )}

        {activeTab === 'management' && isAdminView && (
          <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 md:p-6">
            <UsersCenterPage />
          </section>
        )}

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

// ---------------------------------------------------------------------------
// Tab button helper
// ---------------------------------------------------------------------------

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
