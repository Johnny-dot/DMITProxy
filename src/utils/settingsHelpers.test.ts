import { describe, expect, it } from 'vitest';

import { buildSubscriptionNodePreviewEntries, parseSubscriptionNodeLinks } from './settingsHelpers';

describe('parseSubscriptionNodeLinks', () => {
  it('filters empty lines and comments', () => {
    expect(
      parseSubscriptionNodeLinks(`
        vless://node-1

        # keep this out
        trojan://node-2
      `),
    ).toEqual(['vless://node-1', 'trojan://node-2']);
  });
});

describe('buildSubscriptionNodePreviewEntries', () => {
  it('normalizes node names and extracts protocol details', () => {
    const entries = buildSubscriptionNodePreviewEntries(
      'vless://uuid@example.com:443?type=tcp#🇺🇸 SG-Netflix-Test',
    );

    expect(entries).toEqual([
      {
        raw: 'vless://uuid@example.com:443?type=tcp#🇺🇸 SG-Netflix-Test',
        name: '共享节点｜SG-Netflix-Test',
        protocol: 'VLESS',
        target: 'example.com:443',
      },
    ]);
  });

  it('falls back to indexed names and supports vmess previews', () => {
    const encoded = Buffer.from(
      JSON.stringify({
        ps: '',
        add: 'edge.example.com',
        port: '8443',
      }),
      'utf8',
    ).toString('base64');

    const entries = buildSubscriptionNodePreviewEntries(`vmess://${encoded}`);

    expect(entries).toEqual([
      {
        raw: `vmess://${encoded}`,
        name: '共享节点｜01',
        protocol: 'VMESS',
        target: 'edge.example.com:8443',
      },
    ]);
  });
});
