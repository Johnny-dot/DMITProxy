import { describe, expect, it } from 'vitest';
import {
  buildLoginRedirect,
  resolvePostLoginPath,
  resolveProtectedRedirect,
  shouldShowSubscriptionLoginHint,
} from './routeAccess';

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

  it('keeps the subscription page as the post-login destination', () => {
    expect(buildLoginRedirect('/my-subscription')).toBe('/login?next=%2Fmy-subscription');
    expect(resolvePostLoginPath('/my-subscription?section=setup', 'user')).toBe(
      '/my-subscription?section=setup',
    );
    expect(resolvePostLoginPath('https://evil.example', 'user')).toBe('/my-subscription');
    expect(shouldShowSubscriptionLoginHint('/my-subscription')).toBe(true);
    expect(shouldShowSubscriptionLoginHint('/profile')).toBe(false);
  });

  it('allows admins to open admin pages', () => {
    expect(resolveProtectedRedirect(true, 'admin', '/settings')).toBeNull();
    expect(resolveProtectedRedirect(true, 'admin', '/users')).toBeNull();
    expect(resolveProtectedRedirect(true, 'admin', '/profile')).toBeNull();
    expect(resolveProtectedRedirect(true, 'admin', '/')).toBeNull();
  });
});
