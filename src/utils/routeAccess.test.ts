import { describe, expect, it } from 'vitest';
import { resolveProtectedRedirect } from './routeAccess';

describe('resolveProtectedRedirect', () => {
  it('redirects anonymous visitors to the login page', () => {
    expect(resolveProtectedRedirect(false, null, '/settings')).toBe('/login');
  });

  it('redirects regular users away from admin routes', () => {
    expect(resolveProtectedRedirect(true, 'user', '/settings')).toBe('/my-subscription');
    expect(resolveProtectedRedirect(true, 'user', '/users')).toBe('/my-subscription');
    expect(resolveProtectedRedirect(true, 'user', '/')).toBe('/my-subscription');
  });

  it('allows regular users to open their own pages', () => {
    expect(resolveProtectedRedirect(true, 'user', '/my-subscription')).toBeNull();
    expect(resolveProtectedRedirect(true, 'user', '/profile')).toBeNull();
  });

  it('redirects admins away from user-only pages', () => {
    expect(resolveProtectedRedirect(true, 'admin', '/my-subscription')).toBe('/');
  });

  it('allows admins to open admin pages', () => {
    expect(resolveProtectedRedirect(true, 'admin', '/settings')).toBeNull();
    expect(resolveProtectedRedirect(true, 'admin', '/users')).toBeNull();
    expect(resolveProtectedRedirect(true, 'admin', '/profile')).toBeNull();
    expect(resolveProtectedRedirect(true, 'admin', '/')).toBeNull();
  });
});
