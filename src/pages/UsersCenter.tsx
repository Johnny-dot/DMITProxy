import React from 'react';
import { UsersManagementPage } from './admin/UsersManagement';
import { useI18n } from '@/src/context/I18nContext';
import { cn } from '@/src/utils/cn';

// The user center is now a single unified view: registered users (with their live
// online/traffic/expiry joined from the 3X-UI client list) plus pending invites — no more
// separate "用户 / 用户与邀请码" tabs. The raw per-client table (src/pages/Users.tsx) is kept
// in the tree but no longer routed; re-introduce specific client tools onto the rows if needed.
export function UsersCenterPage({ embedded = false }: { embedded?: boolean }) {
  const { language } = useI18n();
  const isZh = language === 'zh-CN';

  return (
    <div
      className={cn(
        'w-full min-w-0 space-y-6',
        !embedded && 'content-shell-wide reveal-stagger px-4 md:px-6 xl:px-8',
      )}
    >
      {!embedded && (
        <section className="surface-card space-y-3 p-6 md:p-7">
          <p className="section-kicker">{isZh ? '用户中心' : 'User Center'}</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {isZh ? '用户中心' : 'User Center'}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-zinc-400">
            {isZh
              ? '在一个页面里统一管理注册用户、邀请码和实时用量。'
              : 'Manage registered users, invites, and live usage in one place.'}
          </p>
        </section>
      )}

      <UsersManagementPage embedded />
    </div>
  );
}
