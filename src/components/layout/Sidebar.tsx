import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  LayoutDashboard,
  LifeBuoy,
  Link as LinkIcon,
  Newspaper,
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
import { resolveUserPortalSection } from '@/src/pages/portal/types';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { t, language } = useI18n();
  const { role, username, displayName, avatarStyle } = useAuth();
  const isZh = language === 'zh-CN';

  const userCenterLabel = isZh ? '用户中心' : 'User Center';
  const overviewLabel = isZh ? '概览' : 'Overview';
  const marketLabel = isZh ? '市场' : 'Markets';
  const newsLabel = isZh ? '资讯' : 'News';
  const setupLabel = isZh ? '使用订阅' : 'Set up';
  const helpLabel = isZh ? '帮助' : 'Help';
  const activeUserSection = resolveUserPortalSection(
    new URLSearchParams(location.search).get('section'),
  ).tab;

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
      label: setupLabel,
      to: '/my-subscription?section=setup',
      active: location.pathname === '/my-subscription' && activeUserSection === 'setup',
      testId: 'sidebar-user-setup',
    },
    {
      icon: TrendingUp,
      label: marketLabel,
      to: '/my-subscription?section=market',
      active: location.pathname === '/my-subscription' && activeUserSection === 'market',
      testId: 'sidebar-user-market',
    },
    {
      icon: Newspaper,
      label: newsLabel,
      to: '/my-subscription?section=news',
      active: location.pathname === '/my-subscription' && activeUserSection === 'news',
      testId: 'sidebar-user-news',
    },
    {
      icon: LifeBuoy,
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
        : activeUserSection === 'news'
          ? newsLabel
          : activeUserSection === 'setup'
            ? setupLabel
            : activeUserSection === 'help'
              ? helpLabel
              : overviewLabel
      : t('nav.dashboard');

  return (
    <aside className="surface-card flex h-[calc(100vh-2rem)] w-72 flex-col gap-5 p-4">
      <div className="surface-panel relative overflow-hidden px-4 py-4">
        <div className="absolute inset-x-6 top-0 h-px bg-white/25" />
        <div className="flex items-center gap-3">
          <div className="surface-inline flex h-12 w-12 items-center justify-center">
            <img src="/logo.svg" alt="Prism" className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-[var(--text-primary)]">Prism</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="px-1">
        <p className="section-kicker">{role === 'user' ? userCenterLabel : t('nav.dashboard')}</p>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto">
        {role === 'user'
          ? userMenuItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                data-testid={item.testId}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 text-sm font-medium',
                  item.active ? 'glass-nav-item-active' : 'glass-nav-item',
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
                    'flex items-center gap-3 px-4 py-3 text-sm font-medium',
                    isActive ? 'glass-nav-item-active' : 'glass-nav-item',
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
      </nav>

      <div className="soft-divider border-t pt-5">
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
              'glass-pill flex h-11 w-11 items-center justify-center text-sm font-semibold',
              role === 'user' ? getAvatarToneClasses(avatarStyle) : 'text-[var(--accent)]',
            )}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <span
              className="block truncate text-sm font-medium text-[var(--text-primary)]"
              data-testid="sidebar-user-display-name"
            >
              {resolvedDisplayName}
            </span>
            {secondaryLabel && (
              <span className="block truncate text-xs text-[var(--text-secondary)]">
                @{secondaryLabel}
              </span>
            )}
          </div>
        </NavLink>
      </div>
    </aside>
  );
}
