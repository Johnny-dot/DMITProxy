import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Activity, UserCog } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/utils/cn';
import { UsersPage } from './Users';
import { OnlineUsersPage } from './OnlineUsers';
import { UsersManagementPage } from './admin/UsersManagement';
import { useI18n } from '@/src/context/I18nContext';

type UserCenterTab = 'list' | 'online' | 'accounts';

const VALID_TABS: UserCenterTab[] = ['list', 'online', 'accounts'];

function isValidTab(value: string | null): value is UserCenterTab {
  if (!value) return false;
  return VALID_TABS.includes(value as UserCenterTab);
}

export function UsersCenterPage() {
  const { t, language } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const isZh = language === 'zh-CN';
  const rawTab = searchParams.get('tab');
  const activeTab: UserCenterTab = isValidTab(rawTab) ? rawTab : 'list';

  const [mountedTabs, setMountedTabs] = useState<Record<UserCenterTab, boolean>>({
    list: true,
    online: activeTab === 'online',
    accounts: activeTab === 'accounts',
  });

  useEffect(() => {
    if (isValidTab(rawTab)) return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'list');
    setSearchParams(next, { replace: true });
  }, [rawTab, searchParams, setSearchParams]);

  useEffect(() => {
    setMountedTabs((previous) =>
      previous[activeTab] ? previous : { ...previous, [activeTab]: true },
    );
  }, [activeTab]);

  const tabItems = useMemo(
    () => [
      { key: 'list' as const, label: t('users.title'), icon: Users },
      { key: 'online' as const, label: t('online.title'), icon: Activity },
      { key: 'accounts' as const, label: t('userAccounts.title'), icon: UserCog },
    ],
    [t],
  );

  const switchTab = (tab: UserCenterTab) => {
    if (tab === activeTab) return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{isZh ? '用户中心' : 'User Center'}</h1>
        <p className="text-zinc-400 mt-1">
          {isZh
            ? '在一个页面中统一管理用户、在线状态与账号邀请码。'
            : 'Manage users, online activity, and account invites in one workspace.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabItems.map((item) => (
          <Button
            key={item.key}
            variant={activeTab === item.key ? 'secondary' : 'outline'}
            size="sm"
            className={cn('gap-2')}
            onClick={() => switchTab(item.key)}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Button>
        ))}
      </div>

      <div className={cn(activeTab === 'list' ? 'block' : 'hidden')}>
        {mountedTabs.list && <UsersPage embedded onOpenAccounts={() => switchTab('accounts')} />}
      </div>
      <div className={cn(activeTab === 'online' ? 'block' : 'hidden')}>
        {mountedTabs.online && <OnlineUsersPage embedded />}
      </div>
      <div className={cn(activeTab === 'accounts' ? 'block' : 'hidden')}>
        {mountedTabs.accounts && <UsersManagementPage embedded />}
      </div>
    </div>
  );
}
