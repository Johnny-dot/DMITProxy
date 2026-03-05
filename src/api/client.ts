const BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/+$/, '');

interface ApiResponse<T> {
  success: boolean;
  msg: string;
  obj: T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
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

  let data: ApiResponse<T>;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Invalid response from upstream API (HTTP ${res.status}) for ${path}`);
  }
  if (!data.success) throw new Error(data.msg || 'Request failed');
  return data.obj;
}

// Auth
export async function login(username: string, password: string) {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    credentials: 'include',
    // 3X-UI accepts both JSON and form-encoded; form-encoded is more universally supported
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }).toString(),
  });

  const text = await res.text();
  if (!text) {
    throw new Error(
      `Login API returned ${res.status}. Check VITE_3XUI_SERVER and VITE_3XUI_BASE_PATH.`,
    );
  }

  let data: ApiResponse<null>;
  try {
    data = JSON.parse(text);
  } catch {
    // 3X-UI returned HTML (likely a redirect to login page) → wrong credentials or path
    throw new Error(
      `Invalid response from server (HTTP ${res.status}). Check VITE_3XUI_BASE_PATH in .env`,
    );
  }

  if (!res.ok) {
    throw new Error(data.msg || `Login failed (HTTP ${res.status})`);
  }
  if (!data.success) throw new Error(data.msg || 'Login failed — wrong username or password');
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

export function getServerStatus() {
  return apiFetch<ServerStatus>('/panel/api/server/status');
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

export function getInbounds() {
  return apiFetch<Inbound[]>('/panel/api/inbounds/list');
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

// ---------------------------------------------------------------------------
// Local API helper — unified fetch for /local/* endpoints
// ---------------------------------------------------------------------------

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
