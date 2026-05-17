import { describe, expect, it } from 'vitest';
import {
  buildDecoratedSubscriptionLinks,
  getExtraSubscriptionLinks,
  buildSubscriptionDecorations,
  replaceLinkName,
} from './subscription-builder.js';

const GB = 1024 ** 3;

describe('replaceLinkName', () => {
  it('replaces only the fragment for URI-style protocol links', () => {
    const original = 'vless://uuid@example.com:443?security=reality&type=tcp#Original';
    expect(replaceLinkName(original, 'UTC 每月 3 日')).toBe(
      'vless://uuid@example.com:443?security=reality&type=tcp#UTC%20%E6%AF%8F%E6%9C%88%203%20%E6%97%A5',
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

describe('buildSubscriptionDecorations', () => {
  it('summarizes reset day, own usage, other usage, and remaining machine traffic', () => {
    const decorations = buildSubscriptionDecorations({
      resetDay: 3,
      ownUsed: 189.68 * GB,
      allClientUsed: 582.19 * GB,
      machineTotal: 1000 * GB,
    });

    expect(decorations).toEqual([
      '重置日期 | UTC 每月 3 日',
      '你已用 189.68G | 其他人 392.51G',
      '机器剩余 417.81G | 已用 582.19G/1000.00G',
    ]);
  });
});

describe('buildDecoratedSubscriptionLinks', () => {
  it('appends proxyable clone nodes after the real node', () => {
    const original = 'vless://uuid@example.com:443?security=reality&type=tcp#DMIT';
    const links = buildDecoratedSubscriptionLinks(original, ['重置日期 | UTC 每月 3 日']);
    expect(links).toEqual([
      original,
      'vless://uuid@example.com:443?security=reality&type=tcp#%E9%87%8D%E7%BD%AE%E6%97%A5%E6%9C%9F%20%7C%20UTC%20%E6%AF%8F%E6%9C%88%203%20%E6%97%A5',
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
