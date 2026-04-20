import type { ProxyProbeEndpoint } from './subscription-probe-target.js';

interface ClashProxy {
  [key: string]: unknown;
}

function buildClashProxy(node: ProxyProbeEndpoint): ClashProxy | null {
  switch (node.protocol) {
    case 'vless':
      return buildVless(node);
    case 'vmess':
      return buildVmess(node);
    case 'trojan':
      return buildTrojan(node);
    case 'shadowsocks':
      return buildShadowsocks(node);
    default:
      return null;
  }
}

function buildVless(node: ProxyProbeEndpoint): ClashProxy {
  const proxy: ClashProxy = {
    name: node.name,
    type: 'vless',
    server: node.address,
    port: node.port,
    uuid: node.id ?? '',
    network: node.network,
    udp: true,
  };

  if (node.flow) proxy.flow = node.flow;

  if (node.security === 'tls') {
    proxy.tls = true;
    if (node.sni) proxy.servername = node.sni;
    if (node.fingerprint) proxy['client-fingerprint'] = node.fingerprint;
    if (node.alpn.length > 0) proxy.alpn = node.alpn;
    if (node.allowInsecure) proxy['skip-cert-verify'] = true;
  } else if (node.security === 'reality') {
    proxy.tls = true;
    if (node.sni) proxy.servername = node.sni;
    if (node.fingerprint) proxy['client-fingerprint'] = node.fingerprint;
    proxy['reality-opts'] = {
      'public-key': node.publicKey ?? '',
      ...(node.shortId ? { 'short-id': node.shortId } : {}),
    };
  }

  applyTransport(proxy, node);
  return proxy;
}

function buildVmess(node: ProxyProbeEndpoint): ClashProxy {
  const proxy: ClashProxy = {
    name: node.name,
    type: 'vmess',
    server: node.address,
    port: node.port,
    uuid: node.id ?? '',
    alterId: node.alterId ?? 0,
    cipher: node.encryption || 'auto',
    network: node.network,
    udp: true,
  };

  if (node.security === 'tls') {
    proxy.tls = true;
    if (node.sni) proxy.servername = node.sni;
    if (node.fingerprint) proxy['client-fingerprint'] = node.fingerprint;
    if (node.alpn.length > 0) proxy.alpn = node.alpn;
    if (node.allowInsecure) proxy['skip-cert-verify'] = true;
  }

  applyTransport(proxy, node);
  return proxy;
}

function buildTrojan(node: ProxyProbeEndpoint): ClashProxy {
  const proxy: ClashProxy = {
    name: node.name,
    type: 'trojan',
    server: node.address,
    port: node.port,
    password: node.password ?? '',
    network: node.network,
    udp: true,
  };

  if (node.security === 'tls' || node.security === 'none') {
    // Trojan defaults to TLS
    if (node.sni) proxy.sni = node.sni;
    if (node.fingerprint) proxy['client-fingerprint'] = node.fingerprint;
    if (node.alpn.length > 0) proxy.alpn = node.alpn;
    if (node.allowInsecure) proxy['skip-cert-verify'] = true;
  }
  if (node.security === 'reality') {
    proxy['reality-opts'] = {
      'public-key': node.publicKey ?? '',
      ...(node.shortId ? { 'short-id': node.shortId } : {}),
    };
    if (node.sni) proxy.sni = node.sni;
    if (node.fingerprint) proxy['client-fingerprint'] = node.fingerprint;
  }

  applyTransport(proxy, node);
  return proxy;
}

function buildShadowsocks(node: ProxyProbeEndpoint): ClashProxy {
  return {
    name: node.name,
    type: 'ss',
    server: node.address,
    port: node.port,
    cipher: node.method ?? 'aes-256-gcm',
    password: node.password ?? '',
    udp: true,
  };
}

function applyTransport(proxy: ClashProxy, node: ProxyProbeEndpoint) {
  switch (node.network) {
    case 'ws':
      proxy['ws-opts'] = {
        ...(node.path ? { path: node.path } : {}),
        ...(node.hostHeader ? { headers: { Host: node.hostHeader } } : {}),
      };
      break;
    case 'grpc':
      proxy['grpc-opts'] = {
        ...(node.serviceName ? { 'grpc-service-name': node.serviceName } : {}),
      };
      break;
    case 'h2':
      proxy['h2-opts'] = {
        ...(node.path ? { path: node.path } : {}),
        ...(node.hostHeader ? { host: [node.hostHeader] } : {}),
      };
      break;
    case 'httpupgrade':
      proxy['ws-opts'] = {
        ...(node.path ? { path: node.path } : {}),
        ...(node.hostHeader ? { headers: { Host: node.hostHeader } } : {}),
        'v2ray-http-upgrade': true,
      };
      break;
  }
}

// Minimal YAML serializer — avoids pulling in a yaml dependency for a simple structure.
function yamlValue(value: unknown, indent: number): string {
  if (typeof value === 'string') {
    // Quote if it could be misinterpreted
    if (
      value === '' ||
      value === 'true' ||
      value === 'false' ||
      value === 'null' ||
      /^\d+$/.test(value) ||
      /[:{}\[\],&*?|>!%#@`"']/.test(value) ||
      /[\r\n\t]/.test(value)
    ) {
      return JSON.stringify(value);
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return 'null';

  const pad = '  '.repeat(indent);
  const childPad = '  '.repeat(indent + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    // Inline short string arrays
    if (value.every((v) => typeof v === 'string' && v.length < 40) && value.length <= 5) {
      return `[${value.map((v) => yamlValue(v, 0)).join(', ')}]`;
    }
    return (
      '\n' + value.map((item) => `${pad}- ${yamlValue(item, indent + 1).trimStart()}`).join('\n')
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    if (entries.length === 0) return '{}';
    return (
      '\n' + entries.map(([k, v]) => `${childPad}${k}: ${yamlValue(v, indent + 1)}`).join('\n')
    );
  }

  return String(value);
}

function proxyToYaml(proxy: ClashProxy, indent: number): string {
  const pad = '  '.repeat(indent);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(proxy)) {
    if (value === undefined) continue;
    lines.push(`${pad}${key}: ${yamlValue(value, indent)}`);
  }
  return lines.join('\n');
}

export function convertToClashYaml(nodes: ProxyProbeEndpoint[]): string {
  const proxies = nodes.map(buildClashProxy).filter((p): p is ClashProxy => p !== null);
  if (proxies.length === 0) return '';

  const proxyNames = proxies.map((p) => p.name as string);

  const lines: string[] = [
    'port: 7890',
    'socks-port: 7891',
    'allow-lan: false',
    'mode: rule',
    'log-level: info',
    'external-controller: 127.0.0.1:9090',
    '',
    'proxies:',
  ];

  for (const proxy of proxies) {
    lines.push('  - ' + proxyToYaml(proxy, 2).trimStart());
  }

  lines.push('');
  lines.push('proxy-groups:');
  lines.push('  - name: PROXY');
  lines.push('    type: select');
  lines.push('    proxies:');
  for (const name of proxyNames) {
    lines.push(`      - ${yamlValue(name, 0)}`);
  }

  lines.push('');
  lines.push('rules:');
  lines.push('  - MATCH,PROXY');

  return lines.join('\n') + '\n';
}
