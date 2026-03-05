import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Search, User } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useToast } from '../ui/Toast';
import { useI18n } from '@/src/context/I18nContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { NotificationsPanel } from './NotificationsPanel';
import type { NotificationItem } from '@/src/types/notifications';

const NOTIFICATION_STORAGE_KEY = 'proxydog:admin-notifications:v1';

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

export function Navbar() {
  const { toast } = useToast();
  const { t, language, setLanguage } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isRefreshingNotifications, setIsRefreshingNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as NotificationItem[];
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  });

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  function getRelativeTime(createdAt: number) {
    const diffMinutes = Math.max(0, Math.floor((Date.now() - createdAt) / 60000));
    if (diffMinutes < 1) return t('notifications.justNow');
    if (diffMinutes < 60) return t('notifications.minutesAgo', { count: diffMinutes });
    return t('notifications.hoursAgo', { count: Math.floor(diffMinutes / 60) });
  }

  async function refreshNotifications() {
    setIsRefreshingNotifications(true);
    const now = Date.now();
    try {
      const [systemRes, settingsRes, statusRes] = await Promise.allSettled([
        fetch('/local/admin/system', { credentials: 'include' }),
        fetch('/local/admin/settings', { credentials: 'include' }),
        fetch('/api/panel/api/server/status', { credentials: 'include' }),
      ]);

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
            actionPath: '/user-accounts',
            actionLabel: t('notifications.open'),
          });
        } else if (systemFlags.xuiAutoProvisionEnabled) {
          generated.push({
            id: 'cfg-auto-provision-missing-creds',
            level: 'error',
            title: t('systemNotifications.autoProvisionCredsMissingTitle'),
            message: t('systemNotifications.autoProvisionCredsMissingBody'),
            createdAt: now,
            actionPath: '/user-accounts',
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
  }

  function openNotifications() {
    setIsNotificationsOpen(true);
    refreshNotifications();
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

  return (
    <div className="flex items-center justify-between w-full gap-4">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-sm hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder={t('nav.searchPlaceholder')}
            className="pl-10 bg-zinc-900/50 border-white/5 h-9"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <Button
          variant="outline"
          size="sm"
          className="sm:hidden h-9 px-2 text-xs"
          onClick={() => setLanguage(language === 'zh-CN' ? 'en-US' : 'zh-CN')}
        >
          {language === 'zh-CN' ? t('common.en') : t('common.zh')}
        </Button>
        <div className="hidden sm:flex items-center rounded-md border border-white/10 p-0.5">
          <Button
            variant={language === 'zh-CN' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setLanguage('zh-CN')}
          >
            {t('common.zh')}
          </Button>
          <Button
            variant={language === 'en-US' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setLanguage('en-US')}
          >
            {t('common.en')}
          </Button>
        </div>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={openNotifications}
          title={t('notifications.title')}
        >
          <Bell className="w-5 h-5 text-zinc-400" />
          {unreadCount > 0 && (
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-zinc-950" />
          )}
        </Button>
        <div className="h-8 w-px bg-white/10 mx-1 md:mx-2" />
        <Button
          variant={location.pathname === '/profile' ? 'secondary' : 'outline'}
          size="sm"
          className="gap-2 hidden sm:flex"
          onClick={() => navigate('/profile')}
        >
          <User className="w-4 h-4" />
          {t('nav.profile')}
        </Button>
        <Button
          variant={location.pathname === '/profile' ? 'secondary' : 'outline'}
          size="icon"
          className="sm:hidden"
          onClick={() => navigate('/profile')}
        >
          <User className="w-4 h-4" />
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
        onRefresh={refreshNotifications}
        onMarkAllRead={markAllNotificationsRead}
        onClearAll={clearNotifications}
        onMarkRead={markNotificationRead}
        onOpenAction={openNotificationAction}
      />
    </div>
  );
}
