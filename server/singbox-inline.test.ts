import { describe, expect, it } from 'vitest';

import { renderSingboxInlineSubscription } from './singbox-inline.js';

describe('renderSingboxInlineSubscription', () => {
  it('renders VLESS Reality links as sing-box selector outbounds', () => {
    const json = renderSingboxInlineSubscription(
      'vless://00000000-0000-4000-8000-000000000000@example.com:443?security=reality&sni=www.example.com&fp=chrome&pbk=public-key&sid=abcd&type=tcp&flow=xtls-rprx-vision#User',
    );
    const config = JSON.parse(json);

    expect(config.outbounds[0]).toEqual({
      type: 'selector',
      tag: 'PROXY',
      outbounds: ['User'],
    });
    expect(config.outbounds[1]).toMatchObject({
      type: 'vless',
      tag: 'User',
      server: 'example.com',
      server_port: 443,
      uuid: '00000000-0000-4000-8000-000000000000',
      flow: 'xtls-rprx-vision',
      tls: {
        enabled: true,
        server_name: 'www.example.com',
        utls: {
          enabled: true,
          fingerprint: 'chrome',
        },
        reality: {
          enabled: true,
          public_key: 'public-key',
          short_id: 'abcd',
        },
      },
    });
    expect(config.route.final).toBe('PROXY');
  });

  it('renders legacy base64-wrapped VLESS links with the decoded endpoint', () => {
    const encodedAuthority = Buffer.from(
      'none:adf8362f-f4cc-40b7-bf6c-3d326617ae74@168.138.179.100:2096',
    ).toString('base64url');
    const json = renderSingboxInlineSubscription(
      `vless://${encodedAuthority}?tls=1&peer=www.netflix.com&xtls=2&pbk=public-key&sid=short-id#Shared`,
    );
    const config = JSON.parse(json);

    expect(config.outbounds[1]).toMatchObject({
      type: 'vless',
      tag: 'Shared',
      server: '168.138.179.100',
      server_port: 2096,
      uuid: 'adf8362f-f4cc-40b7-bf6c-3d326617ae74',
      flow: 'xtls-rprx-vision',
      tls: {
        enabled: true,
        server_name: 'www.netflix.com',
        reality: {
          enabled: true,
          public_key: 'public-key',
          short_id: 'short-id',
        },
      },
    });
  });
});
