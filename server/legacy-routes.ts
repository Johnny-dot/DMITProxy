export function legacyPortalRedirectPath(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/guides') return '/my-subscription?section=setup';
  if (normalized === '/community') return '/my-subscription?section=help';
  return null;
}
