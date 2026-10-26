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

const LOCAL_ORIGIN = 'http://prism.local';

export function isSafeNextPath(value: string): boolean {
  return (
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\') &&
    !value.includes('\\') &&
    !value.includes('://')
  );
}

function decodedPathname(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

/** Parse `next` against this app and reject protocol-relative or off-origin results. */
function normalizedNextUrl(next: string): URL | null {
  if (!isSafeNextPath(next)) return null;

  let url: URL;
  try {
    url = new URL(next, LOCAL_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== LOCAL_ORIGIN) return null;

  const path = url.pathname;
  const decoded = decodedPathname(path);
  if (!decoded || !isSafeNextPath(decoded) || !isSafeNextPath(path)) return null;

  return url;
}

export function buildLoginRedirect(nextPath: string): string {
  const url = normalizedNextUrl(nextPath);
  if (!url || url.pathname === '/login') return '/login';
  return `/login?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`;
}

export function resolvePostLoginPath(next: string | null, role: Exclude<AuthRole, null>): string {
  const fallback = role === 'user' ? '/my-subscription' : '/';
  if (!next) return fallback;

  const url = normalizedNextUrl(next);
  if (!url) return fallback;

  const path = url.pathname;
  if (path === '/login' || path === '/register' || path === '/reset-password') return fallback;

  if (role === 'admin' && matchesPath(path, '/my-subscription')) return '/';

  const allowed = role === 'user' ? USER_ALLOWED_PATHS : ADMIN_ALLOWED_PATHS;
  if (!allowed.some((allowedPath) => matchesPath(path, allowedPath))) return fallback;

  const target = `${path}${url.search}`;
  if (!isSafeNextPath(target)) return fallback;
  return target;
}

export function shouldShowSubscriptionLoginHint(next: string | null): boolean {
  if (!next) return false;
  const url = normalizedNextUrl(next);
  return url?.pathname === '/my-subscription';
}
