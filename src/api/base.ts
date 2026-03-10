export interface ApiResponse<T> {
  success: boolean;
  msg: string;
  obj: T;
}

export type ResponseBody =
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

export function extractErrorMessage(data: ResponseBody | null, fallback: string) {
  if (data && 'error' in data && typeof data.error === 'string' && data.error.trim()) {
    return data.error;
  }
  if (data && 'msg' in data && typeof data.msg === 'string' && data.msg.trim()) {
    return data.msg;
  }
  return fallback;
}

const BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/+$/, '');

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
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

export async function localFetch<T>(
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
    throw new ApiError(res.status, msg);
  }
  return data as T;
}
