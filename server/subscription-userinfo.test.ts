import { describe, expect, it } from 'vitest';

import { buildSubscriptionUserinfoHeader } from './subscription-userinfo.js';
import type { XuiClientUsage } from './xui-admin.js';

function usage(overrides: Partial<XuiClientUsage> = {}): XuiClientUsage {
  return {
    inboundId: 1,
    inboundRemark: 'DMIT-VLESS-Reality',
    protocol: 'vless',
    up: 12,
    down: 34,
    total: 1000,
    expiryTime: 1835740799000,
    enable: true,
    ...overrides,
  };
}

describe('buildSubscriptionUserinfoHeader', () => {
  it('builds the standard subscription-userinfo header from 3X-UI client usage', () => {
    expect(buildSubscriptionUserinfoHeader(usage())).toBe(
      'upload=12; download=34; total=1000; expire=1835740799',
    );
  });

  it('omits expire when 3X-UI reports no expiry', () => {
    expect(buildSubscriptionUserinfoHeader(usage({ expiryTime: 0 }))).toBe(
      'upload=12; download=34; total=1000',
    );
  });

  it('returns null when no usage was found for the subscription id', () => {
    expect(buildSubscriptionUserinfoHeader(null)).toBeNull();
  });
});
