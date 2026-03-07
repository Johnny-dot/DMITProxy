import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  LayoutDashboard,
  Link as LinkIcon,
  Server,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { cn } from '@/src/utils/cn';
import { useI18n } from '@/src/context/I18nContext';
import { useAuth } from '@/src/context/AuthContext';

type UserSection = 'home' | 'subscription';

function getActiveUserSection(search: string): UserSection {
  const params = new URLSearchParams(search);
  return params.get('section') === 'subscription' ? 'subscription' : 'home';
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { t, language } = useI18n();
  const { role, username } = useAuth();
  const userCenterLabel = language === 'zh-CN' ? '用户中心' : 'User Center';
  const overviewLabel = language === 'zh-CN' ? '概览' : 'Overview';
  const subscriptionLabel = language === 'zh-CN' ? '订阅与客户端' : 'Subscription & Clients';
  const activeUserSection = getActiveUserSection(location.search);

  const adminMenuItems = [
    { icon: LayoutDashboard, label: t('nav.dashboard'), path: '/' },
    { icon: Server, label: t('nav.nodes'), path: '/nodes' },
    { icon: ShieldCheck, label: t('nav.inbounds'), path: '/inbounds' },
    { icon: Users, label: userCenterLabel, path: '/users' },
    { icon: BarChart3, label: t('nav.traffic'), path: '/traffic' },
    { icon: Settings, label: t('nav.settings'), path: '/settings' },
  ];

  const userMenuItems = [
    {
      icon: LayoutDashboard,
      label: overviewLabel,
      to: '/my-subscription?section=home',
      active: location.pathname === '/my-subscription' && activeUserSection === 'home',
      testId: 'sidebar-user-overview',
    },
    {
      icon: LinkIcon,
      label: subscriptionLabel,
      to: '/my-subscription?section=subscription',
      active: location.pathname === '/my-subscription' && activeUserSection === 'subscription',
      testId: 'sidebar-user-subscription',
    },
  ];

  const displayName = username ?? t('nav.adminUser');
  const displayEmail = role === 'user' ? '' : t('nav.adminEmail');
  const initials = (displayName || 'P').slice(0, 1).toUpperCase();
  const subtitle =
    role === 'user'
      ? activeUserSection === 'subscription'
        ? subscriptionLabel
        : overviewLabel
      : t('nav.dashboard');

  return (
    <aside className="surface-card flex h-[calc(100vh-2rem)] w-72 flex-col p-4">
      <div className="surface-panel flex items-center gap-3 px-4 py-4">
        <div className="surface-inline flex h-12 w-12 items-center justify-center">
          <img src="/logo.svg" alt="Prism" className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-zinc-50">Prism</p>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
      </div>

      <nav className="mt-5 flex-1 space-y-2 overflow-y-auto">
        {role === 'user'
          ? userMenuItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                data-testid={item.testId}
                className={cn(
                  'flex items-center gap-3 rounded-[20px] px-4 py-3 text-sm font-medium transition-colors',
                  item.active
                    ? 'bg-[var(--surface-strong)] text-zinc-50'
                    : 'text-zinc-400 hover:bg-[var(--surface-panel)] hover:text-zinc-50',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))
          : adminMenuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-[20px] px-4 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[var(--surface-strong)] text-zinc-50'
                      : 'text-zinc-400 hover:bg-[var(--surface-panel)] hover:text-zinc-50',
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
      </nav>

      <div className="soft-divider mt-5 border-t pt-5">
        <NavLink
          to="/profile"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'surface-panel flex items-center gap-3 px-4 py-4 transition-colors',
              isActive && 'border-[color:var(--border-strong)]',
            )
          }
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-emerald-500">
            {initials}
          </div>
          <div className="min-w-0">
            <span
              className="block truncate text-sm font-medium text-zinc-50"
              data-testid="sidebar-user-display-name"
            >
              {displayName}
            </span>
            {displayEmail && (
              <span className="block truncate text-xs text-zinc-500">{displayEmail}</span>
            )}
          </div>
        </NavLink>
      </div>
    </aside>
  );
}
