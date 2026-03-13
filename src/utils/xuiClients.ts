import type { Inbound, InboundClient } from '@/src/api/client';

type JsonRecord = Record<string, unknown>;
export type XuiClientSettingsRecord = JsonRecord;

export type XuiClientConfigSource = 'settings' | 'stats';

export type ClientStatus = 'active' | 'disabled' | 'expired';

export interface XuiClientRow {
  key: string;
  inboundId: number;
  inboundRemark: string;
  protocol: string;
  port: number;
  clientId: string;
  email: string;
  username: string;
  uuid: string;
  subId: string;
  enable: boolean;
  expiryTime: number;
  totalGB: number;
  up: number;
  down: number;
  deviceLimit: number;
  configSource: XuiClientConfigSource;
  rawClient: XuiClientSettingsRecord;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return fallback;
}

function normalizeText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function parseInboundSettings(settings: string): JsonRecord[] {
  if (!settings) return [];
  try {
    const parsed = JSON.parse(settings) as JsonRecord;
    return Array.isArray(parsed?.clients) ? (parsed.clients as JsonRecord[]) : [];
  } catch {
    return [];
  }
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function resolveClientIdentifier(
  protocol: string,
  client: JsonRecord,
  stats?: InboundClient,
): string {
  const lowerProtocol = protocol.trim().toLowerCase();

  if (lowerProtocol === 'trojan') {
    return normalizeText(client.password) || normalizeText(client.id) || normalizeText(stats?.id);
  }

  if (lowerProtocol === 'shadowsocks') {
    return normalizeText(client.email) || normalizeText(client.id) || normalizeText(stats?.email);
  }

  return normalizeText(client.id) || normalizeText(stats?.id);
}

function resolveClientStatus(enable: boolean, expiryTime: number): ClientStatus {
  if (!enable) return 'disabled';
  if (expiryTime > 0 && Date.now() > expiryTime) return 'expired';
  return 'active';
}

function pickClientStats(
  client: JsonRecord,
  statsByEmail: Map<string, InboundClient>,
  statsById: Map<string, InboundClient>,
  statsBySubId: Map<string, InboundClient>,
): InboundClient | undefined {
  const email = normalizeKey(normalizeText(client.email));
  if (email && statsByEmail.has(email)) return statsByEmail.get(email);

  const id = normalizeKey(normalizeText(client.id));
  if (id && statsById.has(id)) return statsById.get(id);

  const subId = normalizeKey(normalizeText(client.subId));
  if (subId && statsBySubId.has(subId)) return statsBySubId.get(subId);

  return undefined;
}

function buildClientRow(
  inbound: Inbound,
  rawClient: JsonRecord,
  stats?: InboundClient,
  configSource: XuiClientConfigSource = 'settings',
): XuiClientRow {
  const email = normalizeText(rawClient.email) || normalizeText(stats?.email);
  const id = normalizeText(rawClient.id) || normalizeText(stats?.id);
  const subId = normalizeText(rawClient.subId) || normalizeText(stats?.subId);
  const username = email || subId || id || `inbound-${inbound.id}-client`;
  const clientId = resolveClientIdentifier(inbound.protocol, rawClient, stats);

  const up = toNumber(stats?.up, toNumber(rawClient.up));
  const down = toNumber(stats?.down, toNumber(rawClient.down));
  const totalGB = toNumber(rawClient.totalGB, toNumber(stats?.totalGB));
  const expiryTime = toNumber(rawClient.expiryTime, toNumber(stats?.expiryTime));
  const enable = toBoolean(rawClient.enable, toBoolean(stats?.enable, true));
  const deviceLimit = toNumber(rawClient.limitIp);

  return {
    key: `${inbound.id}:${username}:${id || 'none'}`,
    inboundId: inbound.id,
    inboundRemark: inbound.remark,
    protocol: inbound.protocol,
    port: inbound.port,
    clientId,
    email,
    username,
    uuid: id,
    subId,
    enable,
    expiryTime,
    totalGB,
    up,
    down,
    deviceLimit,
    configSource,
    rawClient: { ...rawClient },
  };
}

function uniqueRows(rows: XuiClientRow[]): XuiClientRow[] {
  const deduped = new Map<string, XuiClientRow>();
  for (const row of rows) {
    const dedupeKey = `${row.inboundId}:${normalizeKey(row.subId || row.uuid || row.username)}`;
    if (!deduped.has(dedupeKey)) {
      deduped.set(dedupeKey, row);
      continue;
    }
    const existing = deduped.get(dedupeKey)!;
    if (row.up + row.down > existing.up + existing.down) {
      deduped.set(dedupeKey, row);
    }
  }
  return Array.from(deduped.values());
}

export function flattenInboundClients(inbounds: Inbound[]): XuiClientRow[] {
  const rows: XuiClientRow[] = [];

  for (const inbound of inbounds) {
    const settingsClients = parseInboundSettings(inbound.settings);
    const clientStats = Array.isArray(inbound.clientStats) ? inbound.clientStats : [];

    const statsByEmail = new Map<string, InboundClient>();
    const statsById = new Map<string, InboundClient>();
    const statsBySubId = new Map<string, InboundClient>();
    for (const stat of clientStats) {
      const email = normalizeKey(normalizeText(stat.email));
      if (email) statsByEmail.set(email, stat);
      const id = normalizeKey(normalizeText(stat.id));
      if (id) statsById.set(id, stat);
      const subId = normalizeKey(normalizeText(stat.subId));
      if (subId) statsBySubId.set(subId, stat);
    }

    if (settingsClients.length > 0) {
      for (const client of settingsClients) {
        rows.push(
          buildClientRow(
            inbound,
            client,
            pickClientStats(client, statsByEmail, statsById, statsBySubId),
            'settings',
          ),
        );
      }
    }

    const rawClientKeys = new Set(
      settingsClients.map((client) =>
        normalizeKey(
          normalizeText(client.subId) || normalizeText(client.id) || normalizeText(client.email),
        ),
      ),
    );

    for (const stat of clientStats) {
      const statKey = normalizeKey(
        normalizeText(stat.subId) || normalizeText(stat.id) || normalizeText(stat.email),
      );
      if (statKey && rawClientKeys.has(statKey)) continue;
      rows.push(
        buildClientRow(
          inbound,
          {
            email: stat.email,
            id: stat.id,
            subId: stat.subId,
            enable: stat.enable,
            expiryTime: stat.expiryTime,
            totalGB: stat.totalGB,
            up: stat.up,
            down: stat.down,
          },
          undefined,
          'stats',
        ),
      );
    }
  }

  return uniqueRows(rows);
}

export function getClientStatus(client: XuiClientRow): ClientStatus {
  return resolveClientStatus(client.enable, client.expiryTime);
}

export function formatTraffic(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;
  const tb = gb * 1024;
  if (bytes >= tb) return `${(bytes / tb).toFixed(2)} TB`;
  if (bytes >= gb) return `${(bytes / gb).toFixed(2)} GB`;
  if (bytes >= mb) return `${(bytes / mb).toFixed(1)} MB`;
  if (bytes >= kb) return `${(bytes / kb).toFixed(1)} KB`;
  return `${bytes.toFixed(0)} B`;
}

export function formatExpiry(expiryTime: number): string {
  if (!expiryTime || expiryTime <= 0) return 'Never';
  return new Date(expiryTime).toLocaleString();
}
