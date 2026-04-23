/**
 * Thin client for the local subconverter sidecar.
 *
 * Subconverter (Aethersailor/SubConverter-Extended, a community fork built on
 * tindy2013/subconverter that integrates the mihomo parsing kernel) runs as a
 * separate pm2 process on 127.0.0.1:25500 and converts a v2ray-format
 * subscription into Clash YAML / sing-box JSON / Surge config, applying our
 * own minimal template (server/templates/dmit-default.toml, served loopback-only
 * at /sub/_template/dmit-default.toml). The template ships a single PROXY group
 * containing all nodes plus Loyalsoldier rule lists for LAN/CN bypass — we
 * deliberately avoid community templates like ACL4SSR_Online_Full because they
 * assume nodes carry region tags in their names, which ours don't.
 *
 * We need this fork (not mainline tindy2013) because mainline rejects VLESS +
 * Reality nodes — the dominant protocol from 3X-UI panels — with "No nodes
 * were found!".
 *
 * The Node app exposes /sub/_raw/:subId (loopback only) for subconverter to
 * fetch the raw base64 payload from. We just call subconverter and stream the
 * rendered output back to the client.
 */

const DEFAULT_SUBCONVERTER_URL = 'http://127.0.0.1:25500';
const DEFAULT_TEMPLATE_PATH = '/sub/_template/dmit-default.toml';
const REQUEST_TIMEOUT_MS = 30_000;

export type SubFormat = 'clash' | 'singbox' | 'surge';

export interface SubconvertOptions {
  format: SubFormat;
  rawSourceUrl: string;
}

export interface SubconvertResult {
  body: string;
  contentType: string;
  filename: string;
}

export class SubconverterError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SubconverterError';
    this.status = status;
  }
}

interface FormatDescriptor {
  target: string;
  contentType: string;
  filename: string;
  configEnvKey: string;
}

const FORMAT_DESCRIPTORS: Record<SubFormat, FormatDescriptor> = {
  clash: {
    target: 'clash',
    contentType: 'text/yaml; charset=utf-8',
    filename: 'clash-config.yaml',
    configEnvKey: 'SUBCONVERTER_CONFIG_CLASH',
  },
  singbox: {
    target: 'singbox',
    contentType: 'application/json; charset=utf-8',
    filename: 'sing-box-config.json',
    configEnvKey: 'SUBCONVERTER_CONFIG_SINGBOX',
  },
  surge: {
    target: 'surge',
    contentType: 'text/plain; charset=utf-8',
    filename: 'surge.conf',
    configEnvKey: 'SUBCONVERTER_CONFIG_SURGE',
  },
};

function defaultLocalTemplateUrl(): string {
  const port = process.env.SERVER_PORT ?? '3001';
  return `http://127.0.0.1:${port}${DEFAULT_TEMPLATE_PATH}`;
}

function resolveConfigUrl(format: SubFormat): string {
  const perFormat = process.env[FORMAT_DESCRIPTORS[format].configEnvKey];
  if (perFormat && perFormat.trim()) return perFormat.trim();
  const fallback = process.env.SUBCONVERTER_CONFIG_URL;
  if (fallback && fallback.trim()) return fallback.trim();
  return defaultLocalTemplateUrl();
}

function resolveBaseUrl(): string {
  const raw = process.env.SUBCONVERTER_URL;
  if (raw && raw.trim()) return raw.trim().replace(/\/+$/, '');
  return DEFAULT_SUBCONVERTER_URL;
}

export async function renderSubscription(opts: SubconvertOptions): Promise<SubconvertResult> {
  const descriptor = FORMAT_DESCRIPTORS[opts.format];
  const params = new URLSearchParams({
    target: descriptor.target,
    url: opts.rawSourceUrl,
    config: resolveConfigUrl(opts.format),
    // Disable subconverter's auto-emoji renaming. Otherwise it tries to guess
    // a country flag from the node name and frequently mislabels nodes as 🇨🇳
    // when the name is ambiguous (e.g. just an email).
    emoji: 'false',
    // Use mihomo-style field names (proxy-groups, etc.) in Clash output.
    new_name: 'true',
  });
  if (opts.format === 'surge') params.set('ver', '4');

  const requestUrl = `${resolveBaseUrl()}/sub?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SubconverterError(`subconverter request failed: ${message}`);
  }

  const body = await response.text();

  if (!response.ok) {
    const snippet = body.slice(0, 500);
    throw new SubconverterError(
      `subconverter returned ${response.status}: ${snippet}`,
      response.status,
    );
  }

  if (!body.trim()) {
    throw new SubconverterError('subconverter returned an empty body', response.status);
  }

  return {
    body,
    contentType: descriptor.contentType,
    filename: descriptor.filename,
  };
}
