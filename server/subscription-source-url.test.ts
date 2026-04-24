import { afterEach, describe, expect, it } from 'vitest';

import { buildPublicSubscriptionSourceUrl } from './subscription-source-url.js';

describe('buildPublicSubscriptionSourceUrl', () => {
  const previousSubUrl = process.env.VITE_SUB_URL;
  const previousTemplate = process.env.VITE_SUB_URL_TEMPLATE;

  afterEach(() => {
    if (previousSubUrl === undefined) delete process.env.VITE_SUB_URL;
    else process.env.VITE_SUB_URL = previousSubUrl;

    if (previousTemplate === undefined) delete process.env.VITE_SUB_URL_TEMPLATE;
    else process.env.VITE_SUB_URL_TEMPLATE = previousTemplate;
  });

  it('builds a public universal subscription URL from VITE_SUB_URL', () => {
    process.env.VITE_SUB_URL = 'https://sub.example.com/';
    delete process.env.VITE_SUB_URL_TEMPLATE;

    expect(buildPublicSubscriptionSourceUrl('abc 123')).toBe(
      'https://sub.example.com/sub/abc%20123',
    );
  });

  it('prefers VITE_SUB_URL_TEMPLATE when it contains a subId placeholder', () => {
    process.env.VITE_SUB_URL = 'https://sub.example.com';
    process.env.VITE_SUB_URL_TEMPLATE = 'https://links.example.net/custom/{subId}';

    expect(buildPublicSubscriptionSourceUrl('abc')).toBe('https://links.example.net/custom/abc');
  });

  it('returns null when no public subscription URL is configured', () => {
    delete process.env.VITE_SUB_URL;
    delete process.env.VITE_SUB_URL_TEMPLATE;

    expect(buildPublicSubscriptionSourceUrl('abc')).toBeNull();
  });
});
