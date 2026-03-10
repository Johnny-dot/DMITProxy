import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, LogOut, Search, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../ui/ThemeToggle';
import { LanguageToggle } from '../ui/LanguageToggle';
import { useToast } from '../ui/Toast';
import { useI18n } from '@/src/context/I18nContext';
import { useAuth } from '@/src/context/AuthContext';
import { NotificationsPanel } from './NotificationsPanel';
import type { NotificationItem } from '@/src/types/notifications';
import { localizePortalNotification } from '@/src/pages/portal/NotificationsTab';
import type { PortalContextResponse } from '@/src/pages/portal/types';

interface SystemFlags {
  xuiAutoProvisionEnabled: boolean;
  xuiAutoProvisionCredentialsConfigured: boolean;
}

interface AdminSettings {
  publicUrl: string;
  supportTelegram: string;
  announcementText: string;
  announcementActive: boolean;
}

function getNotificationStorageKey(role: 'admin' | 'user' | null, username: string | null) {
  if (role === 'user' && username) return `prism:user-notifications:v1:${username}`;
  return 'prism:admin-notifications:v1';
}

export function Navbar() {
  const { logout, role, username, displayName, avatarStyle, refreshAuth } = useAuth();
  const { toast } = useToast();
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const isZh = language === 'zh-CN';
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isRefreshingNotifications, setIsRefreshingNotifications] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const notificationStorageKey = useMemo(
    () => getNotificationStorageKey(role, username),
    [role, username],
  );
  const resolvedDisplayName = displayName ?? username ?? '';

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(notificationStorageKey);
      if (!raw) {
        setNotifications([]);
        return;
      }
      const parsed = JSON.parse(raw) as NotificationItem[];
      if (!Array.isArray(parsed)) {
        setNotifications([]);
        return;
      }
      setNotifications(parsed);
    } catch {
      setNotifications([]);
    }
  }, [notificationStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(notificationStorageKey, JSON.stringify(notifications));
  }, [notificationStorageKey, notifications]);

  const getRelativeTime = useCallback(
    (createdAt: number) => {
      const diffMinutes = Math.max(0, Math.floor((Date.now() - createdAt) / 60000));
      if (diffMinutes < 1) return t('notifications.justNow');
      if (diffMinutes < 60) return t('notifications.minutesAgo', { count: diffMinutes });
      return t('notifications.hoursAgo', { count: Math.floor(diffMinutes / 60) });
    },
    [t],
  );

  const mapUserNotifications = useCallback(
    (context: PortalContextResponse): NotificationItem[] =>
      context.notifications.map((item) => {
        const localized = localizePortalNotification(item, isZh, context.settings.supportTelegram);

        return {
          id: item.id,
          title: localized.title,
          message: localized.message,
          level: item.level,
          createdAt: item.createdAt,
          read: false,
          actionPath:
            item.id === 'subscription-ready' || item.id === 'subscription-pending'
              ? '/my-subscription?section=setup'
              : '/my-subscription?section=home',
          actionLabel: t('notifications.open'),
        };
      }),
    [isZh, t],
  );

  const syncAuthAfterUnauthorized = useCallback(async () => {
    setNotifications([]);
    const nextRole = await refreshAuth();
    if (nextRole === 'admin') {
      navigate('/', { replace: true });
    } else if (nextRole === 'user') {
      navigate('/my-subscription', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate, refreshAuth]);

  const refreshNotifications = useCallback(async () => {
    if (!role) {
      setNotifications([]);
      return;
    }

    setIsRefreshingNotifications(true);
    const now = Date.now();
    try {
      if (role === 'user') {
        const res = await fetch('/local/auth/portal/context', { credentials: 'include' });
        if (res.status === 401) {
          await syncAuthAfterUnauthorized();
          return;
        }
        if (!res.ok) {
          throw new Error('Failed to load portal notifications');
        }

        const context = (await res.json().catch(() => null)) as PortalContextResponse | null;
        if (!context) throw new Error('Failed to parse portal notifications');

        const generated = mapUserNotifications(context);
        setNotifications((previous) => {
          const previousMap = new Map<string, NotificationItem>(
            previous.map((item) => [item.id, item]),
          );
          return generated.map((item) => ({
            ...item,
            read: previousMap.get(item.id)?.read ?? false,
          }));
        });
        return;
      }

      const [systemRes, settingsRes, statusRes] = await Promise.allSettled([
        fetch('/local/admin/system', { credentials: 'include' }),
        fetch('/local/admin/settings', { credentials: 'include' }),
        fetch('/api/panel/api/server/status', { credentials: 'include' }),
      ]);

      const settledResponses = [systemRes, settingsRes, statusRes]
        .filter(
          (result): result is PromiseFulfilledResult<Response> => result.status === 'fulfilled',
        )
        .map((result) => result.value);
      if (settledResponses.some((response) => response.status === 401)) {
        await syncAuthAfterUnauthorized();
        return;
      }

      const generated: Array<Omit<NotificationItem, 'read'>> = [];

      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        generated.push({
          id: 'sys-status-ok',
          level: 'success',
          title: t('systemNotifications.serverOkTitle'),
          message: t('systemNotifications.serverOkBody'),
          createdAt: now,
          actionPath: '/',
          actionLabel: t('notifications.open'),
        });
      } else {
        generated.push({
          id: 'sys-status-error',
          level: 'warning',
          title: t('systemNotifications.serverErrorTitle'),
          message: t('systemNotifications.serverErrorBody'),
          createdAt: now,
          actionPath: '/settings',
          actionLabel: t('notifications.open'),
        });
      }

      if (settingsRes.status === 'fulfilled' && settingsRes.value.ok) {
        const settings = (await settingsRes.value.json()) as AdminSettings;
        if (!String(settings.publicUrl ?? '').trim()) {
          generated.push({
            id: 'cfg-public-url-missing',
            level: 'warning',
            title: t('systemNotifications.publicUrlMissingTitle'),
            message: t('systemNotifications.publicUrlMissingBody'),
            createdAt: now,
            actionPath: '/settings',
            actionLabel: t('notifications.open'),
          });
        }
        if (!String(settings.supportTelegram ?? '').trim()) {
          generated.push({
            id: 'cfg-support-missing',
            level: 'info',
            title: t('systemNotifications.supportMissingTitle'),
            message: t('systemNotifications.supportMissingBody'),
            createdAt: now,
            actionPath: '/settings',
            actionLabel: t('notifications.open'),
          });
        }
        if (!settings.announcementActive) {
          generated.push({
            id: 'cfg-announcement-disabled',
            level: 'info',
            title: t('systemNotifications.announcementInactiveTitle'),
            message: t('systemNotifications.announcementInactiveBody'),
            createdAt: now,
            actionPath: '/settings',
            actionLabel: t('notifications.open'),
          });
        }
      }

      if (systemRes.status === 'fulfilled' && systemRes.value.ok) {
        const systemFlags = (await systemRes.value.json()) as SystemFlags;
        if (
          systemFlags.xuiAutoProvisionEnabled &&
          systemFlags.xuiAutoProvisionCredentialsConfigured
        ) {
          generated.push({
            id: 'cfg-auto-provision-ready',
            level: 'success',
            title: t('systemNotifications.autoProvisionReadyTitle'),
            message: t('systemNotifications.autoProvisionReadyBody'),
            createdAt: now,
            actionPath: '/users?tab=accounts',
            actionLabel: t('notifications.open'),
          });
        } else if (systemFlags.xuiAutoProvisionEnabled) {
          generated.push({
            id: 'cfg-auto-provision-missing-creds',
            level: 'error',
            title: t('systemNotifications.autoProvisionCredsMissingTitle'),
            message: t('systemNotifications.autoProvisionCredsMissingBody'),
            createdAt: now,
            actionPath: '/users?tab=accounts',
            actionLabel: t('notifications.open'),
          });
        }
      }

      const severity: Record<NotificationItem['level'], number> = {
        error: 4,
        warning: 3,
        info: 2,
        success: 1,
      };

      setNotifications((previous) => {
        const previousMap = new Map<string, NotificationItem>(
          previous.map((item) => [item.id, item]),
        );
        return generated
          .map((item) => {
            const old = previousMap.get(item.id);
            return {
              ...item,
              createdAt: old?.createdAt ?? item.createdAt,
              read: old?.read ?? false,
            };
          })
          .sort((left, right) => {
            const bySeverity = severity[right.level] - severity[left.level];
            if (bySeverity !== 0) return bySeverity;
            return right.createdAt - left.createdAt;
          });
      });
    } catch {
      toast(t('notifications.refreshFailed'), 'error');
    } finally {
      setIsRefreshingNotifications(false);
    }
  }, [mapUserNotifications, role, syncAuthAfterUnauthorized, t, toast]);

  useEffect(() => {
    if (!role) return;
    void refreshNotifications();
  }, [role, language, refreshNotifications]);

  function openNotifications() {
    setIsNotificationsOpen(true);
    void refreshNotifications();
  }

  function markNotificationRead(id: string) {
    setNotifications((previous) =>
      previous.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  }

  function markAllNotificationsRead() {
    setNotifications((previous) => previous.map((item) => ({ ...item, read: true })));
  }

  function clearNotifications() {
    setNotifications([]);
  }

  function openNotificationAction(item: NotificationItem) {
    markNotificationRead(item.id);
    if (item.actionPath) {
      setIsNotificationsOpen(false);
      navigate(item.actionPath);
    }
  }

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="flex w-full items-center justify-between gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="relative hidden w-full max-w-md sm:block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder={t('nav.searchPlaceholder')}
            className="h-11 bg-[var(--surface-panel)] pl-11 shadow-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <LanguageToggle compact className="hidden sm:inline-flex" testIdPrefix="navbar-language" />
        <ThemeToggle testId="navbar-theme-toggle" />
        <Button
          variant="outline"
          size="icon"
          className="relative"
          onClick={openNotifications}
          title={t('notifications.title')}
          data-testid="navbar-notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-emerald-500" />
          )}
        </Button>
        <div className="hidden h-8 w-px bg-[var(--border-subtle)] sm:block" />
        <Button
          variant={location.pathname === '/profile' ? 'secondary' : 'outline'}
          size="sm"
          className="hidden gap-2 sm:flex"
          onClick={() => navigate('/profile')}
        >
          <User className="h-4 w-4" />
          {t('nav.profile')}
        </Button>
        <Button
          variant={location.pathname === '/profile' ? 'secondary' : 'outline'}
          size="icon"
          className="sm:hidden"
          onClick={() => navigate('/profile')}
        >
          <User className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="hidden gap-2 sm:flex"
          onClick={handleLogout}
          disabled={isLoggingOut}
          data-testid="navbar-signout"
        >
          <LogOut className="h-4 w-4" />
          {t('portal.signOut')}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="sm:hidden"
          onClick={handleLogout}
          disabled={isLoggingOut}
          title={t('portal.signOut')}
          data-testid="navbar-signout-mobile"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <NotificationsPanel
        open={isNotificationsOpen}
        notifications={notifications}
        isRefreshing={isRefreshingNotifications}
        unreadCount={unreadCount}
        getRelativeTime={getRelativeTime}
        t={t}
        onClose={() => setIsNotificationsOpen(false)}
        onRefresh={() => void refreshNotifications()}
        onMarkAllRead={markAllNotificationsRead}
        onClearAll={clearNotifications}
        onMarkRead={markNotificationRead}
        onOpenAction={openNotificationAction}
        viewerName={role === 'user' ? resolvedDisplayName : null}
        viewerAvatarStyle={role === 'user' ? avatarStyle : null}
      />
    </div>
  );
}
