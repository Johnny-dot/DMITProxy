import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from './db.js';
import {
  extractLinkHost,
  formatUsageBytes,
  getSharedNodeUsageConfig,
  resolveSharedNodeNames,
} from './shared-node-usage.js';

const KEY = 'sharedNodeUsage';

function readSetting(): string | undefined {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(KEY) as
    | { value: string }
    | undefined;
  return row?.value;
}

function writeSetting(value: string | null) {
  if (value == null) {
    db.prepare('DELETE FROM app_settings WHERE key = ?').run(KEY);
    return;
  }
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, unixepoch())
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(KEY, value);
}

const originalSetting = readSetting();

afterEach(() => {
  writeSetting(originalSetting ?? null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getSharedNodeUsageConfig', () => {
  it('reads the production array of host, name, limit, and usage source', () => {
    writeSetting(
      JSON.stringify([
        {
          host: 'sg.example.com',
          name: '🇸🇬 新加坡',
          limitBytes: 8e12,
          usageUrl: 'https://usage.example/sg',
          token: 'secret-token',
          localFile: '/tmp/sg.json',
        },
      ]),
    );
    expect(getSharedNodeUsageConfig()).toEqual([
      {
        host: 'sg.example.com',
        name: '🇸🇬 新加坡',
        limitBytes: 8e12,
        usageUrl: 'https://usage.example/sg',
        token: 'secret-token',
        localFile: '/tmp/sg.json',
      },
    ]);
  });

  it('returns nothing for a missing, invalid, or non-array setting', () => {
    writeSetting(null);
    expect(getSharedNodeUsageConfig()).toEqual([]);
    writeSetting('not-json');
    expect(getSharedNodeUsageConfig()).toEqual([]);
    writeSetting(JSON.stringify({ nodes: [] }));
    expect(getSharedNodeUsageConfig()).toEqual([]);
  });
});

describe('formatUsageBytes', () => {
  it('uses decimal gigabytes and terabytes', () => {
    expect(formatUsageBytes(120e9)).toBe('120G');
    expect(formatUsageBytes(26e9)).toBe('26G');
    expect(formatUsageBytes(3e12)).toBe('3T');
    expect(formatUsageBytes(8e12)).toBe('8T');
    expect(formatUsageBytes(1.5e12)).toBe('1.5T');
  });
});

describe('extractLinkHost', () => {
  it('reads the host from a protocol link', () => {
    expect(extractLinkHost('vless://uuid@sg.example.com:443?security=reality#旧')).toBe(
      'sg.example.com',
    );
    expect(extractLinkHost('vless://uuid@[2001:db8::1]:443#node')).toBe('2001:db8::1');
    expect(extractLinkHost('vmess://abc')).toBe('');
  });
});

describe('resolveSharedNodeNames', () => {
  it('replaces the whole name with live usage and does not keep the old title', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-node-'));
    const file = path.join(dir, 'sg.json');
    fs.writeFileSync(file, JSON.stringify({ used_bytes: 120e9 }));
    writeSetting(
      JSON.stringify([
        { host: 'sg.example.com', name: '🇸🇬 新加坡', limitBytes: 8e12, localFile: file },
      ]),
    );

    const names = await resolveSharedNodeNames(['vless://uuid@sg.example.com:443#旧名字']);
    expect(names.get('sg.example.com')).toBe('🇸🇬 新加坡｜已用 120G/8T');
    expect(names.get('sg.example.com')).not.toContain('共享节点');
    expect(names.get('sg.example.com')).not.toContain('旧名字');

    fs.writeFileSync(file, JSON.stringify({ used_bytes: 26e9 }));
    const freshHost = 'kr-live.example.com';
    writeSetting(
      JSON.stringify([{ host: freshHost, name: '限时🇰🇷 首尔', limitBytes: 3e12, localFile: file }]),
    );
    const live = await resolveSharedNodeNames([`vless://uuid@${freshHost}:443#旧名字`]);
    expect(live.get(freshHost)).toBe('限时🇰🇷 首尔｜已用 26G/3T');
    const absent = await resolveSharedNodeNames(['vless://uuid@unknown.example.com:443#旧名字']);
    expect(absent.size).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('falls back to the monthly limit when usage is unavailable', async () => {
    writeSetting(
      JSON.stringify([{ host: 'idle.example.com', name: '🇸🇬 新加坡', limitBytes: 3e12 }]),
    );
    const names = await resolveSharedNodeNames(['vless://uuid@idle.example.com:443#旧名字']);
    expect(names.get('idle.example.com')).toBe('🇸🇬 新加坡｜3T/月');
  });

  it('reads used_bytes from usageUrl and sends the bearer token', async () => {
    writeSetting(
      JSON.stringify([
        {
          host: 'remote.example.com',
          name: '🇸🇬 新加坡',
          limitBytes: 8e12,
          usageUrl: 'https://usage.example/sg',
          token: 'secret-token',
        },
      ]),
    );
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ used_bytes: 120e9 })));
    vi.stubGlobal('fetch', fetchMock);
    const names = await resolveSharedNodeNames(['trojan://secret@remote.example.com:443#旧']);
    expect(names.get('remote.example.com')).toBe('🇸🇬 新加坡｜已用 120G/8T');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://usage.example/sg',
      expect.objectContaining({
        headers: { Authorization: 'Bearer secret-token' },
      }),
    );
  });

  it('keeps the monthly fallback when the usage request fails', async () => {
    writeSetting(
      JSON.stringify([
        {
          host: 'down.example.com',
          name: '限时🇰🇷 首尔',
          limitBytes: 3e12,
          usageUrl: 'https://usage.example/kr',
        },
      ]),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 503 })),
    );
    const names = await resolveSharedNodeNames(['vless://uuid@down.example.com:443#旧']);
    expect(names.get('down.example.com')).toBe('限时🇰🇷 首尔｜3T/月');
  });
});
