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
  if (level === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (level === 'warning') return <TriangleAlert className="w-4 h-4 text-amber-500" />;
  if (level === 'error') return <AlertCircle className="w-4 h-4 text-red-500" />;
  return <Info className="w-4 h-4 text-zinc-400" />;
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
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[80]"
          />
          <motion.aside
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed right-0 top-16 h-[calc(100vh-4rem)] w-full sm:w-[410px] border-l border-white/10 bg-zinc-950/95 backdrop-blur-xl z-[90] flex flex-col"
          >
            <div className="p-4 border-b border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-zinc-300" />
                  <h3 className="font-semibold text-sm">{t('notifications.title')}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={unreadCount > 0 ? 'success' : 'secondary'}>
                    {t('notifications.unreadCount', { count: unreadCount })}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-zinc-500">{t('notifications.subtitle')}</p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs gap-1"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
                  {t('notifications.refresh')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs gap-1"
                  onClick={onMarkAllRead}
                  disabled={notifications.length === 0 || unreadCount === 0}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {t('notifications.markAllRead')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 text-xs gap-1 text-zinc-400"
                  onClick={onClearAll}
                  disabled={notifications.length === 0}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('notifications.clearAll')}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-zinc-500">
                  {t('notifications.empty')}
                </div>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'rounded-lg border p-3 space-y-2',
                      item.read
                        ? 'border-white/10 bg-zinc-900/40'
                        : 'border-white/20 bg-zinc-900/70',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <LevelIcon level={item.level} />
                        <p className="text-sm font-medium truncate">{item.title}</p>
                      </div>
                      {!item.read && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{item.message}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-zinc-500">
                        {getRelativeTime(item.createdAt)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {!item.read && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => onMarkRead(item.id)}
                          >
                            {t('notifications.markRead')}
                          </Button>
                        )}
                        {item.actionPath && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => onOpenAction(item)}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {item.actionLabel || t('notifications.open')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
