import { db } from './db.js';

export type UnlockStatus = 'unknown' | 'supported' | 'limited' | 'blocked';

export interface NodeQualityProfile {
  inboundId: number;
  summary: string;
  fraudScore: number | null;
  netflixStatus: UnlockStatus;
  chatgptStatus: UnlockStatus;
  claudeStatus: UnlockStatus;
  notes: string;
  updatedAt: number | null;
}

const NODE_QUALITY_SETTINGS_KEY = 'nodeQualityProfiles';
const UNLOCK_STATUSES: UnlockStatus[] = ['unknown', 'supported', 'limited', 'blocked'];

type StoredNodeQualityProfile = Omit<NodeQualityProfile, 'inboundId'>;

interface StoredNodeQualityMap {
  [inboundId: string]: StoredNodeQualityProfile;
}

function normalizeUnlockStatus(value: unknown): UnlockStatus {
  if (typeof value !== 'string') return 'unknown';
  return UNLOCK_STATUSES.includes(value as UnlockStatus) ? (value as UnlockStatus) : 'unknown';
}

function normalizeFraudScore(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, Math.trunc(parsed)));
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildStoredNodeQualityProfile(value: unknown): StoredNodeQualityProfile {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const updatedAtRaw = Number(input.updatedAt);
  return {
    summary: normalizeText(input.summary),
    fraudScore: normalizeFraudScore(input.fraudScore),
    netflixStatus: normalizeUnlockStatus(input.netflixStatus),
    chatgptStatus: normalizeUnlockStatus(input.chatgptStatus),
    claudeStatus: normalizeUnlockStatus(input.claudeStatus),
    notes: normalizeText(input.notes),
    updatedAt: Number.isFinite(updatedAtRaw) && updatedAtRaw > 0 ? Math.trunc(updatedAtRaw) : null,
  };
}

function readStoredProfiles(): StoredNodeQualityMap {
  const row = db
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get(NODE_QUALITY_SETTINGS_KEY) as { value: string } | undefined;
  if (!row?.value) return {};

  try {
    const parsed = JSON.parse(row.value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const result: StoredNodeQualityMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const inboundId = Number.parseInt(key, 10);
      if (!Number.isFinite(inboundId) || inboundId <= 0) continue;
      result[String(inboundId)] = buildStoredNodeQualityProfile(value);
    }
    return result;
  } catch {
    return {};
  }
}

function writeStoredProfiles(profiles: StoredNodeQualityMap) {
  db.prepare(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, unixepoch())
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `,
  ).run(NODE_QUALITY_SETTINGS_KEY, JSON.stringify(profiles));
}

export function buildDefaultNodeQualityProfile(inboundId: number): NodeQualityProfile {
  return {
    inboundId,
    summary: '',
    fraudScore: null,
    netflixStatus: 'unknown',
    chatgptStatus: 'unknown',
    claudeStatus: 'unknown',
    notes: '',
    updatedAt: null,
  };
}

export function toNodeQualityProfile(
  inboundId: number,
  stored?: Partial<StoredNodeQualityProfile> | null,
): NodeQualityProfile {
  const normalized = buildStoredNodeQualityProfile(stored ?? {});
  return {
    inboundId,
    ...normalized,
  };
}

export function isMeaningfulNodeQualityProfile(profile: NodeQualityProfile): boolean {
  return Boolean(
    profile.summary ||
    profile.notes ||
    profile.fraudScore !== null ||
    profile.netflixStatus !== 'unknown' ||
    profile.chatgptStatus !== 'unknown' ||
    profile.claudeStatus !== 'unknown',
  );
}

export function getNodeQualityProfiles(): NodeQualityProfile[] {
  const stored = readStoredProfiles();
  return Object.entries(stored)
    .map(([key, value]) => toNodeQualityProfile(Number.parseInt(key, 10), value))
    .sort((left, right) => left.inboundId - right.inboundId);
}

export function getNodeQualityProfile(inboundId: number): NodeQualityProfile {
  const stored = readStoredProfiles();
  return toNodeQualityProfile(inboundId, stored[String(inboundId)]);
}

export function upsertNodeQualityProfile(
  inboundId: number,
  input: Partial<NodeQualityProfile>,
): { profile: NodeQualityProfile; removed: boolean } {
  const current = getNodeQualityProfile(inboundId);
  const next: NodeQualityProfile = {
    inboundId,
    summary: 'summary' in input ? normalizeText(input.summary) : current.summary,
    fraudScore: 'fraudScore' in input ? normalizeFraudScore(input.fraudScore) : current.fraudScore,
    netflixStatus:
      'netflixStatus' in input ? normalizeUnlockStatus(input.netflixStatus) : current.netflixStatus,
    chatgptStatus:
      'chatgptStatus' in input ? normalizeUnlockStatus(input.chatgptStatus) : current.chatgptStatus,
    claudeStatus:
      'claudeStatus' in input ? normalizeUnlockStatus(input.claudeStatus) : current.claudeStatus,
    notes: 'notes' in input ? normalizeText(input.notes) : current.notes,
    updatedAt: Date.now(),
  };

  const stored = readStoredProfiles();
  if (!isMeaningfulNodeQualityProfile(next)) {
    delete stored[String(inboundId)];
    writeStoredProfiles(stored);
    return {
      profile: buildDefaultNodeQualityProfile(inboundId),
      removed: true,
    };
  }

  stored[String(inboundId)] = {
    summary: next.summary,
    fraudScore: next.fraudScore,
    netflixStatus: next.netflixStatus,
    chatgptStatus: next.chatgptStatus,
    claudeStatus: next.claudeStatus,
    notes: next.notes,
    updatedAt: next.updatedAt,
  };
  writeStoredProfiles(stored);

  return { profile: next, removed: false };
}
