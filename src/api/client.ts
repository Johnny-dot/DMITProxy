import type { NodeQualityProfile } from '@/src/types/nodeQuality';
import type {
  MarketChartResponse,
  MarketRefreshResponse,
  MarketSnapshotResponse,
} from '@/src/types/market';
import type { CommunityLink } from '@/src/types/communityLink';
import type { SharedResource } from '@/src/types/sharedResource';
import type { UserProfile, UserAvatarStyle } from '@/src/types/userProfile';

const BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/+$/, '');

interface ApiResponse<T> {
  success: boolean;
  msg: string;
  obj: T;
}

type ResponseBody =
  | ApiResponse<unknown>
  | {
      error?: string;
      msg?: string;
      detail?: string;
      success?: boolean;
      obj?: unknown;
    };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function isXuiConfigured() {
  return Boolean((import.meta.env.VITE_3XUI_SERVER ?? '').trim());
}

export async function hasXuiAdminSessionHint() {
  const data = await localFetch<{ hasAdminCookie?: boolean }>('/local/auth/admin-session-hint', {
    fallbackError: 'Failed to check admin session hint',
  });
  return data.hasAdminCookie === true;
}

function extractErrorMessage(data: ResponseBody | null, fallback: string) {
  if (data && 'error' in data && typeof data.error === 'string' && data.error.trim()) {
    return data.error;
  }
  if (data && 'msg' in data && typeof data.msg === 'string' && data.msg.trim()) {
    return data.msg;
  }
  return fallback;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (res.status === 401 || res.redirected) {
    throw new ApiError(401, 'Unauthorized');
  }

  const text = await res.text();
  let data: ResponseBody | null = null;
  try {
    data = text ? (JSON.parse(text) as ResponseBody) : null;
  } catch {
    throw new Error(`Invalid response from upstream API (HTTP ${res.status}) for ${path}`);
  }

  if (!res.ok) {
    const message = extractErrorMessage(data, `Request failed (HTTP ${res.status})`);
    throw new ApiError(res.status, message);
  }

  if (!data || typeof data !== 'object' || !('success' in data) || !('obj' in data)) {
    throw new Error(`Invalid response from upstream API (HTTP ${res.status}) for ${path}`);
  }
  if (data.success !== true) throw new Error(extractErrorMessage(data, 'Request failed'));
  return data.obj as T;
}

// Auth
export async function login(username: string, password: string) {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    credentials: 'include',
    // 3X-UI accepts both JSON and form-encoded; form-encoded is more universally supported.
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }).toString(),
  });

  const text = await res.text();
  let data: ResponseBody | null = null;
  try {
    data = text ? (JSON.parse(text) as ResponseBody) : null;
  } catch {
    throw new Error(
      `Admin server returned an unexpected response (HTTP ${res.status}). Check VITE_3XUI_BASE_PATH in .env.`,
    );
  }

  if (!res.ok) {
    throw new ApiError(res.status, extractErrorMessage(data, `Login failed (HTTP ${res.status})`));
  }
  if (!data || typeof data !== 'object' || !('success' in data)) {
    throw new Error(
      `Login API returned ${res.status}. Check VITE_3XUI_SERVER and VITE_3XUI_BASE_PATH.`,
    );
  }
  if (data.success !== true) {
    throw new Error(extractErrorMessage(data, 'Login failed: wrong username or password'));
  }
}

export async function logout() {
  await fetch(`${BASE}/logout`, { method: 'POST', credentials: 'include' });
}

// Server Status
export interface ServerStatus {
  cpu: number;
  cpuCores: number;
  mem: { current: number; total: number };
  swap: { current: number; total: number };
  disk: { current: number; total: number };
  xray: { state: string; version: string };
  uptime: number;
  loads: number[];
  tcpCount: number;
  udpCount: number;
  netIO: { up: number; down: number };
  netTraffic: { sent: number; recv: number };
}

export function getServerStatus(options?: RequestInit) {
  return apiFetch<ServerStatus>('/panel/api/server/status', options);
}

// Inbounds
export interface InboundClient {
  id: string;
  email: string;
  enable: boolean;
  expiryTime: number;
  totalGB: number;
  subId: string;
  up: number;
  down: number;
}

export interface Inbound {
  id: number;
  remark: string;
  protocol: string;
  port: number;
  enable: boolean;
  up: number;
  down: number;
  total: number;
  expiryTime: number;
  clientStats: InboundClient[];
  settings: string;
}

export function getInbounds(options?: RequestInit) {
  return apiFetch<Inbound[]>('/panel/api/inbounds/list', options);
}

export async function toggleInbound(id: number, enable: boolean) {
  return apiFetch<null>(`/panel/api/inbounds/update/${id}`, {
    method: 'POST',
    body: JSON.stringify({ enable }),
  });
}

export async function deleteInbound(id: number) {
  return apiFetch<null>(`/panel/api/inbounds/del/${id}`, { method: 'POST' });
}

export async function deleteInboundClient(inboundId: number, clientId: string) {
  const normalizedClientId = clientId.trim();
  if (!normalizedClientId) {
    throw new Error('Missing client id');
  }
  return apiFetch<null>(
    `/panel/api/inbounds/${inboundId}/delClient/${encodeURIComponent(normalizedClientId)}`,
    {
      method: 'POST',
    },
  );
}

export async function deleteInboundClientByEmail(inboundId: number, email: string) {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    throw new Error('Missing client email');
  }
  return apiFetch<null>(
    `/panel/api/inbounds/${inboundId}/delClientByEmail/${encodeURIComponent(normalizedEmail)}`,
    {
      method: 'POST',
    },
  );
}

async function localFetch<T>(
  path: string,
  options?: RequestInit & { fallbackError?: string },
): Promise<T> {
  const { fallbackError, ...fetchOptions } = options ?? {};
  const res = await fetch(path, {
    credentials: 'include',
    ...fetchOptions,
    headers: { 'Content-Type': 'application/json', ...fetchOptions.headers },
  });

  let data: Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Invalid JSON response (HTTP ${res.status}) for ${path}`);
  }

  if (!res.ok) {
    const msg = typeof data.error === 'string' ? data.error : (fallbackError ?? 'Request failed');
    throw new Error(msg);
  }
  return data as T;
}

// Local admin settings
export interface AdminSettings {
  siteName: string;
  publicUrl: string;
  supportTelegram: string;
  announcementText: string;
  announcementActive: boolean;
  sharedResources: SharedResource[];
  communityLinks: CommunityLink[];
}

export function getAdminSettings(): Promise<AdminSettings> {
  return localFetch<AdminSettings>('/local/admin/settings', {
    fallbackError: 'Failed to load settings',
  });
}

export async function saveAdminSettings(payload: Partial<AdminSettings>): Promise<AdminSettings> {
  const data = await localFetch<{ ok: boolean; settings: AdminSettings }>('/local/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
    fallbackError: 'Failed to save settings',
  });
  return data.settings;
}

export async function clearPortalSessions(): Promise<number> {
  const data = await localFetch<{ cleared?: number }>('/local/admin/security/clear-sessions', {
    method: 'POST',
    fallbackError: 'Failed to clear sessions',
  });
  return Number(data.cleared ?? 0);
}

export async function getNodeQualityProfiles(): Promise<NodeQualityProfile[]> {
  const data = await localFetch<{ profiles?: NodeQualityProfile[] }>('/local/admin/node-quality', {
    fallbackError: 'Failed to load node quality profiles',
  });
  return Array.isArray(data.profiles) ? data.profiles : [];
}

export async function refreshNodeQualityProfile(inboundId: number): Promise<NodeQualityProfile> {
  const data = await localFetch<{ profile: NodeQualityProfile }>(
    `/local/admin/node-quality/${inboundId}/refresh`,
    {
      method: 'POST',
      fallbackError: 'Failed to refresh node quality profile',
    },
  );
  return data.profile;
}

export interface RefreshCurrentNodeQualityResult {
  stats: {
    inboundId: number;
    inboundRemark: string;
    protocol: string;
    up: number;
    down: number;
    total: number;
    expiryTime: number;
    enable: boolean;
  } | null;
  nodeQuality: NodeQualityProfile | null;
}

export async function refreshCurrentNodeQuality(): Promise<RefreshCurrentNodeQualityResult> {
  return localFetch<RefreshCurrentNodeQualityResult>('/local/auth/portal/node-quality/refresh', {
    method: 'POST',
    fallbackError: 'Failed to refresh current node quality',
  });
}

export async function backupDatabase(): Promise<string> {
  const data = await localFetch<{ file?: string }>('/local/admin/maintenance/backup', {
    method: 'POST',
    fallbackError: 'Failed to backup database',
  });
  return String(data.file ?? '');
}

export async function clearTrafficLogs(): Promise<void> {
  await localFetch<{ ok: boolean }>('/local/admin/maintenance/clear-traffic', {
    method: 'POST',
    fallbackError: 'Failed to clear traffic logs',
  });
}

export function getUserProfile(): Promise<UserProfile> {
  return localFetch<UserProfile>('/local/auth/profile', {
    fallbackError: 'Failed to load user profile',
  });
}

export async function updateUserProfile(payload: {
  displayName: string;
  avatarStyle: UserAvatarStyle;
}): Promise<UserProfile> {
  const data = await localFetch<{ ok: boolean; profile: UserProfile }>('/local/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
    fallbackError: 'Failed to save user profile',
  });
  return data.profile;
}

export function getMarketSnapshot(): Promise<MarketSnapshotResponse> {
  return localFetch<MarketSnapshotResponse>('/local/auth/portal/market', {
    fallbackError: 'Failed to load market snapshot',
  });
}

export function getMarketChart(assetId: string): Promise<MarketChartResponse> {
  return localFetch<MarketChartResponse>(
    `/local/auth/portal/market/${encodeURIComponent(assetId)}`,
    {
      fallbackError: 'Failed to load market chart',
    },
  );
}

export function refreshMarketSnapshot(assetId: string): Promise<MarketRefreshResponse> {
  return localFetch<MarketRefreshResponse>('/local/auth/portal/market/refresh', {
    method: 'POST',
    body: JSON.stringify({ assetId }),
    fallbackError: 'Failed to refresh market data',
  });
}
