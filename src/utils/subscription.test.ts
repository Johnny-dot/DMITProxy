import { afterEach, describe, expect, it, vi } from 'vitest';

const originalWindow = globalThis.window;

describe('buildSubscriptionUrl', () => {
  afterEach(() => {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
      });
      return;
    }

    Reflect.deleteProperty(globalThis, 'window');
  });

  it('routes every user-facing subscription format through Prism /sub URLs', async () => {
    Object.defineProperty(globalThis, 'window', {
      value: { location: { origin: 'https://portal.example.com' } },
      configurable: true,
    });

    vi.resetModules();
    const { buildSubscriptionUrl } = await import('./subscription');

    expect(buildSubscriptionUrl('abc123', 'universal')).toBe(
      'https://portal.example.com/sub/abc123',
    );
    expect(buildSubscriptionUrl('abc123', 'clash')).toBe(
      'https://portal.example.com/sub/abc123?flag=clash',
    );
    expect(buildSubscriptionUrl('abc123', 'v2ray')).toBe(
      'https://portal.example.com/sub/abc123?flag=v2ray',
    );
    expect(buildSubscriptionUrl('abc123', 'singbox')).toBe(
      'https://portal.example.com/sub/abc123?flag=sing-box',
    );
    expect(buildSubscriptionUrl('abc123', 'surge')).toBe(
      'https://portal.example.com/sub/abc123?flag=surge',
    );
  });

  it('ignores VITE_SUB_URL settings for user-facing links and uses the current site origin', async () => {
    Object.defineProperty(globalThis, 'window', {
      value: { location: { origin: 'https://prismproxy.uk' } },
      configurable: true,
    });

    vi.stubEnv('VITE_SUB_URL', 'http://154.17.12.1:2096');
    vi.stubEnv('VITE_SUB_URL_TEMPLATE', 'http://154.17.12.1:2096/a7k2xmp9qw3z/{subId}');
    vi.resetModules();

    const { buildSubscriptionUrl } = await import('./subscription');

    expect(buildSubscriptionUrl('41b215b8b2f90467', 'universal')).toBe(
      'https://prismproxy.uk/sub/41b215b8b2f90467',
    );
    expect(buildSubscriptionUrl('41b215b8b2f90467', 'v2ray')).toBe(
      'https://prismproxy.uk/sub/41b215b8b2f90467?flag=v2ray',
    );
  });
});
