import { describe, expect, it } from 'vitest';
import { getSidebarSubtitle } from './sidebarSubtitle';

describe('getSidebarSubtitle', () => {
  it('uses the profile label on the profile page', () => {
    expect(getSidebarSubtitle('/profile', 'home', true)).toBe('个人资料');
    expect(getSidebarSubtitle('/profile', 'home', false)).toBe('Profile');
  });

  it('follows the user portal section everywhere else', () => {
    expect(getSidebarSubtitle('/my-subscription', 'home', true)).toBe('使用订阅');
    expect(getSidebarSubtitle('/my-subscription', 'setup', true)).toBe('概览');
    expect(getSidebarSubtitle('/my-subscription', 'help', false)).toBe('Help');
  });
});
