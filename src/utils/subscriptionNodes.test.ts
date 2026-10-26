import { describe, expect, it } from 'vitest';
import { parseSubscriptionNodeCards } from './subscriptionNodes';

describe('parseSubscriptionNodeCards', () => {
  it('reads a flag, name, and used/limit bar from a production shared-node title', () => {
    const [card] = parseSubscriptionNodeCards(
      'vless://uuid@sg.example.com:443?type=tcp#🇸🇬 新加坡｜已用 120G/8T',
    );
    expect(card).toMatchObject({
      flag: '🇸🇬',
      name: '新加坡',
      usedLabel: '120G',
      limitLabel: '8T',
    });
    expect(card.usedRatio).toBeCloseTo(120 / 8000, 5);
  });

  it('keeps a prefix around a flag and treats a monthly limit as unused', () => {
    const cards = parseSubscriptionNodeCards(
      [
        'vless://uuid@kr.example.com:443#限时🇰🇷 首尔｜已用 26G/3T',
        'vless://uuid@jp.example.com:443#🇯🇵 东京｜2T/月',
      ].join('\n'),
    );
    expect(cards[0]).toMatchObject({
      flag: '🇰🇷',
      name: '限时 首尔',
      usedLabel: '26G',
      limitLabel: '3T',
    });
    expect(cards[1]).toMatchObject({
      flag: '🇯🇵',
      name: '东京',
      usedLabel: null,
      limitLabel: '2T',
      usedRatio: null,
    });
  });

  it('decodes a base64 universal subscription before reading node names', () => {
    const raw = [
      'vless://uuid@sg.example.com:443?type=tcp#🇸🇬 新加坡｜已用 120G/8T',
      'vless://uuid@jp.example.com:443#🇯🇵 东京｜2T/月',
    ].join('\n');
    const wrapped = Buffer.from(raw, 'utf8')
      .toString('base64')
      .replace(/(.{48})/g, '$1\n');
    const cards = parseSubscriptionNodeCards(wrapped);
    expect(cards.map((card) => card.name)).toEqual(['新加坡', '东京']);
    expect(cards[0].usedLabel).toBe('120G');
    expect(cards[0].limitLabel).toBe('8T');
  });

  it('reads a vmess display name from the ps field', () => {
    const payload = Buffer.from(JSON.stringify({ ps: '🇸🇬 新加坡｜已用 120G/8T' }), 'utf8').toString(
      'base64',
    );
    const [card] = parseSubscriptionNodeCards(`vmess://${payload}`);
    expect(card).toMatchObject({ flag: '🇸🇬', name: '新加坡', usedLabel: '120G', limitLabel: '8T' });
  });

  it('never renders account or billing lines as node cards', () => {
    const cards = parseSubscriptionNodeCards(
      [
        'vless://uuid@sg.example.com:443?type=tcp#🇸🇬 新加坡｜已用 120G/8T',
        'vless://uuid@user.example:443#用户｜toki18c',
        'vless://uuid@user.example:443?prism_info=prism-info-1#重置｜每月 3 日',
        'vless://uuid@user.example:443#到期｜2028-03-04',
        'vless://uuid@user.example:443#个人｜↑1 ↓2G',
        'vless://uuid@user.example:443#他人｜↑3 ↓4G',
        'vless://uuid@user.example:443#机器｜剩10/100G',
        'vless://uuid@user.example:443#账单重置｜每月 3 日',
        'vless://uuid@user.example:443#流量｜已用 1G',
      ].join('\n'),
    );
    expect(cards.map((card) => card.name)).toEqual(['新加坡']);
  });
});
