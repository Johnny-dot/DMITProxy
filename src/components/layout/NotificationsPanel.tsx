import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Bell,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  Info,
  RefreshCw,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/utils/cn';
import type { NotificationItem } from '@/src/types/notifications';

interface NotificationsPanelProps {
  open: boolean;
  notifications: NotificationItem[];
  isRefreshing: boolean;
  unreadCount: number;
  getRelativeTime: (createdAt: number) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
  onClose: () => void;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onMarkRead: (id: string) => void;
  onOpenAction: (item: NotificationItem) => void;
}

function LevelIcon({ level }: { level: NotificationItem['level'] }) {
  if (level === 'success') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (level === 'warning') return <TriangleAlert className="h-4 w-4 text-amber-500" />;
  if (level === 'error') return <AlertCircle className="h-4 w-4 text-red-500" />;
  return <Info className="h-4 w-4 text-zinc-400" />;
}

export function NotificationsPanel({
  open,
  notifications,
  isRefreshing,
  unreadCount,
  getRelativeTime,
  t,
  onClose,
  onRefresh,
  onMarkAllRead,
  onClearAll,
  onMarkRead,
  onOpenAction,
}: NotificationsPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-[color:var(--overlay)]"
          />
          <motion.aside
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-x-4 bottom-4 top-4 z-[90] flex flex-col sm:left-auto sm:w-[410px]"
          >
            <div className="surface-card flex h-full flex-col">
              <div className="soft-divider border-b px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-zinc-400" />
                    <h3 className="text-sm font-semibold">{t('notifications.title')}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={unreadCount > 0 ? 'success' : 'secondary'}>
                      {t('notifications.unreadCount', { count: unreadCount })}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClose}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-zinc-500">
                  {t('notifications.subtitle')}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                    {t('notifications.refresh')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={onMarkAllRead}
                    disabled={notifications.length === 0 || unreadCount === 0}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    {t('notifications.markAllRead')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    onClick={onClearAll}
                    disabled={notifications.length === 0}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('notifications.clearAll')}
                  </Button>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {notifications.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                    {t('notifications.empty')}
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'surface-panel space-y-3 p-4',
                        !item.read && 'border-[color:var(--border-strong)]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <LevelIcon level={item.level} />
                            <p className="truncate text-sm font-medium text-zinc-50">
                              {item.title}
                            </p>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-zinc-500">{item.message}</p>
                        </div>
                        {!item.read && (
                          <span className="mt-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-zinc-500">
                          {getRelativeTime(item.createdAt)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {!item.read && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-3"
                              onClick={() => onMarkRead(item.id)}
                            >
                              {t('notifications.markRead')}
                            </Button>
                          )}
                          {item.actionPath && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 px-3"
                              onClick={() => onOpenAction(item)}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              {item.actionLabel || t('notifications.open')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
