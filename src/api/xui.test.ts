import { describe, expect, it } from 'vitest';
import type { Inbound } from './xui';
import { buildInboundUpdateForm } from './xui';

describe('xui inbound update helpers', () => {
  it('builds a form payload that preserves inbound config while changing traffic reset', () => {
    const inbound: Inbound = {
      id: 7,
      remark: 'LAX-REALITY',
      protocol: 'vless',
      port: 443,
      listen: '',
      enable: true,
      up: 10,
      down: 20,
      total: 1024,
      expiryTime: 0,
      trafficReset: 'never',
      lastTrafficResetTime: 123,
      clientStats: [],
      settings: '{"clients":[]}',
      streamSettings: '{"network":"tcp"}',
      sniffing: '{"enabled":false}',
    };

    expect(buildInboundUpdateForm(inbound, { trafficReset: 'monthly' })).toEqual({
      up: '10',
      down: '20',
      total: '1024',
      remark: 'LAX-REALITY',
      enable: 'true',
      expiryTime: '0',
      trafficReset: 'monthly',
      lastTrafficResetTime: '123',
      listen: '',
      port: '443',
      protocol: 'vless',
      settings: '{"clients":[]}',
      streamSettings: '{"network":"tcp"}',
      sniffing: '{"enabled":false}',
    });
  });
});
