import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Users,
  BarChart3,
  Link as LinkIcon,
  Settings,
  Dog,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/src/utils/cn';
import { useI18n } from '@/src/context/I18nContext';
import { useAuth } from '@/src/context/AuthContext';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t, language } = useI18n();
  const { role, username } = useAuth();
  const userCenterLabel = language === 'zh-CN' ? '用户中心' : 'User Center';
  const mySubscriptionLabel = language === 'zh-CN' ? '我的订阅' : 'My Subscription';

  const adminMenuItems = [
    { icon: LayoutDashboard, label: t('nav.dashboard'), path: '/' },
    { icon: Server, label: t('nav.nodes'), path: '/nodes' },
    { icon: ShieldCheck, label: t('nav.inbounds'), path: '/inbounds' },
    { icon: Users, label: userCenterLabel, path: '/users' },
    { icon: BarChart3, label: t('nav.traffic'), path: '/traffic' },
    { icon: LinkIcon, label: t('nav.subscriptions'), path: '/subscriptions' },
    { icon: Settings, label: t('nav.settings'), path: '/settings' },
  ];

  const userMenuItems = [{ icon: LinkIcon, label: mySubscriptionLabel, path: '/my-subscription' }];

  const menuItems = role === 'user' ? userMenuItems : adminMenuItems;

  const displayName = username ?? (language === 'zh-CN' ? t('nav.adminUser') : t('nav.adminUser'));
  const displayEmail = role === 'user' ? '' : t('nav.adminEmail');

  return (
    <aside className="w-64 border-r border-white/10 bg-zinc-950 flex flex-col h-full">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-zinc-50 rounded-lg flex items-center justify-center">
          <Dog className="w-5 h-5 text-zinc-950" />
        </div>
        <span className="font-bold text-xl tracking-tight text-zinc-50">ProxyDog</span>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={onNavigate}
            data-testid={
              item.path === '/my-subscription' ? 'sidebar-user-my-subscription' : undefined
            }
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'text-zinc-400 hover:text-zinc-50 hover:bg-white/5',
              )
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500" />
          <div className="flex flex-col">
            <span
              className="text-xs font-medium text-zinc-50"
              data-testid="sidebar-user-display-name"
            >
              {displayName}
            </span>
            {displayEmail && <span className="text-[10px] text-zinc-500">{displayEmail}</span>}
          </div>
        </div>
      </div>
    </aside>
  );
}
