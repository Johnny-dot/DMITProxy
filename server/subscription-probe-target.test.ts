import { describe, expect, it } from 'vitest';
import {
  decodeSubscriptionPayload,
  parseSubscriptionNodes,
  pickProbeEndpointForInbound,
} from './subscription-probe-target.js';

describe('subscription-probe-target', () => {
  it('decodes a base64 subscription payload into node lines', () => {
    const payload = Buffer.from(
      'vless://uuid@example.com:443?security=reality&type=tcp&pbk=pubkey&sid=abcd&sni=example.com#US-West-Reality',
      'utf8',
    ).toString('base64');

    expect(decodeSubscriptionPayload(payload)).toContain('vless://uuid@example.com:443');
  });

  it('parses vless reality nodes from universal subscriptions', () => {
    const nodes = parseSubscriptionNodes(
      'vless://uuid@example.com:443?security=reality&type=tcp&pbk=pubkey&sid=abcd&sni=example.com&fp=chrome#US-West-Reality',
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      protocol: 'vless',
      address: 'example.com',
      port: 443,
      security: 'reality',
      network: 'tcp',
      publicKey: 'pubkey',
      shortId: 'abcd',
      sni: 'example.com',
      name: 'US-West-Reality',
    });
  });

  it('parses vmess links from universal subscriptions', () => {
    const vmessPayload = Buffer.from(
      JSON.stringify({
        v: '2',
        ps: 'JP-VMess',
        add: 'vmess.example.com',
        port: '8443',
        id: '11111111-1111-1111-1111-111111111111',
        aid: '0',
        scy: 'auto',
        net: 'ws',
        host: 'cdn.example.com',
        path: '/ws',
        tls: 'tls',
        sni: 'vmess.example.com',
      }),
      'utf8',
    ).toString('base64');

    const nodes = parseSubscriptionNodes(`vmess://${vmessPayload}`);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      protocol: 'vmess',
      address: 'vmess.example.com',
      port: 8443,
      security: 'tls',
      network: 'ws',
      hostHeader: 'cdn.example.com',
      path: '/ws',
      sni: 'vmess.example.com',
      name: 'JP-VMess',
    });
  });

  it('prefers remark matches when picking a probe endpoint for an inbound', () => {
    const nodes = parseSubscriptionNodes(
      [
        'vless://uuid@a.example.com:443?security=tls&sni=a.example.com#US-West-Reality',
        'vless://uuid@b.example.com:443?security=tls&sni=b.example.com#JP-Tokyo',
      ].join('\n'),
    );

    const selected = pickProbeEndpointForInbound(nodes, {
      remark: 'JP-Tokyo',
      protocol: 'vless',
      port: 443,
    });

    expect(selected?.address).toBe('b.example.com');
  });

  it('returns null when the subscription is ambiguous', () => {
    const nodes = parseSubscriptionNodes(
      [
        'vless://uuid@a.example.com:443?security=tls&sni=a.example.com#SG-One',
        'vless://uuid@b.example.com:443?security=tls&sni=b.example.com#SG-Two',
      ].join('\n'),
    );

    const selected = pickProbeEndpointForInbound(nodes, {
      remark: 'DMIT-VLESS-Reality',
      protocol: 'vless',
      port: 443,
    });

    expect(selected).toBeNull();
  });
});
