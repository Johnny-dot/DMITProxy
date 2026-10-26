export type AuthRole = 'admin' | 'user' | null;

const ADMIN_ALLOWED_PATHS = [
  '/',
  '/inbounds',
  '/users',
  '/nodes',
  '/traffic',
  '/subscriptions',
  '/settings',
  '/admin/dmit-sync',
  '/profile',
];
const USER_ALLOWED_PATHS = ['/my-subscription', '/profile'];

function matchesPath(pathname: string, allowedPath: string) {
  if (allowedPath === '/') {
    return pathname === '/';
  }

  return pathname === allowedPath || pathname.startsWith(`${allowedPath}/`);
}

export function resolveProtectedRedirect(
  isAuthenticated: boolean,
  role: AuthRole,
  pathname: string,
) {
  if (!isAuthenticated) {
    return '/login';
  }

  if (role === 'user') {
    const isAllowed = USER_ALLOWED_PATHS.some((allowedPath) => matchesPath(pathname, allowedPath));
    return isAllowed ? null : '/my-subscription';
  }

  if (role === 'admin') {
    const isAllowed = ADMIN_ALLOWED_PATHS.some((allowedPath) => matchesPath(pathname, allowedPath));
    return isAllowed ? null : '/';
  }

  return '/login';
}

export function isSafeNextPath(value: string): boolean {
  return (
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !value.includes('://')
  );
}

export function buildLoginRedirect(nextPath: string): string {
  if (!isSafeNextPath(nextPath) || nextPath === '/login') return '/login';
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export function resolvePostLoginPath(next: string | null, role: Exclude<AuthRole, null>): string {
  const fallback = role === 'user' ? '/my-subscription' : '/';
  if (!next || !isSafeNextPath(next)) return fallback;

  const url = new URL(next, 'http://prism.local');
  const path = url.pathname;
  if (path === '/login' || path === '/register' || path === '/reset-password') return fallback;

  if (role === 'user') {
    if (path === '/my-subscription' || path === '/profile') return `${path}${url.search}`;
    return fallback;
  }

  if (path === '/my-subscription') return '/';
  return `${path}${url.search}`;
}

export function shouldShowSubscriptionLoginHint(next: string | null): boolean {
  if (!next || !isSafeNextPath(next)) return false;
  return new URL(next, 'http://prism.local').pathname === '/my-subscription';
}
