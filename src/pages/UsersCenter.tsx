import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, UserCog } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/utils/cn';
import { UsersPage } from './Users';
import { UsersManagementPage } from './admin/UsersManagement';
import { useI18n } from '@/src/context/I18nContext';

type UserCenterTab = 'list' | 'accounts';

const VALID_TABS: UserCenterTab[] = ['list', 'accounts'];

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
    accounts: activeTab === 'accounts',
  });

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;

    if (rawTab !== activeTab) {
      next.set('tab', activeTab);
      changed = true;
    }

    if (next.has('view')) {
      next.delete('view');
      changed = true;
    }

    if (!changed) {
      return;
    }

    setSearchParams(next, { replace: true });
  }, [activeTab, rawTab, searchParams, setSearchParams]);

  useEffect(() => {
    setMountedTabs((previous) =>
      previous[activeTab] ? previous : { ...previous, [activeTab]: true },
    );
  }, [activeTab]);

  const tabItems = [
    { key: 'list' as const, label: t('users.title'), icon: Users },
    { key: 'accounts' as const, label: t('userAccounts.title'), icon: UserCog },
  ];

  const switchTab = (tab: UserCenterTab) => {
    if (tab === activeTab) return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    if (tab !== 'list') {
      next.delete('view');
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="w-full min-w-0 space-y-6">
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

      <div className={cn('w-full min-w-0', activeTab === 'list' ? 'block' : 'hidden')}>
        {mountedTabs.list && <UsersPage embedded onOpenAccounts={() => switchTab('accounts')} />}
      </div>
      <div className={cn('w-full min-w-0', activeTab === 'accounts' ? 'block' : 'hidden')}>
        {mountedTabs.accounts && <UsersManagementPage embedded />}
      </div>
    </div>
  );
}
