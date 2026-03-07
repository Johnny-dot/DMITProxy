import { describe, expect, it } from 'vitest';
import { buildClientUsageIndex } from './xui-admin.js';

describe('buildClientUsageIndex', () => {
  it('indexes client usage by subId', () => {
    const index = buildClientUsageIndex([
      {
        id: 11,
        remark: 'US-West-Reality',
        protocol: 'vless',
        enable: true,
        settings: JSON.stringify({
          clients: [
            {
              subId: 'sub-a',
              email: 'alice@example.com',
              expiryTime: 123,
            },
          ],
        }),
        clientStats: [
          {
            email: 'alice@example.com',
            up: 1024,
            down: 2048,
            total: 4096,
            expiryTime: 456,
            enable: true,
          },
        ],
      },
    ] as any);

    expect(index.get('sub-a')).toEqual({
      inboundId: 11,
      inboundRemark: 'US-West-Reality',
      protocol: 'vless',
      up: 1024,
      down: 2048,
      total: 4096,
      expiryTime: 456,
      enable: true,
    });
  });

  it('ignores clients without subId and keeps the first duplicate mapping', () => {
    const index = buildClientUsageIndex([
      {
        id: 1,
        remark: 'A',
        protocol: 'vless',
        enable: true,
        settings: JSON.stringify({
          clients: [
            { subId: '', email: 'missing@example.com', expiryTime: 1 },
            { subId: 'shared-sub', email: 'first@example.com', expiryTime: 2 },
          ],
        }),
        clientStats: [
          {
            email: 'first@example.com',
            up: 10,
            down: 20,
            total: 30,
            expiryTime: 40,
            enable: true,
          },
        ],
      },
      {
        id: 2,
        remark: 'B',
        protocol: 'trojan',
        enable: true,
        settings: JSON.stringify({
          clients: [{ subId: 'shared-sub', email: 'second@example.com', expiryTime: 3 }],
        }),
        clientStats: [
          {
            email: 'second@example.com',
            up: 100,
            down: 200,
            total: 300,
            expiryTime: 400,
            enable: true,
          },
        ],
      },
    ] as any);

    expect(index.has('')).toBe(false);
    expect(index.get('shared-sub')).toMatchObject({
      inboundId: 1,
      inboundRemark: 'A',
      protocol: 'vless',
      up: 10,
      down: 20,
    });
  });
});
