import { Agent } from 'undici';
import type { XuiInbound } from './xui-admin.js';

export type ProxyProbeProtocol = 'vless' | 'vmess' | 'trojan' | 'shadowsocks';
export type ProxyProbeSecurity = 'none' | 'tls' | 'reality';

export interface ProxyProbeEndpoint {
  protocol: ProxyProbeProtocol;
  name: string;
  address: string;
  port: number;
  raw: string;
  security: ProxyProbeSecurity;
  network: string;
  id?: string;
  password?: string;
  method?: string;
  encryption?: string;
  flow?: string;
  alterId?: number;
  hostHeader?: string;
  path?: string;
  serviceName?: string;
  authority?: string;
  sni?: string;
  fingerprint?: string;
  alpn: string[];
  publicKey?: string;
  shortId?: string;
  spiderX?: string;
  allowInsecure: boolean;
  headerType?: string;
}

const SUPPORTED_URI_PREFIXES = ['vless://', 'vmess://', 'trojan://', 'ss://'] as const;
const SUBSCRIPTION_FETCH_TIMEOUT_MS = 10_000;

function shouldSkipSubTlsVerification(): boolean {
  const value = String(process.env.XUI_TLS_INSECURE_SKIP_VERIFY ?? '')
    .trim()
    .toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

const insecureDispatcher = new Agent({ connect: { rejectUnauthorized: false } });

function normalizeBase64(value: string) {
  const trimmed = value.trim().replace(/\s+/g, '');
  const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  return padding === 0 ? normalized : normalized.padEnd(normalized.length + (4 - padding), '=');
}

function decodeBase64ToText(value: string) {
  return Buffer.from(normalizeBase64(value), 'base64').toString('utf8');
}

function splitCsv(value: string | null | undefined) {
  return String(value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function isTruthyFlag(value: string | null | undefined) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function decodeFragment(hash: string) {
  if (!hash) return '';
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function parsePort(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

function buildSubscriptionUrl(subId: string, format: 'universal' = 'universal') {
  const token = encodeURIComponent(subId.trim());
  if (!token) return '';

  const base = String(process.env.VITE_SUB_URL ?? '').replace(/\/+$/, '');
  const template = String(process.env.VITE_SUB_URL_TEMPLATE ?? '').trim();

  let url = '';
  if (template.includes('{subId}')) {
    url = template.replace('{subId}', token);
  } else if (base) {
    url = `${base}/sub/${token}`;
  }

  if (!url) return '';
  if (format === 'universal') return url;
  return url;
}

export interface SubscriptionPayloadResult {
  text: string;
  userinfo: string;
}

export async function fetchSubscriptionPayload(subId: string): Promise<string>;
export async function fetchSubscriptionPayload(
  subId: string,
  options: { includeHeaders: true },
): Promise<SubscriptionPayloadResult>;
export async function fetchSubscriptionPayload(
  subId: string,
  options?: { includeHeaders?: boolean },
): Promise<string | SubscriptionPayloadResult> {
  const url = buildSubscriptionUrl(subId, 'universal');
  if (!url) {
    throw new Error(
      'Subscription URL is not configured. Set VITE_SUB_URL or VITE_SUB_URL_TEMPLATE.',
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUBSCRIPTION_FETCH_TIMEOUT_MS);
  try {
    const fetchOptions: RequestInit & { dispatcher?: Agent } = {
      headers: { accept: 'text/plain,*/*' },
      signal: controller.signal,
    };
    if (url.startsWith('https:') && shouldSkipSubTlsVerification()) {
      fetchOptions.dispatcher = insecureDispatcher;
    }
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`Subscription endpoint returned HTTP ${response.status}.`);
    }
    const text = await response.text();
    if (options?.includeHeaders) {
      return {
        text,
        userinfo: response.headers.get('subscription-userinfo') ?? '',
      };
    }
    return text;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Subscription request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function decodeSubscriptionPayload(payload: string) {
  const trimmed = payload.trim();
  if (!trimmed) return '';
  if (SUPPORTED_URI_PREFIXES.some((prefix) => trimmed.includes(prefix))) {
    return trimmed;
  }

  try {
    const decoded = decodeBase64ToText(trimmed).trim();
    if (SUPPORTED_URI_PREFIXES.some((prefix) => decoded.includes(prefix))) {
      return decoded;
    }
  } catch {
    // Keep the original payload when it is not base64 encoded.
  }

  return trimmed;
}

function parseVlessOrTrojan(raw: string, protocol: 'vless' | 'trojan'): ProxyProbeEndpoint {
  const parsed = new URL(raw);
  const params = parsed.searchParams;
  const securityValue = params.get('security');
  const security: ProxyProbeSecurity =
    securityValue === 'tls' || securityValue === 'reality' ? securityValue : 'none';
  const network = params.get('type') || 'tcp';
  const path = params.get('path') || undefined;
  const serviceName = params.get('serviceName') || undefined;
  const authority = params.get('authority') || undefined;
  const hostHeader = params.get('host') || params.get('Host') || undefined;

  return {
    protocol,
    name: decodeFragment(parsed.hash),
    address: parsed.hostname,
    port: parsePort(parsed.port),
    raw,
    security,
    network,
    id: protocol === 'vless' ? decodeURIComponent(parsed.username) : undefined,
    password: protocol === 'trojan' ? decodeURIComponent(parsed.username) : undefined,
    encryption: params.get('encryption') || (protocol === 'vless' ? 'none' : undefined),
    flow: params.get('flow') || undefined,
    hostHeader,
    path,
    serviceName,
    authority,
    sni: params.get('sni') || params.get('serverName') || undefined,
    fingerprint: params.get('fp') || params.get('fingerprint') || undefined,
    alpn: splitCsv(params.get('alpn')),
    publicKey: params.get('pbk') || params.get('publicKey') || undefined,
    shortId: params.get('sid') || params.get('shortId') || undefined,
    spiderX: params.get('spx') || params.get('spiderX') || undefined,
    allowInsecure: isTruthyFlag(params.get('allowInsecure') || params.get('insecure')),
    headerType: params.get('headerType') || undefined,
  };
}

function parseVmess(raw: string): ProxyProbeEndpoint {
  const encoded = raw.slice('vmess://'.length);
  const decoded = decodeBase64ToText(encoded);
  const data = JSON.parse(decoded) as Record<string, unknown>;
  const network = String(data.net ?? 'tcp').trim() || 'tcp';
  const path = String(data.path ?? '').trim() || undefined;
  const tls = String(data.tls ?? '')
    .trim()
    .toLowerCase();
  const security: ProxyProbeSecurity =
    tls === 'tls' || tls === 'reality' ? (tls as ProxyProbeSecurity) : 'none';

  return {
    protocol: 'vmess',
    name: String(data.ps ?? '').trim(),
    address: String(data.add ?? '').trim(),
    port: parsePort(data.port as string | number | null | undefined),
    raw,
    security,
    network,
    id: String(data.id ?? '').trim(),
    encryption: String(data.scy ?? '').trim() || 'auto',
    alterId: parsePort(data.aid as string | number | null | undefined),
    hostHeader: String(data.host ?? '').trim() || undefined,
    path,
    serviceName: network === 'grpc' ? path : undefined,
    sni: String(data.sni ?? '').trim() || undefined,
    fingerprint: String(data.fp ?? '').trim() || undefined,
    alpn: splitCsv(String(data.alpn ?? '')),
    publicKey: String(data.pbk ?? '').trim() || undefined,
    shortId: String(data.sid ?? '').trim() || undefined,
    spiderX: String(data.spx ?? '').trim() || undefined,
    allowInsecure: isTruthyFlag(String(data.allowInsecure ?? data.insecure ?? '')),
    headerType: String(data.type ?? '').trim() || undefined,
  };
}

function splitOnce(value: string, separator: string) {
  const index = value.indexOf(separator);
  if (index < 0) return [value, ''] as const;
  return [value.slice(0, index), value.slice(index + separator.length)] as const;
}

function parseHostPort(value: string) {
  const candidate = value.includes('://') ? value : `tcp://${value}`;
  const parsed = new URL(candidate);
  return {
    host: parsed.hostname,
    port: parsePort(parsed.port),
  };
}

function parseShadowsocks(raw: string): ProxyProbeEndpoint {
  const withoutScheme = raw.slice('ss://'.length);
  const [beforeHash, hashPart] = splitOnce(withoutScheme, '#');
  const [beforeQuery] = splitOnce(beforeHash, '?');

  let decoded = beforeQuery;
  if (!decoded.includes('@')) {
    decoded = decodeBase64ToText(decoded);
  }

  const [userInfo, hostPart] = splitOnce(decoded, '@');
  const credentials = userInfo.includes(':') ? userInfo : decodeBase64ToText(userInfo);
  const [method, password] = splitOnce(credentials, ':');
  const { host, port } = parseHostPort(hostPart);

  return {
    protocol: 'shadowsocks',
    name: decodeFragment(hashPart),
    address: host,
    port,
    raw,
    security: 'none',
    network: 'tcp',
    method: method.trim(),
    password: password.trim(),
    alpn: [],
    allowInsecure: false,
  };
}

export function parseSubscriptionNodes(payload: string): ProxyProbeEndpoint[] {
  const decoded = decodeSubscriptionPayload(payload);
  if (!decoded) return [];

  const nodes: ProxyProbeEndpoint[] = [];
  for (const rawLine of decoded.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    try {
      if (line.startsWith('vless://')) {
        nodes.push(parseVlessOrTrojan(line, 'vless'));
      } else if (line.startsWith('vmess://')) {
        nodes.push(parseVmess(line));
      } else if (line.startsWith('trojan://')) {
        nodes.push(parseVlessOrTrojan(line, 'trojan'));
      } else if (line.startsWith('ss://')) {
        nodes.push(parseShadowsocks(line));
      }
    } catch {
      // Ignore invalid entries and continue with the remaining nodes.
    }
  }

  return nodes.filter((node) => node.address && node.port > 0);
}

export async function fetchSubscriptionNodes(subId: string) {
  return parseSubscriptionNodes(await fetchSubscriptionPayload(subId));
}

export function pickProbeEndpointForInbound(
  nodes: ProxyProbeEndpoint[],
  inbound: Pick<XuiInbound, 'remark' | 'protocol' | 'port'>,
) {
  if (nodes.length === 0) return null;

  const protocol = String(inbound.protocol ?? '')
    .trim()
    .toLowerCase();
  const protocolMatches = nodes.filter((node) => node.protocol === protocol);
  const pool = protocolMatches.length > 0 ? protocolMatches : nodes;
  if (pool.length === 1) {
    return pool[0] ?? null;
  }

  const normalizedRemark = normalizeName(String(inbound.remark ?? ''));
  const scoredPool = pool.map((node) => {
    let score = 0;
    const normalizedNodeName = normalizeName(node.name);

    if (normalizedRemark && normalizedNodeName) {
      if (normalizedNodeName === normalizedRemark) {
        score += 100;
      } else if (
        normalizedNodeName.includes(normalizedRemark) ||
        normalizedRemark.includes(normalizedNodeName)
      ) {
        score += 70;
      }
    }

    if (typeof inbound.port === 'number' && inbound.port > 0 && inbound.port === node.port) {
      score += 35;
    }

    if (node.protocol === protocol) {
      score += 10;
    }

    return { node, score };
  });

  scoredPool.sort((left, right) => right.score - left.score);
  const best = scoredPool[0];
  const second = scoredPool[1];

  if (!best || best.score < 35) {
    return null;
  }

  if (second && second.score === best.score) {
    return null;
  }

  return best.node;
}
