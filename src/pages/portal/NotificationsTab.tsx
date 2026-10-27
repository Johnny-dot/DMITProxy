import React from 'react';
import { Bell } from 'lucide-react';
import { cn } from '@/src/utils/cn';
import { formatDateTime } from '@/src/utils/dateTime';
import { useI18n } from '@/src/context/I18nContext';
import { Button } from '@/src/components/ui/Button';
import { EmptyState } from '@/src/components/ui/EmptyState';
import type { PortalNotification } from './types';
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
      title: '订阅可用',
      message: '可以复制订阅链接。',
    };
  }

  if (item.id === 'subscription-pending') {
    return {
      ...item,
      title: '订阅准备中',
      message: '订阅链接还在准备。',
    };
  }

  if (item.id === 'admin-announcement' || item.id.startsWith('admin-announcement:')) {
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

  return (
    <section
      className={cn('space-y-5', variant === 'page' && 'surface-card p-6 md:p-7')}
      data-testid="subscription-notifications"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {variant === 'page' ? (
          <div className="space-y-2">
            <p className="section-kicker">{isZh ? '通知中心' : 'Notification center'}</p>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              <Bell className="h-4 w-4 text-[var(--color-emerald-500)]" />
              <span>{isZh ? '订阅提醒与服务通知' : 'Subscription and service notices'}</span>
            </h2>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {isZh ? '新消息显示在这里。' : 'New updates appear here.'}
            </p>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">
              {isZh
                ? '订阅状态、服务说明、联系信息按时间排列。'
                : 'Subscription status, service notes, and contact info, newest first.'}
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
        <EmptyState
          icon={Bell}
          title={isZh ? '暂时没有通知' : 'No notifications yet'}
          description={
            isZh
              ? '订阅状态和服务说明会显示在这里。'
              : 'Subscription and service notices will appear here.'
          }
        />
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
                  'surface-panel space-y-3 border-l-2 p-4',
                  item.level === 'success'
                    ? 'border-l-[var(--color-emerald-500)]'
                    : item.level === 'warning'
                      ? 'border-l-[var(--color-amber-500)]'
                      : 'border-l-[color:var(--accent-border)]',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {localized.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {formatDateTime(item.createdAt) || (isZh ? '时间未知' : 'Unknown time')}
                    </p>
                  </div>

                  {!isRead && (
                    <span className="glass-pill inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                      {isZh ? '未读' : 'Unread'}
                    </span>
                  )}
                </div>

                <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]">
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
