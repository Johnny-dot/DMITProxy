import type { ClientRequest, IncomingHttpHeaders, IncomingMessage } from 'node:http';
import {
  buildXuiPath,
  getXuiPathCandidates,
  getXuiRequestFactory,
  resolveXuiRedirectPath,
  shouldSkipXuiTlsVerification,
  type XuiTarget,
} from './xui.js';

export class XuiTransportError extends Error {
  constructor(
    public code: 'timeout' | 'aborted' | 'network' | 'response-too-large' | 'redirect',
    message: string,
  ) {
    super(message);
    this.name = 'XuiTransportError';
  }
}

export interface XuiTransportResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
  cookies: string[];
  redirectedToLogin: boolean;
}

interface RequestOptions {
  target: XuiTarget;
  path: string;
  method?: string;
  headers?: Record<string, string | string[]>;
  body?: string | Buffer;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export function stripHopByHopHeaders<T extends Record<string, unknown>>(input: T): T {
  const headers = { ...input };
  const blocked = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
  ]);
  for (const [name, value] of Object.entries(input)) {
    if (name.toLowerCase() === 'connection')
      for (const token of String(value).split(',')) blocked.add(token.trim().toLowerCase());
  }
  for (const name of Object.keys(headers))
    if (blocked.has(name.toLowerCase())) delete headers[name];
  return headers;
}

let warnedInsecureTls = false;

export function getXuiRequestTimeoutMs(): number {
  const value = Number(process.env.XUI_REQUEST_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? Math.max(100, Math.min(value, 120_000)) : 15_000;
}

function getResponseLimit(): number {
  const mb = Number(process.env.XUI_MAX_RESPONSE_MB);
  return (Number.isFinite(mb) && mb > 0 ? Math.max(1, Math.min(mb, 128)) : 16) * 1024 * 1024;
}

function requestOnce(
  options: RequestOptions & { deadline: number },
): Promise<Omit<XuiTransportResponse, 'redirectedToLogin'>> {
  return new Promise((resolve, reject) => {
    let request: ClientRequest | undefined;
    let response: IncomingMessage | undefined;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    };
    const fail = (error: XuiTransportError) => {
      if (settled) return;
      settled = true;
      cleanup();
      response?.destroy();
      request?.destroy();
      reject(error);
    };
    const abort = () => fail(new XuiTransportError('aborted', '3X-UI request cancelled'));
    const remaining = options.deadline - Date.now();
    if (options.signal?.aborted) {
      abort();
      return;
    }
    if (remaining <= 0) {
      fail(new XuiTransportError('timeout', '3X-UI request timed out'));
      return;
    }
    timer = setTimeout(
      () => fail(new XuiTransportError('timeout', '3X-UI request timed out')),
      remaining,
    );
    options.signal?.addEventListener('abort', abort, { once: true });
    const maxBytes = options.maxResponseBytes ?? getResponseLimit();
    const headers = stripHopByHopHeaders({ ...options.headers });
    delete headers['content-length'];
    delete headers['Content-Length'];
    delete headers['transfer-encoding'];
    if (options.body?.length) headers['content-length'] = String(Buffer.byteLength(options.body));
    if (
      options.target.protocol === 'https:' &&
      shouldSkipXuiTlsVerification() &&
      !warnedInsecureTls
    ) {
      warnedInsecureTls = true;
      console.warn(
        '[Prism] XUI_TLS_INSECURE_SKIP_VERIFY=true: upstream TLS verification is disabled.',
      );
    }
    try {
      request = getXuiRequestFactory(options.target.protocol)(
        {
          hostname: options.target.hostname,
          port: options.target.port,
          path: options.path,
          method: options.method ?? 'GET',
          headers,
          ...(options.target.protocol === 'https:'
            ? { rejectUnauthorized: !shouldSkipXuiTlsVerification() }
            : {}),
        },
        (incoming) => {
          response = incoming;
          if (settled) {
            incoming.destroy();
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          incoming.on('data', (chunk) => {
            if (settled) return;
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buffer.length;
            if (size > maxBytes) {
              fail(
                new XuiTransportError(
                  'response-too-large',
                  '3X-UI response exceeds the configured limit',
                ),
              );
              return;
            }
            chunks.push(buffer);
          });
          incoming.once('aborted', () =>
            fail(new XuiTransportError('network', '3X-UI response was interrupted')),
          );
          incoming.once('error', () =>
            fail(new XuiTransportError('network', '3X-UI response failed')),
          );
          incoming.once('end', () => {
            if (settled) return;
            settled = true;
            cleanup();
            const cookies = incoming.headers['set-cookie'];
            resolve({
              status: incoming.statusCode ?? 502,
              headers: incoming.headers,
              body: Buffer.concat(chunks),
              cookies: cookies ? (Array.isArray(cookies) ? cookies : [cookies]) : [],
            });
          });
        },
      );
      request.once('error', () => fail(new XuiTransportError('network', 'Failed to reach 3X-UI')));
      if (options.body?.length) request.write(options.body);
      request.end();
    } catch {
      fail(new XuiTransportError('network', 'Failed to start 3X-UI request'));
    }
  });
}

/** One deadline covers connection, complete response bodies, redirects and path fallback. */
export async function requestXuiTransport(options: RequestOptions): Promise<XuiTransportResponse> {
  const deadline = Date.now() + (options.timeoutMs ?? getXuiRequestTimeoutMs());
  const candidates = getXuiPathCandidates(options.path).map((p) =>
    buildXuiPath(options.target.basePath, p),
  );
  let candidateIndex = 0;
  let currentPath = candidates[0];
  let redirects = 0;
  let redirectedToLogin = false;
  let method = options.method ?? 'GET';
  let body = options.body;
  const headers = { ...options.headers };
  const cookies: string[] = [];
  while (true) {
    const result = await requestOnce({
      ...options,
      method,
      body,
      headers,
      path: currentPath,
      deadline,
    });
    cookies.push(...result.cookies);
    const location = result.headers.location;
    if ([301, 302, 303, 307, 308].includes(result.status) && location) {
      if (++redirects > 3) throw new XuiTransportError('redirect', 'Too many 3X-UI redirects');
      const redirected = resolveXuiRedirectPath(options.target, location);
      if (!redirected) throw new XuiTransportError('redirect', 'Unsafe 3X-UI redirect blocked');
      const pathname = redirected.split('?')[0].replace(/\/+$/, '');
      redirectedToLogin ||= /\/login$/i.test(pathname) || pathname === options.target.basePath;
      if (result.status === 303 || ([301, 302].includes(result.status) && method === 'POST')) {
        method = 'GET';
        body = undefined;
      }
      const cookieMap = new Map(
        String(headers.cookie ?? headers.Cookie ?? '')
          .split(';')
          .filter(Boolean)
          .map((part) => {
            const at = part.indexOf('=');
            return [part.slice(0, at).trim(), part.slice(at + 1)];
          }),
      );
      for (const cookie of result.cookies) {
        const pair = cookie.split(';')[0];
        const at = pair.indexOf('=');
        if (at > 0) cookieMap.set(pair.slice(0, at), pair.slice(at + 1));
      }
      delete headers.Cookie;
      if (cookieMap.size)
        headers.cookie = [...cookieMap].map(([key, value]) => `${key}=${value}`).join('; ');
      currentPath = redirected;
      const index = candidates.indexOf(redirected);
      if (index >= 0) candidateIndex = index;
      continue;
    }
    if (result.status === 404 && candidateIndex + 1 < candidates.length) {
      currentPath = candidates[++candidateIndex];
      continue;
    }
    return { ...result, cookies, redirectedToLogin };
  }
}
