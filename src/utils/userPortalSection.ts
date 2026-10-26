export type UserPortalTab = 'home' | 'setup' | 'help';
export type SetupFocus = 'overview' | 'downloads';

export function resolveUserPortalSection(value: string | null): {
  tab: UserPortalTab;
  setupFocus: SetupFocus;
} {
  if (value === 'community') return { tab: 'help', setupFocus: 'overview' };
  if (value === 'clients') return { tab: 'setup', setupFocus: 'downloads' };
  if (value === 'help' || value === 'support') return { tab: 'help', setupFocus: 'overview' };
  if (value === 'setup' || value === 'subscription') {
    return { tab: 'setup', setupFocus: 'overview' };
  }

  return { tab: 'home', setupFocus: 'overview' };
}
