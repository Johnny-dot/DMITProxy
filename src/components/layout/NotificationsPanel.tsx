import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Bell,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  Info,
  Megaphone,
  RefreshCw,
  Send,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/utils/cn';
import type { NotificationItem } from '@/src/types/notifications';
import type { AdminAnnouncement } from '@/src/api/admin';
import { getAvatarInitials, getAvatarToneClasses } from '@/src/utils/userProfile';

interface NotificationsPanelProps {
  open: boolean;
  isZh: boolean;
  adminMode?: boolean;
  notifications: NotificationItem[];
  adminAnnouncements?: AdminAnnouncement[];
  announcementDraft?: string;
  isRefreshing: boolean;
  isSendingAnnouncement?: boolean;
  unreadCount: number;
  deletingAnnouncementId?: string | null;
  getRelativeTime: (createdAt: number) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
  onClose: () => void;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onOpenAction: (item: NotificationItem) => void;
  onAnnouncementDraftChange?: (value: string) => void;
  onAnnouncementSubmit?: () => void;
  onAnnouncementDelete?: (id: string) => void;
  viewerName?: string | null;
  viewerAvatarStyle?: string | null;
}

function LevelIcon({ level }: { level: NotificationItem['level'] }) {
  if (level === 'success') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (level === 'warning') return <TriangleAlert className="h-4 w-4 text-amber-500" />;
  if (level === 'error') return <AlertCircle className="h-4 w-4 text-red-500" />;
  return <Info className="h-4 w-4 text-[var(--text-secondary)]" />;
}

export function NotificationsPanel({
  open,
  isZh,
  adminMode = false,
  notifications,
  adminAnnouncements = [],
  announcementDraft = '',
  isRefreshing,
  isSendingAnnouncement = false,
  unreadCount,
  deletingAnnouncementId,
  getRelativeTime,
  t,
  onClose,
  onRefresh,
  onMarkAllRead,
  onMarkRead,
  onOpenAction,
  onAnnouncementDraftChange,
  onAnnouncementSubmit,
  onAnnouncementDelete,
  viewerName,
  viewerAvatarStyle,
}: NotificationsPanelProps) {
  const [adminView, setAdminView] = React.useState<'announcements' | 'system'>('announcements');

  const renderSystemNotifications = () => {
    if (notifications.length === 0) {
      return (
        <div className="flex min-h-[120px] items-center justify-center rounded-[24px] border border-dashed border-[color:var(--border-subtle)] px-4 text-sm text-[var(--text-secondary)]">
          {adminMode
            ? isZh
              ? '当前没有新的系统提醒。'
              : 'No system reminders right now.'
            : t('notifications.empty')}
        </div>
      );
    }

    return notifications.map((item) => (
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
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                {item.title}
              </p>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{item.message}</p>
          </div>
          {!item.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-emerald-500" />}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-[var(--text-secondary)]">
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
    ));
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-[color:var(--overlay)] backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-x-4 bottom-4 top-4 z-[90] flex flex-col sm:left-auto sm:w-[410px]"
          >
            <div className="surface-card flex h-full flex-col overflow-hidden">
              <div className="soft-divider border-b px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-[var(--text-secondary)]" />
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
                <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
                  {adminMode
                    ? isZh
                      ? '在这里直接发布公告、查看历史，并把已发送公告从用户侧同步删除。'
                      : 'Publish announcements here, review sent history, and remove them for users.'
                    : t('notifications.subtitle')}
                </p>
                {viewerName && (
                  <div className="glass-pill mt-4 inline-flex items-center gap-2 px-3 py-2">
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold',
                        getAvatarToneClasses(viewerAvatarStyle),
                      )}
                    >
                      {getAvatarInitials(viewerName)}
                    </span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {viewerName}
                    </span>
                  </div>
                )}
                {adminMode && (
                  <div className="surface-panel mt-4 p-1">
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => setAdminView('announcements')}
                        className={cn(
                          'px-3 py-2 text-left',
                          adminView === 'announcements'
                            ? 'glass-nav-item-active'
                            : 'glass-nav-item',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            {isZh ? '公告中心' : 'Announcements'}
                          </span>
                          <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
                            {adminAnnouncements.length}
                          </Badge>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminView('system')}
                        className={cn(
                          'px-3 py-2 text-left',
                          adminView === 'system' ? 'glass-nav-item-active' : 'glass-nav-item',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            {isZh ? '系统提醒' : 'System'}
                          </span>
                          <Badge
                            variant={unreadCount > 0 ? 'success' : 'secondary'}
                            className="px-2 py-0.5 text-[10px]"
                          >
                            {notifications.length}
                          </Badge>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
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
                    hidden={adminMode && adminView !== 'system'}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    {t('notifications.markAllRead')}
                  </Button>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {adminMode ? (
                  adminView === 'announcements' ? (
                    <>
                      <section className="surface-panel space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--accent)]">
                              <Megaphone className="h-4 w-4" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-[var(--text-primary)]">
                                {isZh ? '发布公告' : 'Publish'}
                              </p>
                              <p className="text-xs leading-5 text-[var(--text-secondary)]">
                                {isZh
                                  ? '会同步到用户首页和通知中心。'
                                  : 'Syncs to the user home page and notification center.'}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="shrink-0">
                            {isZh
                              ? `${adminAnnouncements.length} 条历史`
                              : `${adminAnnouncements.length} history`}
                          </Badge>
                        </div>
                        <textarea
                          className="min-h-[96px] w-full rounded-[20px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] px-4 py-3 text-sm text-[var(--text-primary)] backdrop-blur-xl placeholder:text-[var(--text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2"
                          value={announcementDraft}
                          placeholder={
                            isZh
                              ? '输入公告内容，发送后所有用户都能看到。'
                              : 'Write the announcement users should see.'
                          }
                          maxLength={2000}
                          onChange={(event) => onAnnouncementDraftChange?.(event.target.value)}
                        />
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs leading-5 text-[var(--text-secondary)]">
                            {isZh
                              ? '删除历史公告时，用户收到的同一条公告也会一起移除。'
                              : 'Deleting sent announcements removes them for users too.'}
                          </p>
                          <Button
                            size="sm"
                            className="h-10 min-w-[112px] gap-1.5 whitespace-nowrap rounded-[18px] px-4 self-start sm:self-auto"
                            onClick={onAnnouncementSubmit}
                            disabled={isSendingAnnouncement || !announcementDraft.trim()}
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>
                              {isSendingAnnouncement
                                ? isZh
                                  ? '发送中...'
                                  : 'Sending...'
                                : isZh
                                  ? '发送公告'
                                  : 'Send'}
                            </span>
                          </Button>
                        </div>
                      </section>

                      <section className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                              {isZh ? '已发送公告' : 'History'}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                              {isZh
                                ? '这里保留你已经发过的公告历史。'
                                : 'Previously sent announcements stay here.'}
                            </p>
                          </div>
                        </div>

                        {adminAnnouncements.length === 0 ? (
                          <div className="flex min-h-[120px] items-center justify-center rounded-[24px] border border-dashed border-[color:var(--border-subtle)] px-4 text-sm text-[var(--text-secondary)]">
                            {isZh ? '还没有发送过公告。' : 'No announcements have been sent yet.'}
                          </div>
                        ) : (
                          adminAnnouncements.map((item) => (
                            <div key={item.id} className="surface-panel space-y-2 p-3.5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-[var(--text-primary)]">
                                      {isZh ? '系统公告' : 'Announcement'}
                                    </p>
                                    <Badge variant={item.isActive ? 'success' : 'secondary'}>
                                      {item.isActive
                                        ? isZh
                                          ? '当前展示中'
                                          : 'Live'
                                        : isZh
                                          ? '历史记录'
                                          : 'History'}
                                    </Badge>
                                  </div>
                                  <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">
                                    {item.message}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 gap-1.5 px-2.5 text-red-300 hover:bg-[var(--danger-soft)] hover:text-red-200"
                                  onClick={() => onAnnouncementDelete?.(item.id)}
                                  disabled={deletingAnnouncementId === item.id}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">
                                    {deletingAnnouncementId === item.id
                                      ? isZh
                                        ? '删除中...'
                                        : 'Deleting...'
                                      : isZh
                                        ? '删除'
                                        : 'Delete'}
                                  </span>
                                </Button>
                              </div>
                              <p className="text-[11px] text-[var(--text-secondary)]">
                                {getRelativeTime(item.createdAt)}
                              </p>
                            </div>
                          ))
                        )}
                      </section>
                    </>
                  ) : (
                    <section className="space-y-3">
                      <div className="flex items-start justify-between gap-3 px-1">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                            {isZh ? '系统提醒' : 'System reminders'}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                            {isZh
                              ? '只在管理员端显示，用来提示运行状态和配置问题。'
                              : 'Visible only to admins for runtime and configuration issues.'}
                          </p>
                        </div>
                        <Badge variant={unreadCount > 0 ? 'success' : 'secondary'}>
                          {isZh
                            ? `${notifications.length} 条提醒`
                            : `${notifications.length} items`}
                        </Badge>
                      </div>
                      {renderSystemNotifications()}
                    </section>
                  )
                ) : (
                  renderSystemNotifications()
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
