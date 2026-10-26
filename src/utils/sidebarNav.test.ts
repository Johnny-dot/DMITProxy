import { describe, expect, it } from 'vitest';
import { resolveSidebarNav } from './sidebarNav';

describe('resolveSidebarNav', () => {
  it('treats the subscription home as 概览', () => {
    expect(resolveSidebarNav('/my-subscription', '')).toBe('user-overview');
    expect(resolveSidebarNav('/my-subscription', '?section=home')).toBe('user-overview');
    expect(resolveSidebarNav('/my-subscription/', '')).toBe('user-overview');
  });

  it('keeps the other user pages on their own rows', () => {
    expect(resolveSidebarNav('/my-subscription', '?section=setup')).toBe('user-subscription');
    expect(resolveSidebarNav('/my-subscription', '?section=clients')).toBe('user-subscription');
    expect(resolveSidebarNav('/my-subscription', '?section=subscription')).toBe(
      'user-subscription',
    );
    expect(resolveSidebarNav('/my-subscription', '?section=help')).toBe('user-help');
    expect(resolveSidebarNav('/my-subscription', '?section=community')).toBe('user-help');
    expect(resolveSidebarNav('/my-subscription', '?section=support')).toBe('user-help');
    expect(resolveSidebarNav('/profile', '')).toBeNull();
  });

  it('matches each admin route to one item and does not fall through to the dashboard', () => {
    expect(resolveSidebarNav('/', '')).toBe('admin-dashboard');
    expect(resolveSidebarNav('/nodes', '')).toBe('admin-nodes');
    expect(resolveSidebarNav('/inbounds', '')).toBe('admin-inbounds');
    expect(resolveSidebarNav('/users', '')).toBe('admin-users');
    expect(resolveSidebarNav('/traffic', '')).toBe('admin-traffic');
    expect(resolveSidebarNav('/admin/dmit-sync', '')).toBe('admin-dmit');
    expect(resolveSidebarNav('/settings', '')).toBe('admin-settings');
    expect(resolveSidebarNav('/settings/', '')).toBe('admin-settings');
    expect(resolveSidebarNav('/nodes/edge-1', '')).toBe('admin-nodes');
    expect(resolveSidebarNav('/admin/dmit-sync/history', '')).toBe('admin-dmit');
    expect(resolveSidebarNav('/subscriptions', '')).toBeNull();
    expect(resolveSidebarNav('/profile', '?from=admin')).toBeNull();
    expect(resolveSidebarNav('/unknown', '')).toBeNull();
  });
});
