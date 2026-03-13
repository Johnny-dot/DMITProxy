import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, LogOut, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../ui/ThemeToggle';
import { LanguageToggle } from '../ui/LanguageToggle';
import { useToast } from '../ui/Toast';
import {
  ApiError,
  createAdminAnnouncement,
  deleteAdminAnnouncement,
  getAdminAnnouncements,
  type AdminAnnouncement,
} from '@/src/api/client';
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

function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

function getUserNotificationActionPath(id: string): string | undefined {
  if (id === 'subscription-ready' || id === 'subscription-pending') {
    return '/my-subscription?section=setup';
  }

  return undefined;
}

function withAction(item: NotificationItem, actionPath?: string): NotificationItem {
  if (!actionPath) return item;

  return {
    ...item,
    actionPath,
  };
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
  const [adminAnnouncements, setAdminAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<string | null>(null);

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

  useEffect(() => {
    if (role === 'admin') return;
    setAdminAnnouncements([]);
    setAnnouncementDraft('');
    setDeletingAnnouncementId(null);
  }, [role]);

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
        const actionPath = getUserNotificationActionPath(item.id);

        return {
          ...withAction(
            {
              id: item.id,
              title: localized.title,
              message: localized.message,
              level: item.level,
              createdAt: item.createdAt,
              read: false,
            },
            actionPath,
          ),
        };
      }),
    [isZh],
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
          return generated
            .map((item) => ({
              ...item,
              read: previousMap.get(item.id)?.read ?? false,
            }))
            .sort((left, right) => right.createdAt - left.createdAt);
        });
        return;
      }

      const [systemRes, settingsRes, statusRes, announcementsRes] = await Promise.allSettled([
        fetch('/local/admin/system', { credentials: 'include' }),
        fetch('/local/admin/settings', { credentials: 'include' }),
        fetch('/api/panel/api/server/status', { credentials: 'include' }),
        getAdminAnnouncements(),
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
      if (announcementsRes.status === 'rejected' && isUnauthorizedError(announcementsRes.reason)) {
        await syncAuthAfterUnauthorized();
        return;
      }

      if (announcementsRes.status === 'fulfilled') {
        setAdminAnnouncements(announcementsRes.value);
      }

      const generated: Array<Omit<NotificationItem, 'read'>> = [];

      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        generated.push({
          id: 'sys-status-ok',
          level: 'success',
          title: t('systemNotifications.serverOkTitle'),
          message: t('systemNotifications.serverOkBody'),
          createdAt: now,
        });
      } else {
        generated.push({
          id: 'sys-status-error',
          level: 'warning',
          title: t('systemNotifications.serverErrorTitle'),
          message: t('systemNotifications.serverErrorBody'),
          createdAt: now,
          actionPath: '/settings',
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
          });
        } else if (systemFlags.xuiAutoProvisionEnabled) {
          generated.push({
            id: 'cfg-auto-provision-missing-creds',
            level: 'error',
            title: t('systemNotifications.autoProvisionCredsMissingTitle'),
            message: t('systemNotifications.autoProvisionCredsMissingBody'),
            createdAt: now,
            actionPath: '/users?tab=accounts',
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
      if (announcementsRes.status === 'rejected') {
        throw announcementsRes.reason;
      }
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

  useEffect(() => {
    if (!role || typeof window === 'undefined') return;

    const handleWindowFocus = () => {
      void refreshNotifications();
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [role, refreshNotifications]);

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

  async function handleAnnouncementSubmit() {
    const message = announcementDraft.trim();
    if (role !== 'admin' || !message || isSendingAnnouncement) return;

    setIsSendingAnnouncement(true);
    try {
      const nextAnnouncements = await createAdminAnnouncement(message);
      setAdminAnnouncements(nextAnnouncements);
      setAnnouncementDraft('');
      toast(isZh ? '公告已发送' : 'Announcement sent', 'success');
    } catch (error) {
      if (isUnauthorizedError(error)) {
        await syncAuthAfterUnauthorized();
        return;
      }
      const messageText =
        error instanceof Error
          ? error.message
          : isZh
            ? '发送公告失败'
            : 'Failed to send announcement';
      toast(messageText, 'error');
    } finally {
      setIsSendingAnnouncement(false);
    }
  }

  async function handleAnnouncementDelete(id: string) {
    if (role !== 'admin' || deletingAnnouncementId) return;
    const confirmed = window.confirm(
      isZh
        ? '删除后，用户侧已经收到的这条公告也会同步移除。确定继续吗？'
        : 'Delete this announcement for users as well?',
    );
    if (!confirmed) return;

    setDeletingAnnouncementId(id);
    try {
      const nextAnnouncements = await deleteAdminAnnouncement(id);
      setAdminAnnouncements(nextAnnouncements);
      toast(isZh ? '公告已删除' : 'Announcement deleted', 'success');
    } catch (error) {
      if (isUnauthorizedError(error)) {
        await syncAuthAfterUnauthorized();
        return;
      }
      const messageText =
        error instanceof Error
          ? error.message
          : isZh
            ? '删除公告失败'
            : 'Failed to delete announcement';
      toast(messageText, 'error');
    } finally {
      setDeletingAnnouncementId(null);
    }
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
    <div className="flex w-full items-center justify-end gap-2 md:gap-3">
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
      <NotificationsPanel
        open={isNotificationsOpen}
        isZh={isZh}
        adminMode={role === 'admin'}
        notifications={notifications}
        adminAnnouncements={adminAnnouncements}
        announcementDraft={announcementDraft}
        isRefreshing={isRefreshingNotifications}
        isSendingAnnouncement={isSendingAnnouncement}
        unreadCount={unreadCount}
        deletingAnnouncementId={deletingAnnouncementId}
        getRelativeTime={getRelativeTime}
        t={t}
        onClose={() => setIsNotificationsOpen(false)}
        onRefresh={() => void refreshNotifications()}
        onMarkAllRead={markAllNotificationsRead}
        onMarkRead={markNotificationRead}
        onOpenAction={openNotificationAction}
        onAnnouncementDraftChange={setAnnouncementDraft}
        onAnnouncementSubmit={() => void handleAnnouncementSubmit()}
        onAnnouncementDelete={(id) => void handleAnnouncementDelete(id)}
        viewerName={role === 'user' ? resolvedDisplayName : null}
        viewerAvatarStyle={role === 'user' ? avatarStyle : null}
      />
    </div>
  );
}
