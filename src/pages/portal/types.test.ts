import { describe, expect, it } from 'vitest';
import { getUserPortalSectionParam, resolveUserPortalSection } from './types';

describe('portal section helpers', () => {
  it('maps the help tab to its own section parameter', () => {
    expect(getUserPortalSectionParam('help')).toBe('help');
  });

  it('maps the news tab to its own section parameter', () => {
    expect(getUserPortalSectionParam('news')).toBe('news');
  });

  it('resolves help routes to the dedicated help tab', () => {
    expect(resolveUserPortalSection('help')).toEqual({
      tab: 'help',
      setupFocus: 'overview',
    });
    expect(resolveUserPortalSection('support')).toEqual({
      tab: 'help',
      setupFocus: 'overview',
    });
    expect(resolveUserPortalSection('community')).toEqual({
      tab: 'help',
      setupFocus: 'overview',
    });
  });

  it('keeps setup download deep links working', () => {
    expect(resolveUserPortalSection('clients')).toEqual({
      tab: 'setup',
      setupFocus: 'downloads',
    });
  });

  it('resolves the dedicated news route to the news tab', () => {
    expect(resolveUserPortalSection('news')).toEqual({
      tab: 'news',
      setupFocus: 'overview',
    });
  });
});
