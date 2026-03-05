import { describe, expect, it, vi } from 'vitest';
import type { Inbound } from '../api/client';
import { flattenInboundClients, formatTraffic, getClientStatus } from './xuiClients';

describe('xuiClients helpers', () => {
  it('flattens client settings and stats into one row', () => {
    const inbounds: Inbound[] = [
      {
        id: 1,
        remark: 'test-inbound',
        protocol: 'vless',
        port: 443,
        enable: true,
        up: 0,
        down: 0,
        total: 0,
        expiryTime: 0,
        settings: JSON.stringify({
          clients: [
            {
              id: 'uuid-1',
              email: 'alice@example.com',
              enable: true,
              expiryTime: 1767225600000,
              totalGB: 20,
              subId: 'sub-1',
            },
          ],
        }),
        clientStats: [
          {
            id: 'uuid-1',
            email: 'alice@example.com',
            enable: true,
            expiryTime: 1767225600000,
            totalGB: 20,
            subId: 'sub-1',
            up: 1024,
            down: 2048,
          },
        ],
      },
    ];

    const rows = flattenInboundClients(inbounds);
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe('alice@example.com');
    expect(rows[0].up).toBe(1024);
    expect(rows[0].down).toBe(2048);
  });

  it('returns expired status when expiry is in the past', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const status = getClientStatus({
      key: '1:test',
      inboundId: 1,
      inboundRemark: 'test',
      protocol: 'vless',
      port: 443,
      username: 'alice',
      uuid: 'uuid-1',
      subId: 'sub-1',
      enable: true,
      expiryTime: 1704067200000,
      totalGB: 10,
      up: 0,
      down: 0,
      deviceLimit: 0,
    });

    expect(status).toBe('expired');
    vi.useRealTimers();
  });

  it('formats traffic in readable units', () => {
    expect(formatTraffic(0)).toBe('0 B');
    expect(formatTraffic(1024)).toBe('1.0 KB');
    expect(formatTraffic(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});
