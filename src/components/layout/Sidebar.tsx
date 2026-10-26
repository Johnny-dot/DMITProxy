import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  LayoutDashboard,
  LifeBuoy,
  Link as LinkIcon,
  Satellite,
  Server,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { LanguageToggle } from '../ui/LanguageToggle';
import { cn } from '@/src/utils/cn';
import { useI18n } from '@/src/context/I18nContext';
import { useAuth } from '@/src/context/AuthContext';
import { getAvatarInitials, getAvatarToneClasses } from '@/src/utils/userProfile';
import { resolveUserPortalSection } from '@/src/pages/portal/types';
import { resolveSidebarNav, type SidebarNavId } from '@/src/utils/sidebarNav';
import { getSidebarSubtitle } from '@/src/utils/sidebarSubtitle';

export function Sidebar({
  onNavigate,
  onClose,
}: {
  onNavigate?: () => void;
  /** Show a close X button at the top-right (mobile drawer mode). */
  onClose?: () => void;
}) {
  const location = useLocation();
  const { t, language } = useI18n();
  const { role, username, displayName, avatarStyle } = useAuth();
  const isZh = language === 'zh-CN';

  const userCenterLabel = isZh ? '用户中心' : 'User Center';
  const overviewLabel = isZh ? '概览' : 'Overview';
  const setupLabel = isZh ? '使用订阅' : 'Set up';
  const helpLabel = isZh ? '帮助' : 'Help';
  const activeUserSection = resolveUserPortalSection(
    new URLSearchParams(location.search).get('section'),
  ).tab;
  const activeNav = resolveSidebarNav(location.pathname, location.search);

  const adminMenuItems: Array<{
    id: SidebarNavId;
    icon: typeof LayoutDashboard;
    label: string;
    to: string;
    testId: string;
  }> = [
    {
      id: 'admin-dashboard',
      icon: LayoutDashboard,
      label: t('nav.dashboard'),
      to: '/',
      testId: 'sidebar-admin-dashboard',
    },
    {
      id: 'admin-nodes',
      icon: Server,
      label: t('nav.nodes'),
      to: '/nodes',
      testId: 'sidebar-admin-nodes',
    },
    {
      id: 'admin-inbounds',
      icon: ShieldCheck,
      label: t('nav.inbounds'),
      to: '/inbounds',
      testId: 'sidebar-admin-inbounds',
    },
    {
      id: 'admin-users',
      icon: Users,
      label: userCenterLabel,
      to: '/users',
      testId: 'sidebar-admin-users',
    },
    {
      id: 'admin-traffic',
      icon: BarChart3,
      label: t('nav.traffic'),
      to: '/traffic',
      testId: 'sidebar-admin-traffic',
    },
    {
      id: 'admin-dmit',
      icon: Satellite,
      label: isZh ? 'DMIT 同步' : 'DMIT Sync',
      to: '/admin/dmit-sync',
      testId: 'sidebar-admin-dmit',
    },
    {
      id: 'admin-settings',
      icon: Settings,
      label: t('nav.settings'),
      to: '/settings',
      testId: 'sidebar-admin-settings',
    },
  ];

  const userMenuItems: Array<{
    id: SidebarNavId;
    icon: typeof LayoutDashboard;
    label: string;
    to: string;
    testId: string;
  }> = [
    {
      id: 'user-overview',
      icon: LayoutDashboard,
      label: overviewLabel,
      to: '/my-subscription?section=setup',
      testId: 'sidebar-user-overview',
    },
    {
      id: 'user-subscription',
      icon: LinkIcon,
      label: setupLabel,
      to: '/my-subscription?section=home',
      testId: 'sidebar-user-setup',
    },
    {
      id: 'user-help',
      icon: LifeBuoy,
      label: helpLabel,
      to: '/my-subscription?section=help',
      testId: 'sidebar-user-help',
    },
  ];

  const resolvedDisplayName = displayName ?? username ?? 'Prism';
  const initials = getAvatarInitials(resolvedDisplayName);
  const secondaryLabel =
    role === 'user' && username && username !== resolvedDisplayName ? username : '';
  const subtitle =
    role === 'user'
      ? getSidebarSubtitle(location.pathname, activeUserSection, isZh)
      : location.pathname === '/profile'
        ? isZh
          ? '个人资料'
          : 'Profile'
        : t('nav.dashboard');

  return (
    <aside className="user-sidebar surface-card w-full md:w-64">
      <div className="relative overflow-hidden px-3 py-4">
        <div className="absolute inset-x-6 top-0 h-px bg-white/25" />
        <div className="flex items-center gap-3">
          <div className="surface-inline flex h-12 w-12 items-center justify-center">
            <img src="/logo.svg" alt="Prism" className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-[var(--text-primary)]">Prism</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]" data-testid="sidebar-subtitle">
              {subtitle}
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={isZh ? '关闭菜单' : 'Close menu'}
              className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-panel)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="px-1">
        <p className="section-kicker">{role === 'user' ? userCenterLabel : t('nav.dashboard')}</p>
      </div>

      <nav
        aria-label={isZh ? '主导航' : 'Main navigation'}
        className="flex-1 space-y-1.5 overflow-y-auto"
      >
        {(role === 'user' ? userMenuItems : adminMenuItems).map((item) => {
          const active = activeNav === item.id;
          return (
            <Link
              key={item.id}
              to={item.to}
              onClick={onNavigate}
              data-testid={item.testId}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-4 py-3 text-sm font-medium',
                active ? 'glass-nav-item-active' : 'glass-nav-item',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {onClose ? (
        <div className="user-drawer-tools items-center gap-2 px-1">
          <LanguageToggle compact testIdPrefix="drawer-language" />
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--border-subtle)] text-[var(--text-secondary)]"
            aria-label={t('notifications.title')}
            onClick={() => {
              window.dispatchEvent(new Event('prism:open-notifications'));
              onClose();
            }}
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="user-sidebar-account">
        <NavLink
          to="/profile"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-3 transition-colors',
              isActive && 'text-[var(--text-primary)]',
            )
          }
        >
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] text-sm font-semibold',
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
