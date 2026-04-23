/**
 * Thin client for the local subconverter sidecar.
 *
 * Subconverter (https://github.com/tindy2013/subconverter) runs as a separate
 * pm2 process on 127.0.0.1:25500 and converts a v2ray-format subscription
 * into Clash YAML / sing-box JSON / Surge config, applying a community-vetted
 * rule template (ACL4SSR Online_Full by default) so generated configs ship
 * with proper LAN/CN bypass instead of a single MATCH-all-to-PROXY rule.
 *
 * The Node app exposes /sub/_raw/:subId (loopback only) for subconverter to
 * fetch the raw base64 payload from. We just call subconverter and stream the
 * rendered output back to the client.
 */

const DEFAULT_SUBCONVERTER_URL = 'http://127.0.0.1:25500';
const DEFAULT_CONFIG_URL =
  'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full.ini';
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
    // Surge uses target=surge with a ver=4 hint encoded as part of the target value;
    // subconverter's URL parser splits on `&` inside the target string the same way
    // it would treat it as a top-level query param, so we keep it as a single token here
    // and let URLSearchParams encode it for us.
    target: 'surge',
    contentType: 'text/plain; charset=utf-8',
    filename: 'surge.conf',
    configEnvKey: 'SUBCONVERTER_CONFIG_SURGE',
  },
};

function resolveConfigUrl(format: SubFormat): string {
  const perFormat = process.env[FORMAT_DESCRIPTORS[format].configEnvKey];
  if (perFormat && perFormat.trim()) return perFormat.trim();
  const fallback = process.env.SUBCONVERTER_CONFIG_URL;
  if (fallback && fallback.trim()) return fallback.trim();
  return DEFAULT_CONFIG_URL;
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
