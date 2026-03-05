import React from 'react';
import { Bell, AlertTriangle } from 'lucide-react';
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
}

export function NotificationsTab({
  notifications,
  readNotificationIds,
  supportTelegram,
  onMarkRead,
  onMarkAllRead,
  onRefresh,
}: NotificationsTabProps) {
  const { language } = useI18n();
  const isZh = language === 'zh-CN';

  const formatDateTime = (value: number) =>
    new Date(toMillis(value)).toLocaleString(isZh ? 'zh-CN' : 'en-US', { hour12: false });

  const localizeNotification = (item: PortalNotification) => {
    if (!isZh) return item;

    if (item.id === 'subscription-ready') {
      return {
        ...item,
        title: '订阅已就绪',
        message: '你的订阅链接已可用，现在可以在客户端导入或更新。',
      };
    }
    if (item.id === 'subscription-pending') {
      return {
        ...item,
        title: '订阅待分配',
        message: '账号已创建，但订阅尚未分配，请联系管理员处理。',
      };
    }
    if (item.id === 'admin-announcement') {
      return { ...item, title: '管理员公告' };
    }
    if (item.id === 'support-contact') {
      return {
        ...item,
        title: '客服联系方式',
        message: `需要帮助请联系：${supportTelegram || item.message}`,
      };
    }
    return item;
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="w-4 h-4 text-emerald-400" />
          <span>{isZh ? '通知中心' : 'Notification center'}</span>
        </h2>
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
        <p className="text-sm text-zinc-500">{isZh ? '暂无通知。' : 'No notifications.'}</p>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => {
            const localized = localizeNotification(item);
            const isRead = readNotificationIds.includes(item.id);
            return (
              <div
                key={item.id}
                className={cn(
                  'rounded-xl border p-4 space-y-2',
                  item.level === 'success' && 'border-emerald-500/20 bg-emerald-500/5',
                  item.level === 'warning' && 'border-amber-500/20 bg-amber-500/5',
                  item.level === 'info' && 'border-white/10 bg-zinc-950/40',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-100">{localized.title}</p>
                    <p className="text-xs text-zinc-500 mt-1">{formatDateTime(item.createdAt)}</p>
                  </div>
                  {!isRead && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded">
                      <AlertTriangle className="w-3 h-3" />
                      {isZh ? '未读' : 'Unread'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">{localized.message}</p>
                {!isRead && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
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
