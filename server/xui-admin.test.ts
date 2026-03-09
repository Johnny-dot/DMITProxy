import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  buildClientUsageIndex,
  safeNonNegativeInt,
  normalizeSetCookie,
  getCookieHeader,
  createUniqueEmail,
  parseInboundClients,
  buildClientPayload,
  pickInboundForAutoProvision,
  toClientUsage,
} from './xui-admin.js';
import type { XuiInbound, XuiClientStat } from './xui-admin.js';

// ---------------------------------------------------------------------------
// safeNonNegativeInt
// ---------------------------------------------------------------------------
describe('safeNonNegativeInt', () => {
  it('returns the integer for a positive integer', () => {
    expect(safeNonNegativeInt(42)).toBe(42);
  });

  it('truncates a positive float', () => {
    expect(safeNonNegativeInt(3.9)).toBe(3);
  });

  it('returns 0 for zero', () => {
    expect(safeNonNegativeInt(0)).toBe(0);
  });

  it('returns fallback for a negative number', () => {
    expect(safeNonNegativeInt(-1)).toBe(0);
    expect(safeNonNegativeInt(-100, 99)).toBe(99);
  });

  it('returns fallback for NaN', () => {
    expect(safeNonNegativeInt(NaN)).toBe(0);
  });

  it('returns fallback for Infinity', () => {
    expect(safeNonNegativeInt(Infinity)).toBe(0);
  });

  it('coerces a numeric string', () => {
    expect(safeNonNegativeInt('10')).toBe(10);
  });

  it('returns fallback for a non-numeric string', () => {
    expect(safeNonNegativeInt('abc')).toBe(0);
  });

  it('returns fallback for null/undefined', () => {
    expect(safeNonNegativeInt(null)).toBe(0);
    expect(safeNonNegativeInt(undefined)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeSetCookie
// ---------------------------------------------------------------------------
describe('normalizeSetCookie', () => {
  it('returns [] for undefined', () => {
    expect(normalizeSetCookie(undefined)).toEqual([]);
  });

  it('wraps a single string in an array', () => {
    expect(normalizeSetCookie('session=abc; Path=/')).toEqual(['session=abc; Path=/']);
  });

  it('passes through an array unchanged', () => {
    const input = ['a=1; Path=/', 'b=2; HttpOnly'];
    expect(normalizeSetCookie(input)).toEqual(input);
  });
});

// ---------------------------------------------------------------------------
// getCookieHeader
// ---------------------------------------------------------------------------
describe('getCookieHeader', () => {
  it('extracts the name=value portion from a single Set-Cookie', () => {
    expect(getCookieHeader(['session=abc123; Path=/; HttpOnly'])).toBe('session=abc123');
  });

  it('joins multiple cookies with "; "', () => {
    expect(getCookieHeader(['a=1; Path=/', 'b=2; HttpOnly'])).toBe('a=1; b=2');
  });

  it('returns an empty string for an empty array', () => {
    expect(getCookieHeader([])).toBe('');
  });
});

// ---------------------------------------------------------------------------
// createUniqueEmail
// ---------------------------------------------------------------------------
describe('createUniqueEmail', () => {
  it('returns the username when there is no conflict', () => {
    expect(createUniqueEmail('alice', new Set())).toBe('alice');
  });

  it('appends _1 on a first collision', () => {
    expect(createUniqueEmail('alice', new Set(['alice']))).toBe('alice_1');
  });

  it('increments until it finds a free slot', () => {
    const taken = new Set(['alice', 'alice_1', 'alice_2']);
    expect(createUniqueEmail('alice', taken)).toBe('alice_3');
  });

  it('falls back to a random hex suffix when all 9999 slots are taken', () => {
    const taken = new Set<string>(['alice']);
    for (let i = 1; i <= 9999; i++) taken.add(`alice_${i}`);
    const result = createUniqueEmail('alice', taken);
    expect(result).toMatch(/^alice_[0-9a-f]{4}$/);
  });
});

// ---------------------------------------------------------------------------
// parseInboundClients
// ---------------------------------------------------------------------------
describe('parseInboundClients', () => {
  it('parses a valid settings JSON with clients', () => {
    const settings = JSON.stringify({ clients: [{ email: 'a@b.com', subId: 'x' }] });
    expect(parseInboundClients(settings)).toEqual([{ email: 'a@b.com', subId: 'x' }]);
  });

  it('returns [] when clients field is absent', () => {
    expect(parseInboundClients(JSON.stringify({}))).toEqual([]);
  });

  it('returns [] when clients is not an array', () => {
    expect(parseInboundClients(JSON.stringify({ clients: 'bad' }))).toEqual([]);
  });

  it('returns [] for invalid JSON without throwing', () => {
    expect(parseInboundClients('not-json')).toEqual([]);
  });

  it('returns [] for an empty string', () => {
    expect(parseInboundClients('')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildClientPayload
// ---------------------------------------------------------------------------
describe('buildClientPayload', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('generates a UUID-based payload for vless', () => {
    const payload = buildClientPayload('vless', 'user@test') as any;
    expect(payload).toMatchObject({ email: 'user@test', enable: true });
    expect(typeof payload.id).toBe('string');
    expect(payload.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect('password' in payload).toBe(false);
  });

  it('generates a UUID-based payload for vmess', () => {
    const payload = buildClientPayload('vmess', 'user@test') as any;
    expect(typeof payload.id).toBe('string');
  });

  it('generates a password-based payload for trojan', () => {
    const payload = buildClientPayload('trojan', 'user@test');
    expect(typeof (payload as any).password).toBe('string');
    expect('id' in payload).toBe(false);
  });

  it('generates a password-based payload for shadowsocks', () => {
    const payload = buildClientPayload('shadowsocks', 'user@test');
    expect(typeof (payload as any).password).toBe('string');
  });

  it('respects XUI_AUTO_CLIENT_EXPIRY_DAYS env var', () => {
    vi.stubEnv('XUI_AUTO_CLIENT_EXPIRY_DAYS', '30');
    const before = Date.now();
    const payload = buildClientPayload('vless', 'u');
    const after = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect((payload as any).expiryTime).toBeGreaterThanOrEqual(before + thirtyDaysMs - 100);
    expect((payload as any).expiryTime).toBeLessThanOrEqual(after + thirtyDaysMs + 100);
  });

  it('sets expiryTime to 0 when no expiry is configured', () => {
    vi.stubEnv('XUI_AUTO_CLIENT_EXPIRY_DAYS', '0');
    const payload = buildClientPayload('vless', 'u');
    expect((payload as any).expiryTime).toBe(0);
  });

  it('generates a unique subId for each call', () => {
    const a = buildClientPayload('vless', 'u');
    const b = buildClientPayload('vless', 'u');
    expect((a as any).subId).not.toBe((b as any).subId);
  });
});

// ---------------------------------------------------------------------------
// pickInboundForAutoProvision
// ---------------------------------------------------------------------------
describe('pickInboundForAutoProvision', () => {
  const makeInbound = (id: number, enable = true): XuiInbound => ({
    id,
    remark: `Inbound-${id}`,
    protocol: 'vless',
    enable,
    settings: '{}',
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null for an empty list', () => {
    expect(pickInboundForAutoProvision([])).toBeNull();
  });

  it('returns the configured inbound when XUI_AUTO_INBOUND_ID matches', () => {
    vi.stubEnv('XUI_AUTO_INBOUND_ID', '2');
    const inbounds = [makeInbound(1), makeInbound(2), makeInbound(3)];
    expect(pickInboundForAutoProvision(inbounds)?.id).toBe(2);
  });

  it('falls back to the first enabled inbound when configured ID is not found', () => {
    vi.stubEnv('XUI_AUTO_INBOUND_ID', '99');
    const inbounds = [makeInbound(1, false), makeInbound(2, true), makeInbound(3, true)];
    expect(pickInboundForAutoProvision(inbounds)?.id).toBe(2);
  });

  it('returns the first inbound when none are enabled', () => {
    vi.unstubAllEnvs();
    const inbounds = [makeInbound(1, false), makeInbound(2, false)];
    expect(pickInboundForAutoProvision(inbounds)?.id).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// toClientUsage
// ---------------------------------------------------------------------------
describe('toClientUsage', () => {
  const inbound: XuiInbound = {
    id: 5,
    remark: 'JP-Tokyo',
    protocol: 'trojan',
    enable: true,
    settings: '{}',
  };

  const stats: XuiClientStat = {
    email: 'bob@test',
    up: 100,
    down: 200,
    total: 300,
    expiryTime: 9999,
    enable: true,
  };

  it('uses stats values when stats are provided', () => {
    const result = toClientUsage(inbound, { expiryTime: 1 }, stats);
    expect(result).toEqual({
      inboundId: 5,
      inboundRemark: 'JP-Tokyo',
      protocol: 'trojan',
      up: 100,
      down: 200,
      total: 300,
      expiryTime: 9999,
      enable: true,
    });
  });

  it('falls back to client.expiryTime when stats are null', () => {
    const result = toClientUsage(inbound, { expiryTime: 42 }, null);
    expect(result.up).toBe(0);
    expect(result.down).toBe(0);
    expect(result.total).toBe(0);
    expect(result.expiryTime).toBe(42);
    expect(result.enable).toBe(false);
  });

  it('falls back to 0 for all numeric fields when stats are null and client has no expiryTime', () => {
    const result = toClientUsage(inbound, {}, null);
    expect(result.expiryTime).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildClientUsageIndex — edge cases
// ---------------------------------------------------------------------------
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

  it('handles missing clientStats gracefully', () => {
    const index = buildClientUsageIndex([
      {
        id: 3,
        remark: 'EU',
        protocol: 'vmess',
        enable: true,
        settings: JSON.stringify({
          clients: [{ subId: 'sub-no-stats', email: 'carol@test', expiryTime: 500 }],
        }),
      },
    ] as any);

    const entry = index.get('sub-no-stats');
    expect(entry).toBeDefined();
    expect(entry?.up).toBe(0);
    expect(entry?.down).toBe(0);
    expect(entry?.expiryTime).toBe(500);
    expect(entry?.enable).toBe(false);
  });

  it('skips inbounds with invalid settings JSON', () => {
    const index = buildClientUsageIndex([
      {
        id: 4,
        remark: 'Bad',
        protocol: 'vless',
        enable: true,
        settings: 'not-json',
        clientStats: [],
      },
    ] as any);

    expect(index.size).toBe(0);
  });

  it('reflects enable=false from clientStats', () => {
    const index = buildClientUsageIndex([
      {
        id: 7,
        remark: 'X',
        protocol: 'vless',
        enable: true,
        settings: JSON.stringify({
          clients: [{ subId: 'sub-disabled', email: 'dave@test', expiryTime: 0 }],
        }),
        clientStats: [
          {
            email: 'dave@test',
            up: 0,
            down: 0,
            total: 0,
            expiryTime: 0,
            enable: false,
          },
        ],
      },
    ] as any);

    expect(index.get('sub-disabled')?.enable).toBe(false);
  });

  it('returns an empty map for an empty inbounds array', () => {
    expect(buildClientUsageIndex([])).toEqual(new Map());
  });
});
