import React from 'react';
import { AlertTriangle, Bell } from 'lucide-react';
import { cn } from '@/src/utils/cn';
import { useI18n } from '@/src/context/I18nContext';
import { Button } from '@/src/components/ui/Button';
import type { PortalNotification } from './types';
import { toMillis } from './types';

interface NotificationsTabProps {
  notifications: PortalNotification[];
  readNotificationIds: string[];
  supportTelegram?: string;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onRefresh: () => void;
  variant?: 'page' | 'drawer';
}

export function localizePortalNotification(
  item: PortalNotification,
  isZh: boolean,
  supportTelegram?: string,
): PortalNotification {
  if (!isZh) return item;

  if (item.id === 'subscription-ready') {
    return {
      ...item,
      title: '订阅已就绪',
      message: '你的订阅链接已经可用，现在可以在客户端中导入或更新。',
    };
  }

  if (item.id === 'subscription-pending') {
    return {
      ...item,
      title: '订阅等待分配',
      message: '账号已经建好，当前订阅还在准备中。如果卡住了，可以通过联系渠道问一声。',
    };
  }

  if (item.id === 'admin-announcement') {
    return {
      ...item,
      title: '最新说明',
    };
  }

  if (item.id === 'support-contact') {
    return {
      ...item,
      title: '联系渠道',
      message: `需要帮助时请联系：${supportTelegram || item.message}`,
    };
  }

  return item;
}

export function NotificationsTab({
  notifications,
  readNotificationIds,
  supportTelegram,
  onMarkRead,
  onMarkAllRead,
  onRefresh,
  variant = 'page',
}: NotificationsTabProps) {
  const { language } = useI18n();
  const isZh = language === 'zh-CN';

  const formatDateTime = (value: number) =>
    new Date(toMillis(value)).toLocaleString(isZh ? 'zh-CN' : 'en-US', { hour12: false });

  return (
    <section
      className={cn('space-y-5', variant === 'page' && 'surface-card p-6 md:p-7')}
      data-testid="subscription-notifications"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {variant === 'page' ? (
          <div className="space-y-2">
            <p className="section-kicker">{isZh ? '通知中心' : 'Notification center'}</p>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-50">
              <Bell className="h-4 w-4 text-emerald-500" />
              <span>{isZh ? '通知和近况' : 'Updates and notes'}</span>
            </h2>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-50">
              {isZh ? '保持通知可见，但按需展开。' : 'Keep notices visible, expand them on demand.'}
            </p>
            <p className="text-sm leading-6 text-zinc-400">
              {isZh
                ? '这里放最近的订阅提醒、说明和联系信息。'
                : 'Recent subscription updates, notes, and contact info stay here.'}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            {isZh ? '刷新' : 'Refresh'}
          </Button>
          <Button variant="secondary" size="sm" onClick={onMarkAllRead}>
            {isZh ? '全部已读' : 'Mark all read'}
          </Button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <p className="text-sm leading-6 text-zinc-500">
          {isZh ? '暂时没有通知。' : 'No notifications yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => {
            const localized = localizePortalNotification(item, isZh, supportTelegram);
            const isRead = readNotificationIds.includes(item.id);

            return (
              <div
                key={item.id}
                data-testid="subscription-notification-item"
                className={cn(
                  'surface-panel space-y-3 p-4',
                  item.level === 'success' && 'text-emerald-500',
                  item.level === 'warning' && 'text-amber-500',
                  item.level === 'info' && 'text-zinc-400',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-50">{localized.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">{formatDateTime(item.createdAt)}</p>
                  </div>

                  {!isRead && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-emerald-500">
                      <AlertTriangle className="h-3 w-3" />
                      {isZh ? '未读' : 'Unread'}
                    </span>
                  )}
                </div>

                <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                  {localized.message}
                </p>

                {!isRead && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3"
                    onClick={() => onMarkRead(item.id)}
                  >
                    {isZh ? '标记已读' : 'Mark as read'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
