import { type ClashValue, parseClashProxyLinks } from './clash-inline.js';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export class SingboxInlineRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SingboxInlineRenderError';
  }
}

function asString(value: ClashValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: ClashValue | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asRecord(value: ClashValue | undefined): Record<string, ClashValue> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, ClashValue>)
    : {};
}

function buildTls(proxy: Record<string, ClashValue>): Record<string, JsonValue> | undefined {
  if (proxy.tls !== true) return undefined;

  const tls: Record<string, JsonValue> = {
    enabled: true,
  };

  const serverName = asString(proxy.servername);
  if (serverName) tls.server_name = serverName;

  const fingerprint = asString(proxy['client-fingerprint']);
  if (fingerprint) {
    tls.utls = {
      enabled: true,
      fingerprint,
    };
  }

  const reality = asRecord(proxy['reality-opts']);
  const publicKey = asString(reality['public-key']);
  const shortId = asString(reality['short-id']);
  if (publicKey) {
    tls.reality = {
      enabled: true,
      public_key: publicKey,
      ...(shortId ? { short_id: shortId } : {}),
    };
  }

  return tls;
}

function buildTransport(proxy: Record<string, ClashValue>): Record<string, JsonValue> | undefined {
  const network = asString(proxy.network);
  if (!network) return undefined;

  if (network === 'ws') {
    const wsOpts = asRecord(proxy['ws-opts']);
    const headers = asRecord(wsOpts.headers);
    const host = asString(headers.Host);
    return {
      type: 'ws',
      ...(asString(wsOpts.path) ? { path: asString(wsOpts.path) } : {}),
      ...(host ? { headers: { Host: host } } : {}),
    };
  }

  if (network === 'grpc') {
    const grpcOpts = asRecord(proxy['grpc-opts']);
    return {
      type: 'grpc',
      ...(asString(grpcOpts['grpc-service-name'])
        ? { service_name: asString(grpcOpts['grpc-service-name']) }
        : {}),
    };
  }

  if (network === 'http') {
    const httpOpts = asRecord(proxy['http-opts']);
    const paths = Array.isArray(httpOpts.path) ? httpOpts.path : [];
    const firstPath = paths.find((item) => typeof item === 'string');
    return {
      type: 'http',
      ...(typeof firstPath === 'string' ? { path: firstPath } : {}),
    };
  }

  return undefined;
}

function withOptional(
  value: Record<string, JsonValue>,
  key: string,
  nested: JsonValue | undefined,
): Record<string, JsonValue> {
  if (nested !== undefined) value[key] = nested;
  return value;
}

function proxyToOutbound(proxy: Record<string, ClashValue>): Record<string, JsonValue> | null {
  const tag = asString(proxy.name);
  const type = asString(proxy.type);
  const server = asString(proxy.server);
  if (!tag || !type || !server) return null;

  const base: Record<string, JsonValue> = {
    tag,
    server,
    server_port: asNumber(proxy.port, 443),
  };
  const tls = buildTls(proxy);
  const transport = buildTransport(proxy);

  if (type === 'vless') {
    const outbound: Record<string, JsonValue> = {
      type: 'vless',
      ...base,
      uuid: asString(proxy.uuid),
    };
    const flow = asString(proxy.flow);
    if (flow) outbound.flow = flow;
    return withOptional(withOptional(outbound, 'tls', tls), 'transport', transport);
  }

  if (type === 'vmess') {
    const outbound: Record<string, JsonValue> = {
      type: 'vmess',
      ...base,
      uuid: asString(proxy.uuid),
      security: asString(proxy.cipher) || 'auto',
      alter_id: asNumber(proxy.alterId, 0),
    };
    return withOptional(withOptional(outbound, 'tls', tls), 'transport', transport);
  }

  if (type === 'trojan') {
    const outbound: Record<string, JsonValue> = {
      type: 'trojan',
      ...base,
      password: asString(proxy.password),
    };
    return withOptional(withOptional(outbound, 'tls', tls), 'transport', transport);
  }

  if (type === 'ss') {
    return {
      type: 'shadowsocks',
      ...base,
      method: asString(proxy.cipher),
      password: asString(proxy.password),
    };
  }

  return null;
}

export function renderSingboxInlineSubscription(payload: string): string {
  const outbounds = parseClashProxyLinks(payload)
    .map(proxyToOutbound)
    .filter((outbound): outbound is Record<string, JsonValue> => Boolean(outbound));

  if (outbounds.length === 0) {
    throw new SingboxInlineRenderError('No sing-box-compatible proxy nodes were found.');
  }

  const outboundTags = outbounds.map((outbound) => String(outbound.tag));
  const config: Record<string, JsonValue> = {
    log: {
      level: 'info',
    },
    outbounds: [
      {
        type: 'selector',
        tag: 'PROXY',
        outbounds: outboundTags,
      },
      ...outbounds,
      {
        type: 'direct',
        tag: 'DIRECT',
      },
      {
        type: 'block',
        tag: 'REJECT',
      },
    ],
    route: {
      final: 'PROXY',
      auto_detect_interface: true,
    },
  };

  return `${JSON.stringify(config, null, 2)}\n`;
}
