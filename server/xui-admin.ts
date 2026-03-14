import { randomBytes, randomUUID } from 'node:crypto';
import { IncomingHttpHeaders } from 'node:http';
import {
  buildXuiPath,
  getXuiPathCandidates,
  getXuiRequestFactory,
  getXuiTarget,
  resolveXuiRedirectPath,
  shouldSkipXuiTlsVerification,
} from './xui.js';

const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308]);
const MAX_REDIRECTS = 3;
const skipTlsVerification = shouldSkipXuiTlsVerification();
let insecureTlsWarningShown = false;

interface XuiEnvelope<T> {
  success: boolean;
  msg: string;
  obj: T;
}

export interface XuiClientStat {
  email: string;
  up: number;
  down: number;
  total: number;
  expiryTime: number;
  enable: boolean;
}

export interface XuiInbound {
  id: number;
  remark?: string;
  protocol: string;
  enable: boolean;
  port?: number;
  listen?: string;
  settings: string;
  streamSettings?: string;
  tag?: string;
  clientStats?: XuiClientStat[];
}

export interface XuiClientUsage {
  inboundId: number;
  inboundRemark: string;
  protocol: string;
  up: number;
  down: number;
  total: number;
  expiryTime: number;
  enable: boolean;
}

export interface XuiServerStatus {
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

export interface AutoProvisionedClient {
  inboundId: number;
  protocol: string;
  email: string;
  clientId: string;
  subId: string;
}

interface XuiRequestResult {
  status: number;
  body: string;
  headers: IncomingHttpHeaders;
  cookies: string[];
}

export class XuiAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XuiAdminError';
  }
}

export function normalizeSetCookie(setCookie: string[] | string | undefined): string[] {
  if (!setCookie) return [];
  return Array.isArray(setCookie) ? setCookie : [setCookie];
}

export function getCookieHeader(setCookies: string[]): string {
  return setCookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

function getXuiCredentials(): { username: string; password: string } | null {
  const username = process.env.XUI_ADMIN_USERNAME ?? '';
  const password = process.env.XUI_ADMIN_PASSWORD ?? '';
  if (!username || !password) return null;
  return { username, password };
}

function ensureConfiguredServiceAccount() {
  const enabled = (process.env.XUI_AUTO_CREATE_ON_REGISTER ?? 'false').toLowerCase() === 'true';
  if (!enabled) return null;

  const creds = getXuiCredentials();
  if (!creds) {
    throw new XuiAdminError(
      'XUI auto-provision is enabled but XUI admin credentials are missing in .env',
    );
  }

  return creds;
}

// Module-level session cache for stats fetches (TTL: 10 minutes)
let cachedStatsCookie: { cookie: string; expiresAt: number } | null = null;
const DEFAULT_STATS_CACHE_TTL_MS = 5_000;
const MIN_STATS_CACHE_TTL_MS = 1_000;
const MAX_STATS_CACHE_TTL_MS = 60_000;

interface StatsSnapshot {
  bySubId: Map<string, XuiClientUsage>;
  fetchedAt: number;
  expiresAt: number;
}

let cachedStatsSnapshot: StatsSnapshot | null = null;
let pendingStatsSnapshotPromise: Promise<StatsSnapshot> | null = null;

async function getStatsCookieHeader(username: string, password: string): Promise<string> {
  const now = Date.now();
  if (cachedStatsCookie && cachedStatsCookie.expiresAt > now) {
    return cachedStatsCookie.cookie;
  }
  const cookie = await loginWithServiceAccount(username, password);
  cachedStatsCookie = { cookie, expiresAt: now + 10 * 60 * 1000 };
  return cookie;
}

export function safeNonNegativeInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : fallback;
}

function normalizeLookupKey(value: unknown): string {
  return String(value ?? '').trim();
}

function getStatsCacheTtlMs(): number {
  const configured = Number.parseInt(process.env.XUI_STATS_CACHE_TTL_MS ?? '', 10);
  if (!Number.isFinite(configured) || configured < MIN_STATS_CACHE_TTL_MS) {
    return DEFAULT_STATS_CACHE_TTL_MS;
  }
  return Math.min(configured, MAX_STATS_CACHE_TTL_MS);
}

export function toClientUsage(
  inbound: XuiInbound,
  client: Record<string, unknown>,
  stats: XuiClientStat | null,
): XuiClientUsage {
  return {
    inboundId: inbound.id,
    inboundRemark: String(inbound.remark ?? ''),
    protocol: inbound.protocol,
    up: safeNonNegativeInt(stats?.up),
    down: safeNonNegativeInt(stats?.down),
    total: safeNonNegativeInt(stats?.total),
    expiryTime: safeNonNegativeInt(stats?.expiryTime ?? client.expiryTime),
    enable: stats?.enable === true,
  };
}

function invalidateStatsSnapshotCache() {
  cachedStatsSnapshot = null;
}

export function buildClientUsageIndex(inbounds: XuiInbound[]): Map<string, XuiClientUsage> {
  const bySubId = new Map<string, XuiClientUsage>();

  for (const inbound of inbounds) {
    const clients = parseInboundClients(inbound.settings);
    const statsByEmail = new Map<string, XuiClientStat>();
    for (const stat of inbound.clientStats ?? []) {
      const email = normalizeLookupKey(stat.email);
      if (email) statsByEmail.set(email, stat);
    }

    for (const client of clients) {
      const subId = normalizeLookupKey(client.subId);
      if (!subId || bySubId.has(subId)) continue;

      const email = normalizeLookupKey(client.email);
      const stats = email ? (statsByEmail.get(email) ?? null) : null;
      bySubId.set(subId, toClientUsage(inbound, client, stats));
    }
  }

  return bySubId;
}

async function getStatsSnapshot(
  cookieHeader: string,
  forceRefresh = false,
): Promise<{ snapshot: StatsSnapshot; fromCache: boolean }> {
  const now = Date.now();
  if (!forceRefresh && cachedStatsSnapshot && cachedStatsSnapshot.expiresAt > now) {
    return { snapshot: cachedStatsSnapshot, fromCache: true };
  }

  if (pendingStatsSnapshotPromise) {
    return { snapshot: await pendingStatsSnapshotPromise, fromCache: false };
  }

  const fetchPromise = (async () => {
    const listResp = await requestXuiJson<XuiInbound[]>(
      '/panel/api/inbounds/list',
      'GET',
      null,
      cookieHeader,
    );
    if (!listResp.success || !Array.isArray(listResp.obj)) {
      throw new XuiAdminError(listResp.msg || 'Failed to fetch inbounds from 3X-UI');
    }

    const fetchedAt = Date.now();
    const snapshot: StatsSnapshot = {
      bySubId: buildClientUsageIndex(listResp.obj),
      fetchedAt,
      expiresAt: fetchedAt + getStatsCacheTtlMs(),
    };
    cachedStatsSnapshot = snapshot;
    return snapshot;
  })();

  pendingStatsSnapshotPromise = fetchPromise;

  try {
    return { snapshot: await fetchPromise, fromCache: false };
  } finally {
    if (pendingStatsSnapshotPromise === fetchPromise) {
      pendingStatsSnapshotPromise = null;
    }
  }
}

async function requestXui(
  path: string,
  method: string,
  headers: Record<string, string>,
  body: string,
  redirectsRemaining: number,
  candidatePaths?: string[],
  candidateIndex = 0,
): Promise<XuiRequestResult> {
  const target = getXuiTarget();
  if (!target) throw new XuiAdminError('VITE_3XUI_SERVER is not configured');

  const requestFactory = getXuiRequestFactory(target.protocol);
  const candidates =
    candidatePaths ??
    getXuiPathCandidates(path).map((candidate) => buildXuiPath(target.basePath, candidate));
  const targetPath = candidates[candidateIndex];
  const upstreamOrigin = `${target.protocol}//${target.hostHeader}`;
  const upstreamReferer = `${upstreamOrigin}${buildXuiPath(target.basePath, '/panel/')}`;

  const requestHeaders: Record<string, string> = {
    Host: target.hostHeader,
    Origin: upstreamOrigin,
    Referer: upstreamReferer,
    'X-Requested-With': 'XMLHttpRequest',
    ...headers,
  };
  if (body.length > 0) requestHeaders['Content-Length'] = String(Buffer.byteLength(body));

  return new Promise<XuiRequestResult>((resolve, reject) => {
    const options: any = {
      hostname: target.hostname,
      port: target.port,
      path: targetPath,
      method,
      headers: requestHeaders,
    };
    if (target.protocol === 'https:' && skipTlsVerification) {
      options.rejectUnauthorized = false;
      if (!insecureTlsWarningShown) {
        insecureTlsWarningShown = true;
        console.warn(
          '[Prism] WARNING: XUI_TLS_INSECURE_SKIP_VERIFY=true, auto-provision TLS verification disabled.',
        );
      }
    }

    const req = requestFactory(options, async (res) => {
      const status = res.statusCode ?? 0;
      const location = typeof res.headers.location === 'string' ? res.headers.location : undefined;
      const receivedCookies = normalizeSetCookie(
        res.headers['set-cookie'] as string[] | string | undefined,
      );

      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', async () => {
        if (REDIRECT_STATUS_CODES.has(status) && location && redirectsRemaining > 0) {
          const redirected = resolveXuiRedirectPath(target, location);
          if (!redirected) {
            return reject(new XuiAdminError(`Unsafe redirect blocked: ${location}`));
          }
          try {
            const next = await requestXui(
              redirected,
              method,
              headers,
              body,
              redirectsRemaining - 1,
              [redirected],
              0,
            );
            resolve({
              ...next,
              cookies: [...receivedCookies, ...next.cookies],
            });
          } catch (err) {
            reject(err);
          }
          return;
        }

        if (status === 404 && candidateIndex + 1 < candidates.length) {
          try {
            const next = await requestXui(
              path,
              method,
              headers,
              body,
              MAX_REDIRECTS,
              candidates,
              candidateIndex + 1,
            );
            resolve({
              ...next,
              cookies: [...receivedCookies, ...next.cookies],
            });
          } catch (err) {
            reject(err);
          }
          return;
        }

        resolve({
          status,
          body: responseBody,
          headers: res.headers,
          cookies: receivedCookies,
        });
      });
    });

    req.on('error', (err) => reject(new XuiAdminError(`Failed to request 3X-UI: ${err.message}`)));
    if (body.length > 0) req.write(body);
    req.end();
  });
}

async function requestXuiJson<T>(
  path: string,
  method: string,
  payload: Record<string, unknown> | null,
  cookieHeader: string | null,
): Promise<XuiEnvelope<T>> {
  const body = payload
    ? new URLSearchParams(Object.entries(payload).map(([k, v]) => [k, String(v)])).toString()
    : '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (cookieHeader) headers.Cookie = cookieHeader;

  const response = await requestXui(path, method, headers, body, MAX_REDIRECTS);
  if (!response.body) throw new XuiAdminError(`3X-UI returned empty response for ${path}`);

  let parsed: XuiEnvelope<T>;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new XuiAdminError(
      `3X-UI returned non-JSON response for ${path} (HTTP ${response.status})`,
    );
  }
  return parsed;
}

export function parseInboundClients(settings: string): Array<Record<string, unknown>> {
  try {
    const obj = JSON.parse(settings);
    return Array.isArray(obj?.clients) ? obj.clients : [];
  } catch (error) {
    console.warn('[Prism] parseInboundClients: failed to parse inbound settings:', error);
    return [];
  }
}

export function pickInboundForAutoProvision(inbounds: XuiInbound[]): XuiInbound | null {
  if (inbounds.length === 0) return null;

  const configuredId = parseInt(process.env.XUI_AUTO_INBOUND_ID ?? '', 10);
  if (!Number.isNaN(configuredId)) {
    const configured = inbounds.find((inbound) => inbound.id === configuredId);
    if (configured) return configured;
  }

  return inbounds.find((inbound) => inbound.enable) ?? inbounds[0];
}

export function buildClientPayload(protocol: string, email: string) {
  const lowerProtocol = protocol.toLowerCase();
  const subId = randomBytes(8).toString('hex');
  const limitIp = parseInt(process.env.XUI_AUTO_CLIENT_LIMIT_IP ?? '0', 10) || 0;
  const totalGB = parseInt(process.env.XUI_AUTO_CLIENT_TOTAL_GB ?? '0', 10) || 0;
  const expiryDays = parseInt(process.env.XUI_AUTO_CLIENT_EXPIRY_DAYS ?? '0', 10) || 0;
  const expiryTime = expiryDays > 0 ? Date.now() + expiryDays * 24 * 60 * 60 * 1000 : 0;

  const common = {
    email,
    enable: true,
    limitIp,
    totalGB: totalGB > 0 ? totalGB * 1024 * 1024 * 1024 : 0,
    expiryTime,
    tgId: '',
    subId,
    comment: 'Auto-created by Prism',
  };

  if (lowerProtocol === 'trojan' || lowerProtocol === 'shadowsocks') {
    return {
      ...common,
      password: randomBytes(16).toString('hex'),
    };
  }

  return {
    ...common,
    id: randomUUID(),
    flow: '',
    alterId: 0,
  };
}

export function createUniqueEmail(username: string, existingEmails: Set<string>): string {
  if (!existingEmails.has(username)) return username;
  for (let i = 1; i <= 9999; i++) {
    const candidate = `${username}_${i}`;
    if (!existingEmails.has(candidate)) return candidate;
  }
  return `${username}_${randomBytes(2).toString('hex')}`;
}

function getProvisionedClientId(protocol: string, client: Record<string, unknown>): string {
  const lowerProtocol = protocol.toLowerCase();
  if (lowerProtocol === 'trojan') {
    return String(client.password ?? '');
  }
  if (lowerProtocol === 'shadowsocks') {
    return String(client.email ?? '');
  }
  return String(client.id ?? '');
}

async function loginWithServiceAccount(username: string, password: string): Promise<string> {
  const form = new URLSearchParams({ username, password }).toString();
  const response = await requestXui(
    '/login',
    'POST',
    {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
    },
    form,
    MAX_REDIRECTS,
  );

  let body: XuiEnvelope<null>;
  try {
    body = JSON.parse(response.body);
  } catch {
    throw new XuiAdminError(`3X-UI login returned invalid response (HTTP ${response.status})`);
  }

  if (!body.success) {
    throw new XuiAdminError(body.msg || '3X-UI login failed');
  }

  const cookieHeader = getCookieHeader(response.cookies);
  if (!cookieHeader)
    throw new XuiAdminError('3X-UI login succeeded but no session cookie was returned');
  return cookieHeader;
}

export async function provisionClientForRegisteredUser(
  username: string,
): Promise<AutoProvisionedClient | null> {
  const serviceAccount = ensureConfiguredServiceAccount();
  if (!serviceAccount) return null;

  const cookieHeader = await loginWithServiceAccount(
    serviceAccount.username,
    serviceAccount.password,
  );
  const listResp = await requestXuiJson<XuiInbound[]>(
    '/panel/api/inbounds/list',
    'GET',
    null,
    cookieHeader,
  );
  if (!listResp.success || !Array.isArray(listResp.obj)) {
    throw new XuiAdminError(listResp.msg || 'Failed to fetch inbounds from 3X-UI');
  }

  const inbound = pickInboundForAutoProvision(listResp.obj);
  if (!inbound) throw new XuiAdminError('No inbound available for auto-provision');

  const existingEmails = new Set(
    parseInboundClients(inbound.settings)
      .map((client) => String(client.email ?? ''))
      .filter(Boolean),
  );
  const email = createUniqueEmail(username, existingEmails);
  const client = buildClientPayload(inbound.protocol, email) as Record<string, unknown>;
  const clientId = getProvisionedClientId(inbound.protocol, client);
  if (!clientId) {
    throw new XuiAdminError(
      `Failed to resolve a cleanup identifier for ${inbound.protocol} client`,
    );
  }

  const addResp = await requestXuiJson<null>(
    '/panel/api/inbounds/addClient',
    'POST',
    {
      id: inbound.id,
      settings: JSON.stringify({ clients: [client] }),
    },
    cookieHeader,
  );

  if (!addResp.success) {
    throw new XuiAdminError(addResp.msg || 'Failed to add client in 3X-UI');
  }

  invalidateStatsSnapshotCache();
  return {
    inboundId: inbound.id,
    protocol: inbound.protocol,
    email,
    clientId,
    subId: String(client.subId ?? ''),
  };
}

export async function cleanupProvisionedClient(client: AutoProvisionedClient): Promise<void> {
  const creds = getXuiCredentials();
  if (!creds) {
    throw new XuiAdminError('XUI admin credentials are missing in .env');
  }

  const cookieHeader = await loginWithServiceAccount(creds.username, creds.password);
  const deleteResp = await requestXuiJson<null>(
    `/panel/api/inbounds/${client.inboundId}/delClient/${encodeURIComponent(client.clientId)}`,
    'POST',
    null,
    cookieHeader,
  );

  if (!deleteResp.success) {
    throw new XuiAdminError(deleteResp.msg || 'Failed to delete client in 3X-UI');
  }

  invalidateStatsSnapshotCache();
}

export async function autoProvisionClientForRegisteredUser(
  username: string,
): Promise<string | null> {
  const provisionedClient = await provisionClientForRegisteredUser(username);
  return provisionedClient?.subId ?? null;
}

export async function fetchClientStatsBySubId(subId: string): Promise<XuiClientUsage | null> {
  const normalizedSubId = normalizeLookupKey(subId);
  if (!normalizedSubId) return null;

  const creds = getXuiCredentials();
  if (!creds) {
    console.warn(
      '[Prism] fetchClientStatsBySubId: XUI credentials not configured, stats unavailable',
    );
    return null;
  }

  const cookieHeader = await getStatsCookieHeader(creds.username, creds.password);

  const initial = await getStatsSnapshot(cookieHeader);
  const cachedUsage = initial.snapshot.bySubId.get(normalizedSubId) ?? null;
  if (cachedUsage || !initial.fromCache) {
    return cachedUsage;
  }

  const refreshed = await getStatsSnapshot(cookieHeader, true);
  return refreshed.snapshot.bySubId.get(normalizedSubId) ?? null;
}

export async function fetchXuiInbounds(): Promise<XuiInbound[]> {
  const creds = getXuiCredentials();
  if (!creds) {
    throw new XuiAdminError('XUI admin credentials are missing in .env');
  }

  const cookieHeader = await getStatsCookieHeader(creds.username, creds.password);
  const response = await requestXuiJson<XuiInbound[]>(
    '/panel/api/inbounds/list',
    'GET',
    null,
    cookieHeader,
  );

  if (!response.success || !Array.isArray(response.obj)) {
    throw new XuiAdminError(response.msg || 'Failed to fetch inbounds from 3X-UI');
  }

  return response.obj;
}

export async function fetchServerStatusForPortal(): Promise<XuiServerStatus | null> {
  const creds = getXuiCredentials();
  if (!creds) {
    console.warn(
      '[Prism] fetchServerStatusForPortal: XUI credentials not configured, server status unavailable',
    );
    return null;
  }

  const cookieHeader = await getStatsCookieHeader(creds.username, creds.password);
  const response = await requestXuiJson<XuiServerStatus>(
    '/panel/api/server/status',
    'GET',
    null,
    cookieHeader,
  );

  if (!response.success || !response.obj) {
    throw new XuiAdminError(response.msg || 'Failed to fetch server status from 3X-UI');
  }

  return response.obj;
}
