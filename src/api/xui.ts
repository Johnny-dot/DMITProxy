import { apiFetch, localFetch, extractErrorMessage, ApiError } from './base';
import type { ResponseBody } from './base';

export function isXuiConfigured() {
  return Boolean((import.meta.env.VITE_3XUI_SERVER ?? '').trim());
}

export interface AuthSessionHint {
  hasAdminCookie: boolean;
  hasUserSessionCookie: boolean;
}

interface XuiApiEnvelope<T> {
  success?: boolean;
  msg?: string;
  obj?: T;
  error?: string;
  detail?: string;
}

export async function getAuthSessionHint(): Promise<AuthSessionHint> {
  const data = await localFetch<{ hasAdminCookie?: boolean; hasUserSessionCookie?: boolean }>(
    '/local/auth/admin-session-hint',
    {
      fallbackError: 'Failed to check auth session hint',
    },
  );
  return {
    hasAdminCookie: data.hasAdminCookie === true,
    hasUserSessionCookie: data.hasUserSessionCookie === true,
  };
}

export async function hasXuiAdminSessionHint() {
  const data = await getAuthSessionHint();
  return data.hasAdminCookie;
}

export async function login(username: string, password: string) {
  const BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/+$/, '');
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
  const BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/+$/, '');
  await fetch(`${BASE}/logout`, { method: 'POST', credentials: 'include' });
}

async function apiFormFetch<T>(
  path: string,
  formData: Record<string, string>,
  fallbackError: string,
): Promise<T> {
  const BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/+$/, '');
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(formData).toString(),
  });

  if (res.status === 401 || res.redirected) {
    throw new ApiError(401, 'Unauthorized');
  }

  const text = await res.text();
  let data: XuiApiEnvelope<T> | null = null;
  try {
    data = text ? (JSON.parse(text) as XuiApiEnvelope<T>) : null;
  } catch {
    throw new Error(`Invalid response from upstream API (HTTP ${res.status}) for ${path}`);
  }

  if (!res.ok) {
    throw new ApiError(res.status, extractErrorMessage(data, fallbackError));
  }

  if (!data || typeof data !== 'object' || data.success !== true) {
    throw new Error(extractErrorMessage(data, fallbackError));
  }

  return (data.obj ?? null) as T;
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

function xuiPostHeaders() {
  return { 'Content-Type': 'application/x-www-form-urlencoded' };
}

export function getInboundLastOnline(options?: RequestInit) {
  return apiFetch<Record<string, number>>('/panel/api/inbounds/lastOnline', {
    method: 'POST',
    headers: xuiPostHeaders(),
    ...options,
  });
}

export async function getInboundClientIps(email: string, options?: RequestInit) {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    throw new Error('Missing client email');
  }
  return apiFetch<unknown>(`/panel/api/inbounds/clientIps/${encodeURIComponent(normalizedEmail)}`, {
    method: 'POST',
    headers: xuiPostHeaders(),
    ...options,
  });
}

export async function resetInboundClientTraffic(inboundId: number, email: string) {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    throw new Error('Missing client email');
  }
  return apiFetch<null>(
    `/panel/api/inbounds/${inboundId}/resetClientTraffic/${encodeURIComponent(normalizedEmail)}`,
    {
      method: 'POST',
      headers: xuiPostHeaders(),
    },
  );
}

export interface UpdateInboundClientInput {
  inboundId: number;
  clientId: string;
  client: Record<string, unknown>;
}

export async function updateInboundClient({
  inboundId,
  clientId,
  client,
}: UpdateInboundClientInput) {
  const normalizedClientId = clientId.trim();
  if (!normalizedClientId) {
    throw new Error('Missing client id');
  }

  return apiFormFetch<null>(
    `/panel/api/inbounds/updateClient/${encodeURIComponent(normalizedClientId)}`,
    {
      id: String(inboundId),
      settings: JSON.stringify({ clients: [client] }),
    },
    'Failed to update client',
  );
}
