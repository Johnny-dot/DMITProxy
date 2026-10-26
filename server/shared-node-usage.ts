import { db } from './db.js';

/**
 * Live usage for shared extra nodes, stored in app_settings under `sharedNodeUsage`.
 *
 * Canonical JSON:
 * {
 *   "updatedAt": 1710000000000,
 *   "nodes": [
 *     { "name": "日本 IEPL 01", "usedBytes": 123, "totalBytes": 456 }
 *   ]
 * }
 *
 * `name` matches the sanitized title of an extra subscription link.
 * `index` is the 0-based position in that list when the link has no name.
 * Also accepted: an entries array, a name-to-usage map, and up/down byte fields.
 */
export const SHARED_NODE_USAGE_KEY = 'sharedNodeUsage';

export interface SharedNodeUsageEntry {
  name: string;
  index: number | null;
  usedBytes: number | null;
  totalBytes: number | null;
  remainingBytes: number | null;
  label: string | null;
}

const GB = 1024 ** 3;

export function sanitizeSharedNodeName(name: string): string {
  return name
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[｜|·•]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Math.max(0, Number(value));
  }
  return null;
}

function readEntry(
  value: unknown,
  fallbackName = '',
  fallbackIndex: number | null = null,
): SharedNodeUsageEntry | null {
  if (typeof value === 'string') {
    const label = value.trim();
    if (!label) return null;
    return {
      name: fallbackName,
      index: fallbackIndex,
      usedBytes: null,
      totalBytes: null,
      remainingBytes: null,
      label,
    };
  }

  const record = asRecord(value);
  if (!record) return null;

  const upload = numberOrNull(record.upload ?? record.up);
  const download = numberOrNull(record.download ?? record.down);
  const usedFromParts = upload != null || download != null ? (upload ?? 0) + (download ?? 0) : null;
  const usedBytes = numberOrNull(record.usedBytes ?? record.used ?? record.usage) ?? usedFromParts;
  const totalBytes = numberOrNull(record.totalBytes ?? record.total ?? record.quota);
  const remainingBytes = numberOrNull(record.remainingBytes ?? record.remaining ?? record.remain);
  const rawLabel = record.label ?? record.text;
  const label = typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel.trim() : null;
  const name = String(record.name ?? record.remark ?? record.title ?? fallbackName).trim();
  const indexRaw = numberOrNull(record.index);
  const index = indexRaw == null ? fallbackIndex : Math.trunc(indexRaw);

  if (
    !name &&
    index == null &&
    !label &&
    usedBytes == null &&
    totalBytes == null &&
    remainingBytes == null
  ) {
    return null;
  }

  return { name, index, usedBytes, totalBytes, remainingBytes, label };
}

function collectEntries(value: unknown): SharedNodeUsageEntry[] {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => readEntry(item, '', index))
      .filter((item): item is SharedNodeUsageEntry => Boolean(item));
  }

  const record = asRecord(value);
  if (!record) return [];

  if (Array.isArray(record.nodes)) return collectEntries(record.nodes);
  if (Array.isArray(record.entries)) return collectEntries(record.entries);

  const nested = asRecord(record.nodes);
  if (nested) {
    return Object.entries(nested)
      .map(([name, item], index) => readEntry(item, name, index))
      .filter((item): item is SharedNodeUsageEntry => Boolean(item));
  }

  const reserved = new Set(['nodes', 'entries', 'updatedAt', 'updated_at']);
  const pairs = Object.entries(record).filter(([key]) => !reserved.has(key));
  if (pairs.length === 0) return [];

  const single = readEntry(record);
  if (single && (single.usedBytes != null || single.totalBytes != null || single.label)) {
    return [single];
  }

  return pairs
    .map(([name, item], index) => readEntry(item, name, index))
    .filter((item): item is SharedNodeUsageEntry => Boolean(item));
}

export function parseSharedNodeUsage(raw: string | null | undefined): SharedNodeUsageEntry[] {
  if (!raw?.trim()) return [];
  try {
    return collectEntries(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

function briefGb(bytes: number): string {
  return (Math.max(0, bytes) / GB).toFixed(1).replace(/\.0$/, '');
}

export function formatSharedNodeUsageLabel(entry: SharedNodeUsageEntry): string | null {
  if (entry.label) {
    return entry.label.replace(/[｜|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24);
  }
  if (entry.remainingBytes != null && entry.totalBytes != null) {
    return `剩${briefGb(entry.remainingBytes)}/${briefGb(entry.totalBytes)}G`;
  }
  if (entry.usedBytes != null && entry.totalBytes != null) {
    const remaining = Math.max(0, entry.totalBytes - entry.usedBytes);
    return `剩${briefGb(remaining)}/${briefGb(entry.totalBytes)}G`;
  }
  if (entry.usedBytes != null) return `已用${briefGb(entry.usedBytes)}G`;
  return null;
}

export function findSharedNodeUsageLabel(
  entries: SharedNodeUsageEntry[],
  input: { name: string; index: number },
): string | null {
  const name = sanitizeSharedNodeName(input.name);
  const named = name
    ? entries.find((entry) => {
        const entryName = sanitizeSharedNodeName(entry.name);
        return entryName === name || entryName === `共享节点 ${name}`;
      })
    : undefined;
  const indexed = entries.find((entry) => entry.index === input.index && !entry.name.trim());
  const entry = named ?? indexed ?? entries.find((entry) => entry.index === input.index);
  if (!entry) return null;
  return formatSharedNodeUsageLabel(entry);
}

export function loadSharedNodeUsageEntries(): SharedNodeUsageEntry[] {
  try {
    const row = db
      .prepare('SELECT value FROM app_settings WHERE key = ?')
      .get(SHARED_NODE_USAGE_KEY) as { value: string } | undefined;
    return parseSharedNodeUsage(row?.value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[shared-node-usage] unable to read ${SHARED_NODE_USAGE_KEY}: ${message}`);
    return [];
  }
}
