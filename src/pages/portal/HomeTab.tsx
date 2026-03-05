import React from 'react';
import { useI18n } from '@/src/context/I18nContext';
import { Button } from '@/src/components/ui/Button';
import type { PortalSettings, UserInfo, PortalTab } from './types';
import { toMillis } from './types';

interface HomeTabProps {
  isAdminView: boolean;
  context: { user: UserInfo; settings: PortalSettings } | null;
  effectiveSettings: PortalSettings | null;
  hasSubscription: boolean;
  subscriptionUniversalUrl: string;
  onCopy: (text: string, key: string) => void;
  onSetSection: (tab: PortalTab) => void;
  onNavigate: (path: string) => void;
}

export function HomeTab({
  isAdminView,
  context,
  effectiveSettings,
  hasSubscription,
  subscriptionUniversalUrl,
  onCopy,
  onSetSection,
  onNavigate,
}: HomeTabProps) {
  const { language } = useI18n();
  const isZh = language === 'zh-CN';

  const latestAnnouncement = effectiveSettings?.announcementActive
    ? effectiveSettings.announcementText.trim()
    : '';
  const supportContact = effectiveSettings?.supportTelegram ?? '';

  const formatDateTime = (value: number) =>
    new Date(toMillis(value)).toLocaleString(isZh ? 'zh-CN' : 'en-US', { hour12: false });

  if (isAdminView) {
    return (
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
          <h2 className="text-lg font-semibold">{isZh ? '管理视图' : 'Management overview'}</h2>
          <div className="space-y-2 text-sm">
            <p className="text-zinc-300">
              <span className="text-zinc-500">{isZh ? '当前身份：' : 'Current role: '}</span>
              {isZh ? '管理员' : 'Administrator'}
            </p>
            <p className="text-zinc-300">
              <span className="text-zinc-500">{isZh ? '入口：' : 'Workspace: '}</span>
              {isZh ? '统一用户中心' : 'Unified user center'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => onSetSection('management')}>
              {isZh ? '打开管理功能' : 'Open management'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate('/settings')}>
              {isZh ? '进入设置' : 'Open settings'}
            </Button>
          </div>
        </div>

        <AdminMessagesCard
          isZh={isZh}
          latestAnnouncement={latestAnnouncement}
          supportContact={supportContact}
          onViewAll={() => onSetSection('notifications')}
        />
      </section>
    );
  }

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
        <h2 className="text-lg font-semibold">{isZh ? '账户状态' : 'Account status'}</h2>
        <div className="space-y-2 text-sm">
          <p className="text-zinc-300">
            <span className="text-zinc-500">{isZh ? '用户名：' : 'Username: '}</span>
            {context?.user.username}
          </p>
          <p className="text-zinc-300">
            <span className="text-zinc-500">{isZh ? '创建时间：' : 'Created at: '}</span>
            {context ? formatDateTime(context.user.createdAt) : '-'}
          </p>
          <p className={`font-medium ${hasSubscription ? 'text-emerald-300' : 'text-amber-300'}`}>
            {hasSubscription
              ? isZh
                ? '订阅已就绪，可随时导入客户端。'
                : 'Subscription is active and ready to import.'
              : isZh
                ? '订阅尚未分配，请联系管理员。'
                : 'Subscription is not assigned yet. Contact your admin.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onSetSection('subscription');
              onCopy(subscriptionUniversalUrl, 'home-universal');
            }}
            disabled={!hasSubscription}
          >
            {isZh ? '复制通用订阅' : 'Copy Universal Link'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onSetSection('subscription')}>
            {isZh ? '打开订阅中心' : 'Open Subscription Center'}
          </Button>
        </div>
      </div>

      <AdminMessagesCard
        isZh={isZh}
        latestAnnouncement={latestAnnouncement}
        supportContact={supportContact}
        onViewAll={() => onSetSection('notifications')}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared card used by both admin and user home views
// ---------------------------------------------------------------------------

function AdminMessagesCard({
  isZh,
  latestAnnouncement,
  supportContact,
  onViewAll,
}: {
  isZh: boolean;
  latestAnnouncement: string;
  supportContact: string;
  onViewAll: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
      <h2 className="text-lg font-semibold">{isZh ? '管理员消息' : 'Admin messages'}</h2>
      {latestAnnouncement ? (
        <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-4 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
          {latestAnnouncement}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          {isZh ? '当前没有启用公告。' : 'No active announcement.'}
        </p>
      )}
      {supportContact ? (
        <p className="text-sm text-zinc-300">
          <span className="text-zinc-500">{isZh ? '客服联系：' : 'Support: '}</span>
          {supportContact}
        </p>
      ) : (
        <p className="text-sm text-zinc-500">
          {isZh ? '暂未配置客服联系方式。' : 'Support contact is not configured.'}
        </p>
      )}
      <Button variant="outline" size="sm" onClick={onViewAll}>
        {isZh ? '查看全部通知' : 'View all notifications'}
      </Button>
    </div>
  );
}
