export type AuthRole = 'admin' | 'user' | null;

const ADMIN_ALLOWED_PATHS = [
  '/',
  '/inbounds',
  '/users',
  '/nodes',
  '/traffic',
  '/subscriptions',
  '/settings',
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
