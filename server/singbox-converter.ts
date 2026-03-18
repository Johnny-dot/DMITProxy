import type { ProxyProbeEndpoint } from './subscription-probe-target.js';

interface SingboxOutbound {
  type: string;
  tag: string;
  server: string;
  server_port: number;
  [key: string]: unknown;
}

function buildTls(node: ProxyProbeEndpoint): Record<string, unknown> | undefined {
  if (node.security === 'none') return undefined;

  const tls: Record<string, unknown> = { enabled: true };

  if (node.sni) tls.server_name = node.sni;
  if (node.allowInsecure) tls.insecure = true;
  if (node.alpn.length > 0) tls.alpn = node.alpn;

  if (node.fingerprint) {
    tls.utls = { enabled: true, fingerprint: node.fingerprint };
  }

  if (node.security === 'reality') {
    tls.reality = {
      enabled: true,
      public_key: node.publicKey ?? '',
      ...(node.shortId ? { short_id: node.shortId } : {}),
    };
  }

  return tls;
}

function buildTransport(node: ProxyProbeEndpoint): Record<string, unknown> | undefined {
  switch (node.network) {
    case 'ws':
      return {
        type: 'ws',
        ...(node.path ? { path: node.path } : {}),
        ...(node.hostHeader ? { headers: { Host: node.hostHeader } } : {}),
      };
    case 'grpc':
      return {
        type: 'grpc',
        ...(node.serviceName ? { service_name: node.serviceName } : {}),
      };
    case 'h2':
      return {
        type: 'http',
        ...(node.path ? { path: node.path } : {}),
        ...(node.hostHeader ? { host: node.hostHeader } : {}),
      };
    case 'httpupgrade':
      return {
        type: 'httpupgrade',
        ...(node.path ? { path: node.path } : {}),
        ...(node.hostHeader ? { host: node.hostHeader } : {}),
      };
    default:
      return undefined;
  }
}

function buildOutbound(node: ProxyProbeEndpoint): SingboxOutbound | null {
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

function buildVless(node: ProxyProbeEndpoint): SingboxOutbound {
  const outbound: SingboxOutbound = {
    type: 'vless',
    tag: node.name,
    server: node.address,
    server_port: node.port,
    uuid: node.id ?? '',
    packet_encoding: 'xudp',
  };
  if (node.flow) outbound.flow = node.flow;
  const tls = buildTls(node);
  if (tls) outbound.tls = tls;
  const transport = buildTransport(node);
  if (transport) outbound.transport = transport;
  return outbound;
}

function buildVmess(node: ProxyProbeEndpoint): SingboxOutbound {
  const outbound: SingboxOutbound = {
    type: 'vmess',
    tag: node.name,
    server: node.address,
    server_port: node.port,
    uuid: node.id ?? '',
    security: node.encryption || 'auto',
    alter_id: node.alterId ?? 0,
  };
  const tls = buildTls(node);
  if (tls) outbound.tls = tls;
  const transport = buildTransport(node);
  if (transport) outbound.transport = transport;
  return outbound;
}

function buildTrojan(node: ProxyProbeEndpoint): SingboxOutbound {
  const outbound: SingboxOutbound = {
    type: 'trojan',
    tag: node.name,
    server: node.address,
    server_port: node.port,
    password: node.password ?? '',
  };
  const tls = buildTls(node);
  // Trojan defaults to TLS even if security is 'none'
  if (tls) {
    outbound.tls = tls;
  } else {
    outbound.tls = { enabled: true, ...(node.sni ? { server_name: node.sni } : {}) };
  }
  const transport = buildTransport(node);
  if (transport) outbound.transport = transport;
  return outbound;
}

function buildShadowsocks(node: ProxyProbeEndpoint): SingboxOutbound {
  return {
    type: 'shadowsocks',
    tag: node.name,
    server: node.address,
    server_port: node.port,
    method: node.method ?? 'aes-256-gcm',
    password: node.password ?? '',
  };
}

export function convertToSingboxJson(nodes: ProxyProbeEndpoint[]): string {
  const outbounds = nodes.map(buildOutbound).filter((o): o is SingboxOutbound => o !== null);
  if (outbounds.length === 0) return '';

  const tags = outbounds.map((o) => o.tag);

  const config = {
    log: { level: 'info' },
    dns: {
      servers: [
        { tag: 'google', address: 'tls://8.8.8.8' },
        { tag: 'local', address: '223.5.5.5', detour: 'direct' },
      ],
      rules: [{ outbound: 'any', server: 'local' }],
    },
    inbounds: [
      { type: 'tun', tag: 'tun-in', inet4_address: '172.19.0.1/30', auto_route: true, sniff: true },
    ],
    outbounds: [
      { type: 'selector', tag: 'proxy', outbounds: tags },
      ...outbounds,
      { type: 'direct', tag: 'direct' },
      { type: 'block', tag: 'block' },
      { type: 'dns', tag: 'dns-out' },
    ],
    route: {
      rules: [{ protocol: 'dns', outbound: 'dns-out' }],
      final: 'proxy',
    },
  };

  return JSON.stringify(config, null, 2) + '\n';
}
