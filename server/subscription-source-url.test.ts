import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.fn();

vi.mock('./db.js', () => ({
  db: {
    prepare: vi.fn(() => ({
      get: getMock,
    })),
  },
}));

import { buildPublicSubscriptionSourceUrl } from './subscription-source-url.js';

describe('buildPublicSubscriptionSourceUrl', () => {
  const previousSubUrl = process.env.VITE_SUB_URL;
  const previousTemplate = process.env.VITE_SUB_URL_TEMPLATE;

  beforeEach(() => {
    getMock.mockReset();
    getMock.mockReturnValue(undefined);
  });

  afterEach(() => {
    if (previousSubUrl === undefined) delete process.env.VITE_SUB_URL;
    else process.env.VITE_SUB_URL = previousSubUrl;

    if (previousTemplate === undefined) delete process.env.VITE_SUB_URL_TEMPLATE;
    else process.env.VITE_SUB_URL_TEMPLATE = previousTemplate;
  });

  it('prefers the publicUrl stored in app settings', () => {
    getMock.mockReturnValue({ value: 'https://prismproxy.uk' });
    process.env.VITE_SUB_URL = 'https://sub.example.com/';
    process.env.VITE_SUB_URL_TEMPLATE = 'https://links.example.net/custom/{subId}';

    expect(buildPublicSubscriptionSourceUrl('abc 123')).toBe('https://prismproxy.uk/sub/abc%20123');
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
