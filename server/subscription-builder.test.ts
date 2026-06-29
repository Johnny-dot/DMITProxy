import { describe, expect, it } from 'vitest';
import {
  buildDecoratedSubscriptionLinks,
  getExtraSubscriptionLinks,
  normalizeExtraSubscriptionLinks,
  replaceLinkName,
  resolveAddress,
} from './subscription-builder.js';

describe('replaceLinkName', () => {
  it('replaces only the fragment for URI-style protocol links', () => {
    const original = 'vless://uuid@example.com:443?security=reality&type=tcp#Original';
    expect(replaceLinkName(original, '重置日：每月 3 日（UTC）')).toBe(
      'vless://uuid@example.com:443?security=reality&type=tcp#%E9%87%8D%E7%BD%AE%E6%97%A5%EF%BC%9A%E6%AF%8F%E6%9C%88%203%20%E6%97%A5%EF%BC%88UTC%EF%BC%89',
    );
  });

  it('replaces vmess ps without changing connection fields', () => {
    const originalConfig = {
      v: '2',
      ps: 'Original',
      add: 'example.com',
      port: 443,
      id: 'uuid',
    };
    const original = `vmess://${Buffer.from(JSON.stringify(originalConfig)).toString('base64')}`;
    const replaced = replaceLinkName(original, '机器剩余 417.81G');
    const decoded = JSON.parse(Buffer.from(replaced.slice('vmess://'.length), 'base64').toString());
    expect(decoded).toEqual({ ...originalConfig, ps: '机器剩余 417.81G' });
  });
});

describe('buildDecoratedSubscriptionLinks', () => {
  it('appends proxyable clone nodes after the real node with distinct connection params', () => {
    const original = 'vless://uuid@example.com:443?security=reality&type=tcp#DMIT';
    const links = buildDecoratedSubscriptionLinks(original, ['账单重置｜每月 3 日（UTC）']);
    expect(links).toEqual([
      original,
      'vless://uuid@example.com:443?security=reality&type=tcp&prism_info=prism-info-1#%E8%B4%A6%E5%8D%95%E9%87%8D%E7%BD%AE%EF%BD%9C%E6%AF%8F%E6%9C%88%203%20%E6%97%A5%EF%BC%88UTC%EF%BC%89',
    ]);
  });
});

describe('getExtraSubscriptionLinks', () => {
  it('returns public nodes from comma and newline separated env text', () => {
    expect(
      getExtraSubscriptionLinks(`
        vless://first@example.com:443#First
        # disabled comment
        vmess://second, trojan://third@example.com:443#Third
      `),
    ).toEqual([
      'vless://first@example.com:443#First',
      'vmess://second',
      'trojan://third@example.com:443#Third',
    ]);
  });
});

describe('normalizeExtraSubscriptionLinks', () => {
  it('renames shared nodes into a coordinated display format', () => {
    expect(
      normalizeExtraSubscriptionLinks([
        'vless://first@example.com:443#🇯🇵 日本 IEPL 01',
        'trojan://second@example.com:443',
      ]),
    ).toEqual([
      'vless://first@example.com:443#%E5%85%B1%E4%BA%AB%E8%8A%82%E7%82%B9%EF%BD%9C%E6%97%A5%E6%9C%AC%20IEPL%2001',
      'trojan://second@example.com:443#%E5%85%B1%E4%BA%AB%E8%8A%82%E7%82%B9%EF%BD%9C02',
    ]);
  });
});

describe('resolveAddress', () => {
  it('prefers PUBLIC_NODE_HOST over the 3X-UI admin host', () => {
    const previousPublicNodeHost = process.env.PUBLIC_NODE_HOST;
    const previousVitePublicNodeHost = process.env.VITE_PUBLIC_NODE_HOST;
    const previousXuiServer = process.env.VITE_3XUI_SERVER;

    try {
      process.env.PUBLIC_NODE_HOST = 'lax.prismproxy.uk';
      delete process.env.VITE_PUBLIC_NODE_HOST;
      process.env.VITE_3XUI_SERVER = 'https://154.17.12.1:49675';

      expect(resolveAddress({ listen: '', port: 443 } as any)).toBe('lax.prismproxy.uk');
    } finally {
      if (previousPublicNodeHost === undefined) delete process.env.PUBLIC_NODE_HOST;
      else process.env.PUBLIC_NODE_HOST = previousPublicNodeHost;
      if (previousVitePublicNodeHost === undefined) delete process.env.VITE_PUBLIC_NODE_HOST;
      else process.env.VITE_PUBLIC_NODE_HOST = previousVitePublicNodeHost;
      if (previousXuiServer === undefined) delete process.env.VITE_3XUI_SERVER;
      else process.env.VITE_3XUI_SERVER = previousXuiServer;
    }
  });

  it('accepts URL-shaped public node hosts and keeps only the hostname', () => {
    const previousPublicNodeHost = process.env.PUBLIC_NODE_HOST;

    try {
      process.env.PUBLIC_NODE_HOST = 'https://lax.prismproxy.uk:443/reality';

      expect(resolveAddress({ listen: '154.17.12.1', port: 443 } as any)).toBe('lax.prismproxy.uk');
    } finally {
      if (previousPublicNodeHost === undefined) delete process.env.PUBLIC_NODE_HOST;
      else process.env.PUBLIC_NODE_HOST = previousPublicNodeHost;
    }
  });
});
