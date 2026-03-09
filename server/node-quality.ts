import { db } from './db.js';

export type UnlockStatus = 'unknown' | 'supported' | 'limited' | 'blocked';
export type NodeQualityProbeCode =
  | 'http_ok'
  | 'challenge'
  | 'region_block'
  | 'unsupported_browser'
  | 'probe_failed'
  | 'trace_unreachable'
  | 'static_unreachable'
  | 'http_status'
  | 'unknown';

export interface NodeQualityServiceDetail {
  code: NodeQualityProbeCode;
  httpStatus: number | null;
  location: string;
  target: string;
}

export interface NodeQualityEgressMeta {
  ip: string;
  country: string;
  countryCode: string;
  regionName: string;
  city: string;
  isp: string;
  asn: string;
  proxy: boolean | null;
  hosting: boolean | null;
  mobile: boolean | null;
}

export type UnlockServiceId =
  | 'netflix'
  | 'chatgpt'
  | 'claude'
  | 'tiktok'
  | 'instagram'
  | 'spotify'
  | 'youtube'
  | 'disneyplus'
  | 'primevideo'
  | 'x';
export type NodeQualityServiceDetails = Partial<Record<UnlockServiceId, NodeQualityServiceDetail>>;

export interface NodeQualityProfile {
  inboundId: number;
  summary: string;
  fraudScore: number | null;
  netflixStatus: UnlockStatus;
  chatgptStatus: UnlockStatus;
  claudeStatus: UnlockStatus;
  tiktokStatus: UnlockStatus;
  instagramStatus: UnlockStatus;
  spotifyStatus: UnlockStatus;
  youtubeStatus: UnlockStatus;
  disneyplusStatus: UnlockStatus;
  primevideoStatus: UnlockStatus;
  xStatus: UnlockStatus;
  notes: string;
  egress: NodeQualityEgressMeta | null;
  serviceDetails: NodeQualityServiceDetails;
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

function normalizeNullableBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  return null;
}

function normalizeProbeCode(value: unknown): NodeQualityProbeCode {
  if (typeof value !== 'string') return 'unknown';
  const normalized = value as NodeQualityProbeCode;
  return [
    'http_ok',
    'challenge',
    'region_block',
    'unsupported_browser',
    'probe_failed',
    'trace_unreachable',
    'static_unreachable',
    'http_status',
    'unknown',
  ].includes(normalized)
    ? normalized
    : 'unknown';
}

function normalizeServiceDetail(value: unknown): NodeQualityServiceDetail | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const httpStatus = Number(input.httpStatus);
  return {
    code: normalizeProbeCode(input.code),
    httpStatus: Number.isFinite(httpStatus) && httpStatus > 0 ? Math.trunc(httpStatus) : null,
    location: normalizeText(input.location),
    target: normalizeText(input.target),
  };
}

function normalizeServiceDetails(value: unknown): NodeQualityServiceDetails {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const serviceDetails: NodeQualityServiceDetails = {};

  for (const serviceId of [
    'netflix',
    'chatgpt',
    'claude',
    'tiktok',
    'instagram',
    'spotify',
    'youtube',
    'disneyplus',
    'primevideo',
    'x',
  ] as const) {
    const detail = normalizeServiceDetail(input[serviceId]);
    if (detail) serviceDetails[serviceId] = detail;
  }

  return serviceDetails;
}

function normalizeEgressMeta(value: unknown): NodeQualityEgressMeta | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const ip = normalizeText(input.ip);
  const country = normalizeText(input.country);
  const countryCode = normalizeText(input.countryCode);
  const regionName = normalizeText(input.regionName);
  const city = normalizeText(input.city);
  const isp = normalizeText(input.isp);
  const asn = normalizeText(input.asn);

  if (!ip && !country && !regionName && !city && !isp && !asn) {
    return null;
  }

  return {
    ip,
    country,
    countryCode,
    regionName,
    city,
    isp,
    asn,
    proxy: normalizeNullableBoolean(input.proxy),
    hosting: normalizeNullableBoolean(input.hosting),
    mobile: normalizeNullableBoolean(input.mobile),
  };
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
    tiktokStatus: normalizeUnlockStatus(input.tiktokStatus),
    instagramStatus: normalizeUnlockStatus(input.instagramStatus),
    spotifyStatus: normalizeUnlockStatus(input.spotifyStatus),
    youtubeStatus: normalizeUnlockStatus(input.youtubeStatus),
    disneyplusStatus: normalizeUnlockStatus(input.disneyplusStatus),
    primevideoStatus: normalizeUnlockStatus(input.primevideoStatus),
    xStatus: normalizeUnlockStatus(input.xStatus),
    notes: normalizeText(input.notes),
    egress: normalizeEgressMeta(input.egress),
    serviceDetails: normalizeServiceDetails(input.serviceDetails),
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
    tiktokStatus: 'unknown',
    instagramStatus: 'unknown',
    spotifyStatus: 'unknown',
    youtubeStatus: 'unknown',
    disneyplusStatus: 'unknown',
    primevideoStatus: 'unknown',
    xStatus: 'unknown',
    notes: '',
    egress: null,
    serviceDetails: {},
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

export function hasMeaningfulNodeQualityProfile(profile: NodeQualityProfile): boolean {
  return Boolean(
    profile.summary ||
    profile.notes ||
    profile.fraudScore !== null ||
    profile.netflixStatus !== 'unknown' ||
    profile.chatgptStatus !== 'unknown' ||
    profile.claudeStatus !== 'unknown' ||
    profile.tiktokStatus !== 'unknown' ||
    profile.instagramStatus !== 'unknown' ||
    profile.spotifyStatus !== 'unknown' ||
    profile.youtubeStatus !== 'unknown' ||
    profile.disneyplusStatus !== 'unknown' ||
    profile.primevideoStatus !== 'unknown' ||
    profile.xStatus !== 'unknown',
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

export function saveNodeQualityProfile(profile: NodeQualityProfile): NodeQualityProfile {
  const stored = readStoredProfiles();
  stored[String(profile.inboundId)] = {
    summary: normalizeText(profile.summary),
    fraudScore: normalizeFraudScore(profile.fraudScore),
    netflixStatus: normalizeUnlockStatus(profile.netflixStatus),
    chatgptStatus: normalizeUnlockStatus(profile.chatgptStatus),
    claudeStatus: normalizeUnlockStatus(profile.claudeStatus),
    tiktokStatus: normalizeUnlockStatus(profile.tiktokStatus),
    instagramStatus: normalizeUnlockStatus(profile.instagramStatus),
    spotifyStatus: normalizeUnlockStatus(profile.spotifyStatus),
    youtubeStatus: normalizeUnlockStatus(profile.youtubeStatus),
    disneyplusStatus: normalizeUnlockStatus(profile.disneyplusStatus),
    primevideoStatus: normalizeUnlockStatus(profile.primevideoStatus),
    xStatus: normalizeUnlockStatus(profile.xStatus),
    notes: normalizeText(profile.notes),
    egress: normalizeEgressMeta(profile.egress),
    serviceDetails: normalizeServiceDetails(profile.serviceDetails),
    updatedAt: profile.updatedAt ?? Date.now(),
  };
  writeStoredProfiles(stored);
  return getNodeQualityProfile(profile.inboundId);
}
