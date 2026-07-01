type ClashScalar = string | number | boolean | null;
type ClashValue = ClashScalar | ClashValue[] | { [key: string]: ClashValue };

export class ClashInlineRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClashInlineRenderError';
  }
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

function decodeFragmentName(url: URL, fallback: string): string {
  if (!url.hash) return fallback;
  try {
    return decodeURIComponent(url.hash.slice(1)).trim() || fallback;
  } catch {
    return url.hash.slice(1).trim() || fallback;
  }
}

function hostname(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, '');
}

function numberPort(url: URL, fallback: number): number {
  const parsed = Number.parseInt(url.port || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function splitCsv(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

function boolParam(value: string | null): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

function addTransportOptions(node: Record<string, ClashValue>, params: URLSearchParams) {
  const network = params.get('type') || params.get('network') || 'tcp';
  if (network && network !== 'tcp') node.network = network === 'h2' ? 'http' : network;

  if (network === 'ws') {
    const wsOpts: Record<string, ClashValue> = {};
    const path = params.get('path');
    const host = params.get('host');
    if (path) wsOpts.path = path;
    if (host) wsOpts.headers = { Host: host };
    if (Object.keys(wsOpts).length > 0) node['ws-opts'] = wsOpts;
    return;
  }

  if (network === 'grpc') {
    const grpcOpts: Record<string, ClashValue> = {};
    const serviceName = params.get('serviceName');
    const authority = params.get('authority');
    if (serviceName) grpcOpts['grpc-service-name'] = serviceName;
    if (authority) grpcOpts['grpc-authority'] = authority;
    if (Object.keys(grpcOpts).length > 0) node['grpc-opts'] = grpcOpts;
    return;
  }

  if (network === 'h2' || network === 'http') {
    const httpOpts: Record<string, ClashValue> = {};
    const path = params.get('path');
    const host = params.get('host');
    if (path) httpOpts.path = [path];
    if (host) httpOpts.headers = { Host: [host] };
    if (Object.keys(httpOpts).length > 0) node['http-opts'] = httpOpts;
  }
}

function addTlsOptions(node: Record<string, ClashValue>, params: URLSearchParams) {
  const security = params.get('security') || '';
  if (security !== 'tls' && security !== 'reality') return;

  node.tls = true;

  const sni = params.get('sni');
  if (sni) node.servername = sni;

  const fingerprint = params.get('fp');
  if (fingerprint) node['client-fingerprint'] = fingerprint;

  const alpn = splitCsv(params.get('alpn'));
  if (alpn) node.alpn = alpn;

  if (boolParam(params.get('allowInsecure'))) node['skip-cert-verify'] = true;

  if (security === 'reality') {
    const realityOpts: Record<string, ClashValue> = {};
    const publicKey = params.get('pbk');
    const shortId = params.get('sid');
    const spiderX = params.get('spx');
    if (publicKey) realityOpts['public-key'] = publicKey;
    if (shortId) realityOpts['short-id'] = shortId;
    if (spiderX) realityOpts['spider-x'] = spiderX;
    if (Object.keys(realityOpts).length > 0) node['reality-opts'] = realityOpts;
  }
}

function parseVlessLink(link: string): Record<string, ClashValue> | null {
  const url = new URL(link);
  const params = url.searchParams;
  const node: Record<string, ClashValue> = {
    name: decodeFragmentName(url, 'VLESS'),
    type: 'vless',
    server: hostname(url),
    port: numberPort(url, 443),
    uuid: decodeURIComponent(url.username),
    udp: true,
  };

  const flow = params.get('flow');
  if (flow) node.flow = flow;

  addTlsOptions(node, params);
  addTransportOptions(node, params);
  return node;
}

function parseTrojanLink(link: string): Record<string, ClashValue> | null {
  const url = new URL(link);
  const params = url.searchParams;
  const node: Record<string, ClashValue> = {
    name: decodeFragmentName(url, 'Trojan'),
    type: 'trojan',
    server: hostname(url),
    port: numberPort(url, 443),
    password: decodeURIComponent(url.username),
    udp: true,
  };

  addTlsOptions(node, params);
  addTransportOptions(node, params);
  return node;
}

function parseShadowsocksUserinfo(url: URL): { cipher: string; password: string } | null {
  const username = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  if (username && password) return { cipher: username, password };

  try {
    const decoded = decodeBase64Url(username);
    const separator = decoded.indexOf(':');
    if (separator <= 0) return null;
    return {
      cipher: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function parseShadowsocksLink(link: string): Record<string, ClashValue> | null {
  const url = new URL(link);
  const userinfo = parseShadowsocksUserinfo(url);
  if (!userinfo) return null;

  return {
    name: decodeFragmentName(url, 'Shadowsocks'),
    type: 'ss',
    server: hostname(url),
    port: numberPort(url, 443),
    cipher: userinfo.cipher,
    password: userinfo.password,
    udp: true,
  };
}

function parseVmessLink(link: string): Record<string, ClashValue> | null {
  const encoded = link.slice('vmess://'.length).trim();
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(decodeBase64Url(encoded)) as Record<string, unknown>;
  } catch {
    return null;
  }

  const params = new URLSearchParams();
  const network = String(config.net ?? 'tcp');
  params.set('type', network);
  if (config.path) params.set('path', String(config.path));
  if (config.host) params.set('host', String(config.host));
  if (config.sni) params.set('sni', String(config.sni));
  if (config.fp) params.set('fp', String(config.fp));
  if (config.alpn) params.set('alpn', String(config.alpn));
  if (String(config.tls ?? '') === 'tls') params.set('security', 'tls');

  const node: Record<string, ClashValue> = {
    name: String(config.ps ?? 'VMess'),
    type: 'vmess',
    server: String(config.add ?? ''),
    port: Number.parseInt(String(config.port ?? '443'), 10) || 443,
    uuid: String(config.id ?? ''),
    alterId: Number.parseInt(String(config.aid ?? '0'), 10) || 0,
    cipher: String(config.scy ?? 'auto'),
    udp: true,
  };

  addTlsOptions(node, params);
  addTransportOptions(node, params);
  return node;
}

function parseProtocolLink(link: string): Record<string, ClashValue> | null {
  try {
    if (link.startsWith('vless://')) return parseVlessLink(link);
    if (link.startsWith('vmess://')) return parseVmessLink(link);
    if (link.startsWith('trojan://')) return parseTrojanLink(link);
    if (link.startsWith('ss://')) return parseShadowsocksLink(link);
  } catch {
    return null;
  }
  return null;
}

function scalarToYaml(value: ClashScalar): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return JSON.stringify(value);
}

function isScalar(value: ClashValue): value is ClashScalar {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function emitYaml(value: ClashValue, indent = 0): string[] {
  const space = ' '.repeat(indent);

  if (isScalar(value)) return [`${space}${scalarToYaml(value)}`];

  if (Array.isArray(value)) {
    if (value.length === 0) return [`${space}[]`];
    const lines: string[] = [];
    for (const item of value) {
      if (isScalar(item)) {
        lines.push(`${space}- ${scalarToYaml(item)}`);
      } else if (Array.isArray(item)) {
        lines.push(`${space}-`);
        lines.push(...emitYaml(item, indent + 2));
      } else {
        const entries = Object.entries(item);
        if (entries.length === 0) {
          lines.push(`${space}- {}`);
          continue;
        }
        const [[firstKey, firstValue], ...rest] = entries;
        if (isScalar(firstValue)) {
          lines.push(`${space}- ${firstKey}: ${scalarToYaml(firstValue)}`);
        } else {
          lines.push(`${space}- ${firstKey}:`);
          lines.push(...emitYaml(firstValue, indent + 4));
        }
        for (const [key, nestedValue] of rest) {
          if (isScalar(nestedValue)) {
            lines.push(`${space}  ${key}: ${scalarToYaml(nestedValue)}`);
          } else {
            lines.push(`${space}  ${key}:`);
            lines.push(...emitYaml(nestedValue, indent + 4));
          }
        }
      }
    }
    return lines;
  }

  const lines: string[] = [];
  for (const [key, nestedValue] of Object.entries(value)) {
    if (isScalar(nestedValue)) {
      lines.push(`${space}${key}: ${scalarToYaml(nestedValue)}`);
    } else {
      lines.push(`${space}${key}:`);
      lines.push(...emitYaml(nestedValue, indent + 2));
    }
  }
  return lines;
}

export function renderClashInlineSubscription(payload: string): string {
  const proxies = payload
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseProtocolLink)
    .filter((proxy): proxy is Record<string, ClashValue> => Boolean(proxy));

  if (proxies.length === 0) {
    throw new ClashInlineRenderError('No Clash-compatible proxy nodes were found.');
  }

  const proxyNames = proxies.map((proxy) => String(proxy.name));
  const config: Record<string, ClashValue> = {
    port: 7890,
    'socks-port': 7891,
    'allow-lan': true,
    mode: 'Rule',
    'log-level': 'info',
    'external-controller': '127.0.0.1:9090',
    proxies,
    'proxy-groups': [
      {
        name: 'PROXY',
        type: 'select',
        proxies: ['DIRECT', ...proxyNames],
      },
    ],
    rules: [
      'DOMAIN-SUFFIX,local,DIRECT',
      'DOMAIN-SUFFIX,localhost,DIRECT',
      'IP-CIDR,127.0.0.0/8,DIRECT,no-resolve',
      'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
      'IP-CIDR,172.16.0.0/12,DIRECT,no-resolve',
      'IP-CIDR,192.168.0.0/16,DIRECT,no-resolve',
      'GEOIP,CN,DIRECT',
      'MATCH,PROXY',
    ],
  };

  return `${emitYaml(config).join('\n')}\n`;
}
