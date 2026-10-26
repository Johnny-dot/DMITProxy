import { resolveUserPortalSection } from '@/src/utils/userPortalSection';

export type SidebarNavId =
  | 'user-overview'
  | 'user-subscription'
  | 'user-help'
  | 'admin-dashboard'
  | 'admin-nodes'
  | 'admin-inbounds'
  | 'admin-users'
  | 'admin-traffic'
  | 'admin-dmit'
  | 'admin-settings';

const ADMIN_ROUTES: Array<{ id: SidebarNavId; path: string }> = [
  { id: 'admin-dmit', path: '/admin/dmit-sync' },
  { id: 'admin-inbounds', path: '/inbounds' },
  { id: 'admin-nodes', path: '/nodes' },
  { id: 'admin-users', path: '/users' },
  { id: 'admin-traffic', path: '/traffic' },
  { id: 'admin-settings', path: '/settings' },
];

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname || '/';
}

/**
 * One sidebar row per route.
 * `/my-subscription` is the home page, so it belongs to 概览.
 * The client guide (`section=setup`) is 使用订阅.
 */
export function resolveSidebarNav(pathname: string, search = ''): SidebarNavId | null {
  const path = normalizePath(pathname);
  if (path === '/profile' || path === '/subscriptions') return null;

  if (path === '/my-subscription') {
    const query = search.startsWith('?') ? search.slice(1) : search;
    const tab = resolveUserPortalSection(new URLSearchParams(query).get('section')).tab;
    if (tab === 'help') return 'user-help';
    if (tab === 'setup') return 'user-subscription';
    return 'user-overview';
  }

  for (const route of ADMIN_ROUTES) {
    if (path === route.path || path.startsWith(`${route.path}/`)) return route.id;
  }
  if (path === '/') return 'admin-dashboard';
  return null;
}
