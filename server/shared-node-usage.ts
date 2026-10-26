import fs from 'node:fs';
import { db } from './db.js';

export interface SharedNodeUsageEntry {
  host: string;
  name: string;
  limitBytes: number;
  usageUrl?: string;
  token?: string;
  localFile?: string;
}

interface UsageResult {
  usedBytes: number;
  at: number;
}

const CACHE_TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 2_000;
const cache = new Map<string, UsageResult>();

export function getSharedNodeUsageConfig(): SharedNodeUsageEntry[] {
  try {
    const row = db
      .prepare('SELECT value FROM app_settings WHERE key = ?')
      .get('sharedNodeUsage') as { value: string } | undefined;
    if (!row?.value) return [];
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function formatUsageBytes(bytes: number): string {
  const g = bytes / 1e9;
  if (g < 1000) return `${Math.round(g)}G`;
  const t = g / 1000;
  return `${Number.isInteger(t) ? t.toFixed(0) : t.toFixed(1).replace(/\.0$/, '')}T`;
}

export function extractLinkHost(link: string): string {
  const m = link.match(/^[a-z0-9]+:\/\/[^@]*@(\[[^\]]+\]|[^:/?#]+)/i);
  return m ? m[1].replace(/^\[|\]$/g, '') : '';
}

async function readUsage(entry: SharedNodeUsageEntry): Promise<number | null> {
  if (entry.localFile) {
    const data = JSON.parse(fs.readFileSync(entry.localFile, 'utf8'));
    return Number(data.used_bytes);
  }
  if (!entry.usageUrl) return null;
  const res = await fetch(entry.usageUrl, {
    headers: entry.token ? { Authorization: `Bearer ${entry.token}` } : {},
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { used_bytes?: unknown };
  const used = Number(data.used_bytes);
  if (!Number.isFinite(used) || used < 0) throw new Error('bad used_bytes');
  return used;
}

async function getUsage(entry: SharedNodeUsageEntry): Promise<number | null> {
  const cached = cache.get(entry.host);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.usedBytes;
  try {
    const used = await readUsage(entry);
    if (used == null || !Number.isFinite(used)) return cached?.usedBytes ?? null;
    cache.set(entry.host, { usedBytes: used, at: Date.now() });
    return used;
  } catch {
    return cached?.usedBytes ?? null;
  }
}

/** Returns host -> display name for configured shared nodes. */
export async function resolveSharedNodeNames(links: string[]): Promise<Map<string, string>> {
  const config = getSharedNodeUsageConfig();
  const names = new Map<string, string>();
  const hosts = new Set(links.map(extractLinkHost));
  await Promise.all(
    config
      .filter((e) => hosts.has(e.host))
      .map(async (e) => {
        const used = await getUsage(e);
        const limit = formatUsageBytes(e.limitBytes);
        names.set(
          e.host,
          used == null
            ? `${e.name}｜${limit}/月`
            : `${e.name}｜已用 ${formatUsageBytes(used)}/${limit}`,
        );
      }),
  );
  return names;
}
