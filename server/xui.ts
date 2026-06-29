import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

export type XuiProtocol = 'http:' | 'https:';

export interface XuiTarget {
  protocol: XuiProtocol;
  hostname: string;
  port: number;
  hostHeader: string;
  basePath: string;
}

function normalizeBasePath(basePath: string): string {
  if (!basePath) return '';
  const withLeadingSlash = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

export function buildXuiPath(basePath: string, path: string): string {
  const requestPath = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${requestPath}`;
}

export function getXuiPathCandidates(path: string): string[] {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const candidates: string[] = [];
  const add = (value: string) => {
    if (!candidates.includes(value)) candidates.push(value);
  };

  add(normalized);

  if (normalized.startsWith('/xui/')) {
    const rest = normalized.slice('/xui/'.length);

    // Newer 3X-UI APIs are under /panel/api/*
    if (rest.startsWith('inbound/')) {
      const suffix = rest.slice('inbound/'.length);
      add(`/panel/api/inbounds/${suffix}`);
    }
    add(`/panel/api/${rest}`);

    // Some deployments still expose /panel/*
    add(`/panel/${rest}`);
  }

  return candidates;
}

function getPort(protocol: string, port: string): number {
  if (port) return parseInt(port, 10);
  return protocol === 'https:' ? 443 : 80;
}

export function isPathWithinBasePath(basePath: string, pathname: string): boolean {
  if (!basePath) return true;
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function resolveXuiRedirectPath(target: XuiTarget, location: string): string | null {
  try {
    const upstreamOrigin = `${target.protocol}//${target.hostHeader}`;
    const parsed = new URL(location, upstreamOrigin);
    const sameHost = parsed.hostname.toLowerCase() === target.hostname.toLowerCase();
    const samePort = getPort(parsed.protocol, parsed.port) === target.port;
    const pathAllowed = isPathWithinBasePath(target.basePath, parsed.pathname);
    if (!sameHost || !samePort || !pathAllowed) return null;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

export function getXuiTarget(): XuiTarget | null {
  const rawServer = (process.env.VITE_3XUI_SERVER ?? '').trim();
  if (!rawServer) return null;

  const fullServer = /^[a-z]+:\/\//i.test(rawServer) ? rawServer : `http://${rawServer}`;
  const parsed = new URL(fullServer);
  const protocol: XuiProtocol = parsed.protocol === 'https:' ? 'https:' : 'http:';
  const port = parsed.port ? parseInt(parsed.port, 10) : protocol === 'https:' ? 443 : 80;

  return {
    protocol,
    hostname: parsed.hostname,
    port,
    hostHeader: parsed.host,
    basePath: normalizeBasePath(process.env.VITE_3XUI_BASE_PATH ?? ''),
  };
}

export function getXuiRequestFactory(protocol: XuiProtocol) {
  return protocol === 'https:' ? httpsRequest : httpRequest;
}

function parseBooleanEnv(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false;
  return fallback;
}

export function shouldSkipXuiTlsVerification(): boolean {
  return parseBooleanEnv(process.env.XUI_TLS_INSECURE_SKIP_VERIFY, false);
}
