import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  CircleHelp,
  Download,
  LayoutDashboard,
  Link as LinkIcon,
  Server,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { cn } from '@/src/utils/cn';
import { useI18n } from '@/src/context/I18nContext';
import { useAuth } from '@/src/context/AuthContext';
import { getAvatarInitials, getAvatarToneClasses } from '@/src/utils/userProfile';

type UserSection = 'home' | 'market' | 'subscription' | 'clients' | 'community' | 'help';

function getActiveUserSection(search: string): UserSection {
  const params = new URLSearchParams(search);
  const section = params.get('section');

  if (
    section === 'market' ||
    section === 'subscription' ||
    section === 'clients' ||
    section === 'community' ||
    section === 'help'
  ) {
    return section;
  }

  return 'home';
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { t, language } = useI18n();
  const { role, username, displayName, avatarStyle } = useAuth();
  const isZh = language === 'zh-CN';

  const userCenterLabel = isZh ? '用户中心' : 'User Center';
  const overviewLabel = isZh ? '概览' : 'Overview';
  const marketLabel = isZh ? '资讯' : 'Markets';
  const subscriptionLabel = isZh ? '订阅' : 'Subscription';
  const clientsLabel = isZh ? '客户端' : 'Clients';
  const communityLabel = isZh ? '社区' : 'Community';
  const helpLabel = isZh ? '帮助' : 'Help';
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
      icon: TrendingUp,
      label: marketLabel,
      to: '/my-subscription?section=market',
      active: location.pathname === '/my-subscription' && activeUserSection === 'market',
      testId: 'sidebar-user-market',
    },
    {
      icon: LinkIcon,
      label: subscriptionLabel,
      to: '/my-subscription?section=subscription',
      active: location.pathname === '/my-subscription' && activeUserSection === 'subscription',
      testId: 'sidebar-user-subscription',
    },
    {
      icon: Download,
      label: clientsLabel,
      to: '/my-subscription?section=clients',
      active: location.pathname === '/my-subscription' && activeUserSection === 'clients',
      testId: 'sidebar-user-clients',
    },
    {
      icon: Users,
      label: communityLabel,
      to: '/my-subscription?section=community',
      active: location.pathname === '/my-subscription' && activeUserSection === 'community',
      testId: 'sidebar-user-community',
    },
    {
      icon: CircleHelp,
      label: helpLabel,
      to: '/my-subscription?section=help',
      active: location.pathname === '/my-subscription' && activeUserSection === 'help',
      testId: 'sidebar-user-help',
    },
  ];

  const resolvedDisplayName = displayName ?? username ?? 'Prism';
  const initials = getAvatarInitials(resolvedDisplayName);
  const secondaryLabel =
    role === 'user' && username && username !== resolvedDisplayName ? username : '';
  const subtitle =
    role === 'user'
      ? activeUserSection === 'market'
        ? marketLabel
        : activeUserSection === 'subscription'
          ? subscriptionLabel
          : activeUserSection === 'clients'
            ? clientsLabel
            : activeUserSection === 'community'
              ? communityLabel
              : activeUserSection === 'help'
                ? helpLabel
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
          <div
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full border text-sm font-semibold',
              role === 'user'
                ? getAvatarToneClasses(avatarStyle)
                : 'border-[var(--border-subtle)] bg-[var(--accent-soft)] text-emerald-500',
            )}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <span
              className="block truncate text-sm font-medium text-zinc-50"
              data-testid="sidebar-user-display-name"
            >
              {resolvedDisplayName}
            </span>
            {secondaryLabel && (
              <span className="block truncate text-xs text-zinc-500">@{secondaryLabel}</span>
            )}
          </div>
        </NavLink>
      </div>
    </aside>
  );
}
