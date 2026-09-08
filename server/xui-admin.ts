import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { IncomingHttpHeaders } from 'node:http';
import { buildXuiPath, getXuiTarget } from './xui.js';
import { requestXuiTransport, XuiTransportError } from './xui-transport.js';

const MAX_REDIRECTS = 3;

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
  sniffing?: string;
  tag?: string;
  up?: number;
  down?: number;
  total?: number;
  allTime?: number;
  expiryTime?: number;
  trafficReset?: string;
  lastTrafficResetTime?: number;
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

export interface XuiClientUsageSource {
  inbound: XuiInbound;
  client: Record<string, unknown>;
  clientStat: XuiClientStat | null;
  usage: XuiClientUsage;
}

export interface XuiClientTrafficUpdate {
  email: string;
  upload: number;
  download: number;
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
  redirectedToLogin?: boolean;
}

export class XuiAdminError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'XuiAdminError';
  }
}

export class XuiMutationUncertainError extends XuiAdminError {}

export function normalizeSetCookie(setCookie: string[] | string | undefined): string[] {
  if (!setCookie) return [];
  return Array.isArray(setCookie) ? setCookie : [setCookie];
}

export function getCookieHeader(setCookies: string[]): string {
  return setCookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

export function getXuiCredentials(): { username: string; password: string } | null {
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
interface ServiceSession {
  cookie: string;
  expiresAt: number;
  identity: string;
}
let cachedStatsCookie: ServiceSession | null = null;
let pendingStatsLogin: { identity: string; promise: Promise<ServiceSession> } | null = null;
const DEFAULT_STATS_CACHE_TTL_MS = 5_000;
const MIN_STATS_CACHE_TTL_MS = 1_000;
const MAX_STATS_CACHE_TTL_MS = 60_000;

interface StatsSnapshot {
  bySubId: Map<string, XuiClientUsage>;
  inbounds: XuiInbound[];
  fetchedAt: number;
  expiresAt: number;
}

let cachedStatsSnapshot: StatsSnapshot | null = null;
let pendingStatsSnapshotPromise: Promise<StatsSnapshot> | null = null;
let statsGeneration = 0;

async function getServiceSession(username: string, password: string): Promise<ServiceSession> {
  const identity = createHash('sha256')
    .update(JSON.stringify([getXuiTarget(), username, password]))
    .digest('hex');
  if (cachedStatsCookie?.identity === identity && cachedStatsCookie.expiresAt > Date.now())
    return cachedStatsCookie;
  if (pendingStatsLogin?.identity === identity) return pendingStatsLogin.promise;
  if (
    (cachedStatsCookie && cachedStatsCookie.identity !== identity) ||
    (pendingStatsLogin && pendingStatsLogin.identity !== identity)
  )
    invalidateStatsSnapshotCache();
  let pending: NonNullable<typeof pendingStatsLogin>;
  const promise = loginWithServiceAccount(username, password)
    .then((cookie) => {
      const session = { cookie, identity, expiresAt: Date.now() + 10 * 60 * 1000 };
      if (pendingStatsLogin === pending) cachedStatsCookie = session;
      return session;
    })
    .finally(() => {
      if (pendingStatsLogin === pending) pendingStatsLogin = null;
    });
  pending = { identity, promise };
  pendingStatsLogin = pending;
  return promise;
}

async function getStatsCookieHeader(username: string, password: string): Promise<string> {
  return (await getServiceSession(username, password)).cookie;
}

class XuiAuthenticationError extends XuiAdminError {}

async function withServiceRead<T>(
  username: string,
  password: string,
  read: (cookie: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const session = await getServiceSession(username, password);
    try {
      return await read(session.cookie);
    } catch (error) {
      if (!(error instanceof XuiAuthenticationError)) throw error;
      if (cachedStatsCookie === session) {
        cachedStatsCookie = null;
        invalidateStatsSnapshotCache();
      }
      if (attempt === 1) throw error;
    }
  }
  throw new XuiAdminError('3X-UI authentication failed');
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
  statsGeneration += 1;
  cachedStatsSnapshot = null;
  pendingStatsSnapshotPromise = null;
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

export function findClientUsageSource(
  inbounds: XuiInbound[],
  subId: string,
): XuiClientUsageSource | null {
  const normalizedSubId = normalizeLookupKey(subId);
  if (!normalizedSubId) return null;

  for (const inbound of inbounds) {
    const clients = parseInboundClients(inbound.settings);
    const statsByEmail = new Map<string, XuiClientStat>();
    for (const stat of inbound.clientStats ?? []) {
      const email = normalizeLookupKey(stat.email);
      if (email) statsByEmail.set(email, stat);
    }

    for (const client of clients) {
      if (normalizeLookupKey(client.subId) !== normalizedSubId) continue;

      const email = normalizeLookupKey(client.email);
      const clientStat = email ? (statsByEmail.get(email) ?? null) : null;
      return {
        inbound,
        client,
        clientStat,
        usage: toClientUsage(inbound, client, clientStat),
      };
    }
  }

  return null;
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
    const generation = statsGeneration;
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
      inbounds: listResp.obj,
      fetchedAt,
      expiresAt: fetchedAt + getStatsCacheTtlMs(),
    };
    if (generation === statsGeneration) cachedStatsSnapshot = snapshot;
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
  _redirectsRemaining: number,
): Promise<XuiRequestResult> {
  const target = getXuiTarget();
  if (!target) throw new XuiAdminError('VITE_3XUI_SERVER is not configured');
  const origin = `${target.protocol}//${target.hostHeader}`;
  try {
    const response = await requestXuiTransport({
      target,
      path,
      method,
      body,
      headers: {
        Host: target.hostHeader,
        Origin: origin,
        Referer: `${origin}${buildXuiPath(target.basePath, '/panel/')}`,
        'X-Requested-With': 'XMLHttpRequest',
        ...headers,
      },
    });
    return { ...response, body: response.body.toString('utf8') };
  } catch (error) {
    throw new XuiAdminError(error instanceof Error ? error.message : '3X-UI request failed', error);
  }
}

function parseXuiEnvelope<T>(
  response: XuiRequestResult,
  path: string,
  cookie: string | null,
): XuiEnvelope<T> {
  if (cookie && ([401, 403].includes(response.status) || response.redirectedToLogin))
    throw new XuiAuthenticationError('3X-UI session expired');
  if (response.status < 200 || response.status >= 300)
    throw new XuiAdminError(`3X-UI returned HTTP ${response.status}`);
  let parsed: XuiEnvelope<T>;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    if (cookie && String(response.headers['content-type']).includes('text/html'))
      throw new XuiAuthenticationError('3X-UI session expired');
    throw new XuiAdminError(`3X-UI returned invalid JSON (HTTP ${response.status})`);
  }
  if (!parsed || typeof parsed !== 'object') throw new XuiAdminError('Invalid 3X-UI envelope');
  if (
    cookie &&
    parsed.success === false &&
    /unauthori[sz]ed|not logged|login required|session expired|未登录|请.*登录/i.test(
      String(parsed.msg ?? ''),
    )
  )
    throw new XuiAuthenticationError('3X-UI session expired');
  return parsed;
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
  return parseXuiEnvelope<T>(response, path, cookieHeader);
}

async function requestXuiJsonBody<T>(
  path: string,
  method: string,
  payload: Record<string, unknown>,
  cookieHeader: string | null,
): Promise<XuiEnvelope<T>> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (cookieHeader) headers.Cookie = cookieHeader;

  const response = await requestXui(path, method, headers, body, MAX_REDIRECTS);
  return parseXuiEnvelope<T>(response, path, cookieHeader);
}

export function buildClientTrafficUpdatePayload(upload: unknown, download: unknown) {
  return {
    upload: safeNonNegativeInt(upload),
    download: safeNonNegativeInt(download),
  };
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
  // A fixed calendar date (e.g. the DMIT service expiry "2028-03-04") takes precedence over a
  // rolling N-days window, so every auto-provisioned client expires with the VPS rather than
  // outliving it. Falls back to N days from now, then to "never".
  const fixedExpiryRaw = (process.env.XUI_AUTO_CLIENT_EXPIRY_DATE ?? '').trim();
  const fixedExpiryMs = fixedExpiryRaw ? Date.parse(fixedExpiryRaw) : NaN;
  const expiryTime = Number.isFinite(fixedExpiryMs)
    ? fixedExpiryMs
    : expiryDays > 0
      ? Date.now() + expiryDays * 24 * 60 * 60 * 1000
      : 0;

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

export async function loginAndListInbounds(
  username: string,
  password: string,
): Promise<XuiInbound[]> {
  return withServiceRead(username, password, async (cookie) => {
    const response = await requestXuiJson<XuiInbound[]>(
      '/panel/api/inbounds/list',
      'GET',
      null,
      cookie,
    );
    if (!response.success || !Array.isArray(response.obj))
      throw new XuiAdminError(response.msg || 'Failed to fetch inbounds from 3X-UI');
    return response.obj;
  });
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

export function buildInboundAggregateTrafficResetPayload(
  inbound: XuiInbound,
): Record<string, unknown> {
  if (!Number.isInteger(inbound.id) || inbound.id <= 0) {
    throw new XuiAdminError('Cannot reset traffic for an invalid inbound id');
  }
  if (!Number.isInteger(inbound.port) || (inbound.port ?? 0) <= 0) {
    throw new XuiAdminError(`Cannot reset traffic for inbound ${inbound.id}: invalid port`);
  }
  if (!inbound.protocol) {
    throw new XuiAdminError(`Cannot reset traffic for inbound ${inbound.id}: protocol is missing`);
  }

  return {
    up: 0,
    down: 0,
    total: inbound.total ?? 0,
    remark: inbound.remark ?? '',
    enable: inbound.enable,
    expiryTime: inbound.expiryTime ?? 0,
    trafficReset: inbound.trafficReset ?? 'never',
    lastTrafficResetTime: inbound.lastTrafficResetTime ?? 0,
    listen: inbound.listen ?? '',
    port: inbound.port,
    protocol: inbound.protocol,
    settings: inbound.settings,
    streamSettings: inbound.streamSettings ?? '',
    sniffing: inbound.sniffing ?? '',
  };
}

/**
 * Reset both traffic scopes maintained by 3X-UI for one billing inbound.
 *
 * 3X-UI keeps aggregate inbound counters and per-client counters separately.
 * Its resetAllClientTraffics endpoint only resets the latter, so a billing
 * reset is complete only after both operations succeed.
 */
export interface BillingResetOptions {
  skipAggregate?: boolean;
  onBeforeWrite?: () => void;
  onAggregateReset?: () => void;
}

async function requestBillingWrite(
  path: string,
  payload: Record<string, unknown> | null,
  cookie: string,
) {
  try {
    return await requestXuiJson<null>(path, 'POST', payload, cookie);
  } catch (error) {
    if (!(error instanceof XuiAuthenticationError)) {
      throw new XuiMutationUncertainError(
        '3X-UI write outcome is unknown; inspect upstream counters before retrying',
        error,
      );
    }
    throw error;
  }
}

export async function resetInboundTrafficCounters(
  inboundId: number,
  options: BillingResetOptions = {},
): Promise<void> {
  if (!Number.isInteger(inboundId) || inboundId <= 0) {
    throw new XuiAdminError('Cannot reset traffic for an invalid inbound id');
  }

  const creds = getXuiCredentials();
  if (!creds) {
    throw new XuiAdminError('XUI admin credentials are missing in .env');
  }

  const { cookieHeader, listResp } = await withServiceRead(
    creds.username,
    creds.password,
    async (cookie) => ({
      cookieHeader: cookie,
      listResp: await requestXuiJson<XuiInbound[]>('/panel/api/inbounds/list', 'GET', null, cookie),
    }),
  );
  if (!listResp.success || !Array.isArray(listResp.obj)) {
    throw new XuiAdminError(listResp.msg || 'Failed to fetch inbounds from 3X-UI');
  }

  const inbound = listResp.obj.find((candidate) => candidate.id === inboundId);
  if (!inbound) {
    throw new XuiAdminError(`Cannot reset traffic: inbound ${inboundId} was not found`);
  }

  let aggregateReset = false;
  let clientResetAttempted = false;
  try {
    if (!options.skipAggregate) {
      const payload = buildInboundAggregateTrafficResetPayload(inbound);
      options.onBeforeWrite?.();
      const aggregateResp = await requestBillingWrite(
        `/panel/api/inbounds/update/${inboundId}`,
        payload,
        cookieHeader,
      );
      if (!aggregateResp.success) {
        throw new XuiAdminError(
          aggregateResp.msg || `Failed to reset aggregate traffic for inbound ${inboundId}`,
        );
      }
      aggregateReset = true;
      options.onAggregateReset?.();
    }

    clientResetAttempted = true;
    options.onBeforeWrite?.();
    const clientsResp = await requestBillingWrite(
      `/panel/api/inbounds/resetAllClientTraffics/${inboundId}`,
      null,
      cookieHeader,
    );
    if (!clientsResp.success) {
      throw new XuiAdminError(
        clientsResp.msg || `Failed to reset client traffic for inbound ${inboundId}`,
      );
    }
  } finally {
    // The aggregate update may have succeeded even if the client reset failed.
    // Never serve a pre-reset snapshot after either remote mutation.
    if (aggregateReset || clientResetAttempted) invalidateStatsSnapshotCache();
  }
}

export async function updateClientTrafficByEmail({
  email,
  upload,
  download,
}: XuiClientTrafficUpdate): Promise<void> {
  const normalizedEmail = normalizeLookupKey(email);
  if (!normalizedEmail) {
    throw new XuiAdminError('Missing client email');
  }

  const creds = getXuiCredentials();
  if (!creds) {
    throw new XuiAdminError('XUI admin credentials are missing in .env');
  }

  const cookieHeader = await getStatsCookieHeader(creds.username, creds.password);
  const resp = await requestXuiJsonBody<null>(
    `/panel/api/inbounds/updateClientTraffic/${encodeURIComponent(normalizedEmail)}`,
    'POST',
    buildClientTrafficUpdatePayload(upload, download),
    cookieHeader,
  );

  if (!resp.success) {
    throw new XuiAdminError(resp.msg || `Failed to update client traffic for ${normalizedEmail}`);
  }

  invalidateStatsSnapshotCache();
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

  const initial = await withServiceRead(creds.username, creds.password, (cookie) =>
    getStatsSnapshot(cookie),
  );
  const cachedUsage = initial.snapshot.bySubId.get(normalizedSubId) ?? null;
  if (cachedUsage || !initial.fromCache) {
    return cachedUsage;
  }

  const refreshed = await withServiceRead(creds.username, creds.password, (cookie) =>
    getStatsSnapshot(cookie, true),
  );
  return refreshed.snapshot.bySubId.get(normalizedSubId) ?? null;
}

export async function fetchClientUsageSourceBySubId(
  subId: string,
): Promise<XuiClientUsageSource | null> {
  const normalizedSubId = normalizeLookupKey(subId);
  if (!normalizedSubId) return null;

  const creds = getXuiCredentials();
  if (!creds) {
    console.warn(
      '[Prism] fetchClientUsageSourceBySubId: XUI credentials not configured, stats unavailable',
    );
    return null;
  }

  const initial = await withServiceRead(creds.username, creds.password, (cookie) =>
    getStatsSnapshot(cookie),
  );
  const cachedUsage = findClientUsageSource(initial.snapshot.inbounds, normalizedSubId);
  if (cachedUsage || !initial.fromCache) {
    return cachedUsage;
  }

  const refreshed = await withServiceRead(creds.username, creds.password, (cookie) =>
    getStatsSnapshot(cookie, true),
  );
  return findClientUsageSource(refreshed.snapshot.inbounds, normalizedSubId);
}

export async function fetchXuiInbounds(): Promise<XuiInbound[]> {
  const creds = getXuiCredentials();
  if (!creds) throw new XuiAdminError('XUI admin credentials are missing in .env');
  return loginAndListInbounds(creds.username, creds.password);
}

export async function fetchServerStatusForPortal(): Promise<XuiServerStatus | null> {
  const creds = getXuiCredentials();
  if (!creds) {
    console.warn(
      '[Prism] fetchServerStatusForPortal: XUI credentials not configured, server status unavailable',
    );
    return null;
  }

  const response = await withServiceRead(creds.username, creds.password, (cookie) =>
    requestXuiJson<XuiServerStatus>('/panel/api/server/status', 'GET', null, cookie),
  );

  if (!response.success || !response.obj) {
    throw new XuiAdminError(response.msg || 'Failed to fetch server status from 3X-UI');
  }

  return response.obj;
}
