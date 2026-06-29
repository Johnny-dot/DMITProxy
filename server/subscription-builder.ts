/**
 * Builds subscription content (protocol links) directly from the 3X-UI admin API,
 * bypassing the unreliable built-in subscription endpoint.
 */

import {
  type XuiInbound,
  XuiAdminError,
  parseInboundClients,
  getXuiCredentials,
  loginAndListInbounds,
} from './xui-admin.js';
import { getBillingConfig } from './xui-billing.js';
import { db } from './db.js';
import { getDmitTrafficSnapshot } from './dmit-traffic-store.js';
import { computeMachineUsage } from './machine-usage.js';
import { getDmitServiceId } from './dmit-config.js';
import {
  buildSubscriptionDecorations,
  getClientTrafficBreakdown,
  getInboundClientTrafficBreakdown,
} from './subscription-usage.js';

interface StreamSettings {
  network?: string;
  security?: string;
  tlsSettings?: Record<string, unknown>;
  realitySettings?: Record<string, unknown>;
  wsSettings?: Record<string, unknown>;
  grpcSettings?: Record<string, unknown>;
  httpSettings?: Record<string, unknown>;
  httpupgradeSettings?: Record<string, unknown>;
  tcpSettings?: Record<string, unknown>;
}

function parseStreamSettings(raw: string | undefined): StreamSettings {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StreamSettings;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[subscription-builder] failed to parse streamSettings JSON: ${message}`);
    return {};
  }
}

function buildVlessLink(
  client: Record<string, unknown>,
  inbound: XuiInbound,
  stream: StreamSettings,
  address: string,
): string {
  const uuid = String(client.id ?? '');
  const port = inbound.port ?? 443;
  const name = String(client.email ?? inbound.remark ?? 'proxy');
  const params = new URLSearchParams();

  // Security
  const security = stream.security ?? 'none';
  params.set('security', security);

  if (security === 'tls' && stream.tlsSettings) {
    const tls = stream.tlsSettings;
    if (tls.serverName) params.set('sni', String(tls.serverName));
    if (tls.fingerprint) params.set('fp', String(tls.fingerprint));
    const alpn = Array.isArray(tls.alpn) ? tls.alpn.join(',') : '';
    if (alpn) params.set('alpn', alpn);
    if (tls.allowInsecure) params.set('allowInsecure', '1');
  }

  if (security === 'reality' && stream.realitySettings) {
    const reality = stream.realitySettings;
    const settings = (reality.settings ?? {}) as Record<string, unknown>;

    // SNI: settings.serverName (singular) may be empty; fall back to serverNames[] (plural, root)
    const sni =
      String(settings.serverName ?? '').trim() ||
      (Array.isArray(reality.serverNames) && reality.serverNames.length > 0
        ? String(reality.serverNames[0])
        : '');
    if (sni) params.set('sni', sni);

    // Fingerprint: always in settings
    const fp = String(settings.fingerprint ?? reality.fingerprint ?? '').trim();
    if (fp) params.set('fp', fp);

    // Public key: always in settings
    const pbk = String(settings.publicKey ?? reality.publicKey ?? '').trim();
    if (pbk) params.set('pbk', pbk);

    // Short ID: shortIds[] (plural array, root level) or settings.shortId (singular)
    const shortIds = reality.shortIds;
    const sid =
      (Array.isArray(shortIds) && shortIds.length > 0 ? String(shortIds[0]) : '') ||
      String(settings.shortId ?? '').trim();
    if (sid) params.set('sid', sid);

    // SpiderX
    const spx = String(settings.spiderX ?? reality.spiderX ?? '').trim();
    if (spx) params.set('spx', spx);
  }

  // Network / transport
  const network = stream.network ?? 'tcp';
  params.set('type', network);

  if (network === 'ws' && stream.wsSettings) {
    const ws = stream.wsSettings as Record<string, unknown>;
    if (ws.path) params.set('path', String(ws.path));
    const headers = ws.headers as Record<string, string> | undefined;
    if (headers?.Host) params.set('host', headers.Host);
  } else if (network === 'grpc' && stream.grpcSettings) {
    const grpc = stream.grpcSettings as Record<string, unknown>;
    if (grpc.serviceName) params.set('serviceName', String(grpc.serviceName));
    if (grpc.authority) params.set('authority', String(grpc.authority));
  } else if (network === 'h2' && stream.httpSettings) {
    const h2 = stream.httpSettings as Record<string, unknown>;
    if (h2.path) params.set('path', String(h2.path));
    const host = Array.isArray(h2.host) ? h2.host[0] : h2.host;
    if (host) params.set('host', String(host));
  } else if (network === 'httpupgrade' && stream.httpupgradeSettings) {
    const hu = stream.httpupgradeSettings as Record<string, unknown>;
    if (hu.path) params.set('path', String(hu.path));
    if (hu.host) params.set('host', String(hu.host));
  }

  // Flow
  const flow = String(client.flow ?? '');
  if (flow) params.set('flow', flow);

  // Encryption
  params.set('encryption', 'none');

  const fragment = encodeURIComponent(name);
  return `vless://${uuid}@${address}:${port}?${params.toString()}#${fragment}`;
}

function buildVmessLink(
  client: Record<string, unknown>,
  inbound: XuiInbound,
  stream: StreamSettings,
  address: string,
): string {
  const network = stream.network ?? 'tcp';
  const security = stream.security ?? 'none';

  const config: Record<string, unknown> = {
    v: '2',
    ps: String(client.email ?? inbound.remark ?? 'proxy'),
    add: address,
    port: inbound.port ?? 443,
    id: String(client.id ?? ''),
    aid: Number(client.alterId ?? 0),
    scy: String(client.security ?? 'auto'),
    net: network,
    type: 'none',
    tls: security === 'tls' ? 'tls' : '',
  };

  if (security === 'tls' && stream.tlsSettings) {
    const tls = stream.tlsSettings;
    if (tls.serverName) config.sni = tls.serverName;
    if (tls.fingerprint) config.fp = tls.fingerprint;
    const alpn = Array.isArray(tls.alpn) ? tls.alpn.join(',') : '';
    if (alpn) config.alpn = alpn;
  }

  if (network === 'ws' && stream.wsSettings) {
    const ws = stream.wsSettings as Record<string, unknown>;
    if (ws.path) config.path = ws.path;
    const headers = ws.headers as Record<string, string> | undefined;
    if (headers?.Host) config.host = headers.Host;
  } else if (network === 'grpc' && stream.grpcSettings) {
    const grpc = stream.grpcSettings as Record<string, unknown>;
    if (grpc.serviceName) config.path = grpc.serviceName;
  } else if (network === 'h2' && stream.httpSettings) {
    const h2 = stream.httpSettings as Record<string, unknown>;
    if (h2.path) config.path = h2.path;
    const host = Array.isArray(h2.host) ? h2.host[0] : h2.host;
    if (host) config.host = host;
  }

  return 'vmess://' + Buffer.from(JSON.stringify(config)).toString('base64');
}

function buildTrojanLink(
  client: Record<string, unknown>,
  inbound: XuiInbound,
  stream: StreamSettings,
  address: string,
): string {
  const password = String(client.password ?? '');
  const port = inbound.port ?? 443;
  const name = String(client.email ?? inbound.remark ?? 'proxy');
  const params = new URLSearchParams();

  const security = stream.security ?? 'tls';
  params.set('security', security);

  if (stream.tlsSettings) {
    const tls = stream.tlsSettings;
    if (tls.serverName) params.set('sni', String(tls.serverName));
    if (tls.fingerprint) params.set('fp', String(tls.fingerprint));
    const alpn = Array.isArray(tls.alpn) ? tls.alpn.join(',') : '';
    if (alpn) params.set('alpn', alpn);
  }

  const network = stream.network ?? 'tcp';
  params.set('type', network);

  if (network === 'ws' && stream.wsSettings) {
    const ws = stream.wsSettings as Record<string, unknown>;
    if (ws.path) params.set('path', String(ws.path));
    const headers = ws.headers as Record<string, string> | undefined;
    if (headers?.Host) params.set('host', headers.Host);
  } else if (network === 'grpc' && stream.grpcSettings) {
    const grpc = stream.grpcSettings as Record<string, unknown>;
    if (grpc.serviceName) params.set('serviceName', String(grpc.serviceName));
  }

  const fragment = encodeURIComponent(name);
  return `trojan://${password}@${address}:${port}?${params.toString()}#${fragment}`;
}

function buildShadowsocksLink(
  client: Record<string, unknown>,
  inbound: XuiInbound,
  _stream: StreamSettings,
  address: string,
): string {
  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(inbound.settings) as Record<string, unknown>;
  } catch {
    // fall through with empty settings
  }
  const method = String(settings.method ?? client.method ?? 'aes-256-gcm');
  const password = String(client.password ?? settings.password ?? '');
  const port = inbound.port ?? 443;
  const name = String(client.email ?? inbound.remark ?? 'proxy');

  const userinfo = Buffer.from(`${method}:${password}`).toString('base64');
  const fragment = encodeURIComponent(name);
  return `ss://${userinfo}@${address}:${port}#${fragment}`;
}

function buildProtocolLink(
  protocol: string,
  client: Record<string, unknown>,
  inbound: XuiInbound,
  stream: StreamSettings,
  address: string,
): string | null {
  switch (protocol) {
    case 'vless':
      return buildVlessLink(client, inbound, stream, address);
    case 'vmess':
      return buildVmessLink(client, inbound, stream, address);
    case 'trojan':
      return buildTrojanLink(client, inbound, stream, address);
    case 'shadowsocks':
      return buildShadowsocksLink(client, inbound, stream, address);
    default:
      return null;
  }
}

function encodeBase64Json(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}

function decodeBase64Json(value: string): Record<string, unknown> | null {
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function replaceLinkName(link: string, name: string): string {
  if (link.startsWith('vmess://')) {
    const encoded = link.slice('vmess://'.length);
    const config = decodeBase64Json(encoded);
    if (!config) return link;
    return `vmess://${encodeBase64Json({ ...config, ps: name })}`;
  }

  const fragmentIndex = link.indexOf('#');
  const encodedName = encodeURIComponent(name);
  if (fragmentIndex >= 0) return `${link.slice(0, fragmentIndex)}#${encodedName}`;
  return `${link}#${encodedName}`;
}

function extractLinkName(link: string): string {
  if (link.startsWith('vmess://')) {
    const encoded = link.slice('vmess://'.length);
    const config = decodeBase64Json(encoded);
    return String(config?.ps ?? '').trim();
  }

  const fragmentIndex = link.indexOf('#');
  if (fragmentIndex < 0) return '';
  try {
    return decodeURIComponent(link.slice(fragmentIndex + 1)).trim();
  } catch {
    return link.slice(fragmentIndex + 1).trim();
  }
}

function sanitizeSharedNodeName(name: string): string {
  return name
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[｜|·•]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
}

export function buildUserNodeName(client: Record<string, unknown>, inbound: XuiInbound): string {
  const raw = String(client.email ?? inbound.remark ?? '默认节点').trim() || '默认节点';
  const compact = (raw.includes('@') ? raw.split('@')[0] : raw).replace(/\s+/g, ' ').trim();
  return `用户｜${compact || '默认节点'}`;
}

export function buildDecoratedSubscriptionLinks(
  originalLink: string,
  decorations: string[],
): string[] {
  return [
    originalLink,
    ...decorations.map((name, index) =>
      replaceLinkName(addDecorationMarker(originalLink, `prism-info-${index + 1}`), name),
    ),
  ];
}

export function getExtraSubscriptionLinks(
  raw: string | undefined = getStoredExtraSubscriptionLinks() ||
    process.env.EXTRA_SUBSCRIPTION_LINKS,
): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map((link) => link.trim())
    .filter((link) => link && !link.startsWith('#'));
}

export function normalizeExtraSubscriptionLinks(links: string[]): string[] {
  return links.map((link, index) => {
    const originalName = sanitizeSharedNodeName(extractLinkName(link));
    const suffix = originalName || String(index + 1).padStart(2, '0');
    return replaceLinkName(link, `共享节点｜${suffix}`);
  });
}

function getStoredExtraSubscriptionLinks(): string {
  const row = db
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get('extraSubscriptionLinks') as { value: string } | undefined;
  return row?.value?.trim() ?? '';
}

function findClientStats(inbound: XuiInbound, client: Record<string, unknown>) {
  const email = String(client.email ?? '').trim();
  if (!email) return null;
  return (
    (inbound.clientStats ?? []).find((stats) => String(stats.email ?? '').trim() === email) ?? null
  );
}

function addDecorationMarker(link: string, marker: string): string {
  if (link.startsWith('vmess://')) {
    const encoded = link.slice('vmess://'.length);
    const config = decodeBase64Json(encoded);
    if (!config) return link;
    return `vmess://${encodeBase64Json({ ...config, prismInfo: marker })}`;
  }

  const fragmentIndex = link.indexOf('#');
  const base = fragmentIndex >= 0 ? link.slice(0, fragmentIndex) : link;
  const fragment = fragmentIndex >= 0 ? link.slice(fragmentIndex) : '';
  const join = base.includes('?') ? '&' : '?';
  return `${base}${join}prism_info=${encodeURIComponent(marker)}${fragment}`;
}

function resolveConfiguredNodeHost(): string | null {
  const raw = String(
    process.env.PUBLIC_NODE_HOST ?? process.env.VITE_PUBLIC_NODE_HOST ?? '',
  ).trim();
  if (!raw) return null;

  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname;
  } catch {
    return (
      raw
        .replace(/^\[|\]$/g, '')
        .split('/')[0]
        ?.split(':')[0]
        ?.trim() || null
    );
  }
}

export function resolveAddress(inbound: XuiInbound): string {
  const configuredNodeHost = resolveConfiguredNodeHost();
  if (configuredNodeHost) return configuredNodeHost;

  // Fall back to a non-wildcard inbound listen address, then to the admin/subscription host.
  const listen = String(inbound.listen ?? '').trim();
  if (listen && listen !== '0.0.0.0' && listen !== '::' && listen !== '') {
    return listen;
  }

  // Extract server address from VITE_3XUI_SERVER or VITE_SUB_URL
  const serverUrl = process.env.VITE_3XUI_SERVER ?? process.env.VITE_SUB_URL ?? '';
  try {
    const url = new URL(serverUrl);
    return url.hostname;
  } catch {
    return '127.0.0.1';
  }
}

/**
 * Build subscription payload (newline-separated protocol links) for a given subId
 * by querying the 3X-UI admin API directly.
 */
export async function buildSubscriptionPayload(subId: string): Promise<string> {
  const creds = getXuiCredentials();
  if (!creds) {
    throw new XuiAdminError('3X-UI admin credentials not configured');
  }

  const inbounds = await loginAndListInbounds(creds.username, creds.password);

  const dmitServiceId = getDmitServiceId();
  const dmitSnapshot = dmitServiceId != null ? getDmitTrafficSnapshot(dmitServiceId) : null;
  // One machine-level number everywhere: the same DMIT-anchored (and staleness-aware)
  // value the admin console shows, instead of the raw snapshot fields.
  const machineUsage = computeMachineUsage(inbounds, dmitSnapshot);

  const links: string[] = [];

  for (const inbound of inbounds) {
    if (!inbound.enable) continue;

    const clients = parseInboundClients(inbound.settings);
    const stream = parseStreamSettings(inbound.streamSettings);
    const address = resolveAddress(inbound);
    const protocol = String(inbound.protocol ?? '').toLowerCase();

    for (const client of clients) {
      const clientSubId = String(client.subId ?? '').trim();
      if (clientSubId !== subId) continue;
      if (client.enable === false) continue;

      const link = buildProtocolLink(protocol, client, inbound, stream, address);
      if (link) {
        const stats = findClientStats(inbound, client);
        const clientTraffic = getClientTrafficBreakdown(stats);
        const inboundTraffic = getInboundClientTrafficBreakdown(inbound);
        const decorations = buildSubscriptionDecorations({
          resetDay: getBillingConfig(inbound.id)?.billingDay ?? null,
          expiryTime: stats?.expiryTime ?? (client.expiryTime as number | undefined) ?? null,
          ownUp: clientTraffic.up,
          ownDown: clientTraffic.down,
          allClientUp: inboundTraffic.up,
          allClientDown: inboundTraffic.down,
          machineTotal: inbound.total ?? 0,
          dmitMachineUsed: machineUsage.usedBytes,
          dmitMachineTotal: machineUsage.totalBytes,
          machineSource: machineUsage.source,
        });
        links.push(
          ...buildDecoratedSubscriptionLinks(
            replaceLinkName(link, buildUserNodeName(client, inbound)),
            decorations,
          ),
        );
      }
    }
  }

  if (links.length === 0) {
    throw new XuiAdminError(`No active client found for subscription ID: ${subId}`);
  }

  links.push(...normalizeExtraSubscriptionLinks(getExtraSubscriptionLinks()));

  return links.join('\n');
}
