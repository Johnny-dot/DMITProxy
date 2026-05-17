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
});
