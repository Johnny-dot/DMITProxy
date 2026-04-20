import type { ProxyProbeEndpoint } from './subscription-probe-target.js';

/**
 * Surge does NOT support VLESS or Reality protocols.
 * Supported: VMess, Trojan, Shadowsocks.
 * VLESS nodes are silently skipped.
 */

function escapeValue(value: string): string {
  // Surge values with commas or special chars should be safe as-is in key=value pairs
  return value;
}

// Surge config is line-based with comma-separated params. A node name containing
// a newline, comma, or '=' would break out of its line and inject arbitrary
// directives into the rendered config. Strip those characters defensively even
// though names normally come from 3X-UI admins.
function sanitizeNodeName(value: string): string {
  return (
    value
      .replace(/[\r\n,=]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'proxy'
  );
}

function buildProxyLine(node: ProxyProbeEndpoint): string | null {
  switch (node.protocol) {
    case 'vmess':
      return buildVmessLine(node);
    case 'trojan':
      return buildTrojanLine(node);
    case 'shadowsocks':
      return buildShadowsocksLine(node);
    case 'vless':
      // Surge does not support VLESS
      return null;
    default:
      return null;
  }
}

function appendTlsParams(params: string[], node: ProxyProbeEndpoint) {
  if (node.security === 'tls') {
    params.push('tls=true');
    if (node.sni) params.push(`sni=${escapeValue(node.sni)}`);
    if (node.allowInsecure) params.push('skip-cert-verify=true');
  }
}

function appendTransportParams(params: string[], node: ProxyProbeEndpoint) {
  if (node.network === 'ws') {
    params.push('ws=true');
    if (node.path) params.push(`ws-path=${escapeValue(node.path)}`);
    if (node.hostHeader) params.push(`ws-headers=Host:${escapeValue(node.hostHeader)}`);
  }
}

function buildVmessLine(node: ProxyProbeEndpoint): string {
  const params: string[] = [`username=${node.id ?? ''}`];

  // VMess encryption
  if (node.encryption && node.encryption !== 'auto') {
    params.push(`encrypt-method=${node.encryption}`);
  }

  appendTlsParams(params, node);
  appendTransportParams(params, node);
  params.push('udp-relay=true');

  return `${sanitizeNodeName(node.name)} = vmess, ${node.address}, ${node.port}, ${params.join(', ')}`;
}

function buildTrojanLine(node: ProxyProbeEndpoint): string {
  const params: string[] = [`password=${node.password ?? ''}`];

  if (node.sni) params.push(`sni=${escapeValue(node.sni)}`);
  if (node.allowInsecure) params.push('skip-cert-verify=true');

  appendTransportParams(params, node);
  params.push('udp-relay=true');

  return `${sanitizeNodeName(node.name)} = trojan, ${node.address}, ${node.port}, ${params.join(', ')}`;
}

function buildShadowsocksLine(node: ProxyProbeEndpoint): string {
  const params: string[] = [
    `encrypt-method=${node.method ?? 'aes-256-gcm'}`,
    `password=${node.password ?? ''}`,
  ];

  params.push('udp-relay=true');

  return `${sanitizeNodeName(node.name)} = ss, ${node.address}, ${node.port}, ${params.join(', ')}`;
}

export function convertToSurgeConfig(nodes: ProxyProbeEndpoint[]): string {
  const proxyLines = nodes.map(buildProxyLine).filter((line): line is string => line !== null);
  if (proxyLines.length === 0) return '';

  const proxyNames = nodes
    .filter((n) => n.protocol !== 'vless')
    .map((n) => sanitizeNodeName(n.name));

  const lines: string[] = [
    '#!MANAGED-CONFIG',
    '',
    '[General]',
    'loglevel = notify',
    '',
    '[Proxy]',
    'DIRECT = direct',
    ...proxyLines,
    '',
    '[Proxy Group]',
    `Proxy = select, ${proxyNames.join(', ')}`,
    '',
    '[Rule]',
    'FINAL,Proxy',
    '',
  ];

  return lines.join('\n');
}
